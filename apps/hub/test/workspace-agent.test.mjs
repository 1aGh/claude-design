// Cloud Phase 16 — the server-owned checkout.
//
// The end-to-end test at the bottom is the one that matters: an edit arrives
// with NO client running anywhere, and a real commit lands in a real git repo
// with the human as author and the bot as committer. Everything above it
// exists to make that test's failures legible.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import * as Y from 'yjs';

import { pendingAssets, sweepAssets } from '../src/asset-lane.mjs';
import { createGitRunner } from '../src/git-runner.mjs';
import { mergeSharedMetaIntoLocal } from '../src/meta-merge.mjs';
import { safeUrl, seedRepo } from '../src/seed-repo.mjs';
import { createWorkspaceAgent, slugFromDocName } from '../src/workspace-agent.mjs';
import {
  attributionFor,
  canvasSlug,
  DOC_TYPES,
  defaultBodyPath,
  filesForCanvas,
  indexCanvasPaths,
  readDocContent,
  siblingPaths,
} from '../src/workspace-files.mjs';

const temps = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'maude-ws-'));
  temps.push(dir);
  return dir;
}
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const silent = () => ({ log() {}, warn() {}, error() {} });

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ drift guards */

// The hub carries plain-JS twins of two studio modules because it must run
// under Node with no studio source tree present (see the header comments in
// workspace-files.mjs / meta-merge.mjs). A twin is only defensible while it is
// provably identical, which is what these two tests are for. They import the
// REAL studio source — available in the repo, absent from the image, which is
// exactly the asymmetry that makes the twins necessary in the first place.

