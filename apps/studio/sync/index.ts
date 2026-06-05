// Sync runtime entry point — Phase 9 Task 4 wiring.
//
// Public surface for the dev-server boot:
//
//   const runtime = createSyncRuntime(ctx);
//   if (runtime) await runtime.start();
//   // ... later ...
//   await runtime.stop();
//
// Returns null when the project is unlinked (`.design/config.json` has no
// `linkedHub` field) — preserves solo mode behavior bit-for-bit. When linked:
// resolves the per-machine token, opens one HocuspocusProvider + sync agent
// per canvas, and wires the existing ctx.bus 'fs:any' events through the
// agent's echo guard.
//
// HocuspocusProvider import is dynamic so a misconfigured project (linked but
// the provider lib didn't install for some reason) prints a useful error
// instead of crashing the dev-server boot.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { Y_TYPES } from '../collab/persistence.ts';
import type { Context } from '../context.ts';
import { type CanvasSyncAgent, createCanvasSyncAgent } from './agent.ts';
import {
  type ConnectionMonitor,
  createConnectionMonitor,
  type ProviderStatus,
} from './connection-state.ts';
import { createEchoGuard, type EchoGuard } from './echo-guard.ts';
import { createFsReader, type FsReader } from './fs-mirror.ts';
import { getHubToken } from './hubs-config.ts';
import { migrateSeed } from './migrate-seed.ts';
import { createDocProjection, type DocProjection } from './projection.ts';
import { createSyncStatusStore, type SyncStatusStore } from './status.ts';
import { writeUntrustedMarkers } from './untrusted.ts';

/** A minimum-surface stand-in for the HocuspocusProvider's runtime API. */
export interface SyncProvider {
  readonly document: Y.Doc;
  /**
   * The provider's hub-synced Awareness, when it exposes one. Phase 9 Task 5
   * bridges this to the collab Room's Awareness so cursors relay through the
   * hub. Optional — a provider without awareness (or a test stub) just skips
   * the bridge.
   */
  readonly awareness?: Awareness;
  /** Resolves when the first hub sync handshake completes. */
  onceSynced(): Promise<void>;
  /**
   * Subscribe to WS connection-status transitions (Phase 9 Task 8 offline
   * mode). Returns an unsubscribe fn. Optional — a test stub or a provider
   * without status events just isn't monitored (treated as always-online).
   */
  onStatus?(cb: (status: ProviderStatus) => void): () => void;
  destroy(): void;
}

/**
 * Structural surface of the collab registry the runtime needs for Task 5.
 * Defined here (rather than imported from collab/) to avoid a dev-server
 * module cycle — the real `Registry` satisfies it.
 */
export interface AwarenessRegistry {
  attachHubAwareness(slug: string, awareness: Awareness): () => void;
  /** Phase 9.1 — relay a hub-pushed comment/annotation snapshot into a live
   *  room (wholesale, in-process) so the peer's canvas reflects it immediately
   *  and the room's own debounced persist can't clobber the synced state back.
   *  Optional so file-sync-only tests can pass a minimal registry. */
  syncRoomFromComments?(slug: string, comments: readonly unknown[]): void;
  syncRoomFromAnnotations?(slug: string, svg: string): void;
  /**
   * Phase 9.2 (DDR-064) — the single cached `Y.Doc` for a slug. When present
   * AND `ctx.sharedDoc` is set, the runtime attaches the HocuspocusProvider to
   * THIS doc instead of a fresh one (the convergence: one doc, both providers).
   * Optional so file-sync-only tests can pass a minimal registry.
   */
  getDoc?(slug: string): Y.Doc;
  /** Keep a shared-doc room alive while its provider is attached (drop guard). */
  pin?(slug: string): void;
  /** Release the shared-doc pin on runtime stop. */
  unpin?(slug: string): void;
}

/** Factory the runtime calls per discovered canvas. Default uses Hocuspocus. */
export type ProviderFactory = (args: {
  url: string;
  token: string;
  documentName: string;
  /**
   * Phase 9.2 (DDR-064) — when set, the provider MUST attach to this existing
   * `Y.Doc` (the shared room doc) instead of creating its own. The runtime
   * passes it only when `ctx.sharedDoc` is on and the registry exposes
   * `getDoc`. Default factory: `args.document ?? new Y.Doc()`.
   */
  document?: Y.Doc;
}) => SyncProvider | Promise<SyncProvider>;

export interface SyncRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Number of active per-canvas agents. */
  size(): number;
  /** Test inspection — get the agent for a slug if one was created. */
  agentFor(slug: string): CanvasSyncAgent | undefined;
  /** Current offline/sync status payload (Task 8), or null when unlinked. */
  status(): import('./status.ts').SyncStatusPayload | null;
}

