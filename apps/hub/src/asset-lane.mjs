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

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

import { assetObjectKey, assetPrefixFromEnv } from './asset-key.mjs';
import { parseAssetPath } from './assets.mjs';
import { getObject, headObject, listObjects, putObject } from './s3.mjs';

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
export async function sweepAssets({ designRoot, s3, log = console, deps = {}, prefix, only }) {
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

  // `only` narrows a sweep to a named set (the B3 incremental lane). Absent =
  // everything, which is the boot sweep and every pre-existing caller.
  const eligible = pendingAssets(all).filter((n) => !only || only.has(n));
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

/**
 * Does `abs` still live under `root` once every symlink on the way is followed?
 *
 * Resolves the deepest EXISTING ancestor, because the target itself is about to
 * be created and `realpathSync` on a missing path throws. Mirrors
 * `realpathOfDeepestExisting` in `apps/studio/sync/index.ts` — the receiver on
 * the other side of the same trust boundary.
 */
function containedReal(abs, root) {
  // BOTH sides go through the same resolution, or the comparison is nonsense:
  // on macOS a temp root under `/var` realpaths to `/private/var`, so resolving
  // only the probe made every restore into a not-yet-created `assets/` look
  // like an escape.
  const realDeepest = (p) => {
    let probe = p;
    for (let i = 0; i < 64 && !existsSync(probe); i++) {
      const parent = dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    // The unresolved tail cannot introduce a link — nothing exists there yet —
    // but `resolve` still collapses any `..` it contains.
    return resolve(realpathSync(probe) + p.slice(probe.length));
  };
  try {
    const realRoot = realDeepest(root);
    const realAbs = realDeepest(abs);
    return realAbs !== realRoot && realAbs.startsWith(realRoot + sep);
  } catch {
    return false; // unreadable is not admissible
  }
}

/**
 * The names a bucket listing offers this checkout, given what is already on disk.
 *
 * Pure — the caller supplies the listing and the disk. Separated from the IO so
 * the two decisions that matter (what is servable, what is missing) can be
 * exhaustively tested without a bucket or a filesystem.
 *
 * @param {string[]} keys       object keys, scope prefix ALREADY stripped
 * @param {Set<string>} onDisk  asset-relative names present in the checkout
 */
export function missingFromCheckout(keys, onDisk = new Set()) {
  return [...new Set(keys.filter((k) => servable(k) && !onDisk.has(k)))].sort();
}

/**
 * Strip a tenant scope from an object key, or null when it is not ours.
 *
 * A listing is filtered server-side by prefix, but the answer is still remote
 * input and this is the step that turns it into a PATH. A key that does not
 * start with the exact scope we asked for is refused rather than trimmed —
 * "close enough" is how one tenant's media ends up in another's checkout.
 */
export function assetNameFromKey(key, prefix = '') {
  const scope = prefix ? `${prefix}/assets/` : 'assets/';
  const k = String(key ?? '');
  return k.startsWith(scope) ? k.slice(scope.length) : null;
}

/**
 * Refill the checkout from the bucket — the direction that did not exist.
 *
 * THE FAILURE. A cell's checkout is EPHEMERAL: the platform migrates instances
 * whenever it likes, and `rehydrate.mjs` restores the working set from the
 * newest backup generation. Assets that reached the bucket AFTER that
 * generation are not in it. `sweepAssets` above mirrors checkout → bucket and
 * there was no reverse, so those bytes existed in exactly one place the cell
 * could not read. The studio serves the CHECKOUT, so every canvas photograph
 * became a grey box.
 *
 * Measured on Brno Alligators, 2026-08-13: immediately after a fleet rollout,
 * 53–58 of ~95 bucket-class assets were 404 in the checkout and 200 in the
 * bucket. Three times in one afternoon. The only repair anyone had was
 * re-uploading ~388 MB from a laptop — a client fixing a server's disk, for
 * bytes the server already had.
 *
 * IT NEVER OVERWRITES. Only files ABSENT from the checkout are written. The
 * bucket is a backup of this checkout, not an authority over it: a
 * content-addressed name means identical bytes either way, and a
 * path-addressed one (`graphics/camo-bg.png`) could legitimately be NEWER on
 * disk — a local edit that has not been swept up yet. Filling gaps is the whole
 * job; anything more is a way to lose work.
 *
 * NEVER THROWS. A cell that refuses to boot because one GET 502'd is worse than
 * a cell with one missing image, and the next boot retries for free.
 *
 * @returns {Promise<{ restored: string[], present: number, failed: {key:string,reason:string}[], listed: number }>}
 */
export async function hydrateAssets({ designRoot, s3, log = console, deps = {}, prefix }) {
  const scope = prefix ?? assetPrefixFromEnv();
  const list = deps.listObjects ?? listObjects;
  const get = deps.getObject ?? getObject;
  const result = { restored: [], present: 0, failed: [], listed: 0 };
  if (!s3) return result;

  const dir = join(designRoot, 'assets');
  let objects;
  try {
    objects = await list(s3, scope ? `${scope}/assets/` : 'assets/');
  } catch (err) {
    log.warn?.(`[assets] could not list the bucket to hydrate: ${err.message}`);
    return result;
  }
  result.listed = objects.length;

  const names = objects.map((o) => assetNameFromKey(o.key, scope)).filter((n) => n !== null);
  const onDisk = new Set(listRecursive(dir));
  result.present = names.filter((n) => onDisk.has(n)).length;
  const missing = missingFromCheckout(names, onDisk);
  if (missing.length === 0) return result;

  log.log?.(
    `[assets] ${missing.length} asset(s) are in the bucket and missing from the checkout — restoring.`
  );

  const root = resolve(dir);
  for (const name of missing) {
    // Belt and braces at a CREATE. `servable()` already refuses `..`, a leading
    // slash, a backslash and anything outside the bounded charset — but this is
    // the one place a remote-controlled string becomes a file, so the last word
    // belongs to the filesystem, not to a regex.
    const abs = resolve(dir, name);
    if (abs !== root && !abs.startsWith(root + sep)) {
      result.failed.push({ key: name, reason: 'resolves outside the assets directory' });
      continue;
    }
    // …AND THE SAME CHECK AGAIN, THROUGH THE SYMLINKS.
    //
    // `resolve()` is purely lexical: it never follows a link, and
    // `mkdirSync(recursive: true)` happily traverses one that already exists.
    // The checkout is a clone of a repository the TENANT controls, so a
    // committed symlink under `.design/assets/` is a write-outside primitive
    // inside this cell — the exact hazard `sync/remote-docs.ts` documents and
    // injects a realpath for, on a receiver that is otherwise this one's twin.
    // Bounded (the `existsSync` re-check below still refuses to overwrite), and
    // still the one guard this codebase already knows it needs.
    if (!containedReal(abs, root)) {
      result.failed.push({
        key: name,
        reason: 'a symlink on the path leaves the assets directory',
      });
      continue;
    }
    try {
      const body = await get(s3, assetObjectKey(name, scope));
      if (!body) {
        // Listed a moment ago, gone now. Not an error worth shouting about.
        result.failed.push({ key: name, reason: 'not found in the bucket' });
        continue;
      }
      if (body.length > MAX_ASSET_BYTES) {
        result.failed.push({ key: name, reason: `over ${MAX_ASSET_BYTES} bytes` });
        continue;
      }
      // Re-check under the write, not only under the plan: a concurrent sweep,
      // a git checkout or a desktop push may have landed the real file while
      // this loop was awaiting an earlier GET.
      if (existsSync(abs)) {
        result.present += 1;
        continue;
      }
      mkdirSync(dirname(abs), { recursive: true });
      // Temp + rename, so a crash mid-restore cannot leave a truncated image
      // that later looks like a real asset to every reader in the process.
      const tmp = `${abs}.hydrating-${process.pid}`;
      writeFileSync(tmp, body);
      renameSync(tmp, abs);
      result.restored.push(name);
    } catch (err) {
      result.failed.push({ key: name, reason: err.message });
    }
  }

  if (result.restored.length || result.failed.length) {
    log.log?.(
      `[assets] restored ${result.restored.length} from the bucket, ${result.present} already present` +
        (result.failed.length ? `, ${result.failed.length} failed` : '')
    );
  }
  return result;
}

/**
 * The lane a BROWSER upload takes — Cloud Phase 27 B3.
 *
 * The boot sweep above rests on "assets arrive with a commit, and a cell wakes
 * on every migration". A browser upload breaks both halves of that: it lands on
 * the working tree through `POST /_api/asset` in the studio, with no commit and
 * no boot, so the bytes sat in `/repo` and reached object storage only whenever
 * the cell next restarted. Until then the asset served fine from the checkout
 * and was one teardown away from being gone.
 *
 * WHY THE HUB AND NOT THE STUDIO. The studio has its own S3 mirror
 * (`assets-s3.ts`) and in a cell it is deliberately unconfigured: `childEnv()`
 * is an allowlist and the tenant's storage credentials are not on it. Handing
 * them over to close this gap would undo a boundary that exists for better
 * reasons than this one. The hub already holds the credentials and already sees
 * the request, so the trigger belongs here.
 *
 * WHY NOT RE-SWEEP. A full sweep is one HEAD per file — 793 of them on a real
 * project — for an upload that added exactly one. This keeps the names it has
 * already mirrored and looks only at what is new, so the steady-state cost of
 * an upload is one HEAD and one PUT.
 */
export function createAssetSweeper({ designRoot, s3, prefix, log = console, deps = {} }) {
  /** Names this process has already put (or found) in the bucket. */
  const mirrored = new Set();
  let running = null;
  let again = false;

  function remember(result) {
    for (const name of result.uploaded) mirrored.add(name);
    return result;
  }

  /** The boot sweep — everything, and remember what was there. */
  async function sweepAll() {
    const result = await sweepAssets({ designRoot, s3, log, deps, prefix });
    // `skipped` counts files already in the bucket; they are equally "done", but
    // sweepAssets does not name them. Re-listing is cheap and local, and it
    // means a second boot does not re-HEAD them.
    for (const name of listRecursive(join(designRoot, 'assets'))) mirrored.add(name);
    return remember(result);
  }

  /**
   * The incremental sweep — only what this process has not mirrored yet.
   *
   * Single-flight with a trailing re-run: a burst of uploads (dragging six
   * images onto a canvas) collapses into one pass, and an upload that lands
   * DURING a pass is not dropped — it triggers exactly one more.
   */
  function sweepNew() {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        const dir = join(designRoot, 'assets');
        const fresh = listRecursive(dir).filter((n) => !mirrored.has(n));
        if (fresh.length === 0) return { uploaded: [], skipped: 0, failed: [] };
        const result = await sweepAssets({
          designRoot,
          s3,
          log,
          deps,
          prefix,
          only: new Set(fresh),
        });
        return remember(result);
      } finally {
        running = null;
        if (again) {
          again = false;
          void sweepNew();
        }
      }
    })();
    return running;
  }

  return { sweepAll, sweepNew, mirroredCount: () => mirrored.size };
}
