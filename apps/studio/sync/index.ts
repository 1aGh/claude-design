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

import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { Y_TYPES } from '../collab/persistence.ts';
import type { Context, LinkedHub } from '../context.ts';
import { createHistory } from '../history.ts';
import { SYNTHETIC_FS_DELAY_MS } from '../hmr-broadcast.ts';
import { type CanvasSyncAgent, createCanvasSyncAgent } from './agent.ts';
import { atomicWrite } from './atomic-write.ts';
import { createAutoCommit } from './autocommit.ts';
import { type CellPairing, resolveCellPairing, sanitizeForLog } from './cell-pairing.ts';
import { canvasPathFromDoc, stampCanvasPath } from './codec.ts';
import {
  type ConnectionMonitor,
  createConnectionMonitor,
  type ProviderStatus,
} from './connection-state.ts';
import { createDocNameResolver } from './doc-name.ts';
import { createEchoGuard } from './echo-guard.ts';
import { createFsReader, type FsReader } from './fs-mirror.ts';
import { getHubToken } from './hubs-config.ts';
import { loadJournal, type SyncJournal } from './journal.ts';
import { isLoopbackHost } from './loopback.ts';
import { migrateSeed } from './migrate-seed.ts';
import { ORIGINS } from './origins.ts';
import { createDocProjection, type DocProjection } from './projection.ts';
import {
  describeRemoteDiff,
  diffRemoteDocs,
  fetchRemoteDocs,
  pullTargets,
  resolvePulledTarget,
} from './remote-docs.ts';
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
  /**
   * DDR-102 — subscribe to hub auth rejections for this document. Returns an
   * unsubscribe fn. Optional — a stub without it just isn't classified.
   */
  onAuthFailed?(cb: (info: { reason: string }) => void): () => void;
  destroy(): void;
}

/* ------------------------------------------------- auth-failure classification */

/** DDR-102 — rejection classes the runtime distinguishes. `rate-limit` and
 *  `generic` are transient (provider backoff keeps retrying); `not-authorized`
 *  and `invalid-token` are permanent (retrying spams the hub bucket — destroy
 *  the provider and re-probe on a slow timer instead). */
export type AuthFailureClass = 'rate-limit' | 'not-authorized' | 'invalid-token' | 'generic';

/** Map a raw hub rejection reason to a class. New hubs send distinct reasons
 *  (DDR-102 hub fix); old hubs send the Hocuspocus default `permission-denied`
 *  → `generic` (interop-safe degradation). */
export function classifyAuthFailure(raw: string): AuthFailureClass {
  const s = raw.toLowerCase();
  if (s.includes('rate limit')) return 'rate-limit';
  if (s.includes('not authorized')) return 'not-authorized';
  if (s.includes('invalid token')) return 'invalid-token';
  return 'generic';
}

export const AUTH_WARN_DEBOUNCE_MS = 2_000;
export const AUTH_REPROBE_MS = 5 * 60 * 1000;
export const BOOT_SETTLE_TIMEOUT_MS = 15_000;

