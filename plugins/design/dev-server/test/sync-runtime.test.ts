// Sync runtime wiring tests — Phase 9 Task 4.
//
// Uses an in-memory ProviderFactory so we don't need to start a Hocuspocus
// server. The agents do real Y.Doc work; the test verifies the runtime
// honors linkedHub config, discovers canvases, wires up agents, and
// dispatches fs events through the bus correctly.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import type { Context, DevServerConfig } from '../context.ts';
import { createBus } from '../context.ts';
import { createConnectionMonitor } from '../sync/connection-state.ts';
import {
  type AwarenessRegistry,
  type SyncProvider,
  buildNoSyncablePayload,
  createSyncRuntime,
  discoverCanvases,
  scanCanvases,
  toWsUrl,
} from '../sync/index.ts';
import { createSyncStatusStore } from '../sync/status.ts';

let dir: string;
let cfgPathEnv: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-runtime-'));
  cfgPathEnv = process.env.HUBS_CONFIG_PATH;
  // Point hubs.json to a temp file we control.
  process.env.HUBS_CONFIG_PATH = join(dir, 'hubs.json');
});

afterEach(() => {
  // Node's process.env stringifies on assignment; assigning undefined yields
  // the literal string "undefined". delete is the correct restoration.
  // biome-ignore lint/performance/noDelete: process.env semantics.
  if (cfgPathEnv === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = cfgPathEnv;
  rmSync(dir, { recursive: true, force: true });
});

function writeHubsConfig(url: string, token: string): void {
  const cfgPath = process.env.HUBS_CONFIG_PATH;
  if (!cfgPath) throw new Error('HUBS_CONFIG_PATH not set by beforeEach');
  writeFileSync(cfgPath, JSON.stringify({ hubs: { [url]: { token, linkedAt: 1 } } }));
  // Match the CLI's saveHubsConfig mode so the DDR-054 §2h mode-warning
  // doesn't fire on every test.
  chmodSync(cfgPath, 0o600);
}

function makeCtx(linkedHub?: DevServerConfig['linkedHub'], canvasOrigin?: string): Context {
  // Minimal Context — only the fields the sync runtime touches.
  const designRoot = join(dir, 'design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  return {
    // T3 (9.1-B) — `canvasOrigin` set === the CSP/sandbox split is active
    // (MAUDE_CANVAS_ORIGIN_SPLIT=1). The `.tsx` sync opt-in is gated on it.
    canvasOrigin,
    cfg: {
      name: 'test',
      projectLabel: null,
      designRoot: 'design',
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
      designRel: 'design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: 'design/system/colors.css',
      systemDirRel: 'system',
    },
    bus: createBus(),
  };
}

function inMemoryProviderFactory(): {
  factory: (args: {
    url: string;
    token: string;
    documentName: string;
  }) => SyncProvider;
  peerOf: (slug: string) => Y.Doc;
} {
  // Map of slug -> { local, peer } Y.Docs cross-linked via applyUpdate.
  const peers = new Map<string, { local: Y.Doc; peer: Y.Doc }>();
  const TRANSPORT = Symbol('test-transport');

  function factory(args: {
    url: string;
    token: string;
    documentName: string;
  }): SyncProvider {
    const local = new Y.Doc();
    const peer = new Y.Doc();
    local.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === TRANSPORT) return;
      Y.applyUpdate(peer, update, TRANSPORT);
    });
    peer.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === TRANSPORT) return;
      Y.applyUpdate(local, update, TRANSPORT);
    });
    peers.set(args.documentName, { local, peer });
    return {
      document: local,
      awareness: new Awareness(local),
      async onceSynced() {
        // Synced immediately for the in-memory pair.
      },
      destroy() {
        local.destroy();
        peer.destroy();
      },
    };
  }

  return {
    factory,
    peerOf(slug: string): Y.Doc {
      const entry = peers.get(slug);
      if (!entry) throw new Error(`no provider for slug ${slug}`);
      return entry.peer;
    },
  };
}