export interface CreateSyncRuntimeOptions {
  /** Override the HocuspocusProvider factory (test injection). */
  providerFactory?: ProviderFactory;
  /** Force-enable/disable adopt mode (overrides cfg.linkedHub.adopt). */
  adopt?: boolean;
  /** Discovery override — pass an explicit canvas list instead of scanning. */
  canvases?: CanvasDescriptor[];
  /**
   * Collab registry — when provided, each provider's Awareness is bridged to
   * the matching Room so cursors relay through the hub (Task 5). Omitted in
   * unit tests that only exercise the file-sync path.
   */
  registry?: AwarenessRegistry;
  /**
   * Override the offline-mode connection monitor (Task 8 test injection —
   * lets tests pass injectable timers/clock). Defaults to a real monitor that
   * writes `_sync.json` + broadcasts 'sync:status' on the bus.
   */
  connectionMonitor?: ConnectionMonitor;
  /** Override the status store (Task 8 test injection). */
  statusStore?: SyncStatusStore;
}

/**
 * One canvas the sync runtime tracks. `slug` is the stable doc-name shared
 * with the hub; the three `paths` are absolute on-disk locations the agent
 * mirrors.
 */
export interface CanvasDescriptor {
  slug: string;
  html: string;
  comments: string;
  annotations: string;
  /** The canvas `.meta.json` sidecar (sibling of the body). Phase 9.1 Gap 2 —
   *  shared keys (layout/artboards) sync; per-user viewport stays local. */
  meta: string;
  /** The canvas's sibling `.css` (Phase 9.1 Gap 3), synced as opaque text. */
  css: string;
}

/**
 * Build the sync runtime, or return null when the project isn't linked to a
 * hub. Idempotent — callers can safely invoke this on every boot.
 */
