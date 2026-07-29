// Server-side asset lane — Cloud Phase 16 Task 3.
//
// THE GAP. The read side has existed since Phase 3: `assets.mjs` proxies
// `assets/<sha8>` out of the bucket for any peer holding a token. The WRITE
// side was client-only — `apps/studio/assets-s3.ts` reads its S3 config from
// the client's environment. So the bytes reached the bucket only if a desktop
// happened to be running with credentials configured. For a browser-only or
// phone-only tenant, every asset reference in their canvases resolved to a 404
// from their own project.
//
// The cell closes that: it is a peer that HAS the bytes (they arrive in the
// checkout, by seed clone or by a desktop's push) and it has the credentials.
//
// WHY NOT MAKE THE HUB AN UPLOAD ENDPOINT. assets.mjs refuses writes on
// purpose — an authenticated upload route is an authenticated disk-fill
// surface, and R2 bills for what lands in it. Sweeping from a checkout keeps
// the write path bounded by what git already accepted.
//
// NOTHING HERE MAY EXPIRE. A canvas in git history can reference media no
// current canvas does, so "unreferenced" never means "unreachable" and a
// lifecycle rule on this prefix is a permanently broken canvas. The
// `s3-no-expiry` verification check asserts it.
//
// Cloud Phase 15 widened what counts as an asset: content-addressed names are
// what `maude design fetch-asset` mints for DOWNLOADED media, but a design
// system's own fonts and graphics are authored, committed, and referenced by
// path (`graphics/camo-bg.png`). Mirroring only hashes left a hosted project
// rendering without its own brand.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assetObjectKey, assetPrefixFromEnv } from './asset-key.mjs';
import { parseAssetPath } from './assets.mjs';
import { headObject, putObject } from './s3.mjs';

/**
 * Eligibility is decided by the PROXY, not by a second regex here.
 *
 * These two rules must agree exactly: a file this uploads but the proxy will
 * not serve is spend with no reader, and a file the proxy would serve but this
 * skips is a broken image in a hosted project. They did not agree — the sweep
 * required content-addressed names while real projects also carry
 * `graphics/camo-bg.png` and `gator_badge_roundel.svg` — so the rule now has
 * one home and this asks it.
 */
function servable(relPath) {
  return parseAssetPath(`/assets/${relPath}`) !== null;
}

/** Skip anything implausible for a design asset. A 2 GB file in the assets dir
 *  is a mistake, and paying R2 to store it silently is the wrong response. */
const MAX_ASSET_BYTES = 512 * 1024 * 1024;

/**
 * Which files in an assets directory are eligible, given what the bucket has.
 * Pure — the caller supplies the listing and the existence check.
 *
 * @param {string[]} names       filenames in `<designRoot>/assets/`
 * @param {Set<string>} present  keys already in the bucket (without the `assets/` prefix)
 */
export function pendingAssets(names, present = new Set()) {
  return [...new Set(names.filter((n) => servable(n) && !present.has(n)))].sort();
}

/** Every file under `dir`, as paths relative to it. Missing dir → []. */
function listRecursive(dir, prefix = '', out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) listRecursive(join(dir, entry.name), rel, out);
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * Mirror the checkout's assets into the bucket. Idempotent and skip-first:
 * a HEAD is far cheaper than re-uploading a video on every boot.
 *
 * Never throws. An asset that fails to upload leaves the canvas referencing it
 * broken, which is bad — but a cell that refuses to serve because one upload
 * 502'd is worse, and the next sweep retries it for free.
 *
 * @returns {Promise<{ uploaded: string[], skipped: number, failed: {key:string,reason:string}[] }>}
 */
export async function sweepAssets({ designRoot, s3, log = console, deps = {}, prefix }) {
  // Tenant scope. Resolved ONCE here and passed down, so the reader and the
  // writer cannot end up computing it differently.
  const scope = prefix ?? assetPrefixFromEnv();
  const head = deps.headObject ?? headObject;
  const put = deps.putObject ?? putObject;
  const result = { uploaded: [], skipped: 0, failed: [] };
  if (!s3) return result;

  const dir = join(designRoot, 'assets');
  const all = listRecursive(dir);
  if (all.length === 0) return result; // no assets — the common case for a fresh project

  const eligible = pendingAssets(all);
  const skipped = all.filter((n) => !servable(n));
  if (skipped.length > 0) {
    // Named loudly rather than dropped. A silently skipped asset is a broken
    // image in a hosted project with nothing anywhere to explain it.
    log.warn?.(
      `[assets] ${skipped.length} file(s) cannot be served and were NOT mirrored ` +
        `(name or depth outside the servable shape): ${skipped.slice(0, 5).join(', ')}` +
        (skipped.length > 5 ? ` …+${skipped.length - 5}` : '')
    );
  }

  for (const name of eligible) {
    const key = assetObjectKey(name, scope);
    try {
      const existing = await head(s3, key);
      if (existing) {
        result.skipped += 1;
        continue;
      }
      const body = readFileSync(join(dir, name));
      if (body.length > MAX_ASSET_BYTES) {
        result.failed.push({ key: name, reason: `over ${MAX_ASSET_BYTES} bytes` });
        continue;
      }
      await put(s3, key, body);
      result.uploaded.push(name);
    } catch (err) {
      result.failed.push({ key: name, reason: err.message });
    }
  }

  if (result.uploaded.length || result.failed.length) {
    log.log?.(
      `[assets] mirrored ${result.uploaded.length}, skipped ${result.skipped}` +
        (result.failed.length ? `, ${result.failed.length} failed` : '')
    );
  }
  return result;
}