describe('drift: hub twins vs studio source', () => {
  it('DOC_TYPES matches the studio codec', async () => {
    const codec = await import('../../studio/sync/codec.ts');
    const persistence = await import('../../studio/collab/persistence.ts');
    assert.equal(DOC_TYPES.html, codec.Y_SYNC_TYPES.html);
    assert.equal(DOC_TYPES.css, codec.Y_SYNC_TYPES.css);
    assert.equal(DOC_TYPES.meta, codec.Y_SYNC_TYPES.meta);
    assert.equal(DOC_TYPES.annotations, persistence.Y_TYPES.annotations);
  });

  it('mergeSharedMetaIntoLocal is byte-identical to the studio codec', async () => {
    const codec = await import('../../studio/sync/codec.ts');
    const corpus = [
      [null, '{"layout":{"artboards":[]}}'],
      ['{"viewport":{"x":1,"y":2},"title":"Old"}', '{"title":"New"}'],
      ['{"syncable":false,"a":1}', '{"a":2,"b":3}'],
      ['{"last_modified":123}', '{"z":1,"a":2}'],
      ['not json at all', '{"ok":true}'],
      ['{"viewport":9}', 'not json either'],
      [null, '[]'],
      [null, '"a string"'],
      ['{"viewport":1}', '{"__proto__":{"polluted":true},"safe":1}'],
    ];
    for (const [local, shared] of corpus) {
      assert.equal(
        mergeSharedMetaIntoLocal(local, shared),
        codec.mergeSharedMetaIntoLocal(local, shared),
        `drift for local=${local} shared=${shared}`
      );
    }
  });

  it('canvasSlug matches the studio slug transform', () => {
    // Mirrors slugFor() in apps/studio/sync/index.ts, which is not exported.
    const studioSlug = (rel) =>
      rel
        .replace(/\//g, '-')
        .replace(/\s+/g, '_')
        .replace(/\.(tsx|html)$/i, '')
        .replace(/^\.+/, '')
        .toLowerCase();
    for (const rel of ['Foo.tsx', 'ui/Foo.tsx', 'UI/Deep/Bar Baz.tsx', 'a.html', '.hidden/x.tsx']) {
      assert.equal(canvasSlug(rel), studioSlug(rel), rel);
    }
  });
});

/* ------------------------------------------------------------- pure module */

describe('workspace-files (pure)', () => {
  it('indexes canvases and ignores runtime-state directories', () => {
    const index = indexCanvasPaths([
      'Home.tsx',
      'ui/Card.tsx',
      '_history/Home/1.tsx',
      '_trash/Old.tsx',
      'Home.meta.json',
      'notes.md',
    ]);
    assert.deepEqual([...index.entries()].sort(), [
      ['home', 'Home.tsx'],
      ['ui-card', 'ui/Card.tsx'],
    ]);
  });

  it('resolves slug collisions deterministically, not by readdir order', () => {
    const a = indexCanvasPaths(['ui/Card.tsx', 'ui-card.tsx']);
    const b = indexCanvasPaths(['ui-card.tsx', 'ui/Card.tsx']);
    assert.equal(a.get('ui-card'), b.get('ui-card'));
    assert.equal(a.get('ui-card'), 'ui-card.tsx'); // shorter wins
  });

  it('places an unknown canvas flat, never in an invented directory', () => {
    assert.equal(defaultBodyPath('ui-card'), 'ui-card.tsx');
    assert.deepEqual(siblingPaths('ui/Card.tsx'), {
      meta: 'ui/Card.meta.json',
      css: 'ui/Card.css',
      annotations: 'ui/Card.annotations.svg',
    });
  });

  it('an absent lane is not a deletion', () => {
    const writes = filesForCanvas({
      bodyRel: 'Home.tsx',
      content: { body: '<div/>', css: null, meta: null, annotations: null },
      onDisk: { body: null, css: 'body{}', meta: '{"a":1}', annotations: '<svg/>' },
    });
    assert.deepEqual(writes, [{ relPath: 'Home.tsx', text: '<div/>' }]);
  });

  it('skips lanes whose bytes already match', () => {
    const writes = filesForCanvas({
      bodyRel: 'Home.tsx',
      content: { body: 'same', css: 'x{}', meta: null, annotations: null },
      onDisk: { body: 'same', css: null, meta: null, annotations: null },
    });
    assert.deepEqual(writes, [{ relPath: 'Home.css', text: 'x{}' }]);
  });

  it('preserves the local meta keys a server must never reset', () => {
    const local = JSON.stringify({ viewport: { x: 5 }, syncable: false, title: 'Old' });
    const [write] = filesForCanvas({
      bodyRel: 'Home.tsx',
      content: { body: null, css: null, meta: '{"title":"New"}', annotations: null },
      onDisk: { meta: local },
    });
    const merged = JSON.parse(write.text);
    assert.equal(write.relPath, 'Home.meta.json');
    assert.equal(merged.title, 'New');
    assert.deepEqual(merged.viewport, { x: 5 }, 'camera must survive a server commit');
    assert.equal(merged.syncable, false, 'a security opt-out must never be overwritten');
  });

  it('refuses to write an unparseable meta over a good one', () => {
    const writes = filesForCanvas({
      bodyRel: 'Home.tsx',
      content: { body: null, css: null, meta: 'not json', annotations: null },
      onDisk: { meta: '{"title":"Keep me"}' },
    });
    assert.deepEqual(writes, []);
  });

  it('attributes an anonymous edit to nobody rather than to the bot', () => {
    assert.equal(attributionFor(null), null);
    assert.equal(attributionFor({}), null);
    assert.deepEqual(attributionFor({ name: 'Alice', email: 'a@example.com' }), {
      name: 'Alice',
      email: 'a@example.com',
    });
    const synthesized = attributionFor({ name: 'macbook-token' });
    assert.equal(synthesized.name, 'macbook-token');
    assert.match(synthesized.email, /@workspace\.invalid$/, 'a synthesized address says so');

    // A hub session label identifies a LOGIN, not a person, and it is a new
    // one tomorrow — attributing a design to `u-1e166564e89d` is unreadable
    // now and wrong later. The address is the stable identity.
    assert.deepEqual(attributionFor({ name: 'u-1e166564e89d', email: 'alice@acme.com' }), {
      name: 'alice',
      email: 'alice@acme.com',
    });
    // With no address there is nothing better, so the label survives.
    assert.equal(attributionFor({ name: 'u-1e166564e89d' }).name, 'u-1e166564e89d');
  });

  it('reads the four synced lanes off a real Y.Doc', () => {
    const doc = new Y.Doc();
    doc.getText('html').insert(0, '<main/>');
    doc.getMap('annotations').set('svg', '<svg/>');
    assert.deepEqual(readDocContent(doc), {
      body: '<main/>',
      css: null,
      meta: null,
      annotations: '<svg/>',
    });
  });
});

describe('slugFromDocName', () => {
  it('accepts the namespace and legacy flat names', () => {
    assert.equal(slugFromDocName('ws/proj/main/home'), 'home');
    assert.equal(slugFromDocName('home'), 'home');
  });

  it('refuses anything it would have to guess about', () => {
    for (const bad of ['', null, 'ws/proj/main/a/b', '../../etc/passwd', 'ws//main/x', 'a/b']) {
      assert.equal(slugFromDocName(bad), null, String(bad));
    }
  });
});

/* -------------------------------------------------------------- seed repo */

describe('seedRepo', () => {
  it('is a no-op without MAUDE_SEED_REPO', async () => {
    const r = await seedRepo(tmp(), async () => ({ code: 0, stdout: '', stderr: '' }), {});
    assert.equal(r.state, 'skipped');
  });

  it('IS consumed — the URL reaches git clone', async () => {
    // The bug this phase closes was an env var nothing read. Asserting the
    // argv is the only thing that proves it is wired, and it is what stops
    // the wiring from rotting back out.
    const calls = [];
    const dir = tmp();
    const r = await seedRepo(
      dir,
      async (args) => {
        calls.push(args);
        return { code: 0, stdout: '', stderr: '' };
      },
      { url: 'https://github.com/acme/design.git', branch: 'main', log: silent() }
    );
    assert.equal(r.state, 'cloned');
    assert.deepEqual(calls[0], [
      'clone',
      '--depth',
      '1',
      '--branch',
      'main',
      '--',
      'https://github.com/acme/design.git',
      dir,
    ]);
  });

  it('refuses schemes that are local, unauthenticated, or arbitrary execution', async () => {
    for (const url of ['file:///etc', 'git://x/y', 'ssh://a/b', 'ext::sh -c whoami', '/tmp/repo']) {
      const r = await seedRepo(tmp(), async () => ({ code: 0, stdout: '', stderr: '' }), { url });
      assert.equal(r.state, 'failed', url);
    }
  });

  it('never seeds over existing work', async () => {
    const dir = tmp();
    writeFileSync(join(dir, 'already-here.txt'), 'x');
    const r = await seedRepo(dir, async () => ({ code: 0, stdout: '', stderr: '' }), {
      url: 'https://example.com/r.git',
    });
    assert.equal(r.state, 'skipped');
    assert.match(r.reason, /not empty/);
  });

  it('redacts the token a seed URL can carry', () => {
    assert.equal(
      safeUrl('https://x-access-token:ghs_secret@github.com/a/b.git'),
      'https://***@github.com/a/b.git'
    );
  });
});

/* ------------------------------------------------------------ asset lane */

describe('asset lane', () => {
  it("mirrors exactly what the proxy will serve — including a DS's own named files", () => {
    // Real projects are not all hashes. alligators references
    // `graphics/camo-bg.png` and `gator_badge_roundel.svg`; requiring
    // content-addressed names left a hosted project rendering without its own
    // brand, silently.
    assert.deepEqual(
      pendingAssets([
        'a1b2c3d4.png',
        'gator_badge_roundel.svg',
        'graphics/camo-bg.png',
        'fonts/Gators-Bold.woff2',
        '../escape',
        'a/b/c/d/e/f/too-deep.png',
        '.hidden',
        'a1b2c3d4.png',
      ]),
      ['a1b2c3d4.png', 'fonts/Gators-Bold.woff2', 'gator_badge_roundel.svg', 'graphics/camo-bg.png']
    );
  });

  it('never mirrors a path that could escape the assets prefix', () => {
    for (const bad of ['../secret', 'a/../../etc/passwd', '/abs.png', 'a//b.png']) {
      assert.deepEqual(pendingAssets([bad]), [], bad);
    }
  });

  it('skips what the bucket already holds instead of re-uploading it', async () => {
    const dir = tmp();
    const assets = join(dir, 'assets');
    mkdirSync(assets);
    writeFileSync(join(assets, 'aaaaaaaa.png'), 'one');
    writeFileSync(join(assets, 'bbbbbbbb.png'), 'two');
    const put = [];
    const r = await sweepAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      log: silent(),
      deps: {
        headObject: async (_c, key) => (key === 'assets/aaaaaaaa.png' ? { size: 3 } : null),
        putObject: async (_c, key) => put.push(key),
      },
    });
    assert.deepEqual(r.uploaded, ['bbbbbbbb.png']);
    assert.equal(r.skipped, 1);
    assert.deepEqual(put, ['assets/bbbbbbbb.png']);
  });

  it('a failed upload does not abort the sweep', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'aaaaaaaa.png'), 'one');
    writeFileSync(join(dir, 'assets', 'bbbbbbbb.png'), 'two');
    const r = await sweepAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      log: silent(),
      deps: {
        headObject: async () => null,
        putObject: async (_c, key) => {
          if (key.includes('aaaa')) throw new Error('502');
          return null;
        },
      },
    });
    assert.deepEqual(r.uploaded, ['bbbbbbbb.png']);
    assert.equal(r.failed.length, 1);
  });

  it('does nothing when the hub has no bucket', async () => {
    const r = await sweepAssets({ designRoot: tmp(), s3: null, log: silent() });
    assert.deepEqual(r, { uploaded: [], skipped: 0, failed: [] });
  });
});