export function createSyncRuntime(
  ctx: Context,
  opts: CreateSyncRuntimeOptions = {}
): SyncRuntime | null {
  const linked = ctx.cfg.linkedHub;
  if (!linked) return null;
  const linkedHub = linked;

  // DDR-054 §2a — CI environment gate. Closes the supply-chain side-door
  // where a future CI workflow runs `maude design serve` and a PR-controlled
  // linkedHub.url silently grants a remote actor write access in an
  // environment carrying GITHUB_TOKEN. Override via MAUDE_SYNC_IN_CI=1.
  if (
    !process.env.MAUDE_SYNC_IN_CI &&
    (process.env.CI === 'true' || process.env.CI === '1' || !!process.env.GITHUB_ACTIONS)
  ) {
    console.warn(
      '[sync] disabled in CI environment (CI / GITHUB_ACTIONS detected). DDR-054 §2a. Set MAUDE_SYNC_IN_CI=1 to override.'
    );
    return null;
  }

  // DDR-054 §2e — scheme allowlist. Refuse plaintext to non-loopback hosts
  // (closes attacker F9 cleartext token exfil and the F2 last-mile chain).
  const schemeError = checkUrlScheme(linkedHub.url);
  if (schemeError) {
    console.error(`[sync] refusing to start: ${schemeError}`);
    return null;
  }

  const resolvedToken = getHubToken(linkedHub.url);
  if (!resolvedToken) {
    console.warn(
      `[sync] linked to ${linkedHub.url} but no token in ~/.config/maude/hubs.json. Re-run 'maude design link' on this machine. Solo mode for now.`
    );
    return null;
  }
  const token: string = resolvedToken;

  const providerFactory = opts.providerFactory ?? defaultProviderFactory;
  const echoGuard = createEchoGuard();
  const agents = new Map<string, CanvasSyncAgent>();
  // Phase 9.2 (DDR-064) — under sharedDoc the disk handler is a loop-free
  // projection (sole owner of html/css/meta doc→file + all-types file→doc),
  // created INSTEAD of an agent. Exactly one of agents/projections is populated
  // per run (chosen by useSharedDoc).
  const projections = new Map<string, DocProjection>();
  const providers = new Map<string, SyncProvider>();
  const awarenessDetaches: Array<() => void> = [];
  const statusDetaches: Array<() => void> = [];
  // Phase 9.2 (DDR-064) — slugs pinned in the registry because a provider is
  // attached to their shared doc; released on stop(). Empty unless sharedDoc.
  const pinnedSlugs = new Set<string>();
  // The shared-doc convergence path is active only when the flag is ON AND the
  // registry can hand us the canvas's single doc. Flag OFF / no registry / a
  // minimal test registry without getDoc → the proven two-doc path, unchanged.
  const useSharedDoc = !!ctx.sharedDoc && typeof opts.registry?.getDoc === 'function';
  let fsReader: FsReader | null = null;
  let busUnsub: (() => void) | null = null;
  let started = false;
  let stopped = false;

  // Task 8 — offline-mode status surface, initialized in start() once the
  // canvas count is known. The store writes `_sync.json` + broadcasts
  // 'sync:status' on the bus; the monitor aggregates provider WS status into
  // online/offline/escalated and feeds every change to the store.
  let statusStore: SyncStatusStore | null = null;
  let monitor: ConnectionMonitor | null = null;

  async function start(): Promise<void> {
    if (started || stopped) return;
    started = true;

    const scan = opts.canvases ? { canvases: opts.canvases, tsxCount: 0 } : await scanCanvases(ctx);
    const canvases = scan.canvases;
    // T4.5 (DDR-054 §3 F3) — every syncable canvas can receive hub-pushed
    // content, so the whole set is untrusted Claude-context. Mark it (writes
    // `_untrusted/INDEX.json` + a managed `.claudeignore` block; clears both
    // when the set is empty). Best-effort — never throws into boot.
    writeUntrustedMarkers(ctx, canvases, linkedHub.url);
    if (canvases.length === 0) {
      // DDR-060 / 9.1-D — the silent early-return made linked mode look healthy
      // while syncing nothing (TSX-only projects: discovery admits .html only,
      // .tsx needs the opt-in + sandbox gate that 9.1-A/B ship). Surface the gap
      // loudly: a warn, a `_sync.json` the CLI + browser banner read, and a bus
      // broadcast so open tabs render it immediately.
      surfaceNoSyncable(ctx, linkedHub.url, scan.tsxCount);
      return;
    }

    // DDR-079 — TSX sync defaults ON, so every linked non-loopback project that
    // ships .tsx broadcasts the WebRTC/self-nav exfil residual (the sandbox
    // contains execution but not that lane) to every synced canvas. The default
    // traded a footgun (silent 0-syncable) for this surface, so the surface must
    // be LOUD: a banner on every `serve` naming the count + the opt-outs. Fires
    // unless explicitly opted out (`syncTsx: false`); loopback hubs (local dev)
    // skip it — no remote exfil concern.
    const tsxBodyCount = canvases.filter((c) => c.html.toLowerCase().endsWith('.tsx')).length;
    if (linkedHub.syncTsx !== false && tsxBodyCount > 0 && !isLoopbackHubUrl(linkedHub.url)) {
      console.warn(
        `[sync] ${tsxBodyCount} TSX canvas BODIES will sync to ${linkedHub.url} (TSX sync is ON by default — DDR-079). The sandbox contains execution, but a WebRTC/self-nav exfil residual applies to every synced canvas — link only hubs you operate or trust. Opt out: linkedHub.syncTsx=false (whole project) or a canvas .meta.json "syncable": false (one canvas).`
      );
    }

    statusStore =
      opts.statusStore ??
      createSyncStatusStore({
        url: linkedHub.url,
        canvases: canvases.length,
        sharedDoc: useSharedDoc,
        write: (payload) => {
          const file = path.join(ctx.paths.designRoot, '_sync.json');
          writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        },
        broadcast: (payload) => ctx.bus.emit('sync:status', payload),
      });
    const store = statusStore;
    monitor =
      opts.connectionMonitor ?? createConnectionMonitor({ onChange: (snap) => store.update(snap) });
    const mon = monitor;

    const reader = createFsReader({
      rootDir: ctx.paths.designRoot,
      accept: (rel) => {
        const ext = path.extname(rel).toLowerCase();
        // `.tsx` added in T3 (9.1-B) so local edits to an opted-in syncable
        // `.tsx` body propagate. Non-syncable `.tsx` changes still notify but
        // match no agent in onRead (descriptor-scoped) → harmless no-op.
        // `.css` added in Gap 3 so the canvas's sibling stylesheet syncs.
        return (
          ext === '.html' || ext === '.tsx' || ext === '.json' || ext === '.svg' || ext === '.css'
        );
      },
      onRead: (evt) => {
        const abs = path.join(ctx.paths.designRoot, evt.path);
        // Dispatch to whichever disk handler owns this path. Only one of
        // agents/projections is populated (useSharedDoc decides); the projector
        // exposes the same applyFromFs(evt) shape as the agent.
        for (const agent of agents.values()) {
          if (agent.applyFromFs({ path: abs, bytes: evt.bytes, hash: evt.hash })) return;
        }
        for (const proj of projections.values()) {
          if (proj.applyFromFs({ path: abs, bytes: evt.bytes, hash: evt.hash })) return;
        }
      },
    });
    fsReader = reader;

    busUnsub = ctx.bus.on('fs:any', (rel: string) => {
      reader.notify(rel);
    });

    const adoptOnce = opts.adopt ?? !!linkedHub.adopt;
    let adoptReconciled = 0;
    const adoptTarget = canvases.length;

    for (const canvas of canvases) {
      try {
        // Phase 9.2 (DDR-064) — when sharedDoc is on, the provider attaches to
        // the collab room's single Y.Doc (registry.getDoc) instead of a fresh
        // one, so browser edits flow straight into the doc that syncs to the
        // hub — no disk hop, no relay, no clobber. Pin the room so the
        // last-browser-leaves drop can't destroy the doc out from under the
        // provider. NB: cold-start seeding of a divergent local+hub doc is the
        // duplication trap (Risk 1) — made safe by Phase E (migrate-seed); the
        // flag stays OFF until then.
        const sharedYDoc = useSharedDoc ? opts.registry?.getDoc?.(canvas.slug) : undefined;
        if (useSharedDoc && sharedYDoc) {
          opts.registry?.pin?.(canvas.slug);
          pinnedSlugs.add(canvas.slug);
        }
        const provider = await providerFactory({
          url: linkedHub.url,
          token,
          documentName: canvas.slug,
          document: sharedYDoc,
        });
        providers.set(canvas.slug, provider);
        const canvasPaths = {
          html: canvas.html,
          comments: canvas.comments,
          annotations: canvas.annotations,
          meta: canvas.meta,
          css: canvas.css,
        };
        // Phase 9.2 (DDR-064) — the disk handler. Under sharedDoc it's a
        // loop-free projection (html/css/meta doc→file + all-types file→doc;
        // the collab room keeps comments/annotations doc→file, so no
        // double-write). Flag-OFF keeps the proven two-doc agent.
        let agent: CanvasSyncAgent | undefined;
        let projection: DocProjection | undefined;
        if (useSharedDoc && sharedYDoc) {
          projection = createDocProjection({
            slug: canvas.slug,
            doc: provider.document,
            paths: canvasPaths,
            echoGuard,
          });
          projection.start();
          projections.set(canvas.slug, projection);
        } else {
          agent = createCanvasSyncAgent({
            slug: canvas.slug,
            doc: provider.document,
            paths: canvasPaths,
            echoGuard,
            adopt: adoptOnce,
            onConflict: (info) => store.addConflict(info),
          });
          agent.start();
          agents.set(canvas.slug, agent);
        }

        // Task 8 — feed this provider's WS status into the offline monitor.
        if (provider.onStatus) {
          statusDetaches.push(provider.onStatus((s) => mon.noteProviderStatus(canvas.slug, s)));
        } else {
          // No status events (test stub) — treat as connected so the monitor
          // doesn't sit in the boot 'connecting' state forever.
          mon.noteProviderStatus(canvas.slug, 'connected');
        }
        // Count local edits (agent-origin doc updates) toward queuedOps while
        // the hub is unreachable — the banner's "N edits queued" figure. Under
        // sharedDoc there is no agent origin to key off (browser edits carry a
        // RoomConn origin); queued-edit counting in that mode is a known gap
        // (offline-banner accuracy only, not data) deferred past Phase C.
        if (agent) {
          const agentOrigin = agent.origin;
          const onLocalUpdate = (_u: Uint8Array, origin: unknown) => {
            if (origin === agentOrigin) mon.noteLocalEdit();
          };
          provider.document.on('update', onLocalUpdate);
          statusDetaches.push(() => provider.document.off('update', onLocalUpdate));
        }

        // Task 5 — bridge the provider's hub-synced Awareness to the Room so
        // browser cursors relay cross-machine. No-op when the provider exposes
        // no awareness or no registry was passed (file-sync-only tests).
        if (opts.registry && provider.awareness) {
          awarenessDetaches.push(opts.registry.attachHubAwareness(canvas.slug, provider.awareness));
        }

        // Relay hub-pushed comment/annotation changes straight into the live
        // room — IN-PROCESS + synchronous, so the room's in-memory doc is
        // updated BEFORE its 800ms persist timer can flush stale pre-sync state
        // back over the file (the disk-mediated re-seed in createCollab loses
        // that race under an actively-edited peer; this is the tight path that
        // actually closes the "comment reverts" clobber). Wholesale-replace via
        // syncRoomFrom* → no duplication. Skip agent-origin updates (our own
        // disk→doc apply — the file is authoritative there; a local design:edit
        // reaches the room via createCollab's fs hook instead).
        //
        // CRITICAL: observe the comment + annotation Y-types SEPARATELY, not the
        // whole-doc update. A whole-doc relay re-applies BOTH types on every
        // change, so a comment sync would re-push the (stale) annotation and
        // clobber an annotation the peer just drew but hasn't synced yet — and
        // vice versa. Per-type observers keep the two lanes independent.
        //
        // Phase 9.2 (DDR-064): under sharedDoc the provider IS attached to the
        // room's doc, so there is no second doc to relay into — the room already
        // has every change. Skipping the relay is what RETIRES the
        // wholesale-replace clobber path (the Phase 9.1 ceiling): with one doc,
        // CRDT merge handles concurrency, no last-writer-wins blob copy.
        const reg = opts.registry;
        if (!useSharedDoc && agent && reg?.syncRoomFromComments) {
          const agentOrigin = agent.origin;
          const slug = canvas.slug;
          const provComments = provider.document.getArray(Y_TYPES.comments);
          const provAnn = provider.document.getMap(Y_TYPES.annotations);
          const onComments = (_e: unknown, tx: { origin: unknown }) => {
            if (tx.origin === agentOrigin) return;
            reg.syncRoomFromComments?.(slug, provComments.toArray());
          };
          const onAnn = (_e: unknown, tx: { origin: unknown }) => {
            if (tx.origin === agentOrigin) return;
            const svg = provAnn.get('svg');
            if (typeof svg === 'string') reg.syncRoomFromAnnotations?.(slug, svg);
          };
          provComments.observe(onComments);
          provAnn.observe(onAnn);
          statusDetaches.push(() => {
            provComments.unobserve(onComments);
            provAnn.unobserve(onAnn);
          });
        }

        // Cold-start reconcile fires once the provider has hub state.
        void provider.onceSynced().then(async () => {
          if (projection) {
            // Phase E (DDR-064 Task 9) — one-time authoritative seed BEFORE
            // materializing: escapes the duplication trap by picking ONE source
            // (hub-wins if the synced doc holds state; adopt local files only
            // when the hub was empty), inside a MIGRATION transaction. The room
            // file-seed is disabled for this pinned slug (createCollab
            // shouldSeed), so no duplicate items can be introduced afterward.
            const result = migrateSeed({
              slug: canvas.slug,
              doc: provider.document,
              paths: canvasPaths,
              historyDir: path.join(ctx.paths.historyDir, canvas.slug),
            });
            if (result === 'local-adopt') {
              console.log(`[sync/${canvas.slug}] shared-doc: adopted local state (hub was empty).`);
            }
            // Then materialize the converged doc to disk (safe — never clobbers
            // non-empty local with an empty doc value).
            projection.reconcile();
            return;
          }
          if (!agent) return;
          await agent.reconcile();
          if (adoptOnce) {
            adoptReconciled++;
            if (adoptReconciled === adoptTarget) {
              // All canvases adopted — clear the flag from .design/config.json
              // so re-running serve doesn't re-trigger. DDR-054 §2i.
              clearAdoptFlag(ctx);
            }
          }
        });
      } catch (err) {
        console.error(`[sync/${canvas.slug}] failed to start:`, err);
      }
    }

    // Persist an initial status snapshot so `_sync.json` exists — and `maude
    // design status` + the browser banner report "agent running" — from the
    // moment serve boots. The ConnectionMonitor only emits on *transitions* and
    // starts in 'online', so on a clean fast localhost connect (provider
    // reaches 'connected' at/before subscribe → no transition fires) nothing
    // would otherwise be written, and status would read "idle / sync agent not
    // running" while sync is in fact healthy. This was the observed bug.
    store.update(mon.snapshot());

    console.log(
      `[sync] linked to ${linkedHub.url} — ${agents.size + projections.size}/${canvases.length} canvas(es) syncing${useSharedDoc ? ' (shared-doc)' : ''}${adoptOnce ? ' (adopt mode — pushing local up)' : ''}.`
    );
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    for (const detach of awarenessDetaches) {
      try {
        detach();
      } catch {
        /* best-effort — registry teardown also clears bridges on destroyAll */
      }
    }
    awarenessDetaches.length = 0;
    // Phase 9.2 (DDR-064) — release shared-doc pins so the rooms can be dropped
    // / destroyed normally on shutdown. Empty unless sharedDoc was active.
    for (const slug of pinnedSlugs) {
      try {
        opts.registry?.unpin?.(slug);
      } catch {
        /* best-effort */
      }
    }
    pinnedSlugs.clear();
    for (const detach of statusDetaches) {
      try {
        detach();
      } catch {
        /* best-effort */
      }
    }
    statusDetaches.length = 0;
    monitor?.stop();
    busUnsub?.();
    busUnsub = null;
    fsReader?.stop();
    fsReader = null;
    for (const agent of agents.values()) {
      try {
        await agent.flush();
        agent.stop();
      } catch {
        /* best-effort */
      }
    }
    agents.clear();
    // Phase 9.2 (DDR-064) — final doc→file flush + stop the projectors BEFORE
    // tearing down providers (so the converged doc lands on disk). The shared
    // doc itself is owned by the collab room and destroyed by registry teardown,
    // not here.
    for (const proj of projections.values()) {
      try {
        await proj.flush();
        proj.stop();
      } catch {
        /* best-effort */
      }
    }
    projections.clear();
    for (const provider of providers.values()) {
      try {
        provider.destroy();
      } catch {
        /* best-effort */
      }
    }
    providers.clear();
  }

  return {
    start,
    stop,
    // Under sharedDoc the per-canvas handler is a projection, not an agent;
    // count both so size() reflects the synced-canvas count in either mode.
    size: () => agents.size + projections.size,
    agentFor: (slug) => agents.get(slug),
    status: () => statusStore?.get() ?? null,
  };
}

