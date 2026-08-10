// Desktop→cell asset push — DDR-217 (fix 6 of the 2026-08-10 sync RCA).
//
// The sync lanes are text-only (`html`/`css`/`meta`/`syncMeta`), so a
// desktop-linked project's `<designRoot>/assets/*` never reached the cell: its
// `/assets/` proxy and its studio child both served bytes they did not have —
// the grey boxes. The desktop is the one peer that HAS the bytes and already
// holds an authenticated channel to the hub, so it pushes them over the asset
// route: `HEAD /assets/<key>` to skip what the cloud already holds, then a
// streamed `PUT /assets/<key>` for the rest. The hub writes into its checkout
// and mirrors to the bucket (the browser-upload precedent) — see
// `apps/hub/src/assets.mjs`.
//
// The key-shape rules here MIRROR the hub's `ASSET_KEY` (assets.mjs) — a file
// this pushes but the hub refuses is a wasted upload, and one this skips but
// the proxy would serve is a broken image. The HUB's validation stays the
// authoritative gate (each trust boundary validates its own input); this list
// is the courtesy filter that keeps junk off the wire.

import { type Dirent, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** One path segment of a pushable key — the hub's `ASSET_KEY` charset. */
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** `ASSET_KEY` allows the name plus up to 4 directory segments. */
const MAX_SEGMENTS = 5;

/** Mirror of the sweeper's implausibility bound — a 2 GB file in `assets/` is
 *  a mistake, and paying to move it silently is the wrong response. */
const MAX_PUSH_BYTES = 512 * 1024 * 1024;

export interface AssetPushResult {
  pushed: string[];
  skipped: number;
  failed: { key: string; reason: string }[];
}

/** Pushable keys under `<designRoot>/assets/`, relative to it. Missing dir → []. */
export function listPushableAssets(designRoot: string): string[] {
  const root = path.join(designRoot, 'assets');
  const out: string[] = [];
  const walk = (dir: string, prefix: string, depth: number): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!KEY_SEGMENT.test(entry.name)) continue; // dotfiles fail the leading-alnum rule
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth + 1 < MAX_SEGMENTS) walk(path.join(dir, entry.name), rel, depth + 1);
      } else if (entry.isFile()) {
        try {
          if (statSync(path.join(dir, entry.name)).size > MAX_PUSH_BYTES) continue;
        } catch {
          continue;
        }
        out.push(rel);
      }
    }
  };
  walk(root, '', 1);
  return out.sort();
}

/**
 * Mirror local assets up to the hub. Idempotent and skip-first (one HEAD per
 * asset per boot; upload only on a miss), sequential on purpose — assets run
 * to videos, and saturating the link a fresh sync is also using would starve
 * the handshakes this rides behind. Never throws; a failed upload is retried
 * for free on the next boot.
 */
export async function pushAssets(opts: {
  designRoot: string;
  hubUrl: string;
  /** Read at call time — silent renewal swaps the credential in place. */
  token: () => string;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
}): Promise<AssetPushResult> {
  const { designRoot, hubUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const base = hubUrl.replace(/\/+$/, '');
  const out: AssetPushResult = { pushed: [], skipped: 0, failed: [] };

  for (const key of listPushableAssets(designRoot)) {
    const url = `${base}/assets/${key}`;
    const headers = { authorization: `Bearer ${opts.token()}` };
    try {
      const head = await fetchImpl(url, { method: 'HEAD', headers });
      if (head.ok) {
        out.skipped += 1;
        continue;
      }
      const put = await fetchImpl(url, {
        method: 'PUT',
        headers,
        body: Bun.file(path.join(designRoot, 'assets', key)),
      });
      if (put.ok) out.pushed.push(key);
      else out.failed.push({ key, reason: `HTTP ${put.status}` });
    } catch (err) {
      out.failed.push({ key, reason: (err as Error).message });
    }
  }

  if (out.pushed.length > 0) {
    log.log?.(
      `[sync/assets] pushed ${out.pushed.length} asset(s) to ${base} (${out.skipped} already there)`
    );
  }
  if (out.failed.length > 0) {
    log.warn?.(
      `[sync/assets] ${out.failed.length} asset(s) did not reach ${base} (retried next boot): ${out.failed
        .slice(0, 3)
        .map((f) => `${f.key} — ${f.reason}`)
        .join('; ')}`
    );
  }
  return out;
}
