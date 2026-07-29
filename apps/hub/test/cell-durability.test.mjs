// Cloud Phase 15 — a cell's disk is ephemeral, so this is what makes it safe.
//
// The generation is the unit. Documents and the checkout are backed up
// together and restored together, because a workspace whose documents
// reference canvases its checkout does not have is corruption that looks like
// an app bug for weeks.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { fileTarget, prefixedTarget, restoreLatest, runBackup } from '../src/backup.mjs';
import { createGitRunner } from '../src/git-runner.mjs';
import { bundleRepo, hasCommits, restoreRepo } from '../src/repo-checkpoint.mjs';

const temps = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'maude-cell-'));
  temps.push(dir);
  return dir;
}
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const skip = gitAvailable() ? false : 'git not available';

/** A repo with one commit, so the bundle lane has something to carry. */
function repoWith(files) {
  const dir = tmp();
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 't@example.com');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  git('add', '-A');
  git('commit', '-m', 'seed');
  return dir;
}

/* ------------------------------------------------------------ tenant scoping */

describe('backup targets are tenant-scoped', () => {
  it('prefixedTarget namespaces writes and hides the prefix from readers', async () => {
    // Cells share one bucket. Without this every cell writes the SAME
    // `backups/...` keys, each tenant silently overwriting the last — and
    // `restoreLatest` then rehydrates one tenant's cell from another tenant's
    // documents. The single worst failure this system can have.
    const root = tmp();
    const base = fileTarget(`file://${root}`);
    const a = prefixedTarget(base, 'tenants/alpha');
    const b = prefixedTarget(base, 'tenants/beta');

    await a.put('backups/g1/hub.db.gz', Buffer.from('alpha'));
    await b.put('backups/g1/hub.db.gz', Buffer.from('beta'));

    assert.equal((await a.get('backups/g1/hub.db.gz')).toString(), 'alpha');
    assert.equal(
      (await b.get('backups/g1/hub.db.gz')).toString(),
      'beta',
      'no cross-tenant clobber'
    );
    assert.ok(existsSync(join(root, 'tenants/alpha/backups/g1/hub.db.gz')));

    // Callers keep working in unprefixed key-space.
    const listed = await a.list('backups/');
    assert.deepEqual(
      listed.map((o) => o.key),
      ['backups/g1/hub.db.gz']
    );
  });

  it('an empty prefix is a no-op rather than a stray leading slash', () => {
    const base = fileTarget(`file://${tmp()}`);
    assert.equal(prefixedTarget(base, ''), base);
    assert.equal(prefixedTarget(base, '/'), base);
  });
});

/* ------------------------------------------------------------- the checkout */

describe('the checkout lane', () => {
  it('a repo with no commits is "empty", not "failed"', { skip }, async () => {
    // A freshly provisioned cell legitimately has nothing to preserve. Failing
    // here would make every first backup look broken.
    const dir = tmp();
    const run = createGitRunner();
    execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'ignore' });
    assert.equal(await hasCommits(dir, run), false);
    assert.equal((await bundleRepo(dir, run)).state, 'empty');
  });

  it('round-trips a repo through a bundle with its history intact', { skip }, async () => {
    const run = createGitRunner();
    const source = repoWith({ '.design/Home.tsx': 'export default () => null;\n' });
    const made = await bundleRepo(source, run);
    assert.equal(made.state, 'ok');

    const dest = join(tmp(), 'restored');
    const back = await restoreRepo(dest, made.bytes, run);
    assert.equal(back.state, 'restored', JSON.stringify(back));
    assert.equal(
      readFileSync(join(dest, '.design/Home.tsx'), 'utf8'),
      'export default () => null;\n'
    );
    const log = execFileSync('git', ['log', '--format=%s'], { cwd: dest, encoding: 'utf8' }).trim();
    assert.equal(log, 'seed', 'history, not just the working tree');
  });

  it('refuses to restore over an existing checkout', { skip }, async () => {
    const run = createGitRunner();
    const source = repoWith({ 'a.txt': 'x' });
    const made = await bundleRepo(source, run);
    // A cell rehydrating on top of live work would replace it with an older
    // copy, silently — the one failure mode worse than not restoring at all.
    const r = await restoreRepo(source, made.bytes, run);
    assert.equal(r.state, 'skipped');
  });

  it('rejects a corrupted bundle instead of cloning a hole', { skip }, async () => {
    // A truncated upload clones into something that looks fine and is missing
    // objects. `git bundle verify` is the difference between "we restored" and
    // "we restored what we backed up".
    const run = createGitRunner();
    const source = repoWith({ 'a.txt': 'x' });
    const made = await bundleRepo(source, run);
    const truncated = made.bytes.subarray(0, Math.floor(made.bytes.length / 2));
    const r = await restoreRepo(join(tmp(), 'dest'), truncated, run);
    assert.equal(r.state, 'failed');
    assert.match(r.reason, /not intact/);
  });

  it('drops the temp-file origin a bundle clone leaves behind', { skip }, async () => {
    // Otherwise `git remote -v` — and any mirror setup (Phase 19) — describes
    // a path in /tmp that no longer exists.
    const run = createGitRunner();
    const made = await bundleRepo(repoWith({ 'a.txt': 'x' }), run);
    const dest = join(tmp(), 'dest');
    await restoreRepo(dest, made.bytes, run);
    const remotes = execFileSync('git', ['remote'], { cwd: dest, encoding: 'utf8' }).trim();
    assert.equal(remotes, '', 'a bundle is not a remote anyone can fetch from again');
  });
});

