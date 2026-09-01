import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { acquireScopeLock, hashFile } from './managed-state.mjs';
import {
  interruptionFailpoint,
  LockError,
  runManagedTransaction,
  transactionFailpoints,
} from './transaction.mjs';

const roots = [];

test('enumerates every supported transaction interruption boundary', () => {
  assert.deepEqual(transactionFailpoints({ existingIndexes: [0, 1], outputCount: 2 }), [
    'after-lock',
    'after-parent-pin:0',
    'after-parent-pin:1',
    'after-validation',
    'before-replace',
    'after-claim:0',
    'before-install:0',
    'after-replace:0',
    'after-claim:1',
    'before-install:1',
    'after-replace:1',
    'before-manifest',
    'after-manifest-callback',
    'after-postcheck',
    'after-manifest-write',
    'after-claim-cleanup:0',
    'after-claim-cleanup:1',
    'before-journal-unlink',
  ]);
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maude-transaction-')));
  roots.push(root);
  const scopeDir = join(root, 'state', 'scope');
  const targetRoot = join(root, 'target');
  await Promise.all([
    mkdir(scopeDir, { mode: 0o700, recursive: true }),
    mkdir(targetRoot, { recursive: true }),
  ]);
  return { root, scopeDir, targetRoot };
}

test('prevalidates every staged output before replacing any target', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.json');
  const second = join(targetRoot, 'second.json');
  await writeFile(first, '{"old":1}\n');
  await writeFile(second, '{"old":2}\n');
  const firstHash = await hashFile(first);
  const secondHash = await hashFile(second);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'invalid-generation',
      outputs: [
        { contents: '{"new":1}\n', expectedHash: firstHash, path: first, validate: JSON.parse },
        { contents: '{broken', expectedHash: secondHash, path: second, validate: JSON.parse },
      ],
      scopeDir,
    }),
    /json|unexpected/i
  );

  assert.equal(await readFile(first, 'utf8'), '{"old":1}\n');
  assert.equal(await readFile(second, 'utf8'), '{"old":2}\n');
});

test('creates nested output parents after stale-stage cleanup skips missing directories', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const nested = join(targetRoot, '.agents', 'skills', 'fixture', 'references', 'guide.md');

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'nested-generation',
    outputs: [{ contents: '# Guide\n', path: nested }],
    scopeDir,
  });

  assert.equal(await readFile(nested, 'utf8'), '# Guide\n');
});

test('commits all outputs before invoking the manifest-last callback', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.md');
  const second = join(targetRoot, 'second.md');
  await writeFile(first, 'old one\n');
  await writeFile(second, 'old two\n');
  const firstHash = await hashFile(first);
  const secondHash = await hashFile(second);
  let observed;

  const result = await runManagedTransaction({
    allowRoots: [targetRoot],
    commitManifest: async (outputs) => {
      observed = [await readFile(first, 'utf8'), await readFile(second, 'utf8'), outputs.length];
    },
    generationId: 'complete-generation',
    outputs: [
      { contents: 'new one\n', expectedHash: firstHash, path: first },
      { contents: 'new two\n', expectedHash: secondHash, path: second },
    ],
    scopeDir,
  });

  assert.deepEqual(observed, ['new one\n', 'new two\n', 2]);
  assert.equal(result.outputs.length, 2);
});

test('commits writes, deletions, and adopted restorations as one manifest-last generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const written = join(targetRoot, 'written.md');
  const deleted = join(targetRoot, 'deleted.md');
  const restored = join(targetRoot, 'restored.json');
  await writeFile(deleted, 'managed deletion\n');
  await writeFile(restored, '{"managed":true}\n');
  let observed;

  const result = await runManagedTransaction({
    allowRoots: [targetRoot],
    commitManifest: async (outputs) => {
      observed = {
        deleted: await exists(deleted),
        outputs: outputs.map((output) => output.path),
        restored: await readFile(restored, 'utf8'),
        written: await readFile(written, 'utf8'),
      };
    },
    generationId: 'mixed-generation',
    outputs: [
      { contents: 'new output\n', metadata: { target: 'opencode' }, path: written },
      { expectedHash: await hashFile(deleted), operation: 'delete', path: deleted },
      {
        contents: '{"user":true}\n',
        expectedHash: await hashFile(restored),
        operation: 'restore',
        path: restored,
      },
    ],
    scopeDir,
  });

  assert.deepEqual(observed, {
    deleted: false,
    outputs: [written],
    restored: '{"user":true}\n',
    written: 'new output\n',
  });
  assert.deepEqual(
    result.outputs.map((output) => output.path),
    [written]
  );
});