/* ---------------------------------------------------------- end to end */

describe('workspace agent, end to end against real git', () => {
  const gitOk = gitAvailable();

  it('a browser-only edit produces a server commit authored by the human', {
    skip: gitOk ? false : 'git not available',
  }, async () => {
    const repo = tmp();
    const agent = createWorkspaceAgent({
      repoDir: repo,
      designRel: '.design',
      debounceMs: 5,
      log: silent(),
    });
    const started = await agent.start();
    assert.equal(started.state, 'created');

    const doc = new Y.Doc();
    doc.getText('html').insert(0, 'export default function Home() { return <main/>; }\n');
    doc.getText('meta').insert(0, '{"title":"Home"}');

    const out = await agent.onDocumentStored({
      documentName: 'ws/acme/main/home',
      document: doc,
      user: { name: 'Alice Novak', email: 'alice@example.com' },
    });
    assert.deepEqual(out.written.sort(), ['home.meta.json', 'home.tsx']);
    assert.ok(existsSync(join(repo, '.design/home.tsx')), 'body written');
    assert.ok(existsSync(join(repo, '.design/home.meta.json')), 'meta written');

    const commit = await agent.flush();
    assert.equal(commit.ok, true, `commit failed: ${JSON.stringify(commit)}`);

    const show = (fmt) =>
      execFileSync('git', ['log', '-1', `--format=${fmt}`], { cwd: repo, encoding: 'utf8' }).trim();
    assert.equal(show('%an'), 'Alice Novak', 'author is the human who edited');
    assert.equal(show('%ae'), 'alice@example.com');
    assert.equal(show('%cn'), 'Maude Workspace', 'committer is the machine');
    assert.match(show('%s'), /^design: update home$/);

    await agent.stop();
  });

  it('never rewrites history — only add and commit reach git', {
    skip: gitOk ? false : 'git not available',
  }, async () => {
    const repo = tmp();
    const verbs = [];
    const real = createGitRunner();
    const agent = createWorkspaceAgent({
      repoDir: repo,
      debounceMs: 5,
      log: silent(),
      run: (args, o) => {
        verbs.push(args[0]);
        return real(args, o);
      },
    });
    await agent.start();
    const doc = new Y.Doc();
    doc.getText('html').insert(0, 'x');
    await agent.onDocumentStored({ documentName: 'ws/a/main/home', document: doc, user: null });
    await agent.flush();
    await agent.stop();

    const forbidden = ['reset', 'rebase', 'checkout', 'push', 'clean', 'restore', 'amend'];
    for (const v of verbs)
      assert.ok(!forbidden.includes(v), `history-rewriting verb reached git: ${v}`);
  });

  it('keeps a canvas at its existing nested path instead of flattening it', {
    skip: gitOk ? false : 'git not available',
  }, async () => {
    const repo = tmp();
    mkdirSync(join(repo, '.design/ui'), { recursive: true });
    writeFileSync(join(repo, '.design/ui/Card.tsx'), 'old\n');
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 5, log: silent() });
    await agent.start();

    const doc = new Y.Doc();
    doc.getText('html').insert(0, 'new\n');
    const out = await agent.onDocumentStored({
      documentName: 'ws/a/main/ui-card',
      document: doc,
      user: null,
    });
    assert.deepEqual(out.written, ['ui/Card.tsx']);
    assert.equal(readFileSync(join(repo, '.design/ui/Card.tsx'), 'utf8'), 'new\n');
    assert.ok(
      !existsSync(join(repo, '.design/ui-card.tsx')),
      'must not flatten an existing canvas'
    );
    await agent.stop();
  });

  it('an unparseable document name is ignored, not guessed at', {
    skip: gitOk ? false : 'git not available',
  }, async () => {
    const repo = tmp();
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 5, log: silent() });
    await agent.start();
    const doc = new Y.Doc();
    doc.getText('html').insert(0, 'x');
    assert.equal(
      await agent.onDocumentStored({ documentName: '../../escape', document: doc, user: null }),
      null
    );
    await agent.stop();
  });
});

