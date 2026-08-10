/**
 * @file       figma/assets.ts — resolving image + vector fills (DDR-216 T8).
 * @scope      apps/studio/figma/assets.ts
 * @purpose    Turn `pendingImages` / `pendingExports` into real, local,
 *             content-addressed assets — batched, capped, and through the
 *             existing gates rather than a second download path.
 *
 * @invariant  BATCH, NEVER ONE CALL PER NODE. `IMAGE_COST = 200` ⇒ ~30 req/min
 *             on the images endpoint — the tight one. Figma's own translator
 *             emitted 22 exports for a trivial 990×648 frame; a real page would
 *             be hundreds. `to-artboard`'s vector-cluster collapse is the other
 *             half of this mitigation.
 *
 * @invariant  DOWNLOADS GO THROUGH `_fetch-asset.mjs`, WITH THE FIGMA LANE'S
 *             NARROWING. The URLs `/v1/images` returns are RESPONSE-CONTROLLED
 *             — Maude did not choose them. They get the full resolved-IP gate
 *             plus a host allowlist, a pinned port, and a tight byte cap. There
 *             is no second downloader here.
 *
 * @invariant  FAIL CLOSED. A vector goes through TWO processes in TWO runtimes
 *             (node for the download, bun for the DDR-167 SVG lane). DDR-177
 *             documents that runtime-spawned helpers have shipped broken inside
 *             the packaged `.app` more than once. If the sanitize step is
 *             unavailable, the staged bytes are DELETED and the node is reported
 *             `asset-skipped` — never "we already have the bytes", which is the
 *             natural and wrong recovery.
 *
 * @invariant  DOWNLOADS STAGE OUTSIDE THE DESIGN ROOT. The caller's per-run
 *             staging directory lives under the OS temp root, never under
 *             `<designRoot>/_history/` — "gitignored" is not "not replicated",
 *             and `~/git/.stignore` excludes neither.
 *
 * @limitation ASSETS PROMOTE PER-ASSET, NOT ONCE AT THE END. `deps.promote`
 *             writes into `<designRoot>/assets/` as each download completes, so
 *             a failure on frame 7 of 60 leaves earlier assets committed while
 *             the report says the import failed. D5 asked for a single
 *             directory rename; this is N renames. Stated as a KNOWN GAP rather
 *             than described as the guarantee it is not (post-implementation
 *             review F6) — content-addressing makes the residue harmless-but-
 *             untidy (orphan assets, no wrong content), which is why it is a
 *             limitation and not a blocker.
 */

import { fetchImageUrls, MAX_IMAGE_BATCH } from './client.ts';
import type { Disposition, ImportReport } from './sanitize.ts';

/** Hosts the Figma image lane may reach. Exact-or-dotted-suffix, frozen. */
export const FIGMA_ASSET_HOSTS = Object.freeze([
  'figma.com',
  'figma-alpha-api.s3.us-west-2.amazonaws.com',
]);

/** D5 — total assets per import. A backstop against an engineered document. */
export const MAX_ASSETS_PER_IMPORT = 200;
/** D5 — cumulative bytes, the cap the per-item ones do not give you. */
export const MAX_ASSET_BYTES_PER_IMPORT = 64 * 1024 * 1024;
/**
 * A UI vector export is kilobytes. The shared helper's 10 MB default was sized
 * for a hero photograph; this lane pins far below it, which is also what closes
 * the "200 assets × 10 MB = 2 GB into a replicated tree" shape.
 */
export const FIGMA_ASSET_MAX_BYTES = 2 * 1024 * 1024;
/** D11 — well below DDR-167's 5 MB, because these bytes are now REMOTE. */
export const FIGMA_SVG_MAX_BYTES = 1 * 1024 * 1024;
/** Politeness + bounded local work. */
export const MAX_CONCURRENT_DOWNLOADS = 4;

export interface AssetRequest {
  nodeId: string;
  format: 'svg' | 'png';
  /** What the emitted source currently references. */
  placeholder: string;
}

export interface ResolvedAsset {
  nodeId: string;
  placeholder: string;
  /** The canvas reference path, e.g. `/assets/<sha8>.png`. */
  ref: string;
  bytes: number;
}

export interface ResolveDeps {
  /**
   * Download to a staged path under the FULL gate. Injected so this module is
   * testable without the network — the real implementation is
   * `_fetch-asset.mjs`'s `fetchAsset({ rawOut })`.
   */
  stage(url: string, outPath: string, maxBytes: number): Promise<{ bytes: number; ext: string }>;
  /**
   * Sanitize + promote a staged file into `assets/`, returning the canvas ref.
   * The real implementation routes SVG through `_import-asset.mjs`'s DDR-167
   * lane and rasters through the content-addressed write.
   */
  promote(stagedPath: string, kind: 'svg' | 'png'): Promise<{ ref: string }>;
  /** Where staged bytes live — OUTSIDE the design root (D5). */
  stagingPath(nodeId: string, ext: string): string;
  /** Drop a staged file on any failure path. */
  discard(path: string): void;
}

/**
 * The caps, as ONE mutable budget for a whole import.
 *
 * They were function-locals of `resolveAssets`, which reads correctly and is
 * wrong: `importFrames` calls it once PER FRAME, so the ceiling reset every
 * frame and 60 frames reconstructed exactly the multi-GB, Syncthing-replicated
 * shape D5 says it closed — while spending a browser launch per SVG canary.
 * A budget you can only bound by asking "who owns the counter?" is not a bound
 * (post-implementation review F4).
 */
