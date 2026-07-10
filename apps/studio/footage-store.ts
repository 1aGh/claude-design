/**
 * @file       footage-store.ts — Footage-analysis + EDL sidecar persistence
 *             (feature-footage-analysis-director, Task 2).
 * @scope      apps/studio/footage-store.ts
 * @purpose    Read / write the two VERSIONED sidecars behind the footage
 *             "director" pipeline (DDR-115 taxonomy):
 *               • `assets/<sha8>.footage.json` — a `FootageAnalysis` (per clip)
 *               • `<designRoot>/<slug>.edl.json` — an `Edl` (per cut)
 *             Mirrors `photo-store.ts`'s `createX(ctx)` factory + `Bun.write`/
 *             `Bun.file` shape. Server-side only — imports the DEPENDENCY-FREE
 *             `footage/schema.ts`.
 *
 * @security   UNLIKE `/_api/photo-edit`, the `/_api/footage` route is
 *             MAIN-ORIGIN ONLY (privileged — NOT in either canvas allowlist).
 *             It is written by the `footage-analyst` / `footage-director` agents
 *             over loopback, never by the untrusted canvas iframe (DDR-054), so
 *             a `GET → 405` assertion from the canvas origin guards it
 *             (canvas-origin-gate.test.ts). The write path is still derived from
 *             caller-supplied params, so the DDR-088 cap stack is preserved:
 *               1. strict sha8 / slug extraction (hex or kebab, bounded) —
 *                  rejects `..`, `/`, `%2f`, absolute paths by construction;
 *               2. explicit containment assert (poisoned-designRoot backstop);
 *               3. structural `validateFootageAnalysis` / `validateEdl`;
 *               4. body/file size cap (256 KB — generous for analysis JSON).
 */

import path from 'node:path';

import type { Context } from './context.ts';
import {
  EDL_VERSION,
  type Edl,
  FOOTAGE_ANALYSIS_VERSION,
  type FootageAnalysis,
  validateEdl,
  validateFootageAnalysis,
} from './footage/schema.ts';

/** Max bytes for either sidecar (read + write). Analysis JSON is small; slack. */
export const FOOTAGE_MAX_BYTES = 256 * 1024;

const SHA_RE = /^[0-9a-f]{8,64}$/;
// A cut slug: lowercase kebab, bounded. Matches the `slug.sh` normalization
// shape — no path segment, no dot, so `..`/`/`/absolute can never survive.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Extract + validate the content-address sha8 from an `asset` param, in any of
 * the forms a caller might hold (`assets/<sha8>.<ext>`, `/assets/<sha8>.png`,
 * `<sha8>.png`, bare `<sha8>`). The hex regex is the traversal defense.
 * (Copied from photo-store.assetSha8 — same contract, kept local so the two
 * stores stay independent.)
 */