describe('seedRepo: a failed clone must be retryable', () => {
  it('removes the partial checkout so the next boot tries again', async () => {
    // The first real container run failed its clone on a missing CA bundle and
    // left `/repo/.git` behind. The "already initialized" guard then read that
    // as a completed seed, so every subsequent boot skipped seeding — one
    // transient network failure turning into a permanently empty workspace.
    const dir = tmp();
    const r = await seedRepo(
      dir,
      async () => {
        mkdirSync(join(dir, '.git'), { recursive: true }); // what a real clone leaves
        return { code: 128, stdout: '', stderr: 'certificate verification failed' };
      },
      { url: 'https://example.com/r.git', log: silent() }
    );
    assert.equal(r.state, 'failed');
    assert.ok(!existsSync(join(dir, '.git')), 'a partial clone must not look like a finished one');

    const retry = await seedRepo(dir, async () => ({ code: 0, stdout: '', stderr: '' }), {
      url: 'https://example.com/r.git',
      log: silent(),
    });
    assert.equal(retry.state, 'cloned', 'the next boot must be able to retry');
  });
});

describe('shutdown must not race the commit', () => {
  it('stop() flushes and REPORTS the commit rather than swallowing it', {
    skip: gitAvailable() ? false : 'git not available',
  }, async () => {
    const repo = tmp();
    // Long debounce, so nothing commits on its own — the only thing that can
    // produce a commit here is stop() doing its job.
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 60_000, log: silent() });
    await agent.start();
    const doc = new Y.Doc();
    doc.getText('html').insert(0, 'late edit\n');
    await agent.onDocumentStored({
      documentName: 'ws/a/main/home',
      document: doc,
      user: { name: 'Alice', email: 'alice@example.com' },
    });

    const outcome = await agent.stop();
    assert.ok(outcome?.ok, `stop() must commit and say so, got ${JSON.stringify(outcome)}`);
    const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim();
    assert.equal(count, '1', 'the edit made just before shutdown must be in history');
  });
});

describe('the hub owns its own shutdown', () => {
  it('Hocuspocus signal handling is OFF', async () => {
    // Hocuspocus installs SIGINT/SIGQUIT/SIGTERM handlers that `destroy()` and
    // then `process.exit(0)`. Ours flushes the pending commit first — and the
    // two race. Observed live: `git add` had run, `git commit` had not, and the
    // workspace shut down staged-but-uncommitted. Every migrated cell would
    // lose its last edits, and migration is the normal path for a cell.
    //
    // This is one config line, which is exactly the kind of thing a refactor
    // removes without a single test going red. Hence this test.
    const { createHub } = await import('../src/server.mjs');
    const built = createHub({ port: 0, dataDir: tmp(), secret: 'x', insecureHttp: true });
    assert.equal(
      built.server.configuration.stopOnSignals,
      false,
      'the hub must handle SIGTERM itself, or the shutdown flush is cut short'
    );
    built.stopBackgroundWork();
  });
});
