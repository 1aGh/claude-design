// Two peers, one hub — the reported bug, end to end, in both directions.
//
// The unit tests in `sync-attach-incremental.test.ts` pin each half against a
// stub. This one puts TWO REAL RUNTIMES on one shared hub and asks the question
// the user actually asked: if somebody makes a canvas over there, does it show
// up over here, live, without anyone restarting anything?
//
// Both directions are the same code — the cell runs the same runtime the
// desktop does — so a test that only checked one would prove half of nothing.
// The reported asymmetry (desktop→cloud "worked", cloud→desktop never did) was
// never about direction: it was about which end happens to restart.
//
// WHAT IS ASSERTED. Not `size()`, which a runtime can inflate by opening a
// provider it never connects. The peer's CONTENT has to arrive, its later edits
// have to keep flowing, and the awareness bridge — the thing behind cursors —
// has to be attached for the canvas that was discovered, not merely for the
// ones that existed at boot.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import type { AwarenessRegistry } from '../sync/index.ts';
import type { Context, DevServerConfig } from '../context.ts';
import { createBus } from '../context.ts';
import { createSyncRuntime, type SyncProvider, type SyncRuntime } from '../sync/index.ts';

const HUB = 'https://hub.example.com';

let root: string;
let cfgPathEnv: string | undefined;
let realFetch: typeof fetch;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'two-peer-'));
  cfgPathEnv = process.env.HUBS_CONFIG_PATH;
  process.env.HUBS_CONFIG_PATH = join(root, 'hubs.json');
  writeFileSync(
    process.env.HUBS_CONFIG_PATH,
    JSON.stringify({ hubs: { [HUB]: { token: 'mau_test', linkedAt: 1 } } })
  );
  chmodSync(process.env.HUBS_CONFIG_PATH, 0o600);
  realFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (cfgPathEnv === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = cfgPathEnv;
  rmSync(root, { recursive: true, force: true });
});

/**
 * One hub both peers connect to.
 *
 * Holds a Y.Doc per documentName and relays between every connection attached
 * to it. Each connection carries its OWN origin symbol, so an update that
 * arrives from peer A reaches peer B and is not echoed back to A — the property
 * a single shared symbol would silently break, leaving a test that passes
 * because nothing ever moved.
 *
 * It also answers `GET /api/documents` from the same map, which is the whole
 * point: the listing is what a peer can learn about a canvas it has never seen,
 * and it can only ever name documents somebody actually opened.
 */
function makeHub() {
  const docs = new Map<string, Y.Doc>();

  function docFor(name: string): Y.Doc {
    let d = docs.get(name);
    if (!d) {
      d = new Y.Doc();
      docs.set(name, d);
    }
    return d;
  }

  function factory() {
    return (args: { documentName: string; document?: Y.Doc }): SyncProvider => {
      const hubDoc = docFor(args.documentName);
      const local = args.document ?? new Y.Doc();
      const conn = Symbol('conn');
      // Initial state transfer, both ways — a real handshake converges the two
      // sides before `onceSynced` resolves, and the cold-start reconcile the
      // runtime runs afterwards depends on that having happened.
      Y.applyUpdate(local, Y.encodeStateAsUpdate(hubDoc), conn);
      Y.applyUpdate(hubDoc, Y.encodeStateAsUpdate(local), conn);
      const onLocal = (u: Uint8Array, origin: unknown) => {
        if (origin === conn) return;
        Y.applyUpdate(hubDoc, u, conn);
      };
      const onHub = (u: Uint8Array, origin: unknown) => {
        if (origin === conn) return;
        Y.applyUpdate(local, u, conn);
      };
      local.on('update', onLocal);
      hubDoc.on('update', onHub);
      return {
        document: local,
        awareness: new Awareness(local),
        async onceSynced() {},
        destroy() {
          local.off('update', onLocal);
          hubDoc.off('update', onHub);
        },
      };
    };
  }

  /** `GET /api/documents` — names only, exactly like the real route. */
  function serveListing(): void {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/documents')) {
        return new Response(
          JSON.stringify({ documents: [...docs.keys()].map((name) => ({ name, bytes: 1 })) }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('nope', { status: 404 });
    }) as typeof fetch;
  }

  return {
    factory,
    serveListing,
    docs,
    bodyOf: (n: string) => docFor(n).getText('html').toString(),
  };
}