describe('createSyncRuntime', () => {
  test('returns null when linkedHub is absent (solo mode)', () => {
    const ctx = makeCtx(undefined);
    expect(createSyncRuntime(ctx)).toBeNull();
  });

  test('returns null when token is missing from hubs.json', () => {
    const ctx = makeCtx({ url: 'https://hub.example.com', linkedAt: 1 });
    // No hubs.json written — token lookup returns null.
    expect(createSyncRuntime(ctx)).toBeNull();
  });

  test('starts agents for each discovered canvas', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });

    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.html'), '<button>hi</button>');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'modal.html'), '<dialog>x</dialog>');

    const { factory } = inMemoryProviderFactory();
    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    expect(runtime).not.toBeNull();

    await runtime?.start();
    expect(runtime?.size()).toBe(2);
    expect(runtime?.agentFor('ui-screen')).toBeDefined();
    expect(runtime?.agentFor('ui-modal')).toBeDefined();

    await runtime?.stop();
  });

  test('9.1-D: TSX-only project surfaces zero-syncable loudly (no silent no-op)', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });

    // Real (TSX-only) project: discovery admits .html only, so these don't sync.
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.tsx'), 'export default () => null;');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'modal.tsx'), 'export default () => null;');

    const events: unknown[] = [];
    ctx.bus.on('sync:status', (p) => events.push(p));

    const { factory } = inMemoryProviderFactory();
    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    await runtime?.start();

    // No agents — but the state is now LOUD, not silent.
    expect(runtime?.size()).toBe(0);

    const syncFile = join(ctx.paths.designRoot, '_sync.json');
    expect(existsSync(syncFile)).toBe(true);
    const payload = JSON.parse(readFileSync(syncFile, 'utf8'));
    expect(payload.notSyncable).toBe(true);
    expect(payload.tsxCount).toBe(2);
    expect(payload.canvases).toBe(0);
    expect(payload.url).toBe(url);
    expect(payload.reason).toContain('DDR-060');

    // The browser banner gets the same payload over the bus.
    expect(events).toHaveLength(1);
    expect((events[0] as { notSyncable?: boolean }).notSyncable).toBe(true);

    await runtime?.stop();
  });

  test('adopt mode: pushes local disk state up to the hub on first sync', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1, adopt: true });

    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'screen.html'),
      '<button>local-bootstrap</button>'
    );

    const { factory, peerOf } = inMemoryProviderFactory();
    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    await runtime?.start();

    // Reconcile fires after onceSynced() resolves — give one tick.
    await new Promise((res) => setTimeout(res, 10));

    expect(peerOf('ui-screen').getText('html').toString()).toBe('<button>local-bootstrap</button>');
    await runtime?.stop();
  });

  test('bus fs:any event dispatches through the agent', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });

    const htmlPath = join(ctx.paths.designRoot, 'ui', 'screen.html');
    writeFileSync(htmlPath, '');

    const { factory, peerOf } = inMemoryProviderFactory();
    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    await runtime?.start();

    // Simulate a local edit: write to disk, then fire the bus event the
    // existing fs-watch.ts would emit.
    writeFileSync(htmlPath, '<button>local</button>');
    ctx.bus.emit('fs:any', 'ui/screen.html');

    // Wait for fs-mirror's 250ms quiet window + agent flush slack.
    await new Promise((res) => setTimeout(res, 400));

    expect(peerOf('ui-screen').getText('html').toString()).toBe('<button>local</button>');
    await runtime?.stop();
  });

  test('attaches each provider awareness to the registry and detaches on stop', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });

    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.html'), '<button>hi</button>');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'modal.html'), '<dialog>x</dialog>');

    const attached: string[] = [];
    let detachCount = 0;
    const registry: AwarenessRegistry = {
      attachHubAwareness(slug, _awareness) {
        attached.push(slug);
        return () => {
          detachCount++;
        };
      },
    };

    const { factory } = inMemoryProviderFactory();
    const runtime = createSyncRuntime(ctx, { providerFactory: factory, registry });
    await runtime?.start();

    expect(attached.sort()).toEqual(['ui-modal', 'ui-screen']);

    await runtime?.stop();
    expect(detachCount).toBe(2);
  });

  test('Task 8: provider going offline drives the status to offline + surfaces queued edits', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.html'), '<button>hi</button>');

    // Provider stub that exposes onStatus so the test can drive WS transitions.
    let emitStatus: ((s: 'connected' | 'connecting' | 'disconnected') => void) | null = null;
    const doc = new Y.Doc();
    const factory = () => ({
      document: doc,
      onStatus(cb: (s: 'connected' | 'connecting' | 'disconnected') => void) {
        emitStatus = cb;
        return () => {
          emitStatus = null;
        };
      },
      async onceSynced() {},
      destroy() {
        doc.destroy();
      },
    });

    // Fake-timer monitor so the 30s grace window fires deterministically.
    let nowMs = 1_000;
    const timers: Array<{ fireAt: number; cb: () => void }> = [];
    const monitor = createConnectionMonitor({
      graceMs: 30_000,
      now: () => nowMs,
      setTimer: (cb, ms) => {
        const t = { fireAt: nowMs + ms, cb };
        timers.push(t);
        return t as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: (h) => {
        const i = timers.indexOf(h as unknown as { fireAt: number; cb: () => void });
        if (i >= 0) timers.splice(i, 1);
      },
      onChange: (snap) => store.update(snap),
    });
    const writes: import('../sync/status.ts').SyncStatusPayload[] = [];
    const store = createSyncStatusStore({
      url,
      canvases: 1,
      write: (p) => writes.push(p),
    });

    const runtime = createSyncRuntime(ctx, {
      providerFactory: factory,
      connectionMonitor: monitor,
      statusStore: store,
    });
    await runtime?.start();

    // Connected → online.
    emitStatus?.('connected');
    expect(runtime?.status()?.state).toBe('online');

    // Disconnect, advance past the grace window → offline.
    emitStatus?.('disconnected');
    nowMs += 31_000;
    for (const t of [...timers]) {
      if (t.fireAt <= nowMs) {
        timers.splice(timers.indexOf(t), 1);
        t.cb();
      }
    }
    const offlineStatus = runtime?.status();
    expect(offlineStatus?.state).toBe('offline');
    expect(offlineStatus?.url).toBe(url);
    expect(offlineStatus?.offlineSince).not.toBeNull();
    // _sync.json mirror got the offline payload too.
    expect(writes.at(-1)?.state).toBe('offline');

    // Reconnect → back online with a green flash.
    emitStatus?.('connected');
    expect(runtime?.status()?.state).toBe('online');
    expect(runtime?.status()?.flash).toBe('synced');

    await runtime?.stop();
  });

  test('writes _sync.json on a clean fast connect (regression: status must not read "idle" while sync is healthy)', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.html'), '<button>hi</button>');

    // Provider that — like the real wrapper after the fix — reports its current
    // status the instant a subscriber attaches, and is already synced. No later
    // WS *transition* fires (the monitor starts 'online', so a 'connected' note
    // is a no-op), so the only thing that writes `_sync.json` is the runtime's
    // initial status persist. Before the fix this left the file absent and
    // `maude design status` reported "idle / sync agent not running".
    const doc = new Y.Doc();
    const factory = () => ({
      document: doc,
      onStatus(cb: (s: 'connected' | 'connecting' | 'disconnected') => void) {
        cb('connected');
        return () => {};
      },
      async onceSynced() {},
      destroy() {
        doc.destroy();
      },
    });

    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    await runtime?.start();

    // Live status reflects an online agent...
    expect(runtime?.status()?.state).toBe('online');
    // ...and it has been persisted to _sync.json (what `maude design status` reads).
    const syncFile = join(ctx.paths.designRoot, '_sync.json');
    expect(existsSync(syncFile)).toBe(true);
    const payload = JSON.parse(readFileSync(syncFile, 'utf8'));
    expect(payload.state).toBe('online');
    expect(payload.canvases).toBe(1);
    expect(payload.notSyncable).toBeUndefined();

    await runtime?.stop();
  });

  test('Task 8: hub-wins reconcile over divergent local content records a conflict', async () => {
    const url = 'https://hub.example.com';
    writeHubsConfig(url, 'mau_test');
    const ctx = makeCtx({ url, linkedAt: 1 });
    // Local disk has divergent, non-empty content.
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'screen.html'), '<button>LOCAL EDIT</button>');

    // Provider whose doc already carries different hub state.
    const factory = () => {
      const document = new Y.Doc();
      document.getText('html').insert(0, '<button>HUB STATE</button>');
      return {
        document,
        async onceSynced() {},
        destroy() {
          document.destroy();
        },
      };
    };

    const runtime = createSyncRuntime(ctx, { providerFactory: factory });
    await runtime?.start();
    // Reconcile fires after onceSynced resolves.
    await new Promise((res) => setTimeout(res, 20));

    const status = runtime?.status();
    expect(status?.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(status?.conflicts[0].kind).toBe('cold-start-hub-wins');
    await runtime?.stop();
  });
});