const AUTH_CLASS_HINT: Record<AuthFailureClass, string> = {
  'rate-limit':
    'boot burst hit the hub rate limit — sync settles as providers back off; if persistent, raise HUB_CONN_RATE_LIMIT on the hub (DDR-102 hubs default to 600/min for valid tokens).',
  'not-authorized':
    "the token's scope does not cover these canvases — mint a hub-wide token (`maude hub token generate --scope '*'` or an admin-UI invite) and re-link. Retries stopped; re-probing in 5 min.",
  'invalid-token':
    'the stored token was rejected — re-run `maude design link <url> --token …` on this machine. Retries stopped; re-probing in 5 min.',
  generic:
    'the hub refused auth without a specific reason (older hub?) — check `maude design status` and the hub logs.',
};

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
  /**
   * DDR-102 — auth-failure + boot-settle knobs (test injection, mirrors the
   * connection-state injectable-timer pattern).
   */
  auth?: {
    /** Debounce for the ONE aggregated rejection warn. Default 2 s. */
    warnDebounceMs?: number;
    /** Re-probe interval for permanently-rejected docs. Default 5 min. */
    reprobeMs?: number;
    /** Boot summary settle ceiling. Default 15 s. */
    settleTimeoutMs?: number;
    setTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimer?: (h: ReturnType<typeof setTimeout>) => void;
  };
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
  // A CELL'S HISTORY BELONGS TO THE CELL — Cloud Phase 27 D2 — WITH EXACTLY ONE
  // EXCEPTION, which is desktop↔cloud live pairing (variant C2).
  //
  // `.design/config.json` is the TENANT's file, versioned in their repo, and
  // `linkedHub` is whatever hub their desktop was linked to when they committed
  // it. Honouring that inside a cell would do two things nobody asked for: dial
  // OUT from the cell to a third-party hub carrying the project's canvases, and
  // start a SECOND autocommit over the working tree the hub is already
  // committing — the exact duplication that phase exists to delete.
  //
  // Both of those remain refused. What is now permitted is the cell talking to
  // ITSELF: a loopback, commit-disabled, shared-doc provider to its own hub, so
  // the browser's collab doc and the desktop's Hocuspocus doc become ONE doc and
  // presence + edits cross. The conditions live in `cell-pairing.ts` and every
  // one of them is a hard gate — see that file for why each exists.
  //
  // Note the ORDER: pairing is resolved from the ENVIRONMENT (which the hub owns
  // and the tenant cannot write) BEFORE `ctx.cfg.linkedHub` is consulted, and it
  // takes only the workspace id from the tenant's config. A cell with pairing on
  // and no `linkedHub` in the tenant's file still pairs; a cell with pairing off
  // and a `linkedHub` pointing anywhere still refuses.
  const workspaceMode = process.env.MAUDE_WORKSPACE_MODE === '1';
  const pairingVerdict = resolveCellPairing();
  const cellPairing: CellPairing | null = pairingVerdict.pairing;
  if (workspaceMode && !cellPairing) {
    if (pairingVerdict.detail) {
      // The operator asked for pairing and we refused — say why, loudly.
      console.warn(`[sync] cell pairing refused — ${pairingVerdict.detail}`);
    }
    console.warn(
      `[sync] ignoring linkedHub ${ctx.cfg.linkedHub?.url ?? '(none)'} — in a workspace cell the hub owns history and sync. (DDR-209 / Phase 27 D2)`
    );
    return null;
  }

  // The hub URL the providers dial. Under pairing it is the hub's own loopback
  // address, NEVER the tenant's `linkedHub.url`. `workspaceId` is the one field
  // taken from the tenant's config, because it decides the wire document name
  // and the desktop resolves it the same way — see cell-pairing.ts.
  const linked: LinkedHub | undefined = cellPairing
    ? {
        url: cellPairing.url,
        linkedAt: 0,
        ...(ctx.cfg.linkedHub?.workspaceId ? { workspaceId: ctx.cfg.linkedHub.workspaceId } : {}),
      }
    : ctx.cfg.linkedHub;
  if (!linked) return null;
  const linkedHub = linked;
  if (cellPairing) {
    console.log(
      `[sync] cell pairing ON — loopback shared-doc provider to ${sanitizeForLog(linkedHub.url)}; autocommit disabled (the hub is the sole committer). DDR-209 threaded, not reversed.`
    );
  }

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

  // DDR-192 §5 — slug → wire documentName. Only the WIRE name is namespaced;
  // every local map (providers, agents, projections, _history/) stays keyed by
  // the flat slug. Opt-in for now (see createDocNameResolver's rollout rule);
  // a bad MAUDE_HUB_NAMESPACED=1 with no resolvable workspace id throws here
  // rather than silently falling back into a shared namespace.
  let docNameFor: (slug: string) => string;
  try {
    docNameFor = createDocNameResolver({
      repoRoot: ctx.paths.repoRoot,
      explicitWorkspaceId: linkedHub.workspaceId,
      flag: process.env.MAUDE_HUB_NAMESPACED,
    });
  } catch (err) {
    console.error(`[sync] refusing to start: ${(err as Error).message}`);
    return null;
  }

  // Cloud Phase 3 Task 1 — in a workspace cell, a disk write is only half the
  // save: nobody is at a keyboard to commit, so the cell does it. Off entirely
  // outside workspace mode, where the developer's own git IS the history and
  // committing under them would be an intrusion (DDR-119).
  //
  // AND OFF UNDER CELL PAIRING, which is the guard DDR-209's core fear asks for.
  // The hub's `afterStoreDocument` already commits every stored document; a
  // second committer inside the studio child would race it over one working
  // tree and one `.git/index`. This is structural rather than conditional on
  // purpose — under pairing the object is never CONSTRUCTED, so there is no
  // later branch that could accidentally reach a commit. `cell-pairing.ts`
  // refuses to pair at all unless MAUDE_SYNC_NO_AUTOCOMMIT says so out loud, so
  // the two halves of this invariant can never disagree.
  const autoCommit =
    workspaceMode && !cellPairing
      ? createAutoCommit({
          repoRoot: ctx.paths.repoRoot,
          run: async (args, { cwd }) => {
            const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
            const [stdout, stderr] = await Promise.all([
              new Response(proc.stdout).text(),
              new Response(proc.stderr).text(),
            ]);
            return { code: await proc.exited, stdout, stderr };
          },
        })
      : null;

  // Under pairing the credential is the hub's own derived cell token, handed to
  // this process in its environment. `~/.config/maude/hubs.json` is a PERSON's
  // credential store and does not exist in a cell (HOME=/tmp) — which is exactly
  // why the old guard was unreachable by accident rather than by design.
  const resolvedToken = cellPairing ? cellPairing.token : getHubToken(linkedHub.url);
  if (!resolvedToken) {
    console.warn(
      `[sync] linked to ${linkedHub.url} but no token in ~/.config/maude/hubs.json. Re-run 'maude design link' on this machine. Solo mode for now.`
    );
    return null;
  }
  const token: string = resolvedToken;

  // DDR-102 — the default factory multiplexes every provider over ONE shared
  // WebSocket per hub URL; the runtime owns its disposal (stop(), after the
  // providers detach). An injected test factory has no shared socket.
  const ownedFactory = opts.providerFactory ? null : createDefaultProviderFactory();
  const providerFactory = opts.providerFactory ?? (ownedFactory as ProviderFactory);
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
  // DDR-102 — the per-machine sync journal (divergence detector). Created in
  // start() (after the hub URL is known), flushed + stopped in stop().
  let journal: SyncJournal | null = null;

  // DDR-102 — auth-failure intelligence state (timers cleared in stop()).
  type TimerHandle = ReturnType<typeof setTimeout>;
  const authSetTimer = opts.auth?.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const authClearTimer = opts.auth?.clearTimer ?? ((h: TimerHandle) => clearTimeout(h));
  const warnDebounceMs = opts.auth?.warnDebounceMs ?? AUTH_WARN_DEBOUNCE_MS;
  const reprobeMs = opts.auth?.reprobeMs ?? AUTH_REPROBE_MS;
  const settleTimeoutMs = opts.auth?.settleTimeoutMs ?? BOOT_SETTLE_TIMEOUT_MS;
  const pendingAuthWarn = new Map<AuthFailureClass, Set<string>>();
  /** Latest rejection class per slug — feeds the boot summary detail. */
  const rejectedReasons = new Map<string, AuthFailureClass>();
  /** Permanently-rejected docs awaiting a slow re-probe (provider destroyed). */
  const rejectedPermanent = new Map<
    string,
    { canvas: CanvasDescriptor; canvasPaths: import('./agent.ts').CanvasSyncPaths; doc: Y.Doc }
  >();
  let authWarnTimer: TimerHandle | null = null;
  let reprobeTimer: TimerHandle | null = null;
  const settleTimers = new Set<TimerHandle>();
  /** Pending synthetic `fs:any` emissions (cell pairing only), keyed by the
   *  design-root-relative path so a second write to the same file inside the
   *  delay window replaces the pending timer instead of scheduling a second
   *  one. Cleared on stop() so a teardown can't fire a reload for a runtime
   *  that no longer exists. */
  const announceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async function start(): Promise<void> {
    if (started || stopped) return;
    started = true;

    // A NEW PROCESS MUST NOT SERVE THE OLD ONE'S VERDICT.
    //
    // `_sync.json` is a file, and `/_sync-status` returns whatever is in it.
    // The first honest snapshot of THIS run is not written until every provider
    // has been constructed — after a scan and a 6-second listing fetch — and
    // until then the endpoint, the CLI and the browser banner were all reading
    // the last run's counters as if they were current. That is how a live fleet
    // showed `0 synced · 73 rejected` for a process whose own log said
    // `76/76 synced` against a hub that was accepting the credential: the
    // rejections were real, and they were from a previous session.
    //
    // Per-document verdicts are NOT rehydratable — a verdict is about a
    // handshake this process has not made yet. So the file is reset to the
    // honest seed (`connecting`, nothing known) the moment the runtime starts.
    resetPersistedStatus(ctx, linkedHub.url);

    const scan = opts.canvases ? { canvases: opts.canvases, tsxCount: 0 } : await scanCanvases(ctx);
    // DDR-064 pre-cutover A4 + A6 — two files must never share a document, and
    // the pinned set must be bounded. See `admitCanvases`.
    const localCanvases = admitCanvases(scan.canvases, useSharedDoc);

    // PULL THE REST OF THE PROJECT DOWN.
    //
    // The scan above only sees this machine's disk, and Yjs cannot enumerate —
    // so before this, a document that existed only on the hub was invisible to
    // a peer forever. A desktop carrying 72 of a project's 75 canvases synced
    // 72, reported "72/72 synced", and was accurate about the wrong universe.
    // That is what "Open in Maude does nothing" was.
    //
    // A project you have access to is a project you get, in full and in both
    // directions. Hub-only documents become real local files (flat under the
    // design root — see `pullTargets` for why flat); local-only canvases go up
    // as they always did. Best-effort: an older hub without the listing route,
    // or an unreachable one, syncs exactly as before.
    const remoteDocs = await fetchRemoteDocs(linkedHub.url, resolvedToken);
    const remoteDiff = diffRemoteDocs(
      localCanvases.map((c) => docNameFor(c.slug)),
      remoteDocs
    );
    // PROVISIONAL targets. The listing carries names and byte counts only — a
    // document's own `syncMeta.path` lives INSIDE it, so every target here is
    // the fallback, and each one is re-resolved in `handleSynced` once that
    // document has actually synced. See `relocatePulled` below.
    //
    // A FRESH LINK HAS DECLARED NOTHING. A design root with no canvases of its
    // own and no `config.json` is a folder somebody just pointed at a project.
    // `config.json` is not synced, so such a peer has only the DEFAULT groups
    // (`system`, `ui`) — and a project whose author calls their group `screens`
    // would have every single incoming path refused as out-of-group and land
    // flat and invisible. That is the empty-folder case, and it is the one this
    // whole change exists for.
    //
    // So on that one boot, an undeclared group is accepted (rules 1-7 are
    // untouched — a path still has to slug back to its own document), and the
    // groups actually seen are then WRITTEN into a config.json, additively. The
    // relaxation therefore applies once: the next boot has a config.
    // EMPTINESS IS A FACT ABOUT THE FOLDER, not about the scan. `scanCanvases`
    // walks only DECLARED groups and applies the syncable + sandbox gates, so a
    // project with real work in it scans to zero whenever `syncTsx:false`, the
    // sandbox is off, or its canvases sit in a group it never declared — and
    // treating that as "a bare folder somebody just pointed at a project" would
    // let a hub author a `config.json` into a project that had work in it.
    let freshLink =
      localCanvases.length === 0 && !existsSync(designConfigPath(ctx)) && designRootIsBare(ctx);
    const learnedGroups = new Set<string>();
    // True once THIS boot wrote the config. Until then an existing file is
    // somebody's own declaration and is never touched; afterwards it is ours to
    // extend as further groups arrive.
    let ownsSeededConfig = false;
    const noteLearnedGroup = (group: string): void => {
      if (!freshLink || learnedGroups.has(group)) return;
      learnedGroups.add(group);
      if (existsSync(designConfigPath(ctx)) && !ownsSeededConfig) return;
      if (seedProjectConfig(ctx, learnedGroups, ownsSeededConfig)) ownsSeededConfig = true;
      // ONE GROUP, ONCE. `freshLink` was a `const`, so after the first config
      // was written every FURTHER undeclared group was accepted and appended —
      // the relaxation perpetuating itself instead of closing, and a hub free to
      // plant an unbounded set of directories in a single session. The project
      // has now declared itself; everything after this is checked against that
      // declaration like any other boot.
      freshLink = false;
      pathOpts.allowUndeclaredGroup = false;
    };
    const pathOpts: {
      designRel: string;
      canvasGroups: Context['cfg']['canvasGroups'];
      allowUndeclaredGroup: boolean;
      onRefused: (slug: string, reason: string) => void;
    } = {
      designRel: ctx.paths.designRel,
      canvasGroups: ctx.cfg.canvasGroups,
      allowUndeclaredGroup: freshLink,
      onRefused: (slug: string, reason: string) =>
        console.warn(`[sync/${slug}] ignoring the path this document carries — ${reason}`),
    };
    const pulled = pullTargets(
      remoteDiff.hubOnly,
      ctx.paths.designRoot,
      path.join,
      path.resolve,
      path.sep,
      { ...pathOpts, realpath: realpathOfDeepestExisting }
    );
    const pullNote = describeRemoteDiff(remoteDiff);
    if (pullNote) console.log(`[sync] ${pullNote}`);
    /** Descriptor paths for one slug at one body path. The sidecar rules live
     *  here, once: `.meta.json`/`.css` are SIBLINGS of the body, while
     *  `.annotations.svg` is keyed by the flat slug at the design root — the
     *  asymmetry `workspace-files.mjs` documents, and which moving the body
     *  must not quietly change. */
    const descriptorFor = (slug: string, bodyAbs: string): CanvasDescriptor => ({
      slug,
      html: bodyAbs,
      comments: path.join(ctx.paths.commentsDir, `${slug}.json`),
      annotations: path.join(ctx.paths.designRoot, `${slug}.annotations.svg`),
      meta: bodyAbs.replace(/\.tsx$/i, '.meta.json'),
      css: bodyAbs.replace(/\.tsx$/i, '.css'),
    });
    // Which slugs came DOWN this run. Only these get their body path re-decided
    // after their document syncs — a canvas already on this disk has its path
    // from the disk, and letting the wire move it would be exactly the
    // "a peer relocates another peer's work" hazard the hub refuses too.
    // A PULL MAY NEVER TARGET A FILE THAT IS ALREADY ON THIS DISK.
    //
    // "Hub-only" means "no local DESCRIPTOR", which is not the same as "no local
    // file": `scanCanvases` omits a canvas whose `.meta.json` says
    // `syncable: false` (a security opt-out a hub must not be able to flip) and
    // one the sandbox gate excluded. Such a canvas is classified hub-only and
    // pulled, and its target — whether the fallback or a carried path — is the
    // real file. Note the fallback collides on its own: `ui-card` falls back to
    // `ui/card.tsx`, which IS `ui/Card.tsx` on a case-insensitive filesystem, so
    // checking only the carried path would leave the same overwrite reachable
    // with no path at all.
    //
    // Refusing the canvas is the conservative answer and the recoverable one:
    // the project keeps the file it has, and the document is still on the hub.
    //
    // APPLIED TO THE FALLBACK TOO, not only to a carried path. The fallback is
    // derived from the slug and the slug is derived from the path, so it lands
    // in the same place: `system-colors_and_type` falls back to
    // `system/colors_and_type.tsx` whether or not a path arrives. Checking only
    // the carried path leaves every one of these reachable with no path at all.
    const admittedPulls = pulled.filter((t) => admitPullTarget(ctx, t.slug, t.bodyAbs));
    const pulledSlugs = new Set(admittedPulls.map((t) => t.slug));
    const canvases = [
      ...localCanvases,
      ...admittedPulls.map((t) => descriptorFor(t.slug, t.bodyAbs)),
    ];
    // T4.5 (DDR-054 §3 F3) — every syncable canvas can receive hub-pushed
    // content, so the whole set is untrusted Claude-context. Mark it (writes
    // `_untrusted/INDEX.json` + a managed `.claudeignore` block; clears both
    // when the set is empty). Best-effort — never throws into boot.
    //
    // NOT under cell pairing. The markers exist for Claude Code reading the
    // checkout, and nothing runs Claude against a cell's tree. `.claudeignore`
    // is a REPO-ROOT file, so writing it here would put a machine-authored file
    // into the tenant's repository, which the hub would then commit and mirror
    // to their GitHub — a change to somebody's repo that nobody asked for. The
    // canvases are no less untrusted; the audience for the marker is absent.
    //
    // MARKED AT THE PATH THE BODY ACTUALLY LANDS AT. A pulled canvas's target is
    // provisional here — the listing carries no path, so every pulled entry is
    // the fallback, and `relocatePulled` moves it once that document arrives.
    // The markers used to be computed ONLY from this provisional set and never
    // recomputed, so for a hub-only document carrying a nested path the
    // `_untrusted/INDEX.json` + `.claudeignore` block named a file that is never
    // created, while the genuinely hub-pushed body sat at the real path listed
    // nowhere. That is the DDR-054 §3 F3 control pointing at a phantom.
    //
    // So it is written twice: once now (so the markers exist before any provider
    // is built) and once after the pulls settle, from the final descriptors.
    const markUntrusted = (): void => {
      if (!cellPairing) writeUntrustedMarkers(ctx, canvases, linkedHub.url);
    };
    markUntrusted();
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

    // DDR-064 pre-cutover A7 — one-time notice, before any doc is attached.
    if (useSharedDoc) noticeSharedDocOnce(linkedHub.url, !!cellPairing);

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

    /**
     * Tell the rest of the server that a doc→file projection write landed.
     *
     * Only wired under cell pairing. In a container the recursive `fs.watch`
     * misses our atomic tmp+rename writes, so a peer's edit reaches the doc and
     * the disk and then stops: no `fs:any`, no `canvas-hmr`, and the other
     * person's canvas iframe stays on the old render until they reload by hand.
     * That is the same gap `createContainerWriteBridge` closes for API writes —
     * it cannot close this one, because it triggers off `activity:suppress` and
     * the projector never arms it.
     *
     * Delayed by the bridge's margin so a watcher that DOES fire gets there
     * first; the HMR broadcaster coalesces per file within its own debounce, so
     * both arriving is one reload, not two.
     *
     * Keyed by path, mirroring `createContainerWriteBridge`'s own
     * clear-and-replace pattern rather than a flat timer bag — html/css/meta
     * can each flush and re-flush across cold-start `reconcile()` plus the
     * first real edit landing moments later, and two announcements for the
     * SAME file inside the delay window would have been two `fs:any` events,
     * i.e. two reloads for one edit. A per-path replace collapses that back
     * to one, same as the sibling mechanism this is modeled on (not reused
     * directly — that one lives in `ws.ts`/`hmr-broadcast.ts` and arms off
     * `activity:suppress`, a server-boot-scoped bus the sync runtime doesn't
     * otherwise depend on; duplicating the small delay-then-emit shape here
     * keeps this runtime testable standalone, the way every test in
     * `shared-doc-cell-pairing.test.ts` relies on).
     */
    const announceWrite = (abs: string): void => {
      const rel = path.relative(ctx.paths.designRoot, abs).split(path.sep).join('/');
      // Outside the design root there is nothing for the canvas layer to reload.
      if (!rel || rel.startsWith('..')) return;
      const prev = announceTimers.get(rel);
      if (prev) clearTimeout(prev);
      announceTimers.set(
        rel,
        setTimeout(() => {
          announceTimers.delete(rel);
          if (stopped) return;
          ctx.bus.emit('fs:any', rel);
        }, SYNTHETIC_FS_DELAY_MS)
      );
    };

    const adoptOnce = opts.adopt ?? !!linkedHub.adopt;
    let adoptReconciled = 0;
    const adoptTarget = canvases.length;

    // DDR-102 — journal + snapshot wiring for the conflict protocol. The
    // journal is per-hub (relink to a different hub wipes it); snapshots land
    // in `_history/<slug>/` via history.ts so /design:rollback recovers them.
    journal = loadJournal(ctx.paths.designRoot);
    journal.invalidateIfHubChanged(linkedHub.url);
    const history = createHistory(ctx);

    // ---- DDR-102 helpers: auth aggregation, re-probe, settle bookkeeping ----

    const flushAuthWarn = (): void => {
      authWarnTimer = null;
      if (stopped || pendingAuthWarn.size === 0) return;
      const lines: string[] = [];
      for (const [cls, slugs] of pendingAuthWarn) {
        const list = [...slugs];
        const shown = list.slice(0, 10).join(', ');
        const more = list.length > 10 ? ` (+${list.length - 10} more)` : '';
        lines.push(
          `  ${list.length} canvas(es) [${cls}]: ${shown}${more}\n    → ${AUTH_CLASS_HINT[cls]}`
        );
      }
      pendingAuthWarn.clear();
      console.warn(`[sync] hub auth rejections (${linkedHub.url}):\n${lines.join('\n')}`);
    };

    const scheduleReprobe = (): void => {
      if (reprobeTimer !== null || stopped) return;
      reprobeTimer = authSetTimer(() => {
        reprobeTimer = null;
        if (stopped) return;
        const entries = [...rejectedPermanent.values()];
        rejectedPermanent.clear();
        for (const entry of entries) {
          mon.noteDocState(entry.canvas.slug, 'pending');
          void connectCanvas(entry.canvas, entry.canvasPaths, entry.doc).catch((err) => {
            console.error(`[sync/${entry.canvas.slug}] re-probe failed:`, err);
          });
        }
      }, reprobeMs);
    };

    const handleAuthFailure = (
      canvas: CanvasDescriptor,
      canvasPaths: import('./agent.ts').CanvasSyncPaths,
      provider: SyncProvider,
      rawReason: string
    ): void => {
      if (stopped) return;
      const reasonClass = classifyAuthFailure(rawReason);
      mon.noteDocState(canvas.slug, 'auth-rejected');
      rejectedReasons.set(canvas.slug, reasonClass);
      // Aggregate console output: ONE debounced warn for the whole burst.
      if (!pendingAuthWarn.has(reasonClass)) pendingAuthWarn.set(reasonClass, new Set());
      pendingAuthWarn.get(reasonClass)?.add(canvas.slug);
      if (authWarnTimer === null) authWarnTimer = authSetTimer(flushAuthWarn, warnDebounceMs);
      // Permanent classes: retrying only spams the hub (and its rate bucket) —
      // destroy the provider and re-probe on a slow timer. Transient classes
      // (rate-limit / generic) keep the provider's built-in backoff.
      if (reasonClass === 'not-authorized' || reasonClass === 'invalid-token') {
        if (!rejectedPermanent.has(canvas.slug)) {
          rejectedPermanent.set(canvas.slug, { canvas, canvasPaths, doc: provider.document });
          providers.delete(canvas.slug);
          try {
            provider.destroy();
          } catch {
            /* best-effort */
          }
          scheduleReprobe();
        }
      }
    };

    /**
     * A HANDSHAKE THAT COMPLETED IS NOT A REJECTED DOCUMENT.
     *
     * `auth-rejected` is deliberately sticky — a dropped socket must not launder
     * a rotated credential into a spinner. But the verdict is about the HUB'S
     * ANSWER, and the hub has just given a different one: this document
     * connected. Clearing it here, at the top of the post-handshake path, means
     * a re-probe that succeeds clears the record even if the reconcile below
     * then fails for a reason that has nothing to do with authentication — which
     * is how `0 synced · 73 rejected` survived on a link the hub was accepting.
     *
     * A GENUINE rejection still says so: nothing clears until a handshake for
     * that document actually completes.
     */
    const clearRejection = (slug: string): void => {
      rejectedPermanent.delete(slug);
      if (!rejectedReasons.delete(slug)) return;
      console.log(`[sync/${slug}] the hub accepted this document — clearing its refusal.`);
    };

    /** Post-handshake reconcile — shared by first connect and re-probe. */
    const handleSynced = async (
      canvas: CanvasDescriptor,
      canvasPaths: import('./agent.ts').CanvasSyncPaths,
      provider: SyncProvider
    ): Promise<void> => {
      if (stopped) return;
      clearRejection(canvas.slug);
      // Not `connected` yet — the reconcile below is what makes that true. But
      // no longer refused, and the difference is the whole point: `pending` says
      // "still settling", `auth-rejected` says "go fix your credential".
      mon.noteDocState(canvas.slug, 'pending');
      const projection = projections.get(canvas.slug);
      const agent = agents.get(canvas.slug);
      if (projection) {
        // Phase E (DDR-064 Task 9) — one-time authoritative seed BEFORE
        // materializing: escapes the duplication trap by picking ONE source
        // inside a MIGRATION transaction. DDR-102: body divergence now takes
        // the journal-gated conflict path (dual snapshot + newest-wins)
        // instead of blind hub-wins. The room file-seed is disabled for this
        // pinned slug (createCollab shouldSeed).
        const relBody = path.relative(ctx.paths.repoRoot, canvas.html);
        const result = await migrateSeed({
          slug: canvas.slug,
          doc: provider.document,
          paths: canvasPaths,
          historyDir: path.join(ctx.paths.historyDir, canvas.slug),
          journal: journal ?? undefined,
          snapshot: async (content, reason) => {
            try {
              const snap = await history.writeSnapshot(relBody, content, reason);
              return snap.ts;
            } catch {
              return null;
            }
          },
          onConflict: (info) => store.addConflict(info),
        });
        if (result === 'local-adopt') {
          console.log(`[sync/${canvas.slug}] shared-doc: adopted local state (hub was empty).`);
        } else if (result === 'conflict-local-wins' || result === 'conflict-hub-wins') {
          console.warn(
            `[sync/${canvas.slug}] shared-doc: diverged — kept the ${
              result === 'conflict-local-wins' ? 'local' : 'hub'
            } version (newest-wins); the other is in _history/${canvas.slug}/ — recover via /design:rollback.`
          );
        }
        // Then materialize the converged doc to disk (safe — never clobbers
        // non-empty local with an empty doc value).
        projection.reconcile();
      } else if (agent) {
        await agent.reconcile();
        if (adoptOnce) {
          adoptReconciled++;
          if (adoptReconciled === adoptTarget) {
            // All canvases adopted — clear the flag from .design/config.json
            // so re-running serve doesn't re-trigger. DDR-054 §2i.
            clearAdoptFlag(ctx);
          }
        }
      }
      // The path travels back OUT. `syncMeta.path` is stamped from where this
      // canvas actually is on THIS disk — never echoed from the wire — so the
      // next peer to receive this document can place it, and a value some
      // receiver refused is never laundered onward by being re-sent.
      try {
        const rel = path.relative(ctx.paths.designRoot, canvasPaths.html).split(path.sep).join('/');
        if (rel && !rel.startsWith('..'))
          stampCanvasPath(provider.document, rel, ORIGINS.DISK_PROJECTION);
      } catch {
        /* best-effort bookkeeping — never costs the canvas its sync */
      }

      // DDR-102 — honest status: the handshake + reconcile completed.
      mon.noteDocState(canvas.slug, 'connected');
      mon.noteSyncActivity(canvas.slug);
    };

    /**
     * `handleSynced`, with the one guarantee its body cannot make for itself.
     *
     * Everything from `migrateSeed` to `agent.reconcile()` can throw, and the
     * rejection was swallowed by `settleWait` — so a document whose reconcile
     * failed never reached the `connected` line and sat on whatever its last
     * verdict was, forever, with nothing on screen or in the log saying why.
     * A reconcile failure is a real failure and is now LOUD; it leaves the
     * document `pending` (set at the top of `handleSynced`), which is what it
     * is: connected to the hub, not yet settled on disk.
     */
    const runHandleSynced = async (
      canvas: CanvasDescriptor,
      canvasPaths: import('./agent.ts').CanvasSyncPaths,
      provider: SyncProvider
    ): Promise<void> => {
      try {
        await handleSynced(canvas, canvasPaths, provider);
      } catch (err) {
        console.error(`[sync/${canvas.slug}] post-handshake reconcile failed:`, err);
      }
    };

    /** onceSynced() with the boot-settle ceiling — never hangs the summary on
     *  an auth-rejected provider (whose handshake never completes). */
    const settleWait = (p: Promise<void>): Promise<void> =>
      new Promise<void>((resolve) => {
        const h = authSetTimer(() => {
          settleTimers.delete(h);
          resolve();
        }, settleTimeoutMs);
        settleTimers.add(h);
        p.then(
          () => {
            settleTimers.delete(h);
            authClearTimer(h);
            resolve();
          },
          () => {
            settleTimers.delete(h);
            authClearTimer(h);
            resolve();
          }
        );
      });
    const bootWaits: Promise<void>[] = [];

    /**
     * Create + wire a provider for a canvas. Used by the boot loop and by the
     * permanent-rejection re-probe (which passes the EXISTING doc so the
     * agent/projection wiring — doc-scoped — survives the provider swap).
     */
    /**
     * Who is editing this canvas right now, from hub awareness.
     *
     * Presence carries a display name and no address, so the address is
     * synthesized and clearly marked as derived — inventing a plausible-looking
     * real address would put an unverified identity into permanent git history.
     * Absent a remote peer the answer is null, which `autocommit` turns into
     * "Unknown editor" rather than attributing the work to the server.
     */
    const editorOf = (slug: string): { name: string; email: string } | null => {
      const awareness = providers.get(slug)?.awareness;
      if (!awareness) return null;
      for (const [clientId, state] of awareness.getStates() as Map<
        number,
        { name?: string } | undefined
      >) {
        if (clientId === awareness.clientID) continue; // that's us, the cell
        const name = state?.name?.trim();
        if (name) {
          const slugified = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          return { name, email: `${slugified || 'peer'}@peers.maude.local` };
        }
      }
      return null;
    };

    /**
     * Re-decide where a PULLED canvas goes, now that its document has synced.
     *
     * The listing (`GET /api/documents`) carries names and byte counts only —
     * the path lives INSIDE the document, so it cannot be known when the target
     * is first computed. This runs in the gap: after the handshake, before
     * anything is written. Nothing is on disk yet for a pulled canvas, so this
     * is a decision rather than a move.
     *
     * Local canvases never reach here. Their path comes from this disk, and
     * letting a remote value relocate them is the same hazard the hub refuses
     * with `pathIndex` — a peer moving another peer's work.
     */
    const relocatePulled = (
      canvas: CanvasDescriptor,
      canvasPaths: import('./agent.ts').CanvasSyncPaths,
      doc: Y.Doc
    ): void => {
      if (!pulledSlugs.has(canvas.slug)) return;
      const resolved = resolvePulledTarget({
        slug: canvas.slug,
        path: canvasPathFromDoc(doc),
        designRoot: ctx.paths.designRoot,
        designRel: ctx.paths.designRel,
        canvasGroups: ctx.cfg.canvasGroups,
        join: path.join,
        resolve: path.resolve,
        sep: path.sep,
        realpath: realpathOfDeepestExisting,
        allowUndeclaredGroup: pathOpts.allowUndeclaredGroup,
        onRefused: (reason) => pathOpts.onRefused(canvas.slug, reason),
      });
      if (!resolved) return;

      // NEVER ONTO A FILE THAT ALREADY EXISTS.
      //
      // `relocatePulled`'s premise is that nothing is on disk for a pulled
      // canvas — but "pulled" only means "no LOCAL DESCRIPTOR", and `scanCanvases`
      // omits a canvas whose `.meta.json` says `syncable: false` (a security
      // opt-out) or whose `.tsx` the sandbox gate excluded. Such a canvas is
      // classified hub-only and pulled, and before this feature that was benign:
      // the body landed flat at the design root, inside no canvas group, loaded
      // by nothing. Honouring a remote path would land it on the real file and
      // let a hub overwrite exactly the canvas the user opted OUT of syncing.
      // The same admission the provisional target already passed, re-asked of
      // the destination the document actually chose.
      if (resolved.fromPath && !admitPullTarget(ctx, canvas.slug, resolved.bodyAbs)) return;
      // The TOP-level component only — `canvasGroups` names a group, not every
      // folder inside it (`ui/2026/social/x.tsx` declares `ui`). A body that
      // landed at the design root has no group and teaches nothing.
      const [group, ...rest] = path
        .relative(ctx.paths.designRoot, resolved.bodyAbs)
        .split(path.sep);
      if (group && rest.length > 0) noteLearnedGroup(group);
      if (resolved.bodyAbs === canvas.html) return;
      const next = descriptorFor(canvas.slug, resolved.bodyAbs);
      // Mutated in place: the descriptor and the paths object are already held
      // by the status surfaces and by the setup closure below, and handing them
      // a second object would leave half the runtime writing to the old path.
      Object.assign(canvas, next);
      canvasPaths.html = next.html;
      canvasPaths.meta = next.meta;
      canvasPaths.css = next.css;
      console.log(
        `[sync/${canvas.slug}] pulled into ${path.relative(ctx.paths.designRoot, next.html)}`
      );
      // RE-MARK NOW, not at the end of boot. The markers were computed from the
      // provisional descriptor set and the descriptors are mutated in place
      // here, so between this line and the end of boot the `_untrusted` index
      // would name a file that does not exist while the hub-pushed body it
      // exists to flag sits somewhere unlisted. Deferring the re-mark to the
      // boot-settle handler leaves exactly that window open — and that handler
      // is fire-and-forget, so a short-lived process never reaches it at all.
      // One small write per relocation is the right price for a marker that is
      // never wrong.
      markUntrusted();
    };

    const connectCanvas = async (
      canvas: CanvasDescriptor,
      canvasPaths: import('./agent.ts').CanvasSyncPaths,
      document?: Y.Doc,
      setup?: (provider: SyncProvider) => void
    ): Promise<SyncProvider> => {
      const provider = await providerFactory({
        url: linkedHub.url,
        token,
        documentName: docNameFor(canvas.slug),
        document,
      });
      providers.set(canvas.slug, provider);
      // First-connect setup (agent/projection creation + doc-scoped wiring)
      // MUST run before handleSynced — that function resolves the
      // agent/projection from the maps, and a test stub's onceSynced can
      // settle on the very next microtask.
      //
      // For a PULLED canvas it must run AFTER the handshake instead, because
      // the agent is constructed around a body path this peer cannot know until
      // the document arrives. Ordering, not skipping: the two still happen in
      // the same order relative to each other.
      const deferSetup = !!setup && pulledSlugs.has(canvas.slug);
      if (!deferSetup) setup?.(provider);

      // Task 8 — feed this provider's WS status into the offline monitor.
      if (provider.onStatus) {
        statusDetaches.push(provider.onStatus((s) => mon.noteProviderStatus(canvas.slug, s)));
      } else {
        // No status events (test stub) — treat as connected so the monitor
        // doesn't sit in the boot 'connecting' state forever.
        mon.noteProviderStatus(canvas.slug, 'connected');
      }
      // DDR-102 — classify + aggregate hub auth rejections.
      if (provider.onAuthFailed) {
        statusDetaches.push(
          provider.onAuthFailed(({ reason }) =>
            handleAuthFailure(canvas, canvasPaths, provider, reason)
          )
        );
      }
      // Task 5 — bridge the provider's hub-synced Awareness to the Room so
      // browser cursors relay cross-machine. No-op when the provider exposes
      // no awareness or no registry was passed (file-sync-only tests).
      if (opts.registry && provider.awareness) {
        awarenessDetaches.push(opts.registry.attachHubAwareness(canvas.slug, provider.awareness));
      }
      // Cold-start reconcile fires once the provider has hub state.
      const synced = provider.onceSynced().then(() => {
        if (deferSetup) {
          relocatePulled(canvas, canvasPaths, provider.document);
          setup?.(provider);
        }
        return runHandleSynced(canvas, canvasPaths, provider);
      });
      bootWaits.push(settleWait(synced));
      return provider;
    };

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
        const canvasPaths = {
          html: canvas.html,
          comments: canvas.comments,
          annotations: canvas.annotations,
          meta: canvas.meta,
          css: canvas.css,
        };
        mon.noteDocState(canvas.slug, 'pending');
        await connectCanvas(canvas, canvasPaths, sharedYDoc, (provider) => {
          // Phase 9.2 (DDR-064) — the disk handler. Under sharedDoc it's a
          // loop-free projection (html/css/meta doc→file + all-types file→doc;
          // the collab room keeps comments/annotations doc→file, so no
          // double-write). Flag-OFF keeps the proven two-doc agent. Created
          // ONCE here (first connect) — a DDR-102 re-probe swaps only the
          // provider; everything below is doc-scoped and survives.
          let agent: CanvasSyncAgent | undefined;
          if (useSharedDoc && sharedYDoc) {
            const projection = createDocProjection({
              slug: canvas.slug,
              doc: provider.document,
              paths: canvasPaths,
              echoGuard,
              journal: journal ?? undefined,
              // Cell pairing only — see the DocProjectionOptions.onWrote doc.
              // The synthetic event is delayed by the same margin the container
              // write bridge uses, so a watcher that DOES fire wins the race and
              // the HMR broadcaster's per-file coalescing collapses the pair
              // into one `canvas-hmr`. The projector's own echo guard drops the
              // resulting file→doc read, so this cannot loop.
              ...(cellPairing ? { onWrote: announceWrite } : {}),
            });
            projection.start();
            projections.set(canvas.slug, projection);
          } else {
            const relBody = path.relative(ctx.paths.repoRoot, canvas.html);
            agent = createCanvasSyncAgent({
              slug: canvas.slug,
              doc: provider.document,
              paths: canvasPaths,
              echoGuard,
              adopt: adoptOnce,
              journal: journal ?? undefined,
              // Wrap the writer rather than adding a new hook: every path the
              // agent materializes to disk goes through it, so a future write
              // surface is committed automatically instead of being forgotten.
              ...(autoCommit
                ? {
                    writer: (file: string, bytes: string | Uint8Array) => {
                      atomicWrite(file, bytes);
                      autoCommit.note(
                        path.relative(ctx.paths.repoRoot, file),
                        editorOf(canvas.slug)
                      );
                    },
                  }
                : {}),
              snapshot: async (content, reason) => {
                try {
                  const snap = await history.writeSnapshot(relBody, content, reason);
                  return snap.ts;
                } catch {
                  return null; // best-effort — resolution proceeds without refs
                }
              },
              onConflict: (info) => store.addConflict(info),
            });
            agent.start();
            agents.set(canvas.slug, agent);
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

    // DDR-102 — honest boot output. The old single line printed
    // "83/83 canvas(es) syncing" BEFORE any handshake completed; per-canvas
    // auth rejections were invisible. Print a short linking line now and the
    // real summary once the handshakes settle (or the 15 s ceiling passes —
    // auth-rejected providers never resolve onceSynced, so the ceiling keeps
    // boot from hanging). Late canvases just update `_sync.json`.
    console.log(
      `[sync] linking to ${linkedHub.url} (${canvases.length} canvases)…${useSharedDoc ? ' (shared-doc)' : ''}${adoptOnce ? ' (adopt mode — pushing local up)' : ''}`
    );
    void Promise.allSettled(bootWaits).then(() => {
      if (stopped) return;
      const snap = mon.snapshot();
      const docs = snap.docs ?? { synced: 0, pending: 0, rejected: 0 };
      const parts = [`${docs.synced}/${canvases.length} synced`];
      if (docs.rejected > 0) {
        const sample = (snap.rejectedSlugs ?? []).slice(0, 3).join(', ');
        const classes = [...new Set(rejectedReasons.values())].join('/') || 'unknown';
        parts.push(
          `${docs.rejected} auth-rejected (${sample}${docs.rejected > 3 ? ', …' : ''} — ${classes})`
        );
      }
      if (docs.pending > 0) parts.push(`${docs.pending} pending`);
      console.log(
        `[sync] ${linkedHub.url}: ${parts.join(' · ')} · shared-doc:${useSharedDoc ? 'on' : 'off'}`
      );
      // What this run brought DOWN, recorded for `_sync.json` and the UI.
      //
      // This used to record `remoteDiff` under the name `remoteGap` — "what the
      // project has that this machine does not". By the time it ran, that was
      // false: the diff is taken BEFORE providers are built and recorded after
      // the pull, so it named exactly the canvases that had just arrived and
      // were sitting on disk. `pulled` is the same list under the name that is
      // true, and it is the fact the user is told to act on.
      mon.notePulled(admittedPulls.map((t) => t.slug));
      // Re-mark from the FINAL descriptors — `relocatePulled` mutates them in
      // place after each handshake, and the markers are the one consumer that
      // read them before that and would otherwise never read them again.
      markUntrusted();
    });
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    // Commit whatever is still inside the quiescence window BEFORE tearing
    // anything down. Shutting down mid-window would leave the last edits on
    // disk but out of history — the one state this whole mechanism exists to
    // make impossible.
    if (autoCommit) {
      try {
        await autoCommit.flush();
      } catch (err) {
        console.error('[sync] final autocommit failed:', err);
      }
      autoCommit.stop();
    }
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
    journal?.stop(); // flushes the pending debounce
    journal = null;
    // DDR-102 — auth/settle timers.
    if (authWarnTimer !== null) {
      authClearTimer(authWarnTimer);
      authWarnTimer = null;
    }
    if (reprobeTimer !== null) {
      authClearTimer(reprobeTimer);
      reprobeTimer = null;
    }
    for (const h of settleTimers) authClearTimer(h);
    settleTimers.clear();
    for (const h of announceTimers.values()) clearTimeout(h);
    announceTimers.clear();
    rejectedPermanent.clear();
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
    // DDR-102 — destroy the shared WebSocket(s) AFTER the providers detached.
    ownedFactory?.dispose();
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

/* ------------------------------------------------ DDR-064 pre-cutover gates */

/**
 * Upper bound on shared-doc canvases held live in one process — DDR-064
 * pre-cutover A6.
 *
 * Every shared-doc canvas is a PINNED room: a `Y.Doc` plus its history, kept in
 * memory for as long as a provider is attached, deliberately immune to the
 * last-browser-leaves drop. That immunity is what makes the ceiling necessary —
 * nothing else will ever reclaim them.
 *
 * Set well above any real project (the largest in-house one is 83 canvases) so
 * that in practice this is a runaway guard, not a product limit. Raise it with
 * `MAUDE_MAX_PINNED_ROOMS` if a real project ever meets it — and if one does,
 * that is a signal worth reading rather than a number worth bumping.
 */
export const DEFAULT_MAX_PINNED_ROOMS = 500;

function maxPinnedRooms(): number {
  const raw = Number.parseInt(process.env.MAUDE_MAX_PINNED_ROOMS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_PINNED_ROOMS;
}

/**
 * Filter the discovered set down to what may safely be synced.
 *
 * **A4 — slug collisions.** `slugFor` flattens `/` to `-`, so `ui/a/b.tsx` and
 * `ui/a-b.tsx` produce the same slug. Two files on one document is not a
 * degraded experience, it is silent cross-contamination: each would receive the
 * other's body as a remote change and write it over itself, forever. Neither
 * file is more correct than the other, so BOTH are excluded rather than one
 * being picked — refusing to sync two canvases is recoverable by renaming a
 * file; overwriting one with the other is not.
 *
 * **A6 — pinned-room ceiling.** Under shared-doc, admit at most
 * `maxPinnedRooms()`. Named loudly, because the ones past the ceiling stop
 * syncing and silence there would read as "sync is broken" with no cause.
 *
 * Exported for the pre-cutover tests.
 */
export function admitCanvases(
  canvases: readonly CanvasDescriptor[],
  sharedDoc: boolean
): CanvasDescriptor[] {
  const bySlug = new Map<string, CanvasDescriptor[]>();
  for (const c of canvases) {
    const group = bySlug.get(c.slug);
    if (group) group.push(c);
    else bySlug.set(c.slug, [c]);
  }

  const admitted: CanvasDescriptor[] = [];
  const collisions: string[] = [];
  for (const [slug, group] of bySlug) {
    if (group.length > 1) {
      collisions.push(`${slug} ← ${group.map((c) => c.html).join(' , ')}`);
      continue;
    }
    admitted.push(group[0] as CanvasDescriptor);
  }
  if (collisions.length > 0) {
    console.error(
      `[sync] ${collisions.length} slug collision(s) — these canvases are NOT syncing, because two files sharing one document would overwrite each other (DDR-064 A4). Rename one of each pair:\n${collisions
        .map((c) => `  ${c}`)
        .join('\n')}`
    );
  }

  if (!sharedDoc) return admitted;
  const cap = maxPinnedRooms();
  if (admitted.length <= cap) return admitted;
  const dropped = admitted.length - cap;
  console.error(
    `[sync] ${admitted.length} syncable canvases exceeds the shared-doc pinned-room ceiling of ${cap} (DDR-064 A6) — ${dropped} will NOT sync. Raise MAUDE_MAX_PINNED_ROOMS if this project is genuinely this large.`
  );
  return admitted.slice(0, cap);
}

/**
 * DDR-064 pre-cutover A7 — say, once, that a shared document is now crossing
 * the network.
 *
 * Under shared-doc the browser's live editing buffer IS the object that syncs to
 * the hub. That is a real change in what leaves this machine and when, and the
 * checklist asks for it to be stated rather than inferred from a release note.
 *
 * A cell is the exception, and deliberately so: the operator turned pairing on
 * per project, the hub is the cell's own loopback, and nothing leaves the
 * container. Consent was given by configuration, and repeating it at every
 * canvas boot would train an operator to skip the line that matters.
 */
let sharedDocNoticeShown = false;
function noticeSharedDocOnce(url: string, cellPairing: boolean): void {
  if (cellPairing || sharedDocNoticeShown) return;
  sharedDocNoticeShown = true;
  console.warn(
    `[sync] shared-doc is ON for ${url} — your live editing buffer for each canvas is now the same object that syncs to the hub, not a copy reconciled through disk (DDR-064). Link only hubs you operate or trust.`
  );
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
 * Blank the persisted status for a process that has just started.
 *
 * Deliberately NOT a rehydration. Presentation state (which hub, how many
 * canvases) is knowable up front; a per-document verdict is not — it is the
 * outcome of a handshake this process has yet to make. Carrying one over is how
 * a stale `auth-rejected` outlives the credential rotation that fixed it.
 *
 * Best-effort, like every other write to this file: a status that cannot be
 * written must not stop a project from syncing.
 */
function resetPersistedStatus(ctx: Context, url: string): void {
  try {
    atomicWrite(
      path.join(ctx.paths.designRoot, '_sync.json'),
      `${JSON.stringify(
        {
          url,
          canvases: 0,
          conflicts: [],
          state: 'connecting',
          queuedOps: 0,
          lastSyncAt: null,
          offlineSince: null,
          flash: null,
          updatedAt: Date.now(),
          docs: { synced: 0, pending: 0, rejected: 0 },
        },
        null,
        2
      )}\n`
    );
  } catch {
    /* best-effort — see the doc comment */
  }
}

/**
 * May a pulled canvas be materialised at this path?
 *
 * Asked of the PROVISIONAL target and again of whatever the document's own
 * `syncMeta.path` resolves to, because the two can be the same place: the
 * fallback is derived from the slug and the slug from the path, so
 * `system-colors_and_type` targets `system/colors_and_type.tsx` with or without
 * a path on the wire. A guard on the carried path alone is a guard on the
 * loudest half of the problem.
 *
 * Two refusals, both about what ALREADY occupies the location — which is
 * precisely what rule 7 does not speak to. Rule 7 ties a path to its own
 * DOCUMENT; it has nothing to say about the file already sitting there.
 */
function admitPullTarget(ctx: Context, slug: string, bodyAbs: string): boolean {
  const rel = path.relative(ctx.paths.designRoot, bodyAbs);
  // 1. A file that is already on this disk. "Hub-only" means "no local
  //    DESCRIPTOR", not "no local file": `scanCanvases` omits a canvas whose
  //    `.meta.json` says `syncable: false` — a security opt-out a hub must not
  //    be able to flip — and one the TSX sandbox gate excluded. Such a canvas is
  //    classified hub-only and pulled, and its target is the real file. Note
  //    `existsSync` settles the case-insensitive collision for free: `ui/card.tsx`
  //    IS `ui/Card.tsx` on macOS, and that is exactly how the fallback reaches a
  //    file the project meant to keep out of the sync set.
  if (existsSync(bodyAbs)) {
    console.warn(
      `[sync/${slug}] not pulling — ${rel} already exists on this machine and is not in ` +
        "this project's sync set (a `syncable: false` sidecar, or the TSX sandbox gate). " +
        'The local file is kept.'
    );
    return false;
  }
  // 2. A file that means something other than "a canvas". The `.css` and
  //    `.meta.json` siblings are derived from the body path and `system` is a
  //    DEFAULT canvas group, so `system-colors_and_type` writes its css lane
  //    straight over `tokensCssRel` — the stylesheet the dev server serves.
  if (collidesWithServedPaths(ctx, bodyAbs)) {
    console.warn(`[sync/${slug}] not pulling — ${rel} would overwrite a served project file.`);
    return false;
  }
  return true;
}

/**
 * True when the design root holds nothing but runtime state.
 *
 * The emptiness question the fresh-link relaxation actually needs to ask. It is
 * NOT "did the scan find canvases": the scan walks declared groups only and
 * applies the syncable + sandbox gates, so it returns zero for several projects
 * that are anything but bare.
 */
function designRootIsBare(ctx: Context): boolean {
  try {
    return readdirSync(ctx.paths.designRoot).every(
      (name) => name.startsWith('_') || name === '.git'
    );
  } catch {
    // No design root at all is as bare as it gets.
    return true;
  }
}

/**
 * True when a pulled body's sidecars would land on a file that means something
 * other than "a canvas".
 *
 * `.css` and `.meta.json` are derived from the body path, and `system` is a
 * DEFAULT canvas group — so a hub-chosen path inside it can put an attacker's
 * css lane exactly where `tokensCssRel` is served from. Rule 7 ties a path to
 * its own DOCUMENT; it says nothing about what already occupies that location.
 */
function collidesWithServedPaths(ctx: Context, bodyAbs: string): boolean {
  const served = new Set<string>();
  const add = (rel: unknown): void => {
    if (typeof rel === 'string' && rel) served.add(path.resolve(ctx.paths.designRoot, rel));
  };
  add(ctx.cfg.tokensCssRel);
  for (const ds of ctx.cfg.designSystems ?? []) add(ds?.tokensCssRel);
  add('config.json');
  const stem = bodyAbs.replace(/\.tsx$/i, '');
  return [bodyAbs, `${stem}.css`, `${stem}.meta.json`].some((p) => served.has(path.resolve(p)));
}

/**
 * `realpathSync`, but for a path that does not exist yet.
 *
 * `realpathSync` throws ENOENT on the file we are about to create, so walk up to
 * the deepest ancestor that DOES exist, resolve that, and re-attach the tail.
 * Any symlink already on the path is therefore followed, which is the whole
 * point: `path.resolve` is lexical, and `mkdirSync(recursive: true)` traverses a
 * symlinked directory without complaint.
 */
function realpathOfDeepestExisting(p: string): string {
  let cur = p;
  for (;;) {
    try {
      return path.join(realpathSync(cur), path.relative(cur, p));
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return p;
      cur = parent;
    }
  }
}

/** `<designRoot>/config.json` — the project's own declaration of itself. */
function designConfigPath(ctx: Context): string {
  return path.join(ctx.paths.designRoot, 'config.json');
}

/**
 * Give a freshly-linked, previously-empty folder a config of its own.
 *
 * A project pulled into a bare directory has no `config.json` (it is not part
 * of the sync lane), so it runs on the DEFAULT canvas groups — and a project
 * whose author calls their group `screens` would be listed by nothing. This
 * writes what the pull actually brought down, so the next boot needs no
 * relaxation and the tree lists the project it just received.
 *
 * ADDITIVE AND ONE-SHOT. It refuses outright if a config already exists — a
 * user's own declaration is never edited by the sync runtime, and the caller's
 * `freshLink` gate means this cannot run on a project that had canvases.
 * Best-effort: a read-only design root costs the project its tidiness, never
 * its sync.
 */
function seedProjectConfig(
  ctx: Context,
  learnedGroups: ReadonlySet<string>,
  owned: boolean
): boolean {
  const file = designConfigPath(ctx);
  if (existsSync(file) && !owned) return false;
  const declared = (ctx.cfg.canvasGroups ?? []).map((g) => g.path);
  const groups = [...declared, ...[...learnedGroups].filter((g) => !declared.includes(g))];
  try {
    atomicWrite(
      file,
      `${JSON.stringify(
        {
          name: ctx.cfg.name,
          designRoot: ctx.paths.designRel,
          canvasGroups: groups.map((p) => ({ label: p, path: p })),
        },
        null,
        2
      )}\n`
    );
    console.log(`[sync] wrote ${ctx.paths.designRel}/config.json (${groups.join(', ')}).`);
    return true;
  } catch (err) {
    console.warn(`[sync] could not write ${ctx.paths.designRel}/config.json: ${String(err)}`);
    return false;
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
 * A ProviderFactory whose shared resources (the per-hub WebSocket) the runtime
 * can dispose on stop(). The call signature stays the plain ProviderFactory
 * shape so injected test stubs are unaffected.
 */
export interface DisposableProviderFactory extends ProviderFactory {
  /** Destroy the shared HocuspocusProviderWebsocket(s). Call AFTER provider
   *  destroys — a provider detach sends a Close message over the socket. */
  dispose(): void;
}

/**
 * The production provider factory — DDR-102: ONE shared
 * `HocuspocusProviderWebsocket` per hub URL, with every canvas's
 * `HocuspocusProvider` attached to it, instead of one socket per canvas.
 * An 83-canvas project used to open 83 WebSockets at boot — the auth burst
 * tripped the hub's per-token rate limit (100/min) the moment two peers
 * booted together, and the per-socket retry storm then pinned the bucket
 * forever (the 2026-06-11 incident). NB: the hub still authenticates once per
 * DOCUMENT (each provider sends its own Auth message on socket open), so the
 * hub-side valid-token bucket resize is the companion fix — the multiplexing
 * kills the SOCKET burst and collapses the retry storm to one reconnect loop.
 *
 * Module + socket creation are lazy so tests / unlinked projects don't pay
 * the load cost. `loadModule` is injectable for unit tests.
 */
export function createDefaultProviderFactory(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import of optional dep.
  loadModule?: () => Promise<any>
): DisposableProviderFactory {
  // biome-ignore lint/suspicious/noExplicitAny: provider runtime typed at call site.
  let mod: any = null;
  // wsUrl → shared HocuspocusProviderWebsocket (one per hub URL; in practice a
  // runtime only ever talks to one hub, but the map keeps the contract exact).
  // biome-ignore lint/suspicious/noExplicitAny: provider runtime typed at call site.
  const sockets = new Map<string, any>();

  const factory = async (args: {
    url: string;
    token: string;
    documentName: string;
    document?: Y.Doc;
  }): Promise<SyncProvider> => {
    if (!mod) {
      try {
        mod = await (loadModule ? loadModule() : import('@hocuspocus/provider'));
      } catch (err) {
        throw new Error(
          `@hocuspocus/provider unavailable — install it under apps/studio/. (${err instanceof Error ? err.message : String(err)})`
        );
      }
    }
    // Hocuspocus accepts ws:// or wss://; the linked URL is http(s)://, so swap
    // the scheme. The provider also accepts http(s):// and upgrades internally
    // in newer versions, but ws:// is explicit + portable.
    const wsUrl = toWsUrl(args.url);
    let socket = sockets.get(wsUrl);
    if (!socket) {
      socket = new mod.HocuspocusProviderWebsocket({ url: wsUrl });
      sockets.set(wsUrl, socket);
    }
    // Phase 9.2 (DDR-064) — attach to the shared room doc when the runtime
    // injected one; otherwise own a fresh doc (the legacy two-doc path).
    const document = args.document ?? new Y.Doc();
    // DDR-102 — rejections fan out to the runtime's aggregator (ONE debounced
    // warn with a reason-correct hint) instead of one 5-line warn per document
    // per retry. The reason is sanitized here, classified by the runtime.
    const authFailedCbs = new Set<(info: { reason: string }) => void>();
    // biome-ignore lint/suspicious/noExplicitAny: provider runtime is typed at the call site.
    const provider: any = new mod.HocuspocusProvider({
      websocketProvider: socket,
      name: args.documentName,
      token: args.token,
      document,
      onAuthenticationFailed: (data: { reason?: string }) => {
        const reason = (data?.reason ?? 'permission-denied').replace(/[\r\n]/g, ' ').slice(0, 200);
        for (const cb of authFailedCbs) cb({ reason });
      },
    });
    // With an injected websocketProvider the provider does NOT auto-attach
    // (manageSocket=false in @hocuspocus/provider 4.x) — attach explicitly.
    provider.attach();
    return {
      document,
      // HocuspocusProvider creates a hub-synced Awareness by default; expose it
      // so the runtime can bridge it to the collab Room (Task 5).
      awareness: provider.awareness as Awareness | undefined,
      onStatus(cb: (status: ProviderStatus) => void): () => void {
        // The shared socket emits 'status' on every WS transition and every
        // ATTACHED provider re-emits it (forwardStatus), so per-provider
        // subscription keeps working under multiplexing.
        const handler = (evt: { status?: string }) => {
          const s = evt?.status;
          if (s === 'connected' || s === 'connecting' || s === 'disconnected') cb(s);
        };
        provider.on('status', handler);
        // Seed the subscriber with the CURRENT status immediately. On
        // localhost the WS can reach 'connected'/synced before this listener
        // attaches — waiting for the *next* transition would leave the
        // connection monitor un-seeded and `_sync.json` never written. The
        // socket (not the provider) owns the live status under multiplexing.
        const cur = socket.status;
        if (cur === 'connected' || cur === 'connecting' || cur === 'disconnected') cb(cur);
        return () => provider.off('status', handler);
      },
      onAuthFailed(cb: (info: { reason: string }) => void): () => void {
        authFailedCbs.add(cb);
        return () => authFailedCbs.delete(cb);
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
        // Detaches from the shared socket (sends a per-document Close); the
        // socket itself is destroyed by dispose() after all providers.
        provider.destroy();
      },
    };
  };

  return Object.assign(factory, {
    dispose(): void {
      for (const socket of sockets.values()) {
        try {
          socket.destroy();
        } catch {
          /* best-effort */
        }
      }
      sockets.clear();
    },
  });
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
  if (!isLoopbackHost(u.hostname)) {
    return `plaintext URL (${proto}//) is only allowed for loopback hosts. Use wss:// for ${u.hostname.toLowerCase()} or change the host to localhost.`;
  }
  return null;
}

/**
 * DDR-072 — true when the hub URL points at a loopback host (localhost,
 * 127.0.0.1, ::1). Used to suppress the `syncTsx` boot banner for local dev
 * hubs (no remote exfil concern). Unparseable URL → treated as non-loopback
 * (fail loud / show the banner). Mirrors checkUrlScheme's loopback host set —
 * literally, both call `isLoopbackHost` (`sync/loopback.ts`).
 */
export function isLoopbackHubUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