test('generation CAS rejects a stale owner while the scope lock is held', async () => {
  const { scopeDir, targetRoot } = await fixture();
  let generation = 'newer';

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      expectedGenerationId: 'older',
      generationId: 'cas-generation',
      outputs: [{ contents: 'must not publish\n', path: join(targetRoot, 'target.md') }],
      readGenerationId: async () => generation,
      scopeDir,
    }),
    /generation changed concurrently/i
  );
  generation = 'older';
  await assert.rejects(lstat(join(targetRoot, 'target.md')), { code: 'ENOENT' });
});

test('rolls back every replaced output when a later replacement fails', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.md');
  const second = join(targetRoot, 'second.md');
  await writeFile(first, 'old one\n');
  await writeFile(second, 'old two\n');
  const firstHash = await hashFile(first);
  const secondHash = await hashFile(second);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint(name) {
        if (name === 'after-replace:0') throw new Error('simulated interruption');
      },
      generationId: 'interrupted-generation',
      outputs: [
        { contents: 'new one\n', expectedHash: firstHash, path: first },
        { contents: 'new two\n', expectedHash: secondHash, path: second },
      ],
      scopeDir,
    }),
    /simulated interruption/
  );

  assert.equal(await readFile(first, 'utf8'), 'old one\n');
  assert.equal(await readFile(second, 'utf8'), 'old two\n');
});

test('rolls back target replacements when manifest commit fails', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        throw new Error('manifest unavailable');
      },
      generationId: 'manifest-failure',
      isGenerationCommitted: async () => false,
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      scopeDir,
    }),
    /manifest unavailable/
  );
  assert.equal(await readFile(target, 'utf8'), 'old\n');
});

test('a manifest callback that commits then throws keeps the committed generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'commit-then-throw';
        throw new Error('post-commit callback failure');
      },
      generationId: 'commit-then-throw',
      isGenerationCommitted: async (generationId) => generationId === committedGeneration,
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      scopeDir,
    }),
    /post-commit callback failure/
  );

  assert.equal(await readFile(target, 'utf8'), 'new\n');
  await assert.rejects(lstat(join(scopeDir, 'transaction.json')), { code: 'ENOENT' });
});

test('rechecks stable sources immediately before replacement', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'source-drift',
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      recheckSources: async () => false,
      scopeDir,
    }),
    /source.*changed/i
  );
  assert.equal(await readFile(target, 'utf8'), 'old\n');
});

test('does not commit a manifest when an installed target changes before manifest commit', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);
  let manifestCommitted = false;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        manifestCommitted = true;
      },
      failpoint: async (name) => {
        if (name === 'before-manifest') await writeFile(target, 'external\n');
      },
      generationId: 'pre-manifest-edit',
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      scopeDir,
    }),
    /target changed before manifest|rollback was incomplete|concurrent edit/i
  );

  assert.equal(manifestCommitted, false);
  assert.equal(await readFile(target, 'utf8'), 'external\n');
});

test('quarantines a target changed inside the manifest callback and restores the original', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'during-manifest-edit';
        await writeFile(target, 'external\n');
      },
      generationId: 'during-manifest-edit',
      isGenerationCommitted: async (generationId) => generationId === committedGeneration,
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      scopeDir,
    }),
    /target changed after manifest|quarantined/i
  );

  assert.equal(await readFile(target, 'utf8'), 'old\n');
  const quarantineDir = join(scopeDir, 'quarantine');
  const quarantineNames = await readdir(quarantineDir);
  assert.equal(quarantineNames.length, 1);
  assert.equal((await lstat(quarantineDir)).mode & 0o077, 0);
  assert.equal((await lstat(join(quarantineDir, quarantineNames[0]))).mode & 0o077, 0);
  assert.equal(await readFile(join(quarantineDir, quarantineNames[0]), 'utf8'), 'external\n');
  const journal = JSON.parse(await readFile(join(scopeDir, 'transaction.json'), 'utf8'));
  assert.equal(journal.phase, 'quarantined');
  assert.equal((await lstat(journal.entries[0].claimPath)).isFile(), true);
});

