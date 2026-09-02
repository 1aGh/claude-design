import assert from 'node:assert/strict';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  adoptManagedPath,
  assertManagedOutputsUnmodified,
  createManifest,
  hashFile,
  manifestPaths,
  readManifest,
  recoverManagedRemoval,
  removalInterruptionFailpoint,
  removeManagedOutputs,
  writeManifest,
} from './managed-state.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maude-managed-state-')));
  roots.push(root);
  const stateRoot = join(root, 'state');
  const targetRoot = join(root, 'target');
  const projectRoot = join(root, 'project');
  await Promise.all([
    mkdir(stateRoot, { recursive: true }),
    mkdir(targetRoot, { recursive: true }),
    mkdir(projectRoot, { recursive: true }),
  ]);
  return { projectRoot, root, stateRoot, targetRoot };
}

test('uses separate machine-local manifests for global and canonical project scopes', async () => {
  const { projectRoot, stateRoot } = await fixture();
  const globalPaths = await manifestPaths({ scope: 'global', stateRoot });
  const projectPaths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });

  assert.notEqual(globalPaths.scopeDir, projectPaths.scopeDir);
  assert.match(projectPaths.rootHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(projectPaths.canonicalRoot, await realpath(projectRoot));
  assert.equal(projectPaths.manifestPath.startsWith(stateRoot), true);
});

test('creates a missing machine-local state root without symlink traversal', async () => {
  const { projectRoot, root } = await fixture();
  const stateRoot = join(root, 'new', 'private', 'harness');

  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  await writeManifest(
    paths,
    createManifest({ generationId: 'first-run', outputs: [], rootHash: paths.rootHash })
  );

  assert.equal((await stat(paths.scopeDir)).mode & 0o077, 0);
});

test('writes and reads a versioned manifest atomically with owner-only state', async () => {
  const { projectRoot, stateRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const manifest = createManifest({
    capabilitySummary: { native: 2 },
    generationId: 'generation-1',
    outputs: [],
    rootHash: paths.rootHash,
    sourceHashes: { source: 'sha256:source' },
    targetVersions: { opencode: '1.18.25' },
  });

  await writeManifest(paths, manifest);

  assert.deepEqual(await readManifest(paths), manifest);
  assert.equal((await stat(paths.manifestPath)).mode & 0o077, 0);
});

test('refuses a machine-local scope directory symlink', async () => {
  const { projectRoot, root, stateRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const outside = join(root, 'outside-state');
  await mkdir(outside);
  await symlink(outside, paths.scopeDir);
  const manifest = createManifest({
    generationId: 'generation-1',
    outputs: [],
    rootHash: paths.rootHash,
  });

  await assert.rejects(writeManifest(paths, manifest), /scope.*symlink/i);
});

test('adoption requires confirmation and preserves an owner-only byte-exact backup', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const ownedPath = join(targetRoot, 'opencode.json');
  const original = Buffer.from('{\n  "user": true\n}\n');
  await writeFile(ownedPath, original);

  const preview = await adoptManagedPath({
    allowRoots: [targetRoot],
    confirm: false,
    path: ownedPath,
    paths,
    target: 'opencode',
  });
  assert.deepEqual(preview, {
    action: 'preview',
    hash: await hashFile(ownedPath),
    path: ownedPath,
    target: 'opencode',
  });

  const adopted = await adoptManagedPath({
    allowRoots: [targetRoot],
    confirm: true,
    path: ownedPath,
    paths,
    target: 'opencode',
  });
  assert.deepEqual(await readFile(adopted.backupPath), original);
  assert.equal((await stat(adopted.backupPath)).mode & 0o077, 0);
});

test('adoption rejects directories, paths outside the allowlist, and symlink escapes', async () => {
  const { projectRoot, root, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const outside = join(root, 'outside.json');
  const escaped = join(targetRoot, 'escaped.json');
  await writeFile(outside, '{}\n');
  await symlink(outside, escaped);

  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: targetRoot,
      paths,
      target: 'opencode',
    }),
    /regular file/i
  );
  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: outside,
      paths,
      target: 'opencode',
    }),
    /allowlisted target root/i
  );
  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: escaped,
      paths,
      target: 'opencode',
    }),
    /symlink/i
  );
});

test('adoption rejects raw credential text before writing a backup', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const ownedPath = join(targetRoot, 'opencode.json');
  await writeFile(ownedPath, '{"token":"ordinary-literal-credential"}\n');

  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: ownedPath,
      paths,
      target: 'opencode',
    }),
    /literal credential/i
  );
  await assert.rejects(lstat(paths.backupDir), { code: 'ENOENT' });
});

