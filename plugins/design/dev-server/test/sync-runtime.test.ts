// Sync runtime wiring tests — Phase 9 Task 4.
//
// Uses an in-memory ProviderFactory so we don't need to start a Hocuspocus
// server. The agents do real Y.Doc work; the test verifies the runtime
// honors linkedHub config, discovers canvases, wires up agents, and
// dispatches fs events through the bus correctly.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import type { Context, DevServerConfig } from '../context.ts';
import { createBus } from '../context.ts';
import { type SyncProvider, createSyncRuntime, discoverCanvases, toWsUrl } from '../sync/index.ts';

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
}

function makeCtx(linkedHub?: DevServerConfig['linkedHub']): Context {
  // Minimal Context — only the fields the sync runtime touches.
  const designRoot = join(dir, 'design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  return {
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
});

describe('discoverCanvases', () => {
  test('finds .html and .tsx files in canvasGroups', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'a.html'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'b.tsx'), '');

    const list = await discoverCanvases(ctx);
    const slugs = list.map((c) => c.slug).sort();
    expect(slugs).toEqual(['ui-a', 'ui-b']);
  });

  test('skips dirs starting with _ (e.g. _history, _comments)', async () => {
    const ctx = makeCtx({ url: 'https://h.example.com', linkedAt: 1 });
    mkdirSync(join(ctx.paths.designRoot, 'ui', '_history'));
    writeFileSync(join(ctx.paths.designRoot, 'ui', '_history', 'snap.html'), '');
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'real.html'), '');

    const list = await discoverCanvases(ctx);
    expect(list.map((c) => c.slug)).toEqual(['ui-real']);
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
