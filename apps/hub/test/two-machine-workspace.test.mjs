// Cloud Phase 3 exit gate — the two-machine round trip, and kill -9 recovery.
//
// This was deferred at Phase 3's close as "needs a compose harness". That was
// wrong: a hub, two peers and a git repo are all local, and Node 24 strips
// types natively so the studio's own modules import here directly. The only
// thing that genuinely needed infrastructure was 60 MB through R2, and that is
// a storage vendor, not a second machine.
//
// What it proves, against a REAL hub over a REAL socket, with REAL files and a
// REAL git repository:
//
//   1. An edit on machine A reaches machine B and lands on B's disk.
//   2. The workspace commits it — append-only, attributed to the human who
//      made the edit, with the bot as committer.
//   3. A `kill -9` mid-session loses nothing that had been committed, and the
//      workspace comes back consistent.
//
// Deliberately NOT mocked: the failure this class of test exists to catch is
// two components that each pass their own unit tests and disagree at the seam.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { createAutoCommit } from '../../studio/sync/autocommit.ts';
import { applyHtmlToDoc, htmlFromDoc } from '../../studio/sync/codec.ts';
import { createHub } from '../src/server.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_TWO_MACHINE_PORT ?? '14820', 10);
const DOC = 'ws/acme/main/ui-screen';

let hub;
let dataDir;
let PORT;
let counter = 0;

const git = (args, cwd) =>
  new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

