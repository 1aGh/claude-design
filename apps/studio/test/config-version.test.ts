// The running version reaches the client — feature-release-reaches-the-fleet.
//
// Reading which release a Maude was actually running used to mean probing
// production by hand, and the first probe of the v0.57.0 incident was MISREAD
// (a 401 that looked like "route exists" was the blanket answer for any unknown
// path). The fix has three surfaces reporting one version: the hub's `/health`,
// this `/_config`, and the status-bar chip the client draws from it.
//
// What is asserted here is the middle one, plus the two properties that make it
// safe to put there: it is resolved through the SINGLE version function, and it
// carries nothing else.

import { afterAll, describe, expect, test } from 'bun:test';
import type { Subprocess } from 'bun';

import { resolveMaudeVersion } from '../whats-new.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const procs: Subprocess[] = [];
afterAll(async () => {
  for (const p of procs) await killProc(p);
});

async function boot(env: Record<string, string> = {}) {
  const { root } = makeSandbox();
  const port = nextPort();
  procs.push(await bootServer(root, port, env));
  return `http://localhost:${port}`;
}

describe('/_config names the release it is running', () => {
  test('the version is present, and is a real version', async () => {
    const base = await boot();
    const cfg = (await (await fetch(`${base}/_config`)).json()) as { version?: string };

    expect(typeof cfg.version).toBe('string');
    // `0.0.0` was the private-workspace placeholder these manifests carried
    // before they joined the release line — reporting it is the bug, not a pass.
    expect(cfg.version).not.toBe('0.0.0');
    expect(cfg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('it is the SAME answer the What’s New feed uses', async () => {
    // One resolution path (DDR-045). Two would eventually disagree, and a chip
    // that contradicts the feed beside it is worse than no chip.
    const base = await boot();
    const cfg = (await (await fetch(`${base}/_config`)).json()) as { version?: string };
    const feed = (await (await fetch(`${base}/_api/whats-new`)).json()) as { version?: string };

    expect(cfg.version).toBe(resolveMaudeVersion());
    expect(cfg.version).toBe(feed.version);
  });
});

describe('the version rides along, and nothing else does', () => {
  test('a cloud tab gets the version too', async () => {
    // `/_config` reaches a browser on someone else's machine in workspace mode.
    // A git tag is public, so the version is fine there — this pins that it
    // actually arrives, since the chip is the cloud's only version surface.
    const base = await boot({
      MAUDE_WORKSPACE_MODE: '1',
      MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
      MAUDE_PROJECT_NAME: 'Alligators',
    });
    const cfg = (await (await fetch(`${base}/_config`)).json()) as {
      version?: string;
      cloud?: unknown;
    };

    expect(typeof cfg.version).toBe('string');
    expect(cfg.cloud).toBeDefined();
  });

  test('no server path or secret came with it', async () => {
    const base = await boot();
    const cfg = (await (await fetch(`${base}/_config`)).json()) as Record<string, unknown>;

    // The version was the one field this change added. Anything matching these
    // shapes arriving in the browser payload is a leak, and the review that
    // waves it through will be the one that reads "it was already there".
    for (const key of Object.keys(cfg)) {
      expect(key).not.toMatch(/token$/i);
      expect(key).not.toMatch(/secret|password|apiKey/i);
    }
    const serialized = JSON.stringify(cfg);
    expect(serialized).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
  });
});
