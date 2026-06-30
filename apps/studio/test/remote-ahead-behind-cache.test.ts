// DDR-132 — remote ahead/behind probe: in-memory TTL cache + in-flight dedupe.
//
// Verifies the cache WRAPPER (TTL-serve / invalidate / in-flight coalesce) fully
// offline, with no network and no git spawn. Trick: the probe's DDR-131 transport
// gate classifies a bare local-path remote as `unsafe`, so `remoteAheadBehind`
// returns a FRESH `{ahead:0,behind:0}` object on every *uncached* evaluation
// without touching the network. Object IDENTITY (`Object.is`) therefore tells a
// cache-serve (same reference) apart from a re-run (new reference) — a stronger
// signal than value equality, and one the security hardening can't invalidate.
//
// (The real fetch/count path needs a reachable github.com remote and is covered
// by the manual native dogfood — same offline ceiling DDR-131 records for
// `gitFetchRemote`. This file owns the wrapper semantics only.)
//
// This file deliberately does NOT set MAUDE_USE_SYSTEM_GIT (it would leak into the
// shared bun-test process and flip other files' iso-engine expectations).

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { invalidateRemoteProbe, remoteAheadBehind } from '../git/service.ts';

function git(cwd: string, args: string[]): void {
  const p = Bun.spawnSync(['git', ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  if (p.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${p.stderr.toString()}`);
}

let work: string;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'maude-ab-work-'));
  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['config', 'user.email', 't@t.dev']);
  git(work, ['config', 'user.name', 'Tester']);
  writeFileSync(join(work, 'a.txt'), 'hello\n');
  git(work, ['add', '.']);
  git(work, ['commit', '-q', '-m', 'init']);
  // A bare local path → DDR-131 transport gate classifies it `unsafe` → the probe
  // returns {0,0} with no spawn. (Any value is fine; we assert on identity.)
  git(work, ['remote', 'add', 'origin', '/var/empty/maude-test-remote']);
});

afterEach(() => {
  invalidateRemoteProbe(work);
  rmSync(work, { recursive: true, force: true });
});

test('a second call within the TTL serves the cached object (no re-run)', async () => {
  const a = await remoteAheadBehind(work, undefined);
  expect(a).toEqual({ ahead: 0, behind: 0 });
  const b = await remoteAheadBehind(work, undefined);
  expect(Object.is(a, b)).toBe(true); // same reference ⇒ served from cache
});

test('invalidateRemoteProbe forces a fresh evaluation (new object)', async () => {
  const a = await remoteAheadBehind(work, undefined);
  invalidateRemoteProbe(work);
  const c = await remoteAheadBehind(work, undefined);
  expect(c).toEqual({ ahead: 0, behind: 0 });
  expect(Object.is(a, c)).toBe(false); // new reference ⇒ re-ran after invalidation
});

test('SECURITY (DDR-133 F1): the unattended probe never fetches a non-github HTTP remote', async () => {
  // Repoint origin to a non-github HTTPS host (a poisoned `.git/config` riding a clone).
  // With system git auto-preferred (DDR-133), the host-allowlist must gate this probe
  // BEFORE the engine branch — otherwise an http transport reached `git fetch` against
  // ANY host on the unattended 45s poll (SSRF / presence beacon). The guard returns
  // {0,0} with NO spawn; a regression would attempt the fetch and reject/hang here.
  git(work, ['remote', 'set-url', 'origin', 'https://evil.example.invalid/repo.git']);
  invalidateRemoteProbe(work);
  const r = await remoteAheadBehind(work, 'tok_must_never_be_sent');
  expect(r).toEqual({ ahead: 0, behind: 0 });
});

test('concurrent callers coalesce onto one shared in-flight result', async () => {
  const [a, b, c] = await Promise.all([
    remoteAheadBehind(work, undefined),
    remoteAheadBehind(work, undefined),
    remoteAheadBehind(work, undefined),
  ]);
  // One shared in-flight promise (or the just-written cache) ⇒ identical reference,
  // never three independent evaluations.
  expect(Object.is(a, b)).toBe(true);
  expect(Object.is(b, c)).toBe(true);
});