export function assetSha8(param: string | null | undefined): string | null {
  if (typeof param !== 'string') return null;
  let s = param.trim();
  if (!s) return null;
  s = s.replace(/^\/+/, '');
  s = s.replace(/^assets\//, '');
  s = s.replace(/\.[A-Za-z0-9]+$/, '');
  return SHA_RE.test(s) ? s : null;
}

/** Validate a cut slug (already-normalized kebab), or null. */
export function edlSlug(param: string | null | undefined): string | null {
  if (typeof param !== 'string') return null;
  const s = param.trim();
  return SLUG_RE.test(s) ? s : null;
}

export interface FootageStore {
  analysisPathForSha8(sha8: string): string;
  edlPathForSlug(slug: string): string;
  getAnalysis(assetParam: string | null | undefined): Promise<FootageAnalysis | null>;
  saveAnalysis(
    assetParam: string | null | undefined,
    analysis: unknown
  ): Promise<
    | { ok: true; path: string; analysis: FootageAnalysis }
    | { ok: false; status: number; error: string }
  >;
  getEdl(slugParam: string | null | undefined): Promise<Edl | null>;
  saveEdl(
    slugParam: string | null | undefined,
    edl: unknown
  ): Promise<{ ok: true; path: string; edl: Edl } | { ok: false; status: number; error: string }>;
}

export function createFootageStore(ctx: Context): FootageStore {
  const designRoot = ctx.paths.designRoot;
  const assetsDir = path.join(designRoot, 'assets');

  function analysisPathForSha8(sha8: string): string {
    if (!SHA_RE.test(sha8)) throw new Error(`invalid sha8: ${sha8}`);
    const abs = path.join(assetsDir, `${sha8}.footage.json`);
    const rel = path.relative(assetsDir, abs);
    if (rel !== `${sha8}.footage.json` || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`footage path escaped assets/: ${abs}`);
    }
    return abs;
  }

  function edlPathForSlug(slug: string): string {
    if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`);
    const abs = path.join(designRoot, `${slug}.edl.json`);
    const rel = path.relative(designRoot, abs);
    if (rel !== `${slug}.edl.json` || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`edl path escaped designRoot: ${abs}`);
    }
    return abs;
  }

  async function readSidecar<T>(
    abs: string,
    validate: (v: unknown) => { ok: boolean }
  ): Promise<T | null> {
    try {
      const file = Bun.file(abs);
      if (!(await file.exists())) return null;
      if (file.size > FOOTAGE_MAX_BYTES) return null;
      const parsed = JSON.parse(await file.text());
      return validate(parsed).ok ? (parsed as T) : null;
    } catch {
      return null;
    }
  }

  async function getAnalysis(
    assetParam: string | null | undefined
  ): Promise<FootageAnalysis | null> {
    const sha8 = assetSha8(assetParam);
    if (!sha8) return null;
    return readSidecar<FootageAnalysis>(analysisPathForSha8(sha8), validateFootageAnalysis);
  }

  async function saveAnalysis(
    assetParam: string | null | undefined,
    analysis: unknown
  ): Promise<
    | { ok: true; path: string; analysis: FootageAnalysis }
    | { ok: false; status: number; error: string }
  > {
    const sha8 = assetSha8(assetParam);
    if (!sha8) return { ok: false, status: 400, error: 'invalid or missing asset (expected sha8)' };

    let serialized: string;
    try {
      serialized = JSON.stringify(analysis ?? {});
    } catch {
      return { ok: false, status: 400, error: 'body is not serializable JSON' };
    }
    if (Buffer.byteLength(serialized, 'utf8') > FOOTAGE_MAX_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `footage analysis exceeds ${FOOTAGE_MAX_BYTES} bytes`,
      };
    }

    const check = validateFootageAnalysis(analysis);
    if (!check.ok) {
      return {
        ok: false,
        status: 400,
        error: `invalid FootageAnalysis: ${check.errors.join('; ')}`,
      };
    }

    // Stamp version only; the sidecar filename (<sha8>.footage.json) is the
    // authoritative source key. `asset` is already validated as a well-formed
    // relative path — keep the client's value verbatim.
    const toWrite: FootageAnalysis = {
      ...(analysis as FootageAnalysis),
      version: FOOTAGE_ANALYSIS_VERSION,
    };

    let abs: string;
    try {
      abs = analysisPathForSha8(sha8);
    } catch (e) {
      return { ok: false, status: 400, error: e instanceof Error ? e.message : 'bad path' };
    }
    try {
      await Bun.write(abs, JSON.stringify(toWrite, null, 2));
    } catch (e) {
      return { ok: false, status: 500, error: e instanceof Error ? e.message : 'write failed' };
    }
    return { ok: true, path: path.posix.join('assets', `${sha8}.footage.json`), analysis: toWrite };
  }

  async function getEdl(slugParam: string | null | undefined): Promise<Edl | null> {
    const slug = edlSlug(slugParam);
    if (!slug) return null;
    return readSidecar<Edl>(edlPathForSlug(slug), validateEdl);
  }

  async function saveEdl(
    slugParam: string | null | undefined,
    edl: unknown
  ): Promise<{ ok: true; path: string; edl: Edl } | { ok: false; status: number; error: string }> {
    const slug = edlSlug(slugParam);
    if (!slug) return { ok: false, status: 400, error: 'invalid or missing slug (expected kebab)' };

    let serialized: string;
    try {
      serialized = JSON.stringify(edl ?? {});
    } catch {
      return { ok: false, status: 400, error: 'body is not serializable JSON' };
    }
    if (Buffer.byteLength(serialized, 'utf8') > FOOTAGE_MAX_BYTES) {
      return { ok: false, status: 413, error: `edl exceeds ${FOOTAGE_MAX_BYTES} bytes` };
    }

    const check = validateEdl(edl);
    if (!check.ok) {
      return { ok: false, status: 400, error: `invalid Edl: ${check.errors.join('; ')}` };
    }

    const toWrite: Edl = { ...(edl as Edl), version: EDL_VERSION };
    let abs: string;
    try {
      abs = edlPathForSlug(slug);
    } catch (e) {
      return { ok: false, status: 400, error: e instanceof Error ? e.message : 'bad path' };
    }
    try {
      await Bun.write(abs, JSON.stringify(toWrite, null, 2));
    } catch (e) {
      return { ok: false, status: 500, error: e instanceof Error ? e.message : 'write failed' };
    }
    return { ok: true, path: `${slug}.edl.json`, edl: toWrite };
  }

  return { analysisPathForSha8, edlPathForSlug, getAnalysis, saveAnalysis, getEdl, saveEdl };
}