test('recovery quarantines a poisoned new target after a committing-phase crash', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'quarantine-recovery';
        await writeFile(target, 'external-after-crash\n');
      },
      failpoint: interruptionFailpoint('after-manifest-callback'),
      generationId: 'quarantine-recovery',
      outputs: [{ contents: 'generated\n', path: target }],
      scopeDir,
    }),
    /simulated interruption/i
  );

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'blocked-by-quarantine',
      isGenerationCommitted: async (generationId) => generationId === committedGeneration,
      outputs: [{ contents: 'next\n', path: join(targetRoot, 'next.md') }],
      scopeDir,
    }),
    /quarantined/i
  );

  await assert.rejects(lstat(target), { code: 'ENOENT' });
  const quarantineDir = join(scopeDir, 'quarantine');
  const quarantineNames = await readdir(quarantineDir);
  assert.equal(quarantineNames.length, 1);
  assert.equal(
    await readFile(join(quarantineDir, quarantineNames[0]), 'utf8'),
    'external-after-crash\n'
  );
  const journal = JSON.parse(await readFile(join(scopeDir, 'transaction.json'), 'utf8'));
  assert.equal(journal.phase, 'quarantined');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'still-blocked-by-quarantine',
      outputs: [{ contents: 'later\n', path: join(targetRoot, 'later.md') }],
      scopeDir,
    }),
    /quarantined/i
  );
  assert.equal(
    await readFile(join(quarantineDir, quarantineNames[0]), 'utf8'),
    'external-after-crash\n'
  );
});

test('edits after postcheck but before transaction cleanup are quarantined as transaction races', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const existing = join(targetRoot, 'existing.md');
  const created = join(targetRoot, 'created.md');
  await writeFile(existing, 'original\n');
  const existingHash = await hashFile(existing);
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'postcheck-race';
      },
      failpoint: async (name) => {
        if (name !== 'after-postcheck') return;
        await writeFile(existing, 'attacker-existing\n');
        await writeFile(created, 'attacker-created\n');
      },
      generationId: 'postcheck-race',
      isGenerationCommitted: async (generationId) => generationId === committedGeneration,
      outputs: [
        { contents: 'managed-existing\n', expectedHash: existingHash, path: existing },
        { contents: 'managed-created\n', path: created },
      ],
      scopeDir,
    }),
    /quarantined|changed/i
  );

  assert.equal(await readFile(existing, 'utf8'), 'original\n');
  await assert.rejects(lstat(created), { code: 'ENOENT' });
  const quarantineDir = join(scopeDir, 'quarantine');
  const quarantinedBytes = await Promise.all(
    (await readdir(quarantineDir)).map((name) => readFile(join(quarantineDir, name), 'utf8'))
  );
  assert.deepEqual(quarantinedBytes.sort(), ['attacker-created\n', 'attacker-existing\n']);
  const journal = JSON.parse(await readFile(join(scopeDir, 'transaction.json'), 'utf8'));
  assert.equal(journal.phase, 'quarantined');
  assert.equal((await lstat(journal.entries[0].claimPath)).isFile(), true);
});

