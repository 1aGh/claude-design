// export-lane.js — DDR-231 (hybrid export lanes), client half.
//
// The SINGLE definition of "can the member's own browser capture this export
// request", shared by the shell ExportDialog and the bridged in-canvas
// handler in app.jsx — and unit-tested without a DOM
// (test/export-browser-lane.test.ts). If the rule forks between the two entry
// points, one dialog silently routes through the fleet the other avoids.
//
// The rule: a workspace (any non-local lane) captures png/svg of a KNOWN
// active artboard in the browser — the canvas already renders there, so the
// capture is instant and needs no render service. Everything else (other
// formats, multi-artboard scopes, selection captures) continues to the jobs
// lane: `remote` renders it on maude-render, `none` refuses with a remedy.

/** Formats the canvas-lib export-capture bridge can produce today. */
export const BROWSER_CAPTURE_FORMATS = new Set(['png', 'svg']);

/**
 * Formats a workspace can serve WITHOUT the render service thanks to the
 * browser lane — the dialog's card-blocking check on lane `none`. pptx rides
 * the capture bridge for its PNGs and the in-cell assemble route
 * (`/_api/export-assemble`) for composition.
 */
export const BROWSER_SERVABLE_FORMATS = new Set(['png', 'svg', 'pptx']);

/**
 * @param {{ exportLane?: string, format?: string, scope?: string, artboardId?: unknown }} req
 * @returns {boolean}
 */
export function browserCaptureEligible({ exportLane, format, scope, artboardId }) {
  if (exportLane === 'local' || exportLane === undefined) return false;
  if (BROWSER_CAPTURE_FORMATS.has(format)) return scope === 'artboard' && !!artboardId;
  // The deck: every artboard captured as PNG in the browser, composed in-cell.
  if (format === 'pptx') return scope === 'canvas-as-separate';
  return false;
}

/**
 * DDR-231 — the pptx browser lane, shared by the shell ExportDialog and the
 * bridged in-canvas handler: capture EVERY artboard as PNG via the bridge,
 * POST them to the in-cell assemble route, hand back the finished deck.
 * 3× mirrors the desktop PNG-deck fallback's FALLBACK_SCALE (crisp in
 * non-vector viewers).
 *
 * @param {{ capture: Function, name?: string, scale?: number, onProgress?: Function }} args
 * @returns {Promise<{ filename: string, blob: Blob }>}
 */
export async function captureDeckViaBrowser({ capture, name = 'export', scale = 3, onProgress }) {
  const items = await capture({
    format: 'png',
    artboardIds: null,
    scale,
    onProgress,
    timeoutMs: 300_000,
  });
  if (!items || !items.length) throw new Error('capture returned nothing');
  const fd = new FormData();
  fd.set('format', 'pptx');
  fd.set('scale', String(scale));
  fd.set('name', name);
  for (const it of items) fd.append('image', it.blob, it.name);
  const r = await fetch('/_api/export-assemble', { method: 'POST', body: fd });
  if (!r.ok) throw new Error((await r.text()) || `deck assembly failed (${r.status})`);
  const disp = r.headers.get('content-disposition') || '';
  const filename = /filename="([^"]+)"/.exec(disp)?.[1] || `${name}.pptx`;
  return { filename, blob: await r.blob() };
}

const SAFE_CAPTURE_MIME = { png: 'image/png', svg: 'image/svg+xml' };

/**
 * DDR-231 security (adversarial pass) — the capture bridge lives in the CANVAS
 * iframe, and tenant-authored TSX executes in that same window. Tenant code can
 * therefore read the `export-capture` request and FORGE an
 * `export-capture-done` reply carrying an arbitrary blob + name that passes the
 * shell's `e.source` check. Before the shell writes any such blob to disk,
 * force a safe shape: a basename stripped to `[A-Za-z0-9._-]` with the format's
 * own extension, and the blob re-wrapped with the format's known MIME — so a
 * blob of HTML bytes labelled `image/png` (a reflected-file-download / local
 * XSS attempt) lands as an inert `.png`, never as an openable `.html`.
 *
 * @param {{ name?: string, blob: Blob }} item
 * @param {string} format 'png' | 'svg'
 * @returns {{ name: string, blob: Blob }}
 */
export function sanitizeCapturedItem(item, format) {
  const mime = SAFE_CAPTURE_MIME[format] || 'application/octet-stream';
  const ext = format === 'svg' ? 'svg' : 'png';
  const raw = typeof item?.name === 'string' ? item.name : '';
  let base = raw
    .replace(/^.*[\\/]/, '') // drop any path
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(new RegExp(`\\.${ext}$`, 'i'), '');
  if (!base || /^\.+$/.test(base)) base = 'artboard';
  return {
    name: `${base.slice(0, 200)}.${ext}`,
    // Re-wrap so the download Content-Type is the format's MIME regardless of
    // what the (untrusted) reply claimed.
    blob: new Blob([item.blob], { type: mime }),
  };
}

/**
 * Fold the dialog's resolution options (scale multiplier OR physical dpi —
 * dpi wins, mirroring exporters/png.ts resolveDeviceScale) into the capture
 * bridge's deviceScale, clamped to the raster guard's 1–8 window
 * (capture-core.ts assertRasterSizeOk enforces the byte/side ceilings).
 *
 * @param {{ dpi?: number, scale?: number }} [options]
 * @returns {number}
 */
export function captureScale(options = {}) {
  return Math.max(1, Math.min(8, options.dpi ? options.dpi / 96 : options.scale || 1));
}
