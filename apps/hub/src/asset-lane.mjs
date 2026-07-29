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
// CONTENT-ADDRESSED ⇒ IMMUTABLE ⇒ NO EXPIRY. The key IS the hash of the bytes,
// so an object can never need replacing, an upload can never race, and a
// lifecycle rule that expired one would break a canvas that still references
// it. The `s3-no-expiry` verification check asserts exactly this.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { headObject, putObject } from './s3.mjs';

/** The only filenames the sweep will consider. Mirrors assets.mjs' ASSET_KEY,
 *  because an object this uploads must be reachable by that proxy — a stricter
 *  or looser shape here would produce assets nobody can fetch. */
const ASSET_FILE = /^[0-9a-f]{8}(?:\.[A-Za-z0-9]{1,8})?$/;

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
  // Deduped: the key IS the content hash, so the same name twice is the same
  // bytes twice — a second PUT would be pure spend for an identical object.
  return [...new Set(names.filter((n) => ASSET_FILE.test(n) && !present.has(n)))].sort();
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
export async function sweepAssets({ designRoot, s3, log = console, deps = {} }) {
  const head = deps.headObject ?? headObject;
  const put = deps.putObject ?? putObject;
  const result = { uploaded: [], skipped: 0, failed: [] };
  if (!s3) return result;

  const dir = join(designRoot, 'assets');
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return result; // no assets dir — the common case for a fresh project
  }

  for (const name of pendingAssets(names)) {
    const key = `assets/${name}`;
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