for (const racePoint of [
  'after-claim-cleanup:0',
  'after-claim-cleanup:1',
  'before-journal-unlink',
]) {
  test(`retains complete rollback authority through ${racePoint}`, async () => {
    const { scopeDir, targetRoot } = await fixture();
    const first = join(targetRoot, 'first.md');
    const second = join(targetRoot, 'second.md');
    await writeFile(first, 'original-first\n');
    await writeFile(second, 'original-second\n');
    const firstHash = await hashFile(first);
    const secondHash = await hashFile(second);
    let committedGeneration;

    await assert.rejects(
      runManagedTransaction({
        allowRoots: [targetRoot],
        commitManifest: async () => {
          committedGeneration = `cleanup-race-${racePoint}`;
        },
        failpoint: async (name) => {
          if (name !== racePoint) return;
          await writeFile(first, 'attacker-first\n');
          await writeFile(second, 'attacker-second\n');
        },
        generationId: `cleanup-race-${racePoint.replaceAll(':', '-')}`,
        isGenerationCommitted: async (generationId) => generationId === committedGeneration,
        outputs: [
          { contents: 'managed-first\n', expectedHash: firstHash, path: first },
          { contents: 'managed-second\n', expectedHash: secondHash, path: second },
        ],
        scopeDir,
      }),
      /quarantined|changed/i
    );

    assert.equal(await readFile(first, 'utf8'), 'original-first\n');
    assert.equal(await readFile(second, 'utf8'), 'original-second\n');
    const quarantineDir = join(scopeDir, 'quarantine');
    const quarantinedBytes = await Promise.all(
      (await readdir(quarantineDir)).map((name) => readFile(join(quarantineDir, name), 'utf8'))
    );
    assert.deepEqual(quarantinedBytes.sort(), ['attacker-first\n', 'attacker-second\n']);
    const journal = JSON.parse(await readFile(join(scopeDir, 'transaction.json'), 'utf8'));
    assert.equal(journal.phase, 'quarantined');
    assert.equal(
      journal.entries.every((entry) => entry.recoveryPath),
      true
    );
    assert.deepEqual(
      await Promise.all(journal.entries.map((entry) => readFile(entry.recoveryPath, 'utf8'))),
      ['original-first\n', 'original-second\n']
    );
    const recoveryModes = await Promise.all(
      journal.entries.map(async (entry) => (await lstat(entry.recoveryPath)).mode & 0o077)
    );
    assert.equal(
      recoveryModes.every((mode) => mode === 0),
      true
    );
  });
}

test('recovery restores every original after crashing with a retired target-parent claim', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.md');
  const second = join(targetRoot, 'second.md');
  await writeFile(first, 'original-first\n');
  await writeFile(second, 'original-second\n');
  const firstHash = await hashFile(first);
  const secondHash = await hashFile(second);
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'claim-cleanup-crash';
      },
      failpoint: interruptionFailpoint('after-claim-cleanup:0'),
      generationId: 'claim-cleanup-crash',
      outputs: [
        { contents: 'managed-first\n', expectedHash: firstHash, path: first },
        { contents: 'managed-second\n', expectedHash: secondHash, path: second },
      ],
      scopeDir,
    }),
    /simulated interruption/i
  );
  await writeFile(first, 'attacker-first\n');
  await writeFile(second, 'attacker-second\n');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'blocked-after-claim-cleanup-crash',
      isGenerationCommitted: async (generationId) => generationId === committedGeneration,
      outputs: [{ contents: 'next\n', path: join(targetRoot, 'next.md') }],
      scopeDir,
    }),
    /quarantined/i
  );

  assert.equal(await readFile(first, 'utf8'), 'original-first\n');
  assert.equal(await readFile(second, 'utf8'), 'original-second\n');
  const quarantineDir = join(scopeDir, 'quarantine');
  const quarantinedBytes = await Promise.all(
    (await readdir(quarantineDir)).map((name) => readFile(join(quarantineDir, name), 'utf8'))
  );
  assert.deepEqual(quarantinedBytes.sort(), ['attacker-first\n', 'attacker-second\n']);
});

test('rejects symlink swaps and never writes through them', async () => {
  const { root, scopeDir, targetRoot } = await fixture();
  const outside = join(root, 'outside.md');
  const target = join(targetRoot, 'target.md');
  await writeFile(outside, 'outside\n');
  await symlink(outside, target);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'symlink',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /symlink/i
  );
  assert.equal(await readFile(outside, 'utf8'), 'outside\n');
});

test('refuses an unmanaged existing target without adoption', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'user owned\n');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'collision',
      outputs: [{ contents: 'generated\n', path: target }],
      scopeDir,
    }),
    /unmanaged.*collision/i
  );
  assert.equal(await readFile(target, 'utf8'), 'user owned\n');
});

test('new-target install never overwrites a file that appears after preparation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name === 'before-install:0') await writeFile(target, 'concurrent\n');
      },
      generationId: 'new-race',
      outputs: [{ contents: 'generated\n', path: target }],
      scopeDir,
    }),
    /appeared|collision/i
  );
  assert.equal(await readFile(target, 'utf8'), 'concurrent\n');
});

