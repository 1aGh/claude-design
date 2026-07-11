/**
 * @file       use-canvas-media-drop.tsx — Phase 23 canvas media intake
 * @scope      apps/studio/use-canvas-media-drop.tsx
 * @purpose    OS-level drag-and-drop + clipboard paste of images, video/audio,
 *             and URLs onto the canvas. Routes each gesture to a create callback
 *             owned by AnnotationsLayer (which holds the commit/undo sink +
 *             screenToWorld):
 *               • image file → `onImage(file, world)`  → optimistic stroke + upload
 *               • video/audio → `onMedia?(file, kind, world)` → upload to assets/
 *                 + toast the `<Video>`/`<Audio>` snippet (DDR-148; auto-insert
 *                 into the comp TSX is a documented follow-up)
 *               • http(s) URL → `onLink(url, title, world)` → client-only link chip
 *
 *             The classification + URL helpers are PURE + exported so the unit
 *             tests cover the dispatch matrix without a real DataTransfer /
 *             ClipboardEvent. The hook itself only wires the DOM events and the
 *             drag-affordance class.
 *
 *             Security: link URLs are gated to http(s) (no javascript:/data:);
 *             image bytes go through POST /_api/asset (magic-byte sniff + caps,
 *             DDR Task 9). Nothing here trusts the dropped content.
 */

import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)

/** A normalized snapshot of a DataTransfer / ClipboardData payload. */
export interface MediaPayload {
  files: readonly File[];
  /** text/uri-list (DnD) */
  uriList: string;
  /** text/html (carries the anchor text for a dragged/pasted link) */
  html: string;
  /** text/plain */
  plain: string;
}

export type MediaIntent =
  | { kind: 'image'; file: File }
  | { kind: 'media'; file: File; mediaKind: 'video' | 'audio' }
  | { kind: 'link'; url: string; title: string };

/** True only for an absolute http(s) URL — the one scheme a link chip accepts. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize a single token into a safe http(s) URL, or null. You should NOT have
 * to type a scheme to paste a link:
 *   - an explicit scheme is kept ONLY if it's http(s) — `javascript:` / `data:`
 *     / `file:` / `mailto:` all return null (never reach window.open);
 *   - a scheme-less but domain-shaped token (`example.com`, `sub.example.io/x`)
 *     gets `https://` prepended. The TLD must be alphabetic (≥2) so a bare
 *     decimal like `3.5` or `v1.2` is NOT mistaken for a domain.
 */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Distinguish a real scheme (`http:`, `javascript:`) from a `host:port` colon.
  // A scheme: the part before the FIRST colon is a valid scheme name (no `/`) AND
  // the char after the colon is NOT a digit (a digit there is a port → scheme-less).
  const colon = s.indexOf(':');
  const hasScheme =
    colon > 0 &&
    /^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(s.slice(0, colon)) &&
    !/^\d/.test(s.slice(colon + 1));
  if (hasScheme) return isHttpUrl(s) ? s : null;
  // Scheme-less but domain-shaped (alphabetic TLD ≥2) → assume https.
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s)) {
    const u = `https://${s}`;
    return isHttpUrl(u) ? u : null;
  }
  return null;
}

/**
 * First link URL in a blob of text, normalized to http(s). Handles a uri-list
 * (newline-separated, `#` comment lines), a bare-domain paste, and an explicit
 * inline URL inside prose. Returns null when none.
 */
