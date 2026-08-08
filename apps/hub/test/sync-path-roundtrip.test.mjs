// The falsifier for "sync carries the path".
//
// A canvas syncs; its LOCATION does not. The document name is a flattened slug
// (`ui/2026/social/summer-camp.tsx` → `ui-2026-social-summer-camp`) and `/`→`-`
// is not reversible, so both receivers give up the same way and write the body
// flat at the design root — where the file tree and `scanCanvases` (which
// enumerate `config.canvasGroups`) cannot see it. Sync succeeds and the canvas
// is invisible.
//
// WHY THIS LIVES IN apps/hub/test AND NOT apps/studio/test, as the plan said.
// The plan asked for `apps/studio/test/sync-path-roundtrip.test.ts`. A real hub
// needs `@hocuspocus/server`, which is a dependency of apps/hub and is NOT
// reachable from apps/studio's own `bun install` (DDR-009 — the studio installs
// independently). Adding a hub server to the studio's tree to place a test file
// would put a server dependency into the compiled sidecar's install for the
// sake of a filename. The hub's test dir already imports studio modules
// directly (`../../studio/sync/*.ts`, see two-machine-workspace.test.mjs), so
// BOTH halves are reachable here and neither is reachable there.
//
// The two halves under test:
//   cloud direction  — the hub's workspace agent materialising a document it
//                      has never seen into a checkout (black box, real git-less
//                      agent, real files);
//   desktop direction — the studio's `pullTargets` deciding where a hub-only
//                      document lands on a peer with an EMPTY design root.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, describe, it } from 'node:test';

import * as Y from 'yjs';

import { createWorkspaceAgent } from '../src/workspace-agent.mjs';

const temps = [];
function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'maude-path-roundtrip-'));
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

/** The canvas the whole feature is about: a folder the receiver does not have. */
const NESTED_REL = 'ui/2026/social/summer-camp.tsx';
const NESTED_SLUG = 'ui-2026-social-summer-camp';
const BODY = 'export default () => <main>summer camp</main>;\n';

/** A document as a peer that knows its own path would put it on the wire. */
function docWith(body, path) {
  const doc = new Y.Doc();
  doc.getText('html').insert(0, body);
  if (path !== null && path !== undefined) doc.getMap('syncMeta').set('path', path);
  return doc;
}

/** A checkout with a design root and (optionally) files already in it. */
function checkout(files = {}) {
  const root = tmp();
  mkdirSync(join(root, '.design'), { recursive: true });
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Seed'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'seed@example.com'], { cwd: root, stdio: 'ignore' });
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, '.design', rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, text);
  }
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'seed', '--allow-empty'], { cwd: root, stdio: 'ignore' });
  return root;
}

/* ------------------------------------------------- the cloud receiver ----- */

