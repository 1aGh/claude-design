// Cell→desktop asset pull — the downward half of the asset lane.
//
// THE BUG THIS EXISTS TO END. `asset-push.ts` is, in its own words, a
// "Desktop→cell asset push", and the cell never runs it at all (the
// `cellPairing` guard on `scheduleAssetSweep`). That is correct as designed —
// the desktop is the peer that HAS the bytes — but nothing was ever built for
// the other direction, so an image dropped onto a canvas IN THE BROWSER had its
// bytes stranded on the cell forever.
//
// The text lanes hid how total that was. `<slug>.annotations.svg` syncs, so the
// image stroke arrives on the desktop with its position, its size and its alt
// text intact, and renders as a broken-image glyph: a canvas that is visibly
// there and permanently empty. Confirmed on alligators — `assets/c0fa9c7f.png`
// referenced by a synced annotation, absent from every local disk.
//
// WHAT IT WANTS IS DERIVED LOCALLY, NOT DICTATED. The hub is untrusted to peers
// (DDR-054), so this never asks "what should I download" — it reads the files
// this peer ALREADY HOLDS, collects the `assets/…` references in them, and asks
// only for the ones missing from its own disk. A hostile hub cannot use this to
// place a file nobody referenced.
//
// AND THE REFERENCES THEMSELVES ARE UNTRUSTED. An annotation can have arrived
// from the hub, so a name found inside one is hub-controlled input. Every
// candidate is re-validated against `ASSET_NAME_RE` before it becomes a path:
// one segment, no scheme, no traversal, allowlisted extension — the same shape
// `ASSET_IMAGE_HREF_RE` enforces on the way in.
//
// MISSING-ONLY AND IDEMPOTENT, so a whole machine costs one directory scan and
// no requests, and a failed pull is retried for free on the next pass.

import {
  type Dirent,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { createPullBudget } from './pull-budget.ts';

/** How long to wait for one asset. Generous — these are photographs and clips. */
const GET_TIMEOUT_MS = 120_000;

/** Refuse an implausible body outright rather than streaming it to disk. */
const MAX_PULL_BYTES = 512 * 1024 * 1024;

/**
 * How many assets one pass will fetch.
 *
 * The same reasoning as the pull lane's `MAX_PULLS_PER_POLL`: every accepted
 * name becomes a real file in the design root, and this runs on a schedule for
 * the life of the process. A cap makes one answer unable to land thousands, and
 * the remainder is simply picked up by the next pass.
 */
const MAX_PULLS_PER_PASS = 200;

/**
 * A content-addressed asset name: ONE segment, no traversal, known extension.
 *
 * Deliberately the same shape as the annotation sanitizer's
 * `ASSET_IMAGE_HREF_RE`, widened to the media + font types the push lane already
 * carries. Anchored, so `assets/../../etc/passwd` and `assets/x.png?../` are
 * both refused before a path is built from them.
 */
const ASSET_NAME_RE =
  /^[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|avif|svg|mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|woff2?|ttf|otf)$/i;

/** Every `assets/<name>` reference in a blob of text. */
const REFERENCE_RE = /assets\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)/g;

/** Files worth reading for references — the canvas and its sidecars. */
const SCANNED_EXT = /\.(?:annotations\.svg|tsx|jsx|css|meta\.json)$/i;

/** Runtime directories that never hold a live reference (DDR-115). */
const SKIPPED_DIRS = new Set(['_trash', '_history', '_untrusted', '_smoke', 'node_modules']);

export interface AssetPullResult {
  pulled: string[];
  /** Referenced, missing, and the hub could not supply it. */
  failed: { name: string; reason: string }[];
  /** Referenced and already on disk — the steady state. */
  present: number;
  /** F6 — the pass stopped on the aggregate byte budget, not on the count cap.
   *  The remainder is the next pass's work; surfaced so status can say so. */
  budgetExhausted?: true;
}

/**
 * Collect every `assets/<name>` this project references, validated.
 *
 * Reads the canvas bodies and their sidecars. A reference that does not survive
 * `ASSET_NAME_RE` is dropped silently: it is either not an asset or not a name
 * this peer will ever turn into a path.
 */
