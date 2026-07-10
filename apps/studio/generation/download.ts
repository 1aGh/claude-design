// generation/download.ts — localize a produced GenAsset into the content-
// addressed `assets/<sha8>.<ext>` store (DDR-088), so nothing generated is ever
// referenced by an expiring provider URL or an un-sniffed blob.
//
// EVERY produced artifact goes through here before it is referenced anywhere:
//   • inline bytes / base64 (sync providers like Gemini) → api.saveAsset(bytes),
//     which magic-byte-sniffs + category-caps + content-addresses in ONE tested
//     path (the same route drag-drop/paste upload uses).
//   • an expiring provider URL (fal/Veo, async) → downloaded through the
//     SSRF-hardened egress path (_fetch-asset.mjs discipline) THEN saveAsset.
//     That URL path is added in Phase 1 (fal); Phase 0 (Gemini base64) never
//     hits it, so it fails loud rather than shipping an unhardened fetch.
//
// The route/job wires `AdapterContext.localize` to `localizeGenAsset(asset, …)`.

import type { GenAsset } from './types.ts';

/** Minimal seam onto api.saveAsset so this module stays dependency-light. */
export interface LocalizeDeps {
  /** api.saveAsset — magic-byte sniff + category cap + sha8 content-address. */
  saveAsset(bytes: Uint8Array): Promise<{ ok: boolean; path?: string; error?: string }>;
}

/** Decode a base64 string into bytes (data: URL prefix tolerated). */
function decodeBase64(data: string): Uint8Array {
  const comma = data.indexOf(',');
  const b64 = data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
  // Bun/Node Buffer decodes base64 without a browser atob dependency.
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Localize one produced asset → returns the `assets/<sha8>.<ext>` rel path.
 * Throws on an empty/rejected asset (saveAsset enforces the sniff + cap, so a
 * provider that returns an SVG/HTML/script blob is rejected there).
 */
export async function localizeGenAsset(asset: GenAsset, deps: LocalizeDeps): Promise<string> {
  let bytes: Uint8Array | null = null;

  const maybeBase64 = (asset as unknown as { base64?: unknown }).base64;
  if (asset.bytes && asset.bytes.byteLength > 0) {
    bytes = asset.bytes;
  } else if (typeof maybeBase64 === 'string') {
    // Some adapters stash base64 under `.base64`; tolerate it.
    bytes = decodeBase64(maybeBase64);
  } else if (asset.url) {
    throw new Error(
      'URL-result localization (expiring provider URL) is added in Phase 1 (fal) — ' +
        'the SSRF-hardened egress path is not wired yet; Phase 0 uses inline bytes only.'
    );
  }

  if (!bytes || bytes.byteLength === 0) {
    throw new Error('generation produced an empty asset');
  }

  const saved = await deps.saveAsset(bytes);
  if (!saved.ok || !saved.path) {
    throw new Error(`asset rejected on save: ${saved.error ?? 'unknown'}`);
  }
  return saved.path;
}