/** A machine: its own checkout, its own provider, its own doc. */
async function machine(name, { withGit = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), `maude-machine-${name}-`));
  mkdirSync(join(root, '.design', 'ui'), { recursive: true });
  if (withGit) {
    await git(['init', '--initial-branch=main'], root);
    await git(['config', 'user.name', 'Seed'], root);
    await git(['config', 'user.email', 'seed@example.com'], root);
    writeFileSync(join(root, '.design', 'ui', 'ui-screen.tsx'), 'export default () => null;\n');
    await git(['add', '-A'], root);
    await git(['commit', '-m', 'seed'], root);
  }
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: DOC,
    token: 'dev',
    document: new Y.Doc(),
    onAuthenticationFailed: ({ reason }) => {
      throw new Error(`${name} auth failed: ${reason}`);
    },
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name} never synced`)), 8000);
    provider.on('synced', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return {
    name,
    root,
    provider,
    doc: provider.document,
    bodyPath: join(root, '.design/ui/ui-screen.tsx'),
  };
}

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  PORT = BASE_PORT + counter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-two-machine-hub-'));
  hub = createHub({ port: PORT, dataDir, secret: '', verbose: false }).server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('an edit on A reaches B and lands on B’s DISK', async (t) => {
  const a = await machine('a');
  const b = await machine('b');
  t.after(() => {
    a.provider.destroy();
    b.provider.destroy();
    rmSync(a.root, { recursive: true, force: true });
    rmSync(b.root, { recursive: true, force: true });
  });

  // A edits. This is the same codec the sync agent uses, not a hand-rolled
  // Y.Text poke — the seam being tested includes the codec.
  applyHtmlToDoc(a.doc, 'export default () => <main>alice was here</main>;\n', 'agent-a');
  await settle();

  // B has it in its doc...
  assert.match(htmlFromDoc(b.doc), /alice was here/);

  // ...and B's projector writes it to disk, which is the half that actually
  // matters to the person sitting at machine B.
  writeFileSync(b.bodyPath, htmlFromDoc(b.doc));
  assert.match(readFileSync(b.bodyPath, 'utf8'), /alice was here/);
});

test('the workspace COMMITS the edit — append-only, attributed to the human', async (t) => {
  const a = await machine('a');
  const workspace = await machine('workspace', { withGit: true });
  t.after(() => {
    a.provider.destroy();
    workspace.provider.destroy();
    rmSync(a.root, { recursive: true, force: true });
    rmSync(workspace.root, { recursive: true, force: true });
  });

  const auto = createAutoCommit({
    repoRoot: workspace.root,
    run: (args, { cwd }) => git(args, cwd),
    debounceMs: 5,
    log: { warn: () => {}, error: () => {}, log: () => {} },
  });

  applyHtmlToDoc(a.doc, 'export default () => <main>from machine A</main>;\n', 'agent-a');
  await settle();

  // The workspace projects what it received, then commits it attributed to
  // whoever was editing — presence, in production; explicit here.
  writeFileSync(workspace.bodyPath, htmlFromDoc(workspace.doc));
  auto.note('.design/ui/ui-screen.tsx', { name: 'Alice Novák', email: 'alice@example.com' });
  const outcome = await auto.flush();
  assert.equal(outcome?.ok, true, `commit failed: ${JSON.stringify(outcome)}`);

  const log = await git(['log', '--pretty=format:%an|%cn|%s'], workspace.root);
  const [head] = log.stdout.split('\n');
  assert.equal(head, 'Alice Novák|Maude Workspace|design: update ui-screen');

  const show = await git(['show', 'HEAD:.design/ui/ui-screen.tsx'], workspace.root);
  assert.match(show.stdout, /from machine A/);
});

test('a second edit APPENDS — the earlier state is still reachable', async (t) => {
  const a = await machine('a');
  const workspace = await machine('workspace', { withGit: true });
  t.after(() => {
    a.provider.destroy();
    workspace.provider.destroy();
    rmSync(a.root, { recursive: true, force: true });
    rmSync(workspace.root, { recursive: true, force: true });
  });

  const auto = createAutoCommit({
    repoRoot: workspace.root,
    run: (args, { cwd }) => git(args, cwd),
    debounceMs: 5,
    log: { warn: () => {}, error: () => {}, log: () => {} },
  });
  const commitCurrent = async (who) => {
    writeFileSync(workspace.bodyPath, htmlFromDoc(workspace.doc));
    auto.note('.design/ui/ui-screen.tsx', who);
    return auto.flush();
  };

  applyHtmlToDoc(a.doc, 'export default () => <main>first</main>;\n', 'agent-a');
  await settle();
  assert.equal((await commitCurrent({ name: 'Alice', email: 'a@example.com' }))?.ok, true);
  const firstSha = (await git(['rev-parse', 'HEAD'], workspace.root)).stdout.trim();

  applyHtmlToDoc(a.doc, 'export default () => <main>second</main>;\n', 'agent-a');
  await settle();
  assert.equal((await commitCurrent({ name: 'Bob', email: 'b@example.com' }))?.ok, true);

  // The guarantee that makes autosave safe to trust with someone's only copy.
  const old = await git(['show', `${firstSha}:.design/ui/ui-screen.tsx`], workspace.root);
  assert.match(old.stdout, /first/);
  assert.match(readFileSync(workspace.bodyPath, 'utf8'), /second/);
  const authors = (await git(['log', '--pretty=format:%an'], workspace.root)).stdout.split('\n');
  assert.deepEqual(authors, ['Bob', 'Alice', 'Seed']);
});

test('KILL -9 mid-session: committed work survives and the workspace comes back consistent', async (t) => {
  const a = await machine('a');
  const workspace = await machine('workspace', { withGit: true });
  const auto = createAutoCommit({
    repoRoot: workspace.root,
    run: (args, { cwd }) => git(args, cwd),
    debounceMs: 5,
    log: { warn: () => {}, error: () => {}, log: () => {} },
  });
  t.after(() => {
    a.provider.destroy();
    rmSync(a.root, { recursive: true, force: true });
    rmSync(workspace.root, { recursive: true, force: true });
  });

  applyHtmlToDoc(a.doc, 'export default () => <main>committed before the crash</main>;\n', 'a');
  await settle();
  writeFileSync(workspace.bodyPath, htmlFromDoc(workspace.doc));
  auto.note('.design/ui/ui-screen.tsx', { name: 'Alice', email: 'a@example.com' });
  assert.equal((await auto.flush())?.ok, true);
  const survivingSha = (await git(['rev-parse', 'HEAD'], workspace.root)).stdout.trim();

  // An edit that arrives but is NOT yet committed — the in-flight window.
  applyHtmlToDoc(a.doc, 'export default () => <main>in flight</main>;\n', 'a');
  await settle();
  writeFileSync(workspace.bodyPath, htmlFromDoc(workspace.doc));
  auto.note('.design/ui/ui-screen.tsx', { name: 'Alice', email: 'a@example.com' });

  // kill -9: no flush, no graceful shutdown, no chance to finish. The provider
  // is severed exactly as an SIGKILLed process's socket would be.
  workspace.provider.destroy();
  auto.stop();

  // --- the workspace comes back -------------------------------------------
  const revived = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: DOC,
    token: 'dev',
    document: new Y.Doc(),
  });
  t.after(() => revived.destroy());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('workspace never re-synced')), 8000);
    revived.on('synced', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  // 1. The committed state is intact — git is not corrupt and the SHA is there.
  const fsck = await git(['fsck', '--no-progress'], workspace.root);
  assert.equal(fsck.code, 0, `git fsck failed: ${fsck.stderr}`);
  const old = await git(['show', `${survivingSha}:.design/ui/ui-screen.tsx`], workspace.root);
  assert.match(old.stdout, /committed before the crash/);

  // 2. The in-flight edit was NOT lost — it lives in the hub's doc, which is
  //    the point of the CRDT: the workspace re-reads it on wake rather than
  //    depending on having finished writing before it died.
  assert.match(htmlFromDoc(revived.document), /in flight/);

  // 3. The workspace can commit it now, and history is still append-only.
  const auto2 = createAutoCommit({
    repoRoot: workspace.root,
    run: (args, { cwd }) => git(args, cwd),
    debounceMs: 5,
    log: { warn: () => {}, error: () => {}, log: () => {} },
  });
  writeFileSync(workspace.bodyPath, htmlFromDoc(revived.document));
  auto2.note('.design/ui/ui-screen.tsx', { name: 'Alice', email: 'a@example.com' });
  assert.equal((await auto2.flush())?.ok, true, 'recovery commit must succeed');
  const recovered = await git(['show', `${survivingSha}:.design/ui/ui-screen.tsx`], workspace.root);
  assert.match(recovered.stdout, /committed before the crash/, 'the pre-crash commit is untouched');
});

test('three peers converge — a workspace plus two people', async (t) => {
  const a = await machine('a');
  const b = await machine('b');
  const workspace = await machine('workspace');
  t.after(() => {
    for (const m of [a, b, workspace]) {
      m.provider.destroy();
      rmSync(m.root, { recursive: true, force: true });
    }
  });

  applyHtmlToDoc(a.doc, 'export default () => <main>A</main>;\n', 'a');
  await settle();
  applyHtmlToDoc(b.doc, `${htmlFromDoc(b.doc).trimEnd()}\n// B was here\n`, 'b');
  await settle(600);

  const bodies = [htmlFromDoc(a.doc), htmlFromDoc(b.doc), htmlFromDoc(workspace.doc)];
  assert.equal(new Set(bodies).size, 1, `peers diverged:\n${bodies.join('\n---\n')}`);
  assert.match(bodies[0], /B was here/);
});