export function referencedAssets(designRoot: string): string[] {
  const out = new Set<string>();
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // `assets/` itself is the destination, not a source of references.
        if (SKIPPED_DIRS.has(entry.name) || entry.name === 'assets') continue;
        walk(abs, depth + 1);
        continue;
      }
      if (!SCANNED_EXT.test(entry.name)) continue;
      let text: string;
      try {
        text = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      for (const match of text.matchAll(REFERENCE_RE)) {
        const name = match[1];
        if (name && ASSET_NAME_RE.test(name)) out.add(name);
      }
    }
  };
  walk(designRoot, 0);
  return [...out].sort();
}

/**
 * Fetch the referenced assets this machine does not have.
 *
 * Sequential on purpose, exactly like `pushAssets`: these run to videos, and
 * saturating a link the sync is also using would starve the handshakes. Never
 * throws — a failure is a line in `failed` and a free retry next pass.
 */
export async function pullAssets(opts: {
  designRoot: string;
  hubUrl: string;
  /** Read at call time — silent renewal swaps the credential in place. */
  token: () => string;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
  /** F6 — override the aggregate per-pass byte ceiling (tests). */
  maxPassBytes?: number;
}): Promise<AssetPullResult> {
  const { designRoot, hubUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const base = hubUrl.replace(/\/+$/, '');
  const assetsDir = path.join(designRoot, 'assets');
  const out: AssetPullResult = { pulled: [], failed: [], present: 0 };

  const wanted: string[] = [];
  for (const name of referencedAssets(designRoot)) {
    if (existsSync(path.join(assetsDir, name))) out.present += 1;
    else wanted.push(name);
  }
  if (wanted.length === 0) return out;

  // A peer that has never held an asset has no `assets/` yet — the first pull
  // is exactly when that is true.
  try {
    mkdirSync(assetsDir, { recursive: true });
  } catch (err) {
    log.warn(`[sync/assets] cannot create ${assetsDir}: ${(err as Error).message}`);
    return out;
  }

  const batch = wanted.slice(0, MAX_PULLS_PER_PASS);
  if (batch.length < wanted.length) {
    // Named loudly, for the same reason the pull lane names its cap: a silent
    // truncation reads as "sync is broken" with no cause.
    log.warn(
      `[sync/assets] ${wanted.length} referenced assets are missing here; taking ${batch.length} this pass.`
    );
  }

  // F6 (DDR-226 §9) — the per-file cap and the count cap multiply, and the hub
  // picks both factors. One aggregate ceiling per pass closes that.
  const budget = createPullBudget({
    label: 'sync/assets',
    log,
    ...(opts.maxPassBytes !== undefined ? { maxBytes: opts.maxPassBytes } : {}),
  });

  for (const name of batch) {
    if (budget.exhausted()) break;
    try {
      const res = await fetchImpl(`${base}/assets/${encodeURIComponent(name)}`, {
        headers: { authorization: `Bearer ${opts.token()}` },
        signal: AbortSignal.timeout(GET_TIMEOUT_MS),
      });
      if (!res.ok) {
        // A 404 is ordinary: the other peer has not pushed it yet. It costs a
        // line here and is retried next pass, when it may well be there.
        out.failed.push({ name, reason: `HTTP ${res.status}` });
        continue;
      }
      const body = new Uint8Array(await res.arrayBuffer());
      if (body.byteLength === 0 || body.byteLength > MAX_PULL_BYTES) {
        out.failed.push({ name, reason: `implausible size (${body.byteLength} B)` });
        continue;
      }
      // This lane learns a size only by receiving it (no manifest), so the
      // charge lands here — before the bytes touch the disk, which is what the
      // budget actually protects.
      if (!budget.take(body.byteLength)) {
        out.budgetExhausted = true;
        break;
      }
      // Write beside the target and rename, so a reader (the dev server serving
      // this very path) never sees a half-written image.
      const finalAbs = path.join(assetsDir, name);
      const tmpAbs = `${finalAbs}.part`;
      writeFileSync(tmpAbs, body);
      renameSync(tmpAbs, finalAbs);
      out.pulled.push(name);
    } catch (err) {
      out.failed.push({ name, reason: (err as Error).message });
    }
  }

  if (out.pulled.length > 0) {
    log.log(
      `[sync/assets] pulled ${out.pulled.length} asset(s) down from the project (${out.failed.length} still missing${
        out.budgetExhausted ? ', pass byte budget reached — resuming next pass' : ''
      }).`
    );
  }
  return out;
}