describe('discoverCanvases', () => {
  test('finds .html files but EXCLUDES .tsx (DDR-054 §2b)', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'a.html'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'b.tsx'), '');

    const list = await discoverCanvases(ctx);
    const slugs = list.map((c) => c.slug).sort();
    // .tsx is deliberately refused — hostile-hub-pushed JSX would be
    // transpiled and executed in iframe same-origin. Solo-mode editing
    // of .tsx is unaffected.
    expect(slugs).toEqual(['ui-a']);
  });

  test('skips dirs starting with _ (e.g. _history, _comments)', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    mkdirSync(join(ctx.paths.designRoot, 'ui', '_history'));
    writeFileSync(join(ctx.paths.designRoot, 'ui', '_history', 'snap.html'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'real.html'), '');

    const list = await discoverCanvases(ctx);
    expect(list.map((c) => c.slug)).toEqual(['ui-real']);
  });

  // T3 (9.1-B) — opted-in .tsx sync, gated on the sandbox split.
  test('admits an opted-in .tsx ONLY when the split is active (Lock1⊃Lock2)', async () => {
    const HUB = { url: 'https://h.example.com', linkedAt: 1 };
    // split ACTIVE (canvasOrigin set) + sidecar opts in → admitted, body = .tsx.
    const ctx = makeCtx(HUB, 'http://localhost:9');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'opted.tsx'), 'export default () => null;');
    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'opted.meta.json'),
      JSON.stringify({ syncable: true })
    );
    const list = await discoverCanvases(ctx);
    const opted = list.find((c) => c.slug === 'ui-opted');
    expect(opted).toBeDefined();
    expect(opted?.html).toBe(join(ctx.paths.designRoot, 'ui', 'opted.tsx'));
  });

  test('does NOT admit an opted-in .tsx when the split is OFF (the coupling)', async () => {
    // Same opt-in, but canvasOrigin undefined → sandbox not in force → refused.
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'opted.tsx'), 'export default () => null;');
    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'opted.meta.json'),
      JSON.stringify({ syncable: true })
    );
    const list = await discoverCanvases(ctx);
    expect(list.map((c) => c.slug)).not.toContain('ui-opted');
  });

  test('does NOT admit a .tsx without the opt-in even when the split is active', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 }, 'http://localhost:9');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'plain.tsx'), 'export default () => null;');
    // sidecar present but syncable:false → still refused.
    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'plain.meta.json'),
      JSON.stringify({ syncable: false, title: 'Plain' })
    );
    const list = await discoverCanvases(ctx);
    expect(list.map((c) => c.slug)).not.toContain('ui-plain');
  });
});

