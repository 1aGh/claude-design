// One log shape, three producers — feature-cloud-managed-git-posture.
//
// A History row is drawn by ONE renderer (`GitPanel`), and it can now be fed by
// three different readers: system-git (`logSystem`), isomorphic-git (`logIso`)
// and the cloud cell (`apps/hub/src/history.mjs`). The first and the third are
// the same code — that is what `git/log-format.ts` is for. The second is a
// separate implementation against a separate library, and it is the one that
// can quietly drift.
//
// The failure mode is specific and quiet: a reader that stops emitting `date`
// (or emits `authorName` instead of `author`) does not throw anywhere. It draws
// a row with a blank field, on whichever of the two engines the reader happens
// to be on — so it is invisible on the machine of whoever made the change.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GIT_LOG_FORMAT, gitLogArgs, gitLogEnv, parseGitLog } from '../git/log-format.ts';

const SERVICE = readFileSync(join(import.meta.dir, '..', 'git', 'service.ts'), 'utf8');

/** The contract `GitLogEntry` declares and `GitPanel` reads. */
const FIELDS = ['sha', 'message', 'author', 'email', 'date'] as const;

describe('parseGitLog', () => {
  test('produces exactly the declared fields', () => {
    const rec = `abc123\x1fa message\x1fAda\x1fada@example.com\x1f2026-08-18T10:00:00+02:00\x1e`;
    const [entry] = parseGitLog(rec);
    expect(Object.keys(entry).sort()).toEqual([...FIELDS].sort());
  });

  test('survives every separator a commit subject can carry', () => {
    const msg = 'fix: tabs\tquotes " and a | pipe, plus a comma';
    const [entry] = parseGitLog(`sha\x1f${msg}\x1fAda\x1fa@b.c\x1f2026-08-18T10:00:00Z\x1e`);
    expect(entry.message).toBe(msg);
  });

  test('a short record still yields strings, never undefined', () => {
    // A renderer must never have to defend against a half-parsed row.
    const [entry] = parseGitLog('justasha\x1fonly a message\x1e');
    for (const f of FIELDS) expect(typeof entry[f]).toBe('string');
  });

  test('garbage is an empty list, never a throw', () => {
    expect(parseGitLog('')).toEqual([]);
    expect(parseGitLog('\x1e\x1e  \x1e')).toEqual([]);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately hostile input
    expect(parseGitLog(null as any)).toEqual([]);
  });
});

describe('gitLogArgs / gitLogEnv travel together', () => {
  test('the format string is the one the parser splits on', () => {
    expect(GIT_LOG_FORMAT).toContain('%x1f');
    expect(GIT_LOG_FORMAT).toContain('%x1e');
    expect(gitLogArgs(30)).toEqual(['log', '-n30', `--pretty=format:${GIT_LOG_FORMAT}`]);
  });

  test('a scoped log terminates its pathspec AND asks for literal pathspecs', () => {
    // The `--` terminator alone does not close pathspec magic (`:(exclude)…`);
    // GIT_LITERAL_PATHSPECS does, and the two must never be separated.
    const args = gitLogArgs(10, '.design/ui/Card.tsx');
    expect(args[args.length - 2]).toBe('--');
    expect(args[args.length - 1]).toBe('.design/ui/Card.tsx');
    expect(gitLogEnv('.design/ui/Card.tsx')).toEqual({ GIT_LITERAL_PATHSPECS: '1' });
  });

  test('an unscoped log asks for neither', () => {
    expect(gitLogArgs(10)).not.toContain('--');
    expect(gitLogEnv(undefined)).toBeUndefined();
  });
});

describe('the isomorphic-git engine has not drifted from the shared shape', () => {
  test('logSystem reads through the shared module rather than re-typing it', () => {
    expect(SERVICE).toContain('gitLogArgs(limit, filepath), gitLogEnv(filepath)');
    expect(SERVICE).toContain('return parseGitLog(r.stdout);');
    // The old literal must be GONE, not merely unused — a leftover copy is the
    // thing a later edit picks up.
    expect(SERVICE).not.toContain("const fmt = '%H%x1f");
  });

  test('logIso still emits exactly the same five fields', () => {
    // Source-level, because `logIso` is a private fallback with no seam to call
    // it through: forcing the engine would mean exporting it, which invents an
    // API for the test to check. The literal it returns IS the contract.
    const body = SERVICE.slice(SERVICE.indexOf('async function logIso('));
    const literal = body.slice(body.indexOf('return {'), body.indexOf('};') + 2);
    for (const f of FIELDS) expect(literal).toContain(`${f}:`);
    // …and nothing else, so a sixth field can't appear on one engine only.
    const keys = [...literal.matchAll(/^\s{8}([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...FIELDS].sort());
  });
});