test('adoption rejects every credential literal form before creating a backup', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const cases = [
    ['username.json', { endpoint: 'https://literal-user@example.invalid/path' }],
    ['query.json', { endpoint: 'https://example.invalid/path?user=ordinary-user' }],
    ['path.json', { endpoint: 'https://example.invalid/password/ordinary-password' }],
    ['semicolon.json', { endpoint: 'Server=db.invalid;token=ordinary-token' }],
    [
      'token-path.json',
      { endpoint: 'https://example.invalid/hooks/4f8a7d93b6214c43bca231fe9b2db124' },
    ],
    [
      'slack.json',
      { endpoint: 'https://hooks.slack.com/services/T00000000/B00000000/SlackWebhookSecret' },
    ],
    ['cookie.json', { headers: { Cookie: 'session=ordinary-cookie' } }],
    ['set-cookie.json', { headers: { 'Set-Cookie': 'session=ordinary-cookie' } }],
    ['database.json', { DATABASE_URL: 'postgres://app:ordinary-password@db.invalid/db' }],
    ['redis.json', { REDIS_URL: 'redis://default:ordinary-password@cache.invalid/0' }],
    ['dsn.json', { DSN: 'Server=db.invalid;Password=ordinary-password' }],
  ];

  for (const [name, value] of cases) {
    const paths = await manifestPaths({
      projectRoot,
      scope: 'project',
      stateRoot: join(stateRoot, name),
    });
    const ownedPath = join(targetRoot, name);
    await writeFile(ownedPath, `${JSON.stringify(value)}\n`);
    await assert.rejects(
      adoptManagedPath({
        allowRoots: [targetRoot],
        confirm: true,
        path: ownedPath,
        paths,
        target: 'opencode',
      }),
      /literal credential/i,
      name
    );
    await assert.rejects(lstat(paths.backupDir), { code: 'ENOENT' });
  }
});

test('adoption structurally rejects JSON and TOML credential fields', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const cases = [
    ['api-key.json', '{"apiKey":"ordinary-json-secret"}\n'],
    ['opencode.json', '{"headers":{"X-Api-Key":"ordinary-json-secret"}}\n'],
    ['headers.json', '{"headers":{"Authorization":"Basic ordinary-header-secret"}}\n'],
    ['config.toml', '[headers]\naccess-token = "ordinary-toml-secret"\n'],
    ['inline.toml', 'headers = { X-Api-Key = "ordinary-inline-secret" }\n'],
    ['invalid.toml', 'api_key = unparsed credential assignment ???\n'],
  ];

  for (const [name, contents] of cases) {
    const ownedPath = join(targetRoot, name);
    await writeFile(ownedPath, contents);
    await assert.rejects(
      adoptManagedPath({
        allowRoots: [targetRoot],
        confirm: true,
        path: ownedPath,
        paths,
        target: 'opencode',
      }),
      /literal credential|credential assignment/i
    );
  }
});

test('adoption permits credential terminology inside valid TOML multiline strings', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const ownedPath = join(targetRoot, 'agent.toml');
  await writeFile(
    ownedPath,
    'name = "mobile"\ndeveloper_instructions = """\nUse secure token storage.\n"""\n'
  );

  const adopted = await adoptManagedPath({
    allowRoots: [targetRoot],
    confirm: true,
    path: ownedPath,
    paths,
    target: 'codex',
  });

  assert.equal(adopted.ownership, 'adopted');
});

test('adoption propagates sensitive TOML table context to nested values', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const literalPath = join(targetRoot, 'literal.toml');
  const referencePath = join(targetRoot, 'reference.toml');
  await writeFile(literalPath, '[credentials]\nvalue = "ordinary-nested-secret"\n');
  await writeFile(referencePath, '[credentials]\nvalue = "{env:CODEX_TOKEN}"\n');

  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: literalPath,
      paths,
      target: 'codex',
    }),
    /literal credential/i
  );
  const adopted = await adoptManagedPath({
    allowRoots: [targetRoot],
    confirm: true,
    path: referencePath,
    paths,
    target: 'codex',
  });
  assert.equal(adopted.ownership, 'adopted');
});

test('adoption rejects embedded shell headers and opaque sensitive assignments before backup', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  for (const [name, contents] of [
    [
      'basic.sh',
      'curl -H "Authorization: Basic QmFzaWNVc2VyOlNlY3JldDEyMzQ1Njc4OTA=" https://example.invalid\n',
    ],
    [
      'custom.sh',
      "curl -H 'Authorization: Maude mF9Qv7L2xR4nK8pT6wY3cD5sH1jB0zA' https://example.invalid\n",
    ],
    ['env.sh', 'env API_TOKEN=pK7vN2xQ9mR4tY8cD6sH3jL1wF5bZ0a run-tool\n'],
  ]) {
    const ownedPath = join(targetRoot, name);
    await writeFile(ownedPath, contents);
    await assert.rejects(
      adoptManagedPath({
        allowRoots: [targetRoot],
        confirm: true,
        path: ownedPath,
        paths,
        target: 'opencode',
      }),
      /literal credential/i
    );
  }
  await assert.rejects(lstat(paths.backupDir), { code: 'ENOENT' });
});

