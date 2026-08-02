/**
 * @file       read-only-mode.ts — Cloud Phase 25 C2
 * @scope      apps/studio/read-only-mode.ts
 * @purpose    One boot-static answer to "is this canvas read-only?" for every
 *             module that runs inside the canvas iframe.
 *
 * The shell appends `?ro=1` to the canvas URL (client/canvas-url.js) when
 * `/_config.readOnly` is true — i.e. the linked hub vouched a `viewer` role at
 * workspace sign-in (sync/hubs-config.ts). Boot-static on purpose: a role is
 * per-session, and reading the URL can't race the way a post-load postMessage
 * could (during which a viewer could still drag something).
 *
 * This flag decides what the canvas chrome OFFERS — tools, drag handles,
 * inline edit, context menus. It never STOPS a write; that is the cell
 * (Phase 25 C1) and the dev-server's read-only gate (http.ts), both of which
 * hold whatever this returns.
 */

let cached: boolean | null = null;

export function isReadOnlyCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  if (cached === null) {
    try {
      cached = new URLSearchParams(window.location.search).get('ro') === '1';
    } catch {
      cached = false;
    }
  }
  return cached;
}

/** Test seam — reset the module cache (bun:test re-uses the module registry). */
export function _resetReadOnlyCache(): void {
  cached = null;
}
