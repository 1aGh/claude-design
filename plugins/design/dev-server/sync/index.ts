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

import * as Y from 'yjs';

import type { Context } from '../context.ts';
import { type CanvasSyncAgent, createCanvasSyncAgent } from './agent.ts';
import { type EchoGuard, createEchoGuard } from './echo-guard.ts';
import { type FsReader, createFsReader } from './fs-mirror.ts';
import { getHubToken } from './hubs-config.ts';

/** A minimum-surface stand-in for the HocuspocusProvider's runtime API. */
export interface SyncProvider {
  readonly document: Y.Doc;
  /** Resolves when the first hub sync handshake completes. */
  onceSynced(): Promise<void>;
  destroy(): void;
}

/** Factory the runtime calls per discovered canvas. Default uses Hocuspocus. */
export type ProviderFactory = (args: {
  url: string;
  token: string;
  documentName: string;
}) => SyncProvider | Promise<SyncProvider>;

export interface SyncRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Number of active per-canvas agents. */
  size(): number;
  /** Test inspection — get the agent for a slug if one was created. */
  agentFor(slug: string): CanvasSyncAgent | undefined;
}

export interface CreateSyncRuntimeOptions {
  /** Override the HocuspocusProvider factory (test injection). */
  providerFactory?: ProviderFactory;
  /** Force-enable/disable adopt mode (overrides cfg.linkedHub.adopt). */
  adopt?: boolean;
  /** Discovery override — pass an explicit canvas list instead of scanning. */
  canvases?: CanvasDescriptor[];
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
  const providers = new Map<string, SyncProvider>();
  let fsReader: FsReader | null = null;
  let busUnsub: (() => void) | null = null;
  let started = false;
  let stopped = false;

  async function start(): Promise<void> {
    if (started || stopped) return;
    started = true;

    const canvases = opts.canvases ?? (await discoverCanvases(ctx));
    if (canvases.length === 0) {
      console.log(
        `[sync] linked to ${linkedHub.url} — no canvases discovered under ${ctx.paths.designRoot}.`
      );
      return;
    }

    const reader = createFsReader({
      rootDir: ctx.paths.designRoot,
      accept: (rel) => {
        const ext = path.extname(rel).toLowerCase();
        return ext === '.html' || ext === '.json' || ext === '.svg';
      },
      onRead: (evt) => {
        for (const agent of agents.values()) {
          const abs = path.join(ctx.paths.designRoot, evt.path);
          const changed = agent.applyFromFs({ path: abs, bytes: evt.bytes, hash: evt.hash });
          if (changed) break; // a path belongs to at most one canvas
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
        const provider = await providerFactory({
          url: linkedHub.url,
          token,
          documentName: canvas.slug,
        });
        providers.set(canvas.slug, provider);
        const agent = createCanvasSyncAgent({
          slug: canvas.slug,
          doc: provider.document,
          paths: {
            html: canvas.html,
            comments: canvas.comments,
            annotations: canvas.annotations,
          },
          echoGuard,
          adopt: adoptOnce,
        });
        agent.start();
        agents.set(canvas.slug, agent);

        // Cold-start reconcile fires once the provider has hub state.
        void provider.onceSynced().then(async () => {
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

    console.log(
      `[sync] linked to ${linkedHub.url} — ${agents.size}/${canvases.length} canvas(es) syncing${adoptOnce ? ' (adopt mode — pushing local up)' : ''}.`
    );
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
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
    size: () => agents.size,
    agentFor: (slug) => agents.get(slug),
  };
}

/* ---------------------------------------------------------------- discovery */

/**
 * Scan `<designRoot>/{ui,system}/` for `.html` canvas files and return one
 * CanvasDescriptor per. Mirrors the existing api.ts file-tree scan but
 * specialised for the sync runtime (we only need the three paths per canvas,
 * not the full metadata).
 *
 * DDR-054 §2b — `.tsx` canvases are deliberately EXCLUDED from sync. The
 * dev-server transpiles `.tsx` to JavaScript and serves it as
 * `application/javascript` in iframe same-origin; a hostile hub pushing
 * arbitrary TypeScript source would result in RCE. `.tsx` stays editable in
 * solo mode; per-canvas opt-in via `.meta.json.syncable: true` is deferred to
 * Task 8 (alongside CSP + iframe sandbox).
 */
export async function discoverCanvases(ctx: Context): Promise<CanvasDescriptor[]> {
  const out: CanvasDescriptor[] = [];
  for (const group of ctx.cfg.canvasGroups) {
    const groupAbs = path.join(ctx.paths.designRoot, group.path);
    if (!existsSync(groupAbs)) continue;
    await walk(groupAbs, ctx.paths.designRoot, ctx.paths.commentsDir, ctx.paths.designRel, out);
  }
  return out;
}

async function walk(
  dirAbs: string,
  designRoot: string,
  commentsDir: string,
  designRel: string,
  acc: CanvasDescriptor[]
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
      await walk(abs, designRoot, commentsDir, designRel, acc);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    // DDR-054 §2b — refuse .tsx; only .html canvases sync.
    if (ext !== '.html') continue;
    const slug = slugFor(abs, designRoot, designRel);
    acc.push({
      slug,
      html: abs,
      comments: path.join(commentsDir, `${slug}.json`),
      annotations: path.join(designRoot, `${slug}.annotations.svg`),
    });
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
}): Promise<SyncProvider> {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import of optional dep.
  let mod: any;
  try {
    mod = await import('@hocuspocus/provider');
  } catch (err) {
    throw new Error(
      `@hocuspocus/provider unavailable — install it under plugins/design/dev-server/. (${err instanceof Error ? err.message : String(err)})`
    );
  }
  // Hocuspocus accepts ws:// or wss://; the linked URL is http(s)://, so swap
  // the scheme. The provider also accepts http(s):// and upgrades internally
  // in newer versions, but ws:// is explicit + portable.
  const wsUrl = toWsUrl(args.url);
  const document = new Y.Doc();
  // biome-ignore lint/suspicious/noExplicitAny: provider runtime is typed at the call site.
  const provider: any = new mod.HocuspocusProvider({
    url: wsUrl,
    name: args.documentName,
    token: args.token,
    document,
    connect: true,
  });
  return {
    document,
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