test('rollback never overwrites a concurrent edit after claiming an existing target', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(target, 'old\n');
  const expectedHash = await hashFile(target);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name === 'after-claim:0') {
          await writeFile(target, 'concurrent\n');
          throw new Error('stop after concurrent edit');
        }
      },
      generationId: 'rollback-race',
      outputs: [{ contents: 'new\n', expectedHash, path: target }],
      scopeDir,
    }),
    /rollback.*incomplete|concurrent/i
  );
  assert.equal(await readFile(target, 'utf8'), 'concurrent\n');
});

test('recovers an interrupted replacement before the next generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.md');
  const second = join(targetRoot, 'second.md');
  await writeFile(first, 'old one\n');
  await writeFile(second, 'old two\n');
  const firstHash = await hashFile(first);
  const secondHash = await hashFile(second);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: interruptionFailpoint('after-replace:0'),
      generationId: 'abandoned',
      outputs: [
        { contents: 'abandoned one\n', expectedHash: firstHash, path: first },
        { contents: 'abandoned two\n', expectedHash: secondHash, path: second },
      ],
      scopeDir,
    }),
    /simulated interruption/i
  );

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'recovered',
    outputs: [
      { contents: 'new one\n', expectedHash: firstHash, path: first },
      { contents: 'new two\n', expectedHash: secondHash, path: second },
    ],
    scopeDir,
  });
  assert.deepEqual(
    [await readFile(first, 'utf8'), await readFile(second, 'utf8')],
    ['new one\n', 'new two\n']
  );
});

test('recovers an interrupted stale deletion before publishing a later generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const stale = join(targetRoot, 'stale.md');
  await writeFile(stale, 'still owned\n');
  const expectedHash = await hashFile(stale);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: interruptionFailpoint('after-replace:0'),
      generationId: 'abandoned-deletion',
      outputs: [{ expectedHash, operation: 'delete', path: stale }],
      scopeDir,
    }),
    /simulated interruption/i
  );

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'after-deletion-recovery',
    outputs: [{ contents: 'next\n', path: join(targetRoot, 'next.md') }],
    scopeDir,
  });
  assert.equal(await readFile(stale, 'utf8'), 'still owned\n');
});

test('refuses a staging location reported on another filesystem', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      deviceFor: async (path) => (path.includes('.maude-stage-') ? 2 : 1),
      generationId: 'cross-device',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /same filesystem/i
  );
});

test('cleans stale staging artifacts before starting a generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const staleName = '.maude-stage-00000000-0000-4000-8000-000000000000-0';
  const stale = join(targetRoot, staleName);
  const userFile = join(targetRoot, '.maude-stage-user-not-owned');
  const target = join(targetRoot, 'target.md');
  await writeFile(stale, 'stale\n');
  await writeFile(userFile, 'user\n');

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'cleanup',
    outputs: [{ contents: 'new\n', path: target }],
    scopeDir,
    staleAgeMs: 0,
  });

  assert.equal((await readdir(targetRoot)).includes(staleName), false);
  assert.equal(await readFile(userFile, 'utf8'), 'user\n');
});

test('rejects hostile interrupted-journal cleanup paths without touching them', async () => {
  const { root, scopeDir, targetRoot } = await fixture();
  const outside = join(root, 'outside.md');
  const target = join(targetRoot, 'target.md');
  await writeFile(outside, 'outside\n');
  await writeFile(
    join(scopeDir, 'transaction.json'),
    `${JSON.stringify({
      entries: [
        {
          existed: false,
          index: 0,
          outputHash: 'sha256:invalid',
          path: target,
          replaced: false,
          replacementStarted: false,
          rollbackPath: outside,
          stagePath: outside,
        },
      ],
      generationId: 'hostile',
      phase: 'prepared',
    })}\n`
  );

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'next',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /invalid transaction journal/i
  );
  assert.equal(await readFile(outside, 'utf8'), 'outside\n');
});