describe('scanCanvases', () => {
  test('tallies .tsx canvases separately from syncable .html', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'a.html'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'b.tsx'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'c.tsx'), '');

    const scan = await scanCanvases(ctx);
    expect(scan.canvases.map((c) => c.slug)).toEqual(['ui-a']);
    expect(scan.tsxCount).toBe(2);
  });
});

describe('buildNoSyncablePayload', () => {
  test('TSX-only project: reason names the count + DDR-060', () => {
    const p = buildNoSyncablePayload('https://h.example.com', 3, '/proj/.design');
    expect(p.notSyncable).toBe(true);
    expect(p.tsxCount).toBe(3);
    expect(p.reason).toContain('3 TSX canvas(es)');
    expect(p.reason).toContain('DDR-060');
  });

  test('empty project: reason reports no canvases under the design root', () => {
    const p = buildNoSyncablePayload('https://h.example.com', 0, '/proj/.design');
    expect(p.tsxCount).toBe(0);
    expect(p.reason).toContain('no canvases found under /proj/.design');
  });
});

describe('toWsUrl', () => {
  test('https → wss', () => {
    expect(toWsUrl('https://hub.example.com')).toBe('wss://hub.example.com');
  });
  test('http → ws', () => {
    expect(toWsUrl('http://localhost:1234')).toBe('ws://localhost:1234');
  });
  test('passthrough for ws://', () => {
    expect(toWsUrl('ws://localhost:1234')).toBe('ws://localhost:1234');
  });
});