/* ---------------------------------------------------------------- discovery */

/**
 * Scan `<designRoot>/{ui,system}/` for `.html` canvas files and return one
 * CanvasDescriptor per. Mirrors the existing api.ts file-tree scan but
 * specialised for the sync runtime (we only need the three paths per canvas,
 * not the full metadata).
 *
 * DDR-054 §2b / DDR-060 — `.tsx` canvases are deliberately EXCLUDED from sync.
 * The dev-server transpiles `.tsx` to JavaScript and serves it as
 * `application/javascript` in iframe same-origin; a hostile hub pushing
 * arbitrary TypeScript source would result in RCE (the audit's CRITICAL F1).
 * Since Phase 3.6 made `.tsx` the ONLY canvas format, this means real projects
 * discover zero syncable canvases — surfaced loudly by `surfaceNoSyncable`
 * (9.1-D) rather than silently. The per-canvas opt-in (`.meta.json.syncable:
 * true`) + CSP/sandbox gate that make `.tsx` syncable land in 9.1-A/B.
 */
export async function discoverCanvases(ctx: Context): Promise<CanvasDescriptor[]> {
  return (await scanCanvases(ctx)).canvases;
}

/** Result of a canvas-group scan: syncable descriptors + a tally of the .tsx
 *  canvases that exist but are NOT yet syncable (DDR-060 — they need the
 *  per-canvas opt-in + sandbox gate). The tsx count feeds 9.1-D's loud
 *  zero-syncable surface so the message can say *why* nothing syncs. */