test('strictly rejects malformed journal fields and transaction-bound artifact names', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  const transactionId = '00000000-0000-4000-8000-000000000001';
  await writeFile(
    join(scopeDir, 'transaction.json'),
    `${JSON.stringify({
      entries: [
        {
          claimPath: join(targetRoot, `.maude-claim-wrong-0`),
          claimed: 'yes',
          existed: true,
          index: 0,
          installed: false,
          originalHash: 'not-a-hash',
          originalMode: 0o10000,
          outputHash: 'sha256:invalid',
          path: target,
          stagePath: join(targetRoot, `.maude-stage-${transactionId}-0`),
        },
      ],
      generationId: '',
      phase: 'unknown',
      schemaVersion: 1,
      transactionId,
    })}\n`
  );

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'next',
      outputs: [{ contents: 'next\n', path: target }],
      scopeDir,
    }),
    /invalid transaction journal/i
  );
});

test('strict journal validation rejects unknown fields', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: interruptionFailpoint('after-replace:0'),
      generationId: 'unknown-field',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /simulated interruption/i
  );
  const journalPath = join(scopeDir, 'transaction.json');
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  journal.untrusted = true;
  await writeFile(journalPath, `${JSON.stringify(journal)}\n`);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'next',
      outputs: [{ contents: 'next\n', expectedHash: await hashFile(target), path: target }],
      scopeDir,
    }),
    /invalid transaction journal/i
  );
});

test('recovery refuses a symlinked transaction journal', async () => {
  const { root, scopeDir, targetRoot } = await fixture();
  const outside = join(root, 'outside-journal.json');
  await writeFile(outside, '{}\n');
  await symlink(outside, join(scopeDir, 'transaction.json'));

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: 'symlinked-journal',
      outputs: [{ contents: 'new\n', path: join(targetRoot, 'target.md') }],
      scopeDir,
    }),
    /symlink|too many levels/i
  );
  assert.equal(await readFile(outside, 'utf8'), '{}\n');
});

test('release refuses to remove a lock whose ownership token changed', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const lockPath = join(scopeDir, 'transaction.lock');
  const target = join(targetRoot, 'target.md');

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name !== 'after-lock') return;
        await writeFile(
          lockPath,
          `${JSON.stringify({ pid: process.pid, schemaVersion: 1, token: '00000000-0000-4000-8000-000000000099' })}\n`
        );
      },
      generationId: 'lock-token',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /lock ownership/i
  );
  assert.equal((await lstat(lockPath)).isFile(), true);
});

test('stale lock takeover quarantines the old token and leaves no quarantine artifact', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  await writeFile(
    join(scopeDir, 'transaction.lock'),
    `${JSON.stringify({
      pid: 2_147_483_647,
      schemaVersion: 1,
      token: '00000000-0000-4000-8000-000000000098',
    })}\n`,
    { mode: 0o600 }
  );

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'stale-lock',
    outputs: [{ contents: 'new\n', path: target }],
    scopeDir,
  });

  assert.deepEqual(
    (await readdir(scopeDir)).filter((name) => name.includes('lock-quarantine')),
    []
  );
});

test('killing lock publication before linking never exposes a malformed lock', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_LOCK_PUBLISH], {
    env: {
      ...process.env,
      MANAGED_STATE_URL: new URL('./managed-state.mjs', import.meta.url).href,
      SCOPE_DIR: scopeDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [ready] = await once(child.stdout, 'data');
  assert.equal(ready.toString(), 'ready\n');
  child.kill('SIGKILL');
  await once(child, 'exit');

  await assert.rejects(lstat(join(scopeDir, 'transaction.lock')), { code: 'ENOENT' });
  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'after-lock-publish-crash',
    outputs: [{ contents: 'new\n', path: join(targetRoot, 'target.md') }],
    scopeDir,
  });
  assert.deepEqual(
    (await readdir(scopeDir)).filter((name) => name.startsWith('.maude-lock-stage-')),
    []
  );
});

test('lock acquisition verifies the published inode still carries its token', async () => {
  const { scopeDir } = await fixture();
  await assert.rejects(
    acquireScopeLock(scopeDir, {
      afterLink: async () => {
        await writeFile(
          join(scopeDir, 'transaction.lock'),
          `${JSON.stringify({
            pid: process.pid,
            schemaVersion: 1,
            token: '00000000-0000-4000-8000-000000000097',
          })}\n`
        );
      },
    }),
    /lock ownership|token changed/i
  );
});