test('adoption permits structural credential references without persisting literals', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  for (const [name, contents] of [
    ['opencode.json', `{"apiKey":"\${OPENCODE_API_KEY}"}\n`],
    ['config.toml', 'access_token = "keychain:opencode/api-key"\n'],
    [
      'database.json',
      `{"endpoint":"postgres://\${DATABASE_USER}:\${DATABASE_PASSWORD}@db.invalid/studyfi"}\n`,
    ],
    ['database.toml', 'dsn = "Server=db.invalid;Password={env:DATABASE_PASSWORD}"\n'],
  ]) {
    const ownedPath = join(targetRoot, name);
    await writeFile(ownedPath, contents);
    const adopted = await adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: ownedPath,
      paths,
      target: 'opencode',
    });
    assert.equal(adopted.ownership, 'adopted');
  }
});

test('adoption rejects target identifiers outside the fixed target allowlist', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const ownedPath = join(targetRoot, 'config.json');
  await writeFile(ownedPath, '{}\n');

  await assert.rejects(
    adoptManagedPath({
      allowRoots: [targetRoot],
      confirm: true,
      path: ownedPath,
      paths,
      target: '../../escape',
    }),
    /target identifier/i
  );
  assert.equal(await readFile(ownedPath, 'utf8'), '{}\n');
});

test('refuses a permissive machine-local scope directory instead of silently weakening it', async () => {
  const { projectRoot, stateRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  await mkdir(paths.scopeDir, { mode: 0o755 });

  await assert.rejects(readManifest(paths), /scope.*private/i);
});

test('detects external edits before any managed write', async () => {
  const { targetRoot } = await fixture();
  const ownedPath = join(targetRoot, 'owned.json');
  await writeFile(ownedPath, '{"generation":1}\n');
  const output = { hash: await hashFile(ownedPath), ownership: 'generated', path: ownedPath };
  await writeFile(ownedPath, '{"generation":"external"}\n');

  await assert.rejects(assertManagedOutputsUnmodified([output]), /externally modified/i);
});

test('remove deletes generated files and restores adopted files byte-for-byte', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const generatedPath = join(targetRoot, 'generated.md');
  const adoptedPath = join(targetRoot, 'adopted.json');
  const original = Buffer.from('{"before":true}\n');
  await writeFile(generatedPath, '# generated\n');
  await writeFile(adoptedPath, original);
  const adoption = await adoptManagedPath({
    allowRoots: [targetRoot],
    confirm: true,
    path: adoptedPath,
    paths,
    target: 'opencode',
  });
  await writeFile(adoptedPath, '{"after":true}\n');
  const outputs = [
    { hash: await hashFile(generatedPath), ownership: 'generated', path: generatedPath },
    {
      backupHash: adoption.backupHash,
      backupPath: adoption.backupPath,
      hash: await hashFile(adoptedPath),
      ownership: 'adopted',
      path: adoptedPath,
    },
  ];

  await removeManagedOutputs({
    allowRoots: [targetRoot],
    backupRoots: [paths.backupDir],
    outputs,
    scopeDir: paths.scopeDir,
  });

  await assert.rejects(lstat(generatedPath), { code: 'ENOENT' });
  assert.deepEqual(await readFile(adoptedPath), original);
  await assert.rejects(lstat(adoption.backupPath), { code: 'ENOENT' });
});

for (const ownership of ['generated', 'adopted']) {
  test(`remove rechecks a concurrently edited ${ownership} output during preparation`, async () => {
    const { projectRoot, stateRoot, targetRoot } = await fixture();
    const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
    const target = join(targetRoot, `${ownership}.json`);
    await writeFile(target, '{"managed":true}\n');
    const output = { hash: await hashFile(target), ownership, path: target };
    if (ownership === 'adopted') {
      const original = join(targetRoot, 'original.json');
      await writeFile(original, '{"original":true}\n');
      const adoption = await adoptManagedPath({
        allowRoots: [targetRoot],
        confirm: true,
        path: original,
        paths,
        target: 'opencode',
      });
      output.backupHash = adoption.backupHash;
      output.backupPath = adoption.backupPath;
    }

    await assert.rejects(
      removeManagedOutputs({
        allowRoots: [targetRoot],
        backupRoots: [paths.backupDir],
        failpoint: async (name) => {
          if (name === 'before-remove-inspect:0') await writeFile(target, '{"concurrent":true}\n');
        },
        outputs: [output],
        scopeDir: paths.scopeDir,
      }),
      /externally modified|concurrent/i
    );
    assert.equal(await readFile(target, 'utf8'), '{"concurrent":true}\n');
  });
}