describe('the hub materialises a document at the path it carries', () => {
  const skip = gitAvailable() ? false : 'git not available';

  it('a canvas in a folder the checkout has never seen lands at its real path', {
    skip,
  }, async () => {
    const repo = checkout();
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 5, log: silent() });
    await agent.start();

    await agent.onDocumentStored({
      documentName: `ws/acme/main/${NESTED_SLUG}`,
      document: docWith(BODY, NESTED_REL),
      user: { name: 'Alice', email: 'alice@example.com' },
    });
    await agent.stop();

    const wanted = join(repo, '.design', NESTED_REL);
    const flat = join(repo, '.design', `${NESTED_SLUG}.tsx`);

    // Settle the open question the plan left open — `countCanvases()` said 71
    // against 76 documents, which is consistent with "wrote it flat" AND with
    // "wrote nothing". Record whichever it is, so the fix has a baseline.
    const observed = existsSync(wanted) ? 'nested' : existsSync(flat) ? 'flat' : 'nothing';
    assert.equal(
      observed,
      'nested',
      `the body must land at ${NESTED_REL}; observed: ${observed} ` +
        '(a flat file at the design root is in NO canvas group, so the tree ' +
        'does not list it and scanCanvases does not sync it onward)'
    );
    assert.equal(readFileSync(wanted, 'utf8'), BODY);
  });

  it('a file the checkout already has is NOT relocated by a remote path', { skip }, async () => {
    // The regression guard for the warm `pathIndex` path — and a security
    // property: a peer must not be able to move another peer's files.
    const repo = checkout({ 'ui/Card.tsx': 'export default () => null;\n' });
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 5, log: silent() });
    await agent.start();

    await agent.onDocumentStored({
      documentName: 'ws/acme/main/ui-card',
      document: docWith('export default () => <b>edited</b>;\n', 'ui/somewhere/else/Card.tsx'),
      user: { name: 'Alice', email: 'alice@example.com' },
    });
    await agent.stop();

    assert.match(
      readFileSync(join(repo, '.design/ui/Card.tsx'), 'utf8'),
      /edited/,
      'the existing file is the one that must receive the edit'
    );
    assert.ok(
      !existsSync(join(repo, '.design/ui/somewhere/else/Card.tsx')),
      'pathIndex wins — a remote path must never relocate a file that exists'
    );
  });

  it('a document with NO path still arrives, inside a canvas group', { skip }, async () => {
    // An older peer omits `syncMeta.path`. It must keep working — and the
    // fallback must land somewhere the tree LISTS, which the design root is
    // not (it is inside no `canvasGroups` entry).
    const repo = checkout();
    const agent = createWorkspaceAgent({ repoDir: repo, debounceMs: 5, log: silent() });
    await agent.start();

    await agent.onDocumentStored({
      documentName: 'ws/acme/main/ui-legacy',
      document: docWith('export default () => null;\n', null),
      user: { name: 'Alice', email: 'alice@example.com' },
    });
    await agent.stop();

    assert.ok(
      existsSync(join(repo, '.design/ui/legacy.tsx')),
      'an un-pathed canvas must land inside a canvas group, not at the design root — ' +
        'and at a path that still slugs back to `ui-legacy`, or the fallback forks the document'
    );
  });
});

/* ----------------------------------------------- the desktop receiver ----- */

describe('a peer with an EMPTY design root pulls the project down whole', () => {
  it('a hub-only document lands at the path it carries', async () => {
    const { pullTargets } = await import('../../studio/sync/remote-docs.ts');
    const designRoot = join(tmp(), '.design');
    mkdirSync(designRoot, { recursive: true });

    const targets = pullTargets(
      [{ name: `ws/acme/main/${NESTED_SLUG}`, bytes: BODY.length }],
      designRoot,
      join,
      resolve,
      sep,
      {
        designRel: '.design',
        canvasGroups: [{ path: 'system' }, { path: 'ui' }],
        // In production the path is read from the DOCUMENT after it syncs — the
        // listing carries names and byte counts only. Injected here so the law
        // is expressed in one place rather than behind a live socket.
        pathFor: () => NESTED_REL,
      }
    );

    assert.equal(targets.length, 1);
    assert.equal(
      targets[0].bodyAbs,
      join(designRoot, NESTED_REL),
      'the pulled canvas must land in the folder its author put it in'
    );
  });

  it('a hub-only document with NO path lands inside a canvas group', async () => {
    const { pullTargets } = await import('../../studio/sync/remote-docs.ts');
    const designRoot = join(tmp(), '.design');
    mkdirSync(designRoot, { recursive: true });

    const targets = pullTargets(
      [{ name: 'ws/acme/main/ui-legacy', bytes: 10 }],
      designRoot,
      join,
      resolve,
      sep,
      {
        designRel: '.design',
        canvasGroups: [{ path: 'system' }, { path: 'ui' }],
        pathFor: () => null,
      }
    );

    assert.equal(
      targets[0].bodyAbs,
      join(designRoot, 'ui', 'legacy.tsx'),
      'the fallback must be visible — a file at the design root is in no canvas group'
    );
  });
});