test('recovers a crash after manifest write by checking the committed generation', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const target = join(targetRoot, 'target.md');
  let committedGeneration;

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      commitManifest: async () => {
        committedGeneration = 'manifest-crash';
      },
      failpoint: interruptionFailpoint('after-manifest-write'),
      generationId: 'manifest-crash',
      outputs: [{ contents: 'committed\n', path: target }],
      scopeDir,
    }),
    /simulated interruption/i
  );

  await runManagedTransaction({
    allowRoots: [targetRoot],
    generationId: 'next',
    isGenerationCommitted: async (generationId) => generationId === committedGeneration,
    outputs: [{ contents: 'next\n', expectedHash: await hashFile(target), path: target }],
    scopeDir,
  });
  assert.equal(await readFile(target, 'utf8'), 'next\n');
});

test('revalidates allowlisted parents immediately before installation', async () => {
  const { root, scopeDir, targetRoot } = await fixture();
  const parent = join(targetRoot, 'nested');
  const movedParent = join(targetRoot, 'moved');
  const outside = join(root, 'outside');
  const target = join(parent, 'target.md');
  await Promise.all([mkdir(parent), mkdir(outside)]);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name !== 'before-install:0') return;
        await rename(parent, movedParent);
        await symlink(outside, parent);
      },
      generationId: 'parent-swap',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /symlink|parent/i
  );
  await assert.rejects(lstat(join(outside, 'target.md')), { code: 'ENOENT' });
});

test('transaction mutations remain bound to a pinned parent during a symlink swap', async () => {
  const { root, scopeDir, targetRoot } = await fixture();
  const parent = join(targetRoot, 'nested');
  const movedParent = join(targetRoot, 'moved');
  const outside = join(root, 'outside');
  const target = join(parent, 'target.md');
  await Promise.all([mkdir(parent), mkdir(outside)]);

  await assert.rejects(
    runManagedTransaction({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name !== 'after-parent-pin:0') return;
        await rename(parent, movedParent);
        await symlink(outside, parent);
      },
      generationId: 'pinned-parent-swap',
      outputs: [{ contents: 'new\n', path: target }],
      scopeDir,
    }),
    /parent.*identity|symlink/i
  );

  await assert.rejects(lstat(join(movedParent, 'target.md')), { code: 'ENOENT' });
  await assert.rejects(lstat(join(outside, 'target.md')), { code: 'ENOENT' });
});

test('scope lock rejects a concurrent process', async () => {
  const { scopeDir, targetRoot } = await fixture();
  const first = join(targetRoot, 'first.md');
  const second = join(targetRoot, 'second.md');
  const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_TRANSACTION], {
    env: {
      ...process.env,
      FIRST_PATH: first,
      SCOPE_DIR: scopeDir,
      TARGET_ROOT: targetRoot,
      TRANSACTION_URL: new URL('./transaction.mjs', import.meta.url).href,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const [ready] = await once(child.stdout, 'data');
  assert.equal(ready.toString(), 'ready\n');

  try {
    await assert.rejects(
      runManagedTransaction({
        allowRoots: [targetRoot],
        generationId: 'second',
        outputs: [{ contents: 'second\n', path: second }],
        scopeDir,
      }),
      LockError
    );
  } finally {
    child.stdin.end('continue\n');
  }
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
});

const CHILD_TRANSACTION = `
const { runManagedTransaction } = await import(process.env.TRANSACTION_URL);
await runManagedTransaction({
  allowRoots: [process.env.TARGET_ROOT],
  failpoint: async (name) => {
    if (name !== 'after-lock') return;
    process.stdout.write('ready\\n');
    await new Promise((resolve) => process.stdin.once('data', resolve));
  },
  generationId: 'child',
  outputs: [{ contents: 'first\\n', path: process.env.FIRST_PATH }],
  scopeDir: process.env.SCOPE_DIR,
});
`;

const CHILD_LOCK_PUBLISH = `
const { acquireScopeLock } = await import(process.env.MANAGED_STATE_URL);
await acquireScopeLock(process.env.SCOPE_DIR, {
  afterTempSync: async () => {
    process.stdout.write('ready\\n');
    await new Promise(() => {});
  },
});
process.stdout.write('unexpected\\n');
`;

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