export function firstHttpUrl(text: string): string | null {
  if (!text) return null;
  for (const raw of text.split(/[\r\n]+/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const u = normalizeUrl(line);
    if (u) return u;
  }
  // Fall back to an explicit inline URL token inside prose (a scheme is required
  // here — bare-domain detection only fires on a whole standalone line).
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? normalizeUrl(m[0]) : null;
}

/** Hostname without a leading `www.` — the chip's domain label. */
export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A readable title fallback when no anchor text is available. */
export function prettifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return path && path !== '/' ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

/** Anchor text from a `text/html` DnD/clipboard payload, else null. */
export function anchorTextFromHtml(html: string): string | null {
  if (!html) return null;
  const m = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (!m?.[1]) return null;
  const text = m[1]
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/**
 * Decide what a drop / paste is: an image file wins over a URL (a dragged image
 * carries both an image file AND a uri-list pointing at it). Returns null for a
 * plain-text / non-media payload so the caller leaves the event untouched.
 */
export function classifyMediaPayload(p: MediaPayload): MediaIntent | null {
  const imageFile = p.files.find((f) => typeof f.type === 'string' && f.type.startsWith('image/'));
  if (imageFile) return { kind: 'image', file: imageFile };
  // DDR-148 — video/audio files land in the project's assets/ (the widened asset
  // route, DDR-088) so a comp can reference them as <Video>/<Audio src="assets/…">.
  const mediaFile = p.files.find(
    (f) =>
      typeof f.type === 'string' && (f.type.startsWith('video/') || f.type.startsWith('audio/'))
  );
  if (mediaFile) {
    return {
      kind: 'media',
      file: mediaFile,
      mediaKind: mediaFile.type.startsWith('video/') ? 'video' : 'audio',
    };
  }
  const url = firstHttpUrl(p.uriList) ?? firstHttpUrl(p.plain);
  if (url) {
    const title = anchorTextFromHtml(p.html) ?? prettifyUrl(url);
    return { kind: 'link', url, title };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload

/** POST raw image bytes to the capped asset route. Returns the assets/ path. */
export async function uploadAsset(file: Blob): Promise<{ path: string } | { error: string }> {
  try {
    const res = await fetch('/_api/asset', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) {
      let msg = `upload failed (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* non-JSON error body */
      }
      return { error: msg };
    }
    const j = (await res.json()) as { path?: string };
    return typeof j?.path === 'string' ? { path: j.path } : { error: 'malformed upload response' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'network error' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transient toast (no React state — self-contained DOM, mirrors ensure*Styles)

const TOAST_CSS = `
.dc-media-toast {
  position: fixed;
  left: 50%;
  bottom: 108px;
  transform: translateX(-50%);
  z-index: 9;
  max-width: 360px;
  padding: 8px 14px;
  border-radius: 8px;
  background: #26262b;
  color: #fff;
  font-family: var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.34);
  opacity: 0;
  transition: opacity 140ms ease;
  pointer-events: none;
}
.dc-media-toast[data-show="1"] { opacity: 1; }
/* Drop affordance — a focus-accent inset frame while a media drag is over the
   canvas, so the surface reads as a drop target. */
.dc-media-dragover::after {
  content: "";
  position: fixed;
  inset: 6px;
  z-index: 8;
  border: 2px dashed var(--maude-hud-accent, #d63b1f);
  border-radius: 12px;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .dc-media-toast { transition: none; }
}
`.trim();

function ensureMediaStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-media-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-media-css';
  s.textContent = TOAST_CSS;
  document.head.appendChild(s);
}

/** Show a brief auto-dismissing toast in the canvas (e.g. an upload failure). */
export function showCanvasToast(message: string): void {
  if (typeof document === 'undefined') return;
  ensureMediaStyles();
  const el = document.createElement('div');
  el.className = 'dc-media-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.setAttribute('data-show', '1'));
  setTimeout(() => {
    el.setAttribute('data-show', '0');
    setTimeout(() => el.remove(), 200);
  }, 2600);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook

export interface MediaDropCallbacks {
  onImage: (file: File, world: [number, number]) => void;
  onLink: (url: string, title: string, world: [number, number]) => void;
  /**
   * DDR-148 — a video/audio file was dropped. Optional: when omitted, the hook
   * uploads it to `assets/` and toasts a ready-to-use `<Video>`/`<Audio>`
   * snippet (the drop-then-reference flow). A future host can provide this to
   * auto-insert the element into the composition TSX (the deferred slice — the
   * comp-placement question, see DDR-148 open items).
   */
  onMedia?: (file: File, mediaKind: 'video' | 'audio', world: [number, number]) => void;
}

/** The snippet the toast surfaces so the dropped clip is one paste away. */
export function mediaSnippet(mediaKind: 'video' | 'audio', assetPath: string): string {
  if (mediaKind === 'audio') return `<Audio src="${assetPath}" />`;
  return `<Video src="${assetPath}" />`;
}

/**
 * Default media-drop handler: upload the file to the widened asset route, then
 * toast the `assets/…` path + the snippet to paste into the comp. Copies the
 * snippet to the clipboard when available. Exported for reuse/testing.
 */
export async function uploadAndAnnounceMedia(
  file: File,
  mediaKind: 'video' | 'audio'
): Promise<void> {
  const sizeMb = file.size / (1024 * 1024);
  const res = await uploadAsset(file);
  if ('error' in res) {
    showCanvasToast(`Couldn't add ${mediaKind}: ${res.error}`);
    return;
  }
  const snippet = mediaSnippet(mediaKind, res.path);
  try {
    await navigator.clipboard?.writeText(snippet);
  } catch {
    /* clipboard unavailable — the toast still shows the snippet */
  }
  const warn = sizeMb > 20 ? ' · ⚠ >20 MB rides git + sync' : '';
  showCanvasToast(`Added ${res.path}${warn} — snippet copied: ${snippet}`);
}

/** World-px stagger between cascaded drop targets so a batch Finder drop
 * doesn't stack every clip on the exact same point. Exported — the picker's
 * batched "Add as annotation" insert (annotations-layer.tsx) reuses the same
 * stagger so both entry points cascade identically. */
export const BATCH_DROP_CASCADE_PX = 28;

export function useCanvasMediaDrop(opts: {
  enabled: boolean;
  screenToWorld: (cx: number, cy: number) => [number, number];
  callbacks: MediaDropCallbacks;
}): void {
  const { enabled, screenToWorld, callbacks } = opts;
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    ensureMediaStyles();
    const body = document.body;

    const hasMedia = (dt: DataTransfer | null): boolean => {
      if (!dt) return false;
      const types = Array.from(dt.types ?? []);
      return types.includes('Files') || types.includes('text/uri-list');
    };

    const payloadFromTransfer = (dt: DataTransfer): MediaPayload => ({
      files: dt.files ? Array.from(dt.files) : [],
      uriList: safeGet(dt, 'text/uri-list'),
      html: safeGet(dt, 'text/html'),
      plain: safeGet(dt, 'text/plain'),
    });

    const onDragOver = (e: DragEvent) => {
      if (!hasMedia(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      body.classList.add('dc-media-dragover');
    };
    const onDragLeave = (e: DragEvent) => {
      // Only clear when the pointer actually leaves the window (related target
      // null), not when crossing between child elements.
      if (e.relatedTarget == null) body.classList.remove('dc-media-dragover');
    };
    const onDrop = (e: DragEvent) => {
      body.classList.remove('dc-media-dragover');
      if (!e.dataTransfer) return;
      const payload = payloadFromTransfer(e.dataTransfer);
      // A multi-file Finder drop (select N clips → drag) previously fell through
      // classifyMediaPayload's single-intent contract (designed for the
      // drop-carries-both-a-file-and-a-uri-list case) and silently dropped every
      // file past the first — forcing users to drop one at a time. Batch-dispatch
      // every image/video/audio file here; classifyMediaPayload still owns the
      // single-item path (including link/URL drops, which have no "files" list).
      const mediaFiles = payload.files.filter(
        (f) =>
          typeof f.type === 'string' &&
          (f.type.startsWith('image/') ||
            f.type.startsWith('video/') ||
            f.type.startsWith('audio/'))
      );
      if (mediaFiles.length > 1) {
        e.preventDefault();
        const [ox, oy] = screenToWorld(e.clientX, e.clientY);
        mediaFiles.forEach((file, i) => {
          const world: [number, number] = [
            ox + i * BATCH_DROP_CASCADE_PX,
            oy + i * BATCH_DROP_CASCADE_PX,
          ];
          const intent: MediaIntent = file.type.startsWith('image/')
            ? { kind: 'image', file }
            : {
                kind: 'media',
                file,
                mediaKind: file.type.startsWith('video/') ? 'video' : 'audio',
              };
          dispatchIntent(intent, world);
        });
        return;
      }
      const intent = classifyMediaPayload(payload);
      if (!intent) return; // not media — leave the event for other handlers
      e.preventDefault();
      const world = screenToWorld(e.clientX, e.clientY);
      dispatchIntent(intent, world);
    };
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const files: File[] = [];
      if (cd.files) for (const f of Array.from(cd.files)) files.push(f);
      // Some browsers expose pasted images only via items, not files.
      if (cd.items) {
        for (const it of Array.from(cd.items)) {
          if (it.kind === 'file' && it.type.startsWith('image/')) {
            const f = it.getAsFile();
            if (f && !files.includes(f)) files.push(f);
          }
        }
      }
      const intent = classifyMediaPayload({
        files,
        uriList: safeGet(cd, 'text/uri-list'),
        html: safeGet(cd, 'text/html'),
        plain: safeGet(cd, 'text/plain'),
      });
      if (!intent) return; // plain-text paste — let the existing paste flow run
      e.preventDefault();
      // Paste has no pointer position — drop at the visible viewport centre.
      const world = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      dispatchIntent(intent, world);
    };

    const dispatchIntent = (intent: MediaIntent, world: [number, number]) => {
      if (intent.kind === 'image') callbacks.onImage(intent.file, world);
      else if (intent.kind === 'media') {
        if (callbacks.onMedia) callbacks.onMedia(intent.file, intent.mediaKind, world);
        else void uploadAndAnnounceMedia(intent.file, intent.mediaKind);
      } else if (intent.kind === 'link' && isHttpUrl(intent.url)) {
        callbacks.onLink(intent.url, intent.title, world);
      }
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
      body.classList.remove('dc-media-dragover');
    };
  }, [enabled, screenToWorld, callbacks]);
}

function safeGet(dt: DataTransfer, type: string): string {
  try {
    return dt.getData(type) ?? '';
  } catch {
    return '';
  }
}