export interface CanvasScan {
  canvases: CanvasDescriptor[];
  tsxCount: number;
}

export async function scanCanvases(ctx: Context): Promise<CanvasScan> {
  const out: CanvasDescriptor[] = [];
  const counter = { tsx: 0 };
  // T3 (9.1-B) — LOAD-BEARING coupling (the plan's "two locks flip together"
  // invariant): a `.tsx` body is admitted to sync ONLY when the cross-origin
  // CSP/sandbox containment is active (`ctx.canvasOrigin` is set — Lock 2). The
  // sandbox is now ON BY DEFAULT, but a user can opt out with
  // MAUDE_CANVAS_ORIGIN_SPLIT=0; if they do, `canvasOrigin` is undefined and NO
  // `.tsx` syncs — the per-canvas opt-in is inert without the sandbox, and
  // decoupling them would re-open the CRITICAL F1 RCE (DDR-060, DDR-054 §F1).
  const splitActive = !!ctx.canvasOrigin;
  // DDR-079 (supersedes DDR-072) — TSX sync defaults ON for a linked project.
  // Absence of the flag = ON: a freshly-linked peer sees the project's TSX
  // without a hidden per-project opt-in (the recurring "I linked but my teammate
  // sees nothing" footgun). `linkedHub.syncTsx: false` is the explicit
  // project-wide opt-out; a per-canvas `.meta.json "syncable": false` still wins
  // for one canvas (see resolveSyncable). The Lock-2 sandbox coupling
  // (`splitActive`) is UNTOUCHED — a `.tsx` still syncs ONLY when the cross-origin
  // containment is active; decoupling them would re-open the F1 RCE (DDR-060).
  const projectSyncTsx = ctx.cfg.linkedHub?.syncTsx !== false;
  for (const group of ctx.cfg.canvasGroups) {
    const groupAbs = path.join(ctx.paths.designRoot, group.path);
    if (!existsSync(groupAbs)) continue;
    await walk(
      groupAbs,
      ctx.paths.designRoot,
      ctx.paths.commentsDir,
      ctx.paths.designRel,
      out,
      counter,
      splitActive,
      projectSyncTsx
    );
  }
  return { canvases: out, tsxCount: counter.tsx };
}

