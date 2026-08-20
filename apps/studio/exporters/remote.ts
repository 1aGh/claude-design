// Remote render dispatch — feature-cloud-export-render-workers (DDR-230).
//
// In a workspace cell the browser-needing exporters cannot run: no browser
// enters the image (DDR-209 A′1, unchanged). What a cell CAN do is resolve the
// export's scope against its own checkout (Target is pure data) and hand the
// fully-resolved job to the `maude-render` service, which holds a Chromium and
// NOTHING ELSE — no HUB_SECRET, no tenant store, no provider keys (DDR-230).
// The service reaches the canvas exactly the way the member's browser does:
// through the public canvas origin, authenticated by the member's own
// short-lived read-only render token, forwarded from the enqueue request.
//
// This module is deliberately dumb: one POST, the artifact (or a typed error)
// back. Progress is coarse in v1 — queued → running → done; the per-frame
// stream stays a local-lane feature until the service grows a progress channel.

import path from 'node:path';

import type { ExportDegradation } from './degraded.ts';
import type { ExportOptions, ExportResult, Format } from './index.ts';
import type { Target } from './scope.ts';

// The render service is the fleet's LEAST-trusted process (DDR-230 — it is the
// one place tenant TSX is evaluated in Chromium). Everything crossing back from
// it is untrusted, so its response is sanitized at THIS boundary before it
// reaches disk or the job record — security-review defender findings, 2026-08-21.

/**
 * Cap on the artifact a render worker may return — a hostile one must not OOM
 * the cell. Read per-call (not a module const) so the deployment can tune it
 * and tests can exercise the ceiling.
 */
function artifactCap(): number {
  return Math.max(
    1_000_000,
    Number(process.env.MAUDE_RENDER_MAX_ARTIFACT_BYTES) || 512 * 1024 * 1024
  );
}

/**
 * Reduce whatever the render service put in `x-maude-filename` to a safe
 * basename. This value has TWO untrusted sinks (security-review): it lands in
 * `Bun.write(path.join(jobsDir, id, name), …)` (jobs.ts), so `../../…` is an
 * arbitrary-path write; and it is reflected into a `Content-Disposition:
 * attachment; filename="…"` header (http.ts), so a quote or CR/LF is header
 * injection. A strict allowlist charset closes BOTH: keep only letters, digits,
 * dot, dash, underscore — drop everything else (separators, quotes, control
 * chars) — then reject a name that is only dots.
 */
function safeArtifactName(raw: string | null, format: Format): string {
  const fallback = `export.${format === 'canva' ? 'zip' : format}`;
  if (!raw) return fallback;
  const base = path.basename(raw).replace(/[^A-Za-z0-9._-]/g, '');
  if (!base || /^\.+$/.test(base)) return fallback;
  return base.slice(0, 255);
}

/** Read a response body with a hard byte ceiling — `arrayBuffer()` has none. */
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    throw new Error(`render artifact too large (${declared} bytes > ${max})`);
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new Error(`render artifact exceeded ${max} bytes mid-stream`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Formats that never touch a browser. `zip` is JSZip over project files — it
 * runs in-cell in every lane. Everything else captures through the Playwright
 * spine and must dispatch (or refuse) in a workspace.
 */
export const BROWSER_FREE_FORMATS: ReadonlySet<Format> = new Set<Format>(['zip']);

export function formatNeedsBrowser(format: Format): boolean {
  return !BROWSER_FREE_FORMATS.has(format);
}

/**
 * Formats the render service cannot produce: `canva` bundles PNG captures WITH
 * project files (CSV, README, sources), and the service holds no tenant store
 * to read them from (DDR-230 §1). In a workspace these refuse with a
 * use-the-desktop remedy on BOTH the `remote` and `none` lanes.
 */
export const REMOTE_UNSUPPORTED_FORMATS: ReadonlySet<Format> = new Set<Format>(['canva']);

export const REMOTE_UNSUPPORTED_MESSAGE =
  'Canva handoff bundles project files the render service can’t reach — export it from the desktop app.';

/** Where the render service lives, from the cell/hub environment (T6 wiring). */
export interface RenderService {
  /** `MAUDE_RENDER_URL` — origin of the maude-render service. */
  url: string;
  /** `MAUDE_RENDER_SECRET` — shared ingress bearer. Never a hub secret. */
  secret: string;
}

/** How the render service reaches the tenant's canvas — the member's own grant. */
export interface RemoteCanvasAccess {
  /** PUBLIC canvas origin (what the member's browser iframes load from). */
  origin: string;
  /** The member's render token (x-maude-canvas-token), forwarded verbatim. */
  token?: string;
  /** designRoot-relative tokens CSS path (`?tokens=` on the shell URL). */
  tokensCssRel?: string;
  /** designRoot-relative shared components CSS path, when the DS has one. */
  componentsCssRel?: string;
}

export function resolveRenderService(env: NodeJS.ProcessEnv = process.env): RenderService | null {
  const url = env.MAUDE_RENDER_URL;
  if (!url) return null;
  return { url: url.replace(/\/+$/, ''), secret: env.MAUDE_RENDER_SECRET ?? '' };
}

/** The message a lane-`none` refusal carries — surfaced verbatim in the job UI. */
export const NO_RENDER_SERVICE_MESSAGE =
  'This format needs the render service, which this workspace doesn’t have configured. ' +
  'ZIP still works here; for rendered formats use the desktop app, or add the maude-render ' +
  'service (see the self-hosting docs).';

export class NoRenderServiceError extends Error {
  constructor() {
    super(NO_RENDER_SERVICE_MESSAGE);
    this.name = 'NoRenderServiceError';
  }
}

/**
 * POST one fully-resolved export job to the render service and return the
 * artifact as a normal `ExportResult`. Degradation travels back as a JSON
 * header rather than a wrapped body so the artifact bytes stream unmodified.
 */
export async function renderRemotely(args: {
  format: Format;
  targets: Target[];
  options: ExportOptions;
  canvas: RemoteCanvasAccess;
  service: RenderService;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const { format, targets, options, canvas, service, signal } = args;
  const res = await fetch(`${service.url}/render`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${service.secret}`,
    },
    body: JSON.stringify({ format, targets, options, canvas }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')) || `${res.status}`;
    throw new Error(`render service refused the job: ${detail}`);
  }
  // Sanitize the filename BEFORE it can reach `Bun.write` in jobs.ts — the
  // service is untrusted (DDR-230), and this header would otherwise choose the
  // write path.
  const filename = safeArtifactName(res.headers.get('x-maude-filename'), format);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  let degraded: ExportDegradation | undefined;
  const degradedHeader = res.headers.get('x-maude-degraded');
  if (degradedHeader) {
    try {
      degraded = JSON.parse(degradedHeader) as ExportDegradation;
    } catch {
      /* a malformed degradation note must not fail a real artifact */
    }
  }
  const body = await readCapped(res, artifactCap());
  return { filename, contentType, body, ...(degraded ? { degraded } : {}) };
}