export interface AssetBudget {
  count: number;
  bytes: number;
}

export function makeAssetBudget(): AssetBudget {
  return { count: 0, bytes: 0 };
}

export interface ResolveResult {
  resolved: ResolvedAsset[];
  /** placeholder → ref, for rewriting the emitted source in one pass. */
  rewrites: Map<string, string>;
  totalBytes: number;
}

/** Split ids into `/v1/images`-sized batches. Never one call per node. */
export function batchIds(ids: readonly string[], size = MAX_IMAGE_BATCH): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push([...ids.slice(i, i + size)]);
  return out;
}

/** Run `tasks` with bounded concurrency, preserving input order in the result. */
async function pooled<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await run(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Resolve every pending asset for one import.
 *
 * Caps are enforced BEFORE work is done where possible (asset count) and
 * during it where they cannot be (cumulative bytes) — and a cap trip is a
 * REPORTED bounded degradation (`asset-cap-reached`), not a silent stop: the
 * import continues without that asset and the summary names it.
 */
export async function resolveAssets(
  fileKey: string,
  requests: readonly AssetRequest[],
  deps: ResolveDeps,
  report: ImportReport,
  budget: AssetBudget = makeAssetBudget()
): Promise<ResolveResult> {
  const rewrites = new Map<string, string>();
  const resolved: ResolvedAsset[] = [];
  let totalBytes = 0;

  if (requests.length === 0) return { resolved, rewrites, totalBytes };

  const room = Math.max(0, MAX_ASSETS_PER_IMPORT - budget.count);
  const accepted = requests.slice(0, room);
  budget.count += accepted.length;
  for (const dropped of requests.slice(room)) {
    report.add(dropped.nodeId, 'ASSET', 'asset-cap-reached', `>${MAX_ASSETS_PER_IMPORT}`);
  }

  // ── Batched URL resolution, per format ──
  const urlByNode = new Map<string, string>();
  for (const format of ['svg', 'png'] as const) {
    const ids = accepted.filter((r) => r.format === format).map((r) => r.nodeId);
    if (ids.length === 0) continue;
    for (const batch of batchIds(ids)) {
      const { images } = await fetchImageUrls(fileKey, batch, format);
      for (const [nodeId, url] of Object.entries(images)) {
        if (typeof url === 'string' && url.length > 0) urlByNode.set(nodeId, url);
      }
    }
  }

  // ── Bounded-concurrency download + sanitize + promote ──
  await pooled(accepted, MAX_CONCURRENT_DOWNLOADS, async (req) => {
    const url = urlByNode.get(req.nodeId);
    if (!url) {
      report.add(req.nodeId, 'ASSET', 'asset-skipped', 'figma declined to render');
      return;
    }
    if (budget.bytes >= MAX_ASSET_BYTES_PER_IMPORT) {
      report.add(req.nodeId, 'ASSET', 'asset-cap-reached', 'total bytes');
      return;
    }

    const staged = deps.stagingPath(req.nodeId, req.format);
    try {
      const cap = req.format === 'svg' ? FIGMA_SVG_MAX_BYTES : FIGMA_ASSET_MAX_BYTES;
      const { bytes, ext } = await deps.stage(url, staged, cap);
      // Counted HERE, not after a successful promote: bytes that crossed the
      // network and landed on disk cost the same whether the promote succeeded.
      budget.bytes += bytes;
      // The staged kind must agree with what we asked Figma to render. A
      // mismatch means the response is not what the request implied — refuse
      // rather than promote something into a versioned, peer-synced tree.
      const kindOk = req.format === 'svg' ? ext === 'svg' : ext !== 'svg';
      if (!kindOk) {
        deps.discard(staged);
        report.add(req.nodeId, 'ASSET', 'asset-skipped', 'format mismatch');
        return;
      }
      const { ref } = await deps.promote(staged, req.format);
      totalBytes += bytes;
      resolved.push({ nodeId: req.nodeId, placeholder: req.placeholder, ref, bytes });
      rewrites.set(req.placeholder, ref);
    } catch {
      // FAIL CLOSED — including when the bun-side sanitizer is simply not
      // available in a packaged app (DDR-177). Delete the staged bytes and
      // report; never keep them and never reference them.
      deps.discard(staged);
      report.add(req.nodeId, 'ASSET', 'asset-skipped', 'download or sanitize failed');
    }
  });

  return { resolved, rewrites, totalBytes };
}

/**
 * Rewrite placeholders in emitted source. A placeholder that never resolved is
 * left in place deliberately — the canvas shows a visibly broken image, which
 * is a far better failure than a silently-missing element, and the summary
 * already names the node.
 */
export function applyRewrites(source: string, rewrites: ReadonlyMap<string, string>): string {
  let out = source;
  for (const [placeholder, ref] of rewrites) {
    out = out.split(placeholder).join(ref);
  }
  return out;
}

/** The disposition set this module can emit — kept in sync with `sanitize.ts`. */
export const ASSET_DISPOSITIONS: readonly Disposition[] = [
  'asset-pending',
  'asset-skipped',
  'asset-cap-reached',
];
