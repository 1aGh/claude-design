// Cloud Phase 20 — "you can leave".
//
// This is the promise the rest of the product rests on, so these tests are
// about completeness and honesty rather than plumbing: does the export contain
// the history, does it say what it does NOT contain, and does it refuse rather
// than hand somebody a broken archive at the moment they are leaving.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { assetManifest, buildExport, exportStamp, manifestText } from '../src/export.mjs';
import { createGitRunner } from '../src/git-runner.mjs';

const temps = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'maude-export-'));
  temps.push(d);
  return d;
}
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
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

function project() {
  const dir = tmp();
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  mkdirSync(join(dir, '.design/assets'), { recursive: true });
  writeFileSync(join(dir, '.design/Home.tsx'), 'export default () => null;\n');
  writeFileSync(join(dir, '.design/Home.meta.json'), '{"title":"Home"}\n');
  writeFileSync(join(dir, '.design/assets/a1b2c3d4.png'), 'png-bytes');
  git('init', '-b', 'main');
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e.com');
  git('add', '-A');
  git('commit', '-m', 'first');
  return dir;
}

describe('an export is a project you can walk away with', () => {
  it('contains the HISTORY, not a copy of current files', { skip }, async () => {
    // A zip of the working tree loses the record of how the work got there,
    // which is most of what a design project is.
    const dir = project();
    const out = await buildExport({ repoDir: dir, tenant: 'acme', run: createGitRunner() });
    assert.equal(out.ok, true, out.reason);

    const names = out.files.map((f) => f.name).sort();
    assert.deepEqual(names, ['MANIFEST.md', 'assets.json', 'repo.bundle']);

    // Prove it: clone the bundle and read the history back.
    const bundlePath = join(tmp(), 'repo.bundle');
    writeFileSync(bundlePath, out.files.find((f) => f.name === 'repo.bundle').body);
    const dest = join(tmp(), 'restored');
    execFileSync('git', ['clone', '--', bundlePath, dest], { stdio: 'ignore' });
    assert.equal(
      execFileSync('git', ['log', '--format=%s'], { cwd: dest, encoding: 'utf8' }).trim(),
      'first'
    );
  });

  it('lists every asset with a key and a size', { skip }, async () => {
    // Without the sizes a reader cannot tell whether their download finished.
    const out = await buildExport({ repoDir: project(), tenant: 'acme', run: createGitRunner() });
    const manifest = JSON.parse(out.files.find((f) => f.name === 'assets.json').body.toString());
    assert.equal(manifest.count, 1);
    assert.deepEqual(manifest.assets[0], {
      name: 'a1b2c3d4.png',
      bytes: 9,
      key: 'tenants/acme/assets/a1b2c3d4.png',
    });
    assert.equal(manifest.totalBytes, 9);
  });

  it('refuses rather than exporting an empty project as if it worked', { skip }, async () => {
    const dir = tmp();
    execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'ignore' });
    const out = await buildExport({ repoDir: dir, tenant: 'acme', run: createGitRunner() });
    assert.equal(out.ok, false);
    assert.match(out.reason, /nothing to export/);
  });

  it('an unreadable assets directory costs the manifest, not the export', { skip }, async () => {
    // The history is the irreplaceable part. Losing the export because the
    // media listing failed would be the wrong trade at the worst moment.
    const dir = project();
    rmSync(join(dir, '.design/assets'), { recursive: true, force: true });
    const out = await buildExport({ repoDir: dir, tenant: 'acme', run: createGitRunner() });
    assert.equal(out.ok, true);
    assert.equal(JSON.parse(out.files.find((f) => f.name === 'assets.json').body).count, 0);
  });
});

describe('the manifest says what is NOT there', () => {
  it('names the omissions as plainly as the contents', () => {
    // An export that quietly omits something is worse than one that refuses:
    // the reader finds out months later, when the original is gone.
    const text = manifestText({
      project: 'acme',
      canvases: 3,
      assets: 2,
      totalBytes: 2_500_000,
      stamp: '20260729T170411Z',
    });
    assert.match(text, /## What is NOT here/);
    assert.match(text, /Comments, presence, and per-machine state/);
    assert.match(text, /media bytes themselves/);
    assert.match(text, /only\s+acme/);
  });

  it('tells the reader how to open it without Maude', () => {
    const text = manifestText({
      project: 'acme',
      canvases: 1,
      assets: 0,
      totalBytes: 0,
      stamp: 'x',
    });
    assert.match(text, /git clone repo\.bundle acme/);
    assert.match(text, /Nothing about it depends on Maude/);
  });

  it('says how to tell a bad download from a bad archive', () => {
    const text = manifestText({
      project: 'acme',
      canvases: 1,
      assets: 0,
      totalBytes: 0,
      stamp: 'x',
    });
    assert.match(text, /git bundle verify/);
    assert.match(text, /download is incomplete/);
  });
});

describe('exports never collide', () => {
  it('stamps are sortable, so "latest" is lexical', () => {
    const a = exportStamp(new Date('2026-07-29T17:04:11.123Z'));
    const b = exportStamp(new Date('2026-07-29T17:04:12.000Z'));
    assert.equal(a, '20260729T170411Z');
    assert.ok(a < b);
  });

  it('a manifest only ever describes its own project', () => {
    const m = assetManifest([{ name: 'x.png', bytes: 1 }], 'acme');
    assert.equal(m.project, 'acme');
    assert.match(m.assets[0].key, /^tenants\/acme\//);
  });
});