/** A peer: its own disk, its own context, its own runtime. */
function makePeer(name: string) {
  const repoRoot = join(root, name);
  const designRoot = join(repoRoot, 'design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  const linkedHub: DevServerConfig['linkedHub'] = { url: HUB, linkedAt: 1 };
  const ctx = {
    // The sandbox split is active — the gate `.tsx` sync is coupled to
    // (9.1-B). TSX is the real canvas format, and it is also where the pulled
    // body lands: `fallbackCanvasPath` always resolves to `.tsx`, so a test
    // written against `.html` would assert a file that correctly never exists.
    canvasOrigin: 'http://canvas.localhost:9',
    cfg: {
      name,
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
    projectLabel: name,
    paths: {
      repoRoot,
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
  } as Context;

  /** Which slugs got a hub-awareness bridge — the cursor lane, per canvas. */
  const bridged: string[] = [];
  const registry: AwarenessRegistry = {
    attachHubAwareness(slug) {
      bridged.push(slug);
      return () => {};
    },
  };

  return {
    ctx,
    bridged,
    registry,
    /** A canvas the way a real one exists: a `.tsx` body plus the sidecar that
     *  opts it into sync (Lock 1 — a hub must never be able to flip it). */
    write(canvas: string, body: string) {
      writeFileSync(join(designRoot, 'ui', `${canvas}.tsx`), body);
      writeFileSync(
        join(designRoot, 'ui', `${canvas}.meta.json`),
        JSON.stringify({ syncable: true })
      );
    },
    read(canvas: string) {
      return readFileSync(join(designRoot, 'ui', `${canvas}.tsx`), 'utf8');
    },
  };
}

/** Settle both the fs reader's quiet window and the doc round-trips. */
const settle = (ms = 450) => new Promise((res) => setTimeout(res, ms));

describe('two peers on one hub', () => {
  let runtimes: (SyncRuntime | null)[] = [];
  afterEach(async () => {
    for (const r of runtimes) await r?.stop();
    runtimes = [];
  });

  test('a canvas created on peer A reaches peer B — no restart on either side', async () => {
    const hub = makeHub();
    const a = makePeer('a');
    const b = makePeer('b');
    // Both start with the same one canvas, so neither is in the special
    // empty-project path and the only variable is the NEW one.
    a.write('home', '<main>home</main>');
    b.write('home', '<main>home</main>');
    hub.serveListing();

    const ra = createSyncRuntime(a.ctx, { providerFactory: hub.factory(), registry: a.registry });
    const rb = createSyncRuntime(b.ctx, { providerFactory: hub.factory(), registry: b.registry });
    runtimes = [ra, rb];
    await ra?.start();
    await rb?.start();
    await settle(50);

    expect(ra?.size()).toBe(1);
    expect(rb?.size()).toBe(1);

    // ── A makes a canvas. Nobody restarts anything. ──────────────────────
    a.write('newidea', '<section>made on A</section>');
    a.ctx.bus.emit('canvas-list-update', { action: 'added', rel: 'ui/newidea.tsx' });
    await ra?.rescanNow();
    await settle();

    // It is on the hub — which on a cell is the step that used to be missing
    // entirely, and is why the other side could not even learn the name.
    expect(hub.bodyOf('ui-newidea')).toBe('<section>made on A</section>');

    // ── B has never heard of it. It polls, and pulls it down. ────────────
    await rb?.pullRemoteNow();
    await settle();

    expect(rb?.size()).toBe(2);
    expect(b.read('newidea')).toBe('<section>made on A</section>');
    // The cursor lane is attached for the canvas that ARRIVED, not just the
    // ones that existed at boot — "no cursor in the new canvas" was half the
    // report.
    expect(b.bridged).toContain('ui-newidea');
  });

  test('the discovered canvas keeps syncing — it is live, not a one-shot copy', async () => {
    const hub = makeHub();
    const a = makePeer('a');
    const b = makePeer('b');
    a.write('home', '<main>home</main>');
    b.write('home', '<main>home</main>');
    hub.serveListing();

    const ra = createSyncRuntime(a.ctx, { providerFactory: hub.factory(), registry: a.registry });
    const rb = createSyncRuntime(b.ctx, { providerFactory: hub.factory(), registry: b.registry });
    runtimes = [ra, rb];
    await ra?.start();
    await rb?.start();

    a.write('shared', '<p>v1</p>');
    await ra?.rescanNow();
    await settle();
    await rb?.pullRemoteNow();
    await settle();
    expect(b.read('shared')).toBe('<p>v1</p>');

    // A edits it again, well after the discovery. This is the difference
    // between "it appeared" and "it syncs".
    a.write('shared', '<p>v2 — edited after discovery</p>');
    a.ctx.bus.emit('fs:any', 'ui/shared.tsx');
    // Long enough for the whole chain: A's fs quiet window, the doc round-trip,
    // and B's agent debouncing its doc→file write. Three debounces, not one.
    await settle(1500);

    expect(hub.bodyOf('ui-shared')).toBe('<p>v2 — edited after discovery</p>');
    expect(b.read('shared')).toBe('<p>v2 — edited after discovery</p>');
  });

  test('the other direction is the same code — B creates, A discovers', async () => {
    const hub = makeHub();
    const a = makePeer('a');
    const b = makePeer('b');
    a.write('home', '<main>home</main>');
    b.write('home', '<main>home</main>');
    hub.serveListing();

    const ra = createSyncRuntime(a.ctx, { providerFactory: hub.factory(), registry: a.registry });
    const rb = createSyncRuntime(b.ctx, { providerFactory: hub.factory(), registry: b.registry });
    runtimes = [ra, rb];
    await ra?.start();
    await rb?.start();

    b.write('fromb', '<article>made on B</article>');
    await rb?.rescanNow();
    await settle();
    await ra?.pullRemoteNow();
    await settle();

    expect(a.read('fromb')).toBe('<article>made on B</article>');
    expect(ra?.size()).toBe(2);
    expect(a.bridged).toContain('ui-fromb');
  });

  test('a canvas each, made at the same time, and both sides end up with both', async () => {
    // The case a one-directional fix passes and a real one has to survive:
    // neither peer is "the server", and each has something the other lacks.
    const hub = makeHub();
    const a = makePeer('a');
    const b = makePeer('b');
    a.write('home', '<main>home</main>');
    b.write('home', '<main>home</main>');
    hub.serveListing();

    const ra = createSyncRuntime(a.ctx, { providerFactory: hub.factory(), registry: a.registry });
    const rb = createSyncRuntime(b.ctx, { providerFactory: hub.factory(), registry: b.registry });
    runtimes = [ra, rb];
    await ra?.start();
    await rb?.start();

    a.write('alpha', '<p>alpha</p>');
    b.write('beta', '<p>beta</p>');
    await Promise.all([ra?.rescanNow(), rb?.rescanNow()]);
    await settle();
    await Promise.all([ra?.pullRemoteNow(), rb?.pullRemoteNow()]);
    await settle();

    expect(a.read('beta')).toBe('<p>beta</p>');
    expect(b.read('alpha')).toBe('<p>alpha</p>');
    expect(ra?.size()).toBe(3);
    expect(rb?.size()).toBe(3);
  });
});