/**
 * T3 (9.1-B) + DDR-079 (was DDR-072) — resolve whether a `.tsx` body is syncable.
 *
 * Tri-state precedence:
 *  1. The sibling `<name>.meta.json` `"syncable"` boolean ALWAYS wins when
 *     present (`true` opts in, `false` opts out) — set by a human editing the
 *     sidecar; deliberately NOT in the untrusted `/_api/canvas-meta` PATCH
 *     whitelist (api.ts), so a hostile canvas/hub cannot flip its own body into
 *     or out of the sync set.
 *  2. Otherwise fall back to `projectSyncTsx` — which now defaults to TRUE
 *     (DDR-079); `linkedHub.syncTsx: false` is the explicit project-wide opt-out.
 *
 * Missing sidecar / parse error → no explicit verdict → the project default (on).
 */
function resolveSyncable(bodyAbs: string, projectSyncTsx: boolean): boolean {
  const metaAbs = bodyAbs.replace(/\.(tsx|html)$/i, '.meta.json');
  try {
    const obj = JSON.parse(readFileSync(metaAbs, 'utf8'));
    if (obj && typeof obj === 'object' && typeof obj.syncable === 'boolean') {
      return obj.syncable; // per-canvas verdict wins (true OR explicit false)
    }
  } catch {
    /* missing / unparseable sidecar → defer to the project default below */
  }
  return projectSyncTsx;
}

async function walk(
  dirAbs: string,
  designRoot: string,
  commentsDir: string,
  designRel: string,
  acc: CanvasDescriptor[],
  counter: { tsx: number },
  splitActive: boolean,
  projectSyncTsx: boolean
): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      // Skip plugin runtime dirs.
      if (entry.name.startsWith('_')) continue;
      await walk(
        abs,
        designRoot,
        commentsDir,
        designRel,
        acc,
        counter,
        splitActive,
        projectSyncTsx
      );
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    // T3 (9.1-B) + DDR-072 — a `.tsx` syncs ONLY when the sandbox is active AND
    // it resolves to syncable (per-canvas sidecar verdict, else the project-level
    // `linkedHub.syncTsx` default — see resolveSyncable + the splitActive
    // coupling above). Otherwise tally it for 9.1-D's loud zero-syncable surface
    // so the message can explain *why* it isn't syncing.
    if (ext === '.tsx') {
      if (!(splitActive && resolveSyncable(abs, projectSyncTsx))) {
        counter.tsx += 1;
        continue;
      }
      // falls through to descriptor push (body = the .tsx file)
    } else if (ext !== '.html') {
      continue;
    }
    const slug = slugFor(abs, designRoot, designRel);
    acc.push({
      // `html` is the canvas BODY path — `.html` or an opted-in `.tsx`. The
      // sync codec treats the body as opaque Y.Text, so the field name is
      // historical; both formats round-trip identically (DDR-060).
      slug,
      html: abs,
      comments: path.join(commentsDir, `${slug}.json`),
      annotations: path.join(designRoot, `${slug}.annotations.svg`),
      // The `.meta.json` sidecar sits next to the body: `Foo.tsx` → `Foo.meta.json`.
      meta: abs.replace(/\.(tsx|html)$/i, '.meta.json'),
      // The `.css` sibling: `Foo.tsx` → `Foo.css` (absent for inline-CSS canvases).
      css: abs.replace(/\.(tsx|html)$/i, '.css'),
    });
  }
}

