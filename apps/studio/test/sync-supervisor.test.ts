// The sync supervisor — the piece that makes "Connect" mean "syncing", not
// "now go restart something".
//
// The runtime itself is injected here (a fake factory): what is under test is
// the SUPERVISION — that a just-authorized link is adopted in memory and
// applied by a real stop→start cycle, that two Connects can't interleave, and
// that a refusal comes back as a sentence a person can act on instead of a
// silent null.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { type Context, createBus, type DevServerConfig } from '../context.ts';
import type { SyncProvider, SyncRuntime } from '../sync/index.ts';
import { createSyncSupervisor } from '../sync/supervisor.ts';

let hubsEnv: string | undefined;

beforeEach(() => {
  hubsEnv = process.env.HUBS_CONFIG_PATH;
});

afterEach(() => {
  // Assigning undefined would store the literal string "undefined".
  if (hubsEnv === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = hubsEnv;
});

function makeCtx(linkedHub?: DevServerConfig['linkedHub']): Context {
  const dir = mkdtempSync(join(tmpdir(), 'sync-supervisor-'));
  const designRoot = join(dir, '.design');
  return {
    cfg: {
      name: 'test',
      projectLabel: null,
      designRoot: '.design',
      canvasGroups: [{ label: 'Canvases', path: 'ui' }],
      rootClass: 'app',
      themeDefault: 'dark',
      tokensCssRel: 'system/colors.css',
      teamAccentDefault: null,
      handoffTargets: [],
      newCanvasDir: 'ui',
      newComponentDir: 'ui/components',
      linkedHub,
      _source: 'defaults',
    },
    projectLabel: 'test',
    paths: {
      repoRoot: dir,
      designRel: '.design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: '.design/system/colors.css',
      systemDirRel: 'system',
    },
    bus: createBus(),
  };
}

/** A runtime that records its lifecycle and reports `size` canvases. */
function fakeRuntime(log: string[], id: string, size = 3): SyncRuntime {
  return {
    start: async () => {
      log.push(`start:${id}`);
    },
    stop: async () => {
      log.push(`stop:${id}`);
    },
    size: () => size,
    agentFor: () => undefined,
    status: () => null,
    cancelAssetSweep: () => false,
  };
}

describe('createSyncSupervisor', () => {
  test('an unlinked project starts nothing and says so in words', async () => {
    const ctx = makeCtx();
    const sup = createSyncSupervisor(ctx, {}, () => null);
    const out = await sup.start();
    expect(out.syncing).toBe(false);
    expect(out.reason).toBe('unlinked');
    expect(out.detail).toMatch(/not linked/i);
    expect(sup.current()).toBeNull();
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('restart adopts the link it is HANDED and cycles the runtime', async () => {
    const ctx = makeCtx();
    const log: string[] = [];
    let n = 0;
    const sup = createSyncSupervisor(ctx, {}, (c) =>
      c.cfg.linkedHub ? fakeRuntime(log, `r${++n}`) : null
    );

    // Boot unlinked — solo mode, exactly as before.
    expect((await sup.start()).syncing).toBe(false);
    expect(log).toEqual([]);

    // The attach lane hands the value it just wrote; the supervisor adopts it
    // (never re-reading the committed config file) and starts syncing.
    const link = { url: 'https://hub.example', linkedAt: 1, syncTsx: false };
    const out = await sup.restart(link);
    expect(out).toEqual({ syncing: true, canvases: 3 });
    expect(ctx.cfg.linkedHub).toEqual(link);
    expect(log).toEqual(['start:r1']);

    // A second Connect tears the first runtime down before opening the next.
    await sup.restart({ url: 'https://other.example', linkedAt: 2 });
    expect(log).toEqual(['start:r1', 'stop:r1', 'start:r2']);
    expect(ctx.cfg.linkedHub?.url).toBe('https://other.example');
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('two Connects in flight at once do not interleave stop with start', async () => {
    const ctx = makeCtx({ url: 'https://hub.example', linkedAt: 1 });
    const log: string[] = [];
    let n = 0;
    const sup = createSyncSupervisor(ctx, {}, () => fakeRuntime(log, `r${++n}`));
    await sup.start();
    await Promise.all([
      sup.restart({ url: 'https://a.example', linkedAt: 2 }),
      sup.restart({ url: 'https://b.example', linkedAt: 3 }),
    ]);
    expect(log).toEqual(['start:r1', 'stop:r1', 'start:r2', 'stop:r2', 'start:r3']);
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('linked but zero syncable canvases is reported, not mistaken for syncing', async () => {
    const ctx = makeCtx({ url: 'https://hub.example', linkedAt: 1 });
    const log: string[] = [];
    const empty: SyncRuntime = {
      ...fakeRuntime(log, 'empty', 0),
      status: () => ({ reason: 'no canvases found under .design' }) as never,
    };
    const sup = createSyncSupervisor(ctx, {}, () => empty);
    const out = await sup.start();
    expect(out.syncing).toBe(false);
    expect(out.reason).toBe('nothing-syncable');
    // The runtime already wrote the full explanation into _sync.json — the
    // panel repeats THAT, so the two can never drift apart.
    expect(out.detail).toBe('no canvases found under .design');
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('END TO END with the REAL runtime: an unlinked server starts syncing on Connect', async () => {
    // No fake runtime here — this is the actual `createSyncRuntime`, reached
    // exactly as the attach lane reaches it: the server booted solo (no
    // linkedHub anywhere), and one restart() with the value the cloud endpoint
    // just wrote turns the project into a syncing one, in place.
    const ctx = makeCtx();
    mkdirSync(join(ctx.paths.designRoot, 'ui'), { recursive: true });
    mkdirSync(ctx.paths.commentsDir, { recursive: true });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'home.html'), '<main>home</main>');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'pricing.html'), '<main>pricing</main>');

    const url = 'https://hub.example.com';
    process.env.HUBS_CONFIG_PATH = join(ctx.paths.repoRoot, 'hubs.json');
    writeFileSync(
      process.env.HUBS_CONFIG_PATH,
      JSON.stringify({ hubs: { [url]: { token: 'mau_test', linkedAt: 1 } } })
    );
    chmodSync(process.env.HUBS_CONFIG_PATH, 0o600);

    const opened: string[] = [];
    const providerFactory = (args: { documentName: string; document?: Y.Doc }): SyncProvider => {
      opened.push(args.documentName);
      const document = args.document ?? new Y.Doc();
      return { document, onceSynced: () => Promise.resolve(), destroy: () => {} };
    };

    const sup = createSyncSupervisor(ctx, { providerFactory });
    expect((await sup.start()).syncing).toBe(false); // solo — nothing linked yet

    const out = await sup.restart({ url, linkedAt: Date.now() });
    expect(out).toEqual({ syncing: true, canvases: 2 });
    expect(opened.sort()).toEqual(['ui-home', 'ui-pricing']);
    expect(sup.current()).not.toBeNull();

    await sup.stop();
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  // feature-sync-resync-and-out-of-process-sweep — `busy()` is what lets the
  // Resync route answer 409 instead of quietly queueing a second full re-link
  // of every canvas. It reports the chain; it must never BE the chain.
  test('busy() reports a cycle in flight and clears when it settles', async () => {
    const ctx = makeCtx({ url: 'https://hub.example', linkedAt: 1 });
    let release: () => void = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });
    const sup = createSyncSupervisor(ctx, {}, () => ({
      start: () => held,
      stop: async () => {},
      size: () => 1,
      agentFor: () => undefined,
      status: () => null,
      cancelAssetSweep: () => false,
    }));

    expect(sup.busy()).toBe(false);
    const cycle = sup.start();
    expect(sup.busy()).toBe(true);
    release();
    await cycle;
    expect(sup.busy()).toBe(false);
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('busy() clears after a cycle that THREW — Resync never wedges shut', async () => {
    const ctx = makeCtx({ url: 'https://hub.example', linkedAt: 1 });
    const sup = createSyncSupervisor(ctx, {}, () => ({
      start: async () => {
        throw new Error('nope');
      },
      stop: async () => {},
      size: () => 0,
      agentFor: () => undefined,
      status: () => null,
      cancelAssetSweep: () => false,
    }));
    await sup.start();
    expect(sup.busy()).toBe(false);
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });

  test('a throwing start leaves the server up and answers with the reason', async () => {
    const ctx = makeCtx({ url: 'https://hub.example', linkedAt: 1 });
    const sup = createSyncSupervisor(ctx, {}, () => ({
      start: async () => {
        throw new Error('hub refused the handshake');
      },
      stop: async () => {},
      size: () => 0,
      agentFor: () => undefined,
      status: () => null,
      cancelAssetSweep: () => false,
    }));
    const out = await sup.start();
    expect(out.syncing).toBe(false);
    expect(out.reason).toBe('error');
    expect(out.detail).toContain('hub refused the handshake');
    // And the NEXT attach still runs — a failed cycle must not poison the chain.
    const log: string[] = [];
    expect((await sup.restart()).syncing).toBe(false);
    expect(log).toEqual([]);
    rmSync(ctx.paths.repoRoot, { recursive: true, force: true });
  });
});