test('remove refuses a modified managed file and leaves every output untouched', async () => {
  const { targetRoot } = await fixture();
  const first = join(targetRoot, 'first.json');
  const second = join(targetRoot, 'second.json');
  await writeFile(first, '{"managed":1}\n');
  await writeFile(second, '{"managed":2}\n');
  const outputs = [
    { hash: await hashFile(first), ownership: 'generated', path: first },
    { hash: await hashFile(second), ownership: 'generated', path: second },
  ];
  await writeFile(second, '{"external":true}\n');

  await assert.rejects(
    removeManagedOutputs({
      allowRoots: [targetRoot],
      outputs,
      scopeDir: join(targetRoot, 'state'),
    }),
    /externally modified/i
  );

  assert.equal(await readFile(first, 'utf8'), '{"managed":1}\n');
  assert.equal(await readFile(second, 'utf8'), '{"external":true}\n');
});

test('remove rejects adopted backup metadata outside the machine-local backup root', async () => {
  const { projectRoot, root, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const target = join(targetRoot, 'adopted.json');
  const outside = join(root, 'outside.backup');
  await mkdir(paths.scopeDir, { mode: 0o700 });
  await mkdir(paths.backupDir, { mode: 0o700 });
  await writeFile(target, '{"managed":true}\n');
  await writeFile(outside, '{"outside":true}\n');

  await assert.rejects(
    removeManagedOutputs({
      allowRoots: [targetRoot],
      backupRoots: [paths.backupDir],
      outputs: [
        {
          backupHash: await hashFile(outside),
          backupPath: outside,
          hash: await hashFile(target),
          ownership: 'adopted',
          path: target,
        },
      ],
      scopeDir: paths.scopeDir,
    }),
    /allowlisted target root/i
  );
  assert.equal(await readFile(target, 'utf8'), '{"managed":true}\n');
});

test('recovers an interrupted managed removal with original bytes and mode', async () => {
  const { projectRoot, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const target = join(targetRoot, 'generated.md');
  await writeFile(target, 'managed\n');
  await chmod(target, 0o640);
  const outputs = [{ hash: await hashFile(target), ownership: 'generated', path: target }];

  await assert.rejects(
    removeManagedOutputs({
      allowRoots: [targetRoot],
      failpoint: removalInterruptionFailpoint('after-remove:0'),
      outputs,
      scopeDir: paths.scopeDir,
    }),
    /simulated removal interruption/i
  );
  await recoverManagedRemoval({ allowRoots: [targetRoot], scopeDir: paths.scopeDir });

  assert.equal(await readFile(target, 'utf8'), 'managed\n');
  assert.equal((await stat(target)).mode & 0o777, 0o640);
});

test('removal recovery refuses a symlinked journal', async () => {
  const { projectRoot, root, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  await mkdir(paths.scopeDir, { mode: 0o700 });
  const outside = join(root, 'outside-removal.json');
  await writeFile(outside, '{}\n');
  await symlink(outside, join(paths.scopeDir, 'removal.json'));

  await assert.rejects(
    recoverManagedRemoval({ allowRoots: [targetRoot], scopeDir: paths.scopeDir }),
    /symlink|too many levels/i
  );
  assert.equal(await readFile(outside, 'utf8'), '{}\n');
});

test('managed removal stays bound to its pinned parent during a symlink swap', async () => {
  const { projectRoot, root, stateRoot, targetRoot } = await fixture();
  const paths = await manifestPaths({ projectRoot, scope: 'project', stateRoot });
  const parent = join(targetRoot, 'nested');
  const movedParent = join(targetRoot, 'moved');
  const outside = join(root, 'outside');
  const target = join(parent, 'target.md');
  await Promise.all([mkdir(parent), mkdir(outside)]);
  await writeFile(target, 'managed\n');

  await assert.rejects(
    removeManagedOutputs({
      allowRoots: [targetRoot],
      failpoint: async (name) => {
        if (name !== 'after-remove-parent-pin:0') return;
        await rename(parent, movedParent);
        await symlink(outside, parent);
      },
      outputs: [{ hash: await hashFile(target), ownership: 'generated', path: target }],
      scopeDir: paths.scopeDir,
    }),
    /parent.*identity|symlink/i
  );

  assert.equal(await readFile(join(movedParent, 'target.md'), 'utf8'), 'managed\n');
  await assert.rejects(lstat(join(outside, 'target.md')), { code: 'ENOENT' });
});