/**
 * The shape written to `<designRoot>/_sync.json` (and broadcast on the
 * 'sync:status' bus) when the project is linked but has zero syncable
 * canvases. DDR-060 / 9.1-D. Distinct from the live SyncStatusPayload — the
 * `notSyncable` discriminator lets the CLI status line and the browser banner
 * render the "linked but nothing syncs" state instead of a healthy one.
 */
export interface NoSyncablePayload {
  linked: true;
  notSyncable: true;
  url: string;
  reason: string;
  /** Count of .tsx canvases present (syncable once 9.1-A/B land). */
  tsxCount: number;
  canvases: 0;
  updatedAt: number;
}

/** Build the zero-syncable payload (exported for the CLI + tests). */
export function buildNoSyncablePayload(
  url: string,
  tsxCount: number,
  designRoot: string
): NoSyncablePayload {
  const reason =
    tsxCount > 0
      ? `${tsxCount} TSX canvas(es) found but none are syncable. TSX sync is ON by default (DDR-079), so this means it was opted OUT — either project-wide (.design/config.json linkedHub.syncTsx: false) or per canvas (.meta.json "syncable": false) — OR the cross-origin sandbox is off (MAUDE_CANVAS_ORIGIN_SPLIT=0 disables it, and TSX sync with it — DDR-060). Remove the opt-out / re-enable the sandbox to sync.`
      : `no canvases found under ${designRoot}.`;
  return {
    linked: true,
    notSyncable: true,
    url,
    reason,
    tsxCount,
    canvases: 0,
    updatedAt: Date.now(),
  };
}

/**
 * 9.1-D — replace the silent zero-canvas early-return with a loud surface:
 * a warn line, a `_sync.json` the CLI + browser read, and a bus broadcast.
 * Best-effort on the write/broadcast — a failure there must never throw into
 * the boot path (solo mode for unlinked projects is unaffected either way).
 */