/* ------------------------------------------- one generation, both artifacts */

describe('a generation carries documents AND the checkout', () => {
  it('backs up and restores both from the same generation', { skip }, async () => {
    const run = createGitRunner();
    const dataDir = tmp();
    // A real SQLite file, so `runBackup`'s VACUUM INTO path is the one exercised.
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(join(dataDir, 'hub.db'));
    db.exec('CREATE TABLE documents (name TEXT PRIMARY KEY, data BLOB);');
    db.prepare('INSERT INTO documents VALUES (?, ?)').run('ws/a/main/home', Buffer.from([1, 2, 3]));
    db.close();

    const repoDir = repoWith({ '.design/Home.tsx': 'v1\n' });
    const target = fileTarget(`file://${tmp()}`);

    const backed = await runBackup({ dataDir, target, repoDir, run });
    assert.ok(backed.repo, 'the checkout must ride in the generation');
    assert.equal(backed.manifest.repo.name, 'repo.bundle');

    const destData = join(tmp(), 'data');
    const destRepo = join(tmp(), 'repo');
    const restored = await restoreLatest({
      target,
      destDir: destData,
      repoDir: destRepo,
      run,
    });
    assert.ok(restored.restored.includes('hub.db'));
    assert.equal(restored.repo.state, 'restored');
    assert.equal(readFileSync(join(destRepo, '.design/Home.tsx'), 'utf8'), 'v1\n');
    assert.equal(restored.generation, backed.prefix, 'documents and checkout, same generation');
  });

  it('a pre-Phase-15 generation still restores its databases', { skip }, async () => {
    // Older generations carry no checkout. Refusing them would make the
    // upgrade itself the thing that breaks restore.
    const run = createGitRunner();
    const dataDir = tmp();
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(join(dataDir, 'hub.db'));
    db.exec('CREATE TABLE documents (name TEXT PRIMARY KEY, data BLOB);');
    db.close();

    const target = fileTarget(`file://${tmp()}`);
    await runBackup({ dataDir, target }); // no repoDir — the old shape

    const restored = await restoreLatest({
      target,
      destDir: join(tmp(), 'data'),
      repoDir: join(tmp(), 'repo'),
      run,
    });
    assert.ok(restored.restored.includes('hub.db'));
    assert.equal(restored.repo, null);
  });

  it('a failed checkout bundle does not discard a good document backup', { skip }, async () => {
    const dataDir = tmp();
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(join(dataDir, 'hub.db'));
    db.exec('CREATE TABLE documents (name TEXT PRIMARY KEY, data BLOB);');
    db.close();

    const target = fileTarget(`file://${tmp()}`);
    const repoDir = repoWith({ 'a.txt': 'x' });
    const broken = async (args, o) =>
      args[0] === 'bundle'
        ? { code: 1, stdout: '', stderr: 'disk full' }
        : createGitRunner()(args, o);

    const backed = await runBackup({ dataDir, target, repoDir, run: broken });
    assert.equal(backed.repo, null);
    assert.ok(
      backed.files.some((f) => f.name === 'hub.db'),
      'the documents still made it'
    );
  });
});

/* ------------------------------------------------------- media is scoped too */

describe('media is tenant-scoped', () => {
  it('reader and writer derive the SAME object key', async () => {
    // They live in different modules and are called from different processes.
    // If they ever disagree the sweep uploads to one key and the proxy 404s on
    // another — a hosted project with no images and no error anywhere.
    const { assetObjectKey } = await import('../src/asset-key.mjs');
    assert.equal(
      assetObjectKey('deadbeef.png', 'tenants/alligators'),
      'tenants/alligators/assets/deadbeef.png'
    );
    assert.equal(
      assetObjectKey('graphics/camo-bg.png', 'tenants/alligators'),
      'tenants/alligators/assets/graphics/camo-bg.png'
    );
  });

  it('an unscoped hub keeps the flat layout it has always had', async () => {
    const { assetObjectKey } = await import('../src/asset-key.mjs');
    assert.equal(assetObjectKey('deadbeef.png'), 'assets/deadbeef.png');
    assert.equal(assetObjectKey('deadbeef.png', ''), 'assets/deadbeef.png');
    assert.equal(assetObjectKey('deadbeef.png', '/'), 'assets/deadbeef.png');
  });

  it('two tenants with the SAME authored filename do not collide', async () => {
    // The exact regression the widened key shape introduced: content-addressed
    // names were collision-proof by construction (same name ⇒ same bytes);
    // `graphics/camo-bg.png` is not, and every design system has one.
    const { assetObjectKey } = await import('../src/asset-key.mjs');
    assert.notEqual(
      assetObjectKey('graphics/camo-bg.png', 'tenants/alpha'),
      assetObjectKey('graphics/camo-bg.png', 'tenants/beta')
    );
  });

  it('refuses a prefix that could reach another tenant', async () => {
    const { assetPrefixFromEnv } = await import('../src/asset-key.mjs');
    for (const bad of ['../other', 'Tenant', 'a b', '*']) {
      assert.throws(
        () => assetPrefixFromEnv({ MAUDE_TENANT_PREFIX: bad }),
        /must be lowercase/,
        bad
      );
    }
    assert.equal(assetPrefixFromEnv({}), '');
    assert.equal(
      assetPrefixFromEnv({ MAUDE_TENANT_PREFIX: 'tenants/alligators' }),
      'tenants/alligators'
    );
  });
});