function surfaceNoSyncable(ctx: Context, url: string, tsxCount: number): void {
  const payload = buildNoSyncablePayload(url, tsxCount, ctx.paths.designRoot);
  console.warn(`[sync] linked to ${url} but 0 syncable canvases — ${payload.reason}`);
  try {
    const file = path.join(ctx.paths.designRoot, '_sync.json');
    writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch {
    /* best-effort — never throw into boot */
  }
  try {
    ctx.bus.emit('sync:status', payload);
  } catch {
    /* best-effort */
  }
}

function slugFor(absPath: string, designRoot: string, designRel: string): string {
  let rel = path.relative(designRoot, absPath);
  rel = rel.replace(/\\/g, '/');
  // Mirror api.fileSlug(): collapse path separators to '-', strip extension.
  const prefix = `${designRel.replace(/^\/+|\/+$/g, '')}/`;
  if (rel.startsWith(prefix)) rel = rel.slice(prefix.length);
  return rel
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

/* ---------------------------------------------------------------- default provider */

/**
 * The production provider factory — instantiates a real HocuspocusProvider.
 * Imported dynamically so tests / unlinked projects don't pay the load cost.
 */
async function defaultProviderFactory(args: {
  url: string;
  token: string;
  documentName: string;
  document?: Y.Doc;
}): Promise<SyncProvider> {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import of optional dep.
  let mod: any;
  try {
    mod = await import('@hocuspocus/provider');
  } catch (err) {
    throw new Error(
      `@hocuspocus/provider unavailable — install it under apps/studio/. (${err instanceof Error ? err.message : String(err)})`
    );
  }
  // Hocuspocus accepts ws:// or wss://; the linked URL is http(s)://, so swap
  // the scheme. The provider also accepts http(s):// and upgrades internally
  // in newer versions, but ws:// is explicit + portable.
  const wsUrl = toWsUrl(args.url);
  // Phase 9.2 (DDR-064) — attach to the shared room doc when the runtime
  // injected one; otherwise own a fresh doc (the legacy two-doc path).
  const document = args.document ?? new Y.Doc();
  // biome-ignore lint/suspicious/noExplicitAny: provider runtime is typed at the call site.
  const provider: any = new mod.HocuspocusProvider({
    url: wsUrl,
    name: args.documentName,
    token: args.token,
    document,
    connect: true,
    // Make a rejected handshake LOUD instead of an invisible reconnect loop.
    // The most common cause is a scope-bound token (DDR-053 default scope =
    // label) that can't authorize this canvas's flat-slug documentName — that
    // failure mode previously looked identical to "hub unreachable / offline".
    onAuthenticationFailed: (data: { reason?: string }) => {
      const reason = (data?.reason ?? 'unknown reason').replace(/[\r\n]/g, ' ').slice(0, 200);
      console.warn(
        `[sync] hub REJECTED auth for documentName="${args.documentName}": ${reason}.
       If this is "token not authorized for this documentName", the token's scope
       does not cover this canvas — mint a hub-wide token (\`maude hub token generate
       --scope '*'\` or an admin-UI invite) and re-link. The peer keeps retrying until then.`
      );
    },
  });
  return {
    document,
    // HocuspocusProvider creates a hub-synced Awareness by default; expose it
    // so the runtime can bridge it to the collab Room (Task 5).
    awareness: provider.awareness as Awareness | undefined,
    onStatus(cb: (status: ProviderStatus) => void): () => void {
      // HocuspocusProvider emits 'status' with { status: 'connected' |
      // 'connecting' | 'disconnected' } on every WS transition (Task 8).
      const handler = (evt: { status?: string }) => {
        const s = evt?.status;
        if (s === 'connected' || s === 'connecting' || s === 'disconnected') cb(s);
      };
      provider.on('status', handler);
      // Seed the subscriber with the provider's CURRENT status immediately. On
      // localhost the WS can reach 'connected'/synced inside the constructor —
      // before this listener attaches — so waiting for the *next* transition
      // would leave the connection monitor un-seeded and `_sync.json` never
      // written (status reads "idle / sync agent not running" while sync is in
      // fact healthy). Reading provider.status closes that race; it always
      // reflects the true current state, so a missed event can't strand us.
      const cur = provider.status;
      if (cur === 'connected' || cur === 'connecting' || cur === 'disconnected') cb(cur);
      return () => provider.off('status', handler);
    },
    onceSynced(): Promise<void> {
      return new Promise<void>((resolve) => {
        if (provider.synced) {
          resolve();
          return;
        }
        const handler = () => {
          provider.off('synced', handler);
          resolve();
        };
        provider.on('synced', handler);
      });
    },
    destroy() {
      provider.destroy();
    },
  };
}

/** Convert an http(s):// URL to ws(s):// for the HocuspocusProvider. */
export function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith('https://')) return `wss://${httpUrl.slice('https://'.length)}`;
  if (httpUrl.startsWith('http://')) return `ws://${httpUrl.slice('http://'.length)}`;
  return httpUrl;
}

/**
 * Rewrite .design/config.json to drop `linkedHub.adopt`. Called once after
 * all canvases finish their first adopt-reconcile. DDR-054 §2i (defender I5).
 * Best-effort — failure logs and leaves the disk flag in place; the only
 * downstream cost is the user being prompted to re-run adopt.
 */
function clearAdoptFlag(ctx: Context): void {
  const cfgPath = path.join(ctx.paths.repoRoot, '.design', 'config.json');
  if (!existsSync(cfgPath)) return;
  try {
    const raw = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      linkedHub?: { adopt?: boolean; lastAdoptedAt?: number };
    };
    if (!raw?.linkedHub?.adopt) return;
    raw.linkedHub.adopt = undefined;
    raw.linkedHub.lastAdoptedAt = Date.now();
    // Strip undefined values via stringify/parse so the JSON output is clean.
    const cleaned = JSON.parse(JSON.stringify(raw));
    writeFileSync(cfgPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
    console.log('[sync] adopt complete — cleared linkedHub.adopt from .design/config.json');
  } catch (err) {
    console.warn(
      '[sync] failed to clear linkedHub.adopt:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Refuse non-loopback ws:// / http:// (cleartext token exposure to MITM).
 * DDR-054 §2e (attacker F9). Returns null on accept, error string on refuse.
 *
 * Loopback hosts (localhost, 127.0.0.1, [::1], ::1) keep ws:// allowed for
 * local hub development. Non-http(s)/ws(s) schemes are refused outright.
 */
export function checkUrlScheme(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return `invalid hub URL: ${url}`;
  }
  const proto = u.protocol.toLowerCase();
  if (proto !== 'http:' && proto !== 'https:' && proto !== 'ws:' && proto !== 'wss:') {
    return `unsupported hub URL scheme: ${proto} (expected https:// or wss://)`;
  }
  const isPlaintext = proto === 'http:' || proto === 'ws:';
  if (!isPlaintext) return null;
  const host = u.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (!isLoopback) {
    return `plaintext URL (${proto}//) is only allowed for loopback hosts. Use wss:// for ${host} or change the host to localhost.`;
  }
  return null;
}

/**
 * DDR-072 — true when the hub URL points at a loopback host (localhost,
 * 127.0.0.1, ::1). Used to suppress the `syncTsx` boot banner for local dev
 * hubs (no remote exfil concern). Unparseable URL → treated as non-loopback
 * (fail loud / show the banner). Mirrors checkUrlScheme's loopback host set.
 */
export function isLoopbackHubUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}
