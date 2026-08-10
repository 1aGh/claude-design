// figma/endpoints.ts — `/_api/figma/*` orchestration (DDR-216 D2 + D3).
//
// Pure handlers behind the three Figma routes: validate inputs, call the key
// store or the REST client, and shape a `{ status, json }` result. NO HTTP /
// Request dependency — http.ts owns the gating (method · loopback Host ·
// same-origin CSRF · body byte cap) and this module owns orchestration,
// mirroring github/endpoints.ts and git/endpoints.ts.
//
// SECURITY — the three properties this file exists to hold (DDR-216):
//
//   1. MAIN-ORIGIN ONLY, by omission from BOTH CANVAS_SAFE_API (http.ts) and
//      startCanvasServer's `routes` map (server.ts). A canvas-reachable Figma
//      route is simultaneously a token-exfiltration primitive and an SSRF
//      primitive, and canvases run as real unsandboxed JS on a separate origin
//      (DDR-054) — so the gate is that the route does not exist from there.
//      `test/canvas-origin-gate.test.ts` asserts all three 403 at the gate on
//      the canvas origin (403, not 405 — the request never reaches a handler).
//      That is only HALF the property: the MAIN origin is reachable from any
//      page the user visits, so http.ts also applies `isTrustedRequestHost` +
//      `sameOriginWrite` (writes) / `sameOriginRead` (the status GET, where a
//      browser may omit `Origin`). `test/figma-routes.test.ts` owns that half.
//
//   2. THE KEY IS NEVER ECHOED. `connect` returns `{ configured: true }`;
//      `status` returns presence only. Neither reads the stored value back —
//      the same discipline `/_api/generate/keys` states in its own comment, so
//      a proxy or a log between here and the client cannot capture it.
//
//   3. `figma` IS NOT A MEDIA-GENERATION PROVIDER. It produces no Modality and
//      needs no AdapterFactory, so it is deliberately absent from
//      generation/registry.ts; these routes call the key STORE directly. That
//      also keeps ONE write path for the secret — two would be how one of them
//      ends up ungated (DDR-216 D2, a Round-1 security finding).

import { deleteProviderKey, isConfigured, setProviderKey } from '../generation/keys.ts';
import { FigmaApiError, fetchIdentity } from './client.ts';

/** The provider id under which the PAT lives in `~/.config/maude/keys.json`. */
export const FIGMA_PROVIDER_ID = 'figma';

/** Where a user mints one, and the granular scope to ask for. The blanket
 *  `files:read` scope is deprecated — never name it in UI or docs. */
export const FIGMA_TOKEN_URL = 'https://www.figma.com/developers/api#access-tokens';
export const FIGMA_REQUIRED_SCOPE = 'file_content:read';

export interface FigmaEndpointResult {
  status: number;
  json: unknown;
}

/**
 * Figma PATs are opaque, but they are not arbitrary text: bounding the shape
 * here means a paste accident (a whole URL, a JSON blob, a stray newline) fails
 * at the boundary rather than becoming a stored "key" that produces a confusing
 * 401 later. Deliberately permissive on the alphabet and strict on everything
 * structural — printable ASCII only, no whitespace, bounded length.
 */
const TOKEN_SHAPE_RE = /^[!-~]{20,255}$/;

/**
 * `/v1/me` returns a handle we display as "Connected as …". It is
 * upstream-controlled, so it is length- and charset-bounded before it ever
 * reaches client state, and it is NEVER persisted into config.json or any
 * versioned file (DDR-216 D6 sink table).
 */
export function boundDisplayHandle(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._@-]/gu, '')
    .trim()
    .slice(0, 64);
}

export interface FigmaImportRequest {
  url: string;
  mode: 'board' | 'frames' | 'tokens';
  dryRun?: boolean;
}

export interface FigmaEndpoints {
  /** POST — store a PAT. Returns presence only, never the value. */
  connect(body: unknown): FigmaEndpointResult;
  /** DELETE — forget the PAT. */
  disconnect(): FigmaEndpointResult;
  /** GET — presence only. Reveals whether a key exists, never what it is. */
  status(): FigmaEndpointResult;
  /** POST — validate the stored token against `GET /v1/me`. */
  probe(): Promise<FigmaEndpointResult>;
  /** POST — run an import. Same work the CLI verb does, same guarantees. */
  runImport(body: unknown): Promise<FigmaEndpointResult>;
}

/**
 * Validate an import request into a typed shape.
 *
 * Deliberately narrow: a mode from a fixed enum, a URL that `figma/url.ts` will
 * reject if it is not a real Figma URL, and a boolean. No slug, no path, no
 * output location — the caller does not get to choose where anything lands
 * (the same reason DDR-174 has its orchestrator compute the target path rather
 * than letting the producer pick one).
 */
export function parseImportRequest(body: unknown): FigmaImportRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const mode = b.mode;
  if (mode !== 'board' && mode !== 'frames' && mode !== 'tokens') return null;
  if (typeof b.url !== 'string' || b.url.length === 0 || b.url.length > 2048) return null;
  return { url: b.url, mode, dryRun: b.dryRun === true };
}

export interface FigmaEndpointDeps {
  /**
   * Runs the import. Injected so this module stays HTTP- and fs-free (the same
   * split github/endpoints.ts uses) and so the route can be tested without a
   * network. The real implementation is `bin/_import-figma.mjs`.
   */
  runImport?(req: FigmaImportRequest): Promise<{
    summary: Record<string, unknown>;
  }>;
}

export function createFigmaEndpoints(deps: FigmaEndpointDeps = {}): FigmaEndpoints {
  return {
    connect(body: unknown): FigmaEndpointResult {
      if (!body || typeof body !== 'object') {
        return { status: 400, json: { error: 'token required' } };
      }
      const token = (body as Record<string, unknown>).token;
      if (typeof token !== 'string' || !TOKEN_SHAPE_RE.test(token.trim())) {
        // Fixed message — never echoes what was sent (DDR-216 D10).
        return { status: 400, json: { error: 'that does not look like a Figma access token' } };
      }
      try {
        setProviderKey(FIGMA_PROVIDER_ID, token.trim());
      } catch {
        return { status: 400, json: { error: 'could not store the token' } };
      }
      // Presence flag only. Deliberately does NOT read the value back.
      return { status: 200, json: { configured: isConfigured(FIGMA_PROVIDER_ID) } };
    },

    disconnect(): FigmaEndpointResult {
      deleteProviderKey(FIGMA_PROVIDER_ID);
      return { status: 200, json: { configured: false } };
    },

    status(): FigmaEndpointResult {
      return {
        status: 200,
        json: {
          configured: isConfigured(FIGMA_PROVIDER_ID),
          tokenUrl: FIGMA_TOKEN_URL,
          requiredScope: FIGMA_REQUIRED_SCOPE,
        },
      };
    },

    async probe(): Promise<FigmaEndpointResult> {
      try {
        const identity = await fetchIdentity();
        return { status: 200, json: { ok: true, handle: boundDisplayHandle(identity.handle) } };
      } catch (err) {
        if (err instanceof FigmaApiError) {
          // `err.message` is a fixed, code-owned string from MESSAGE_BY_KIND —
          // it carries no upstream text, no header and no token (D2/D10).
          const status = err.kind === 'not_configured' ? 400 : 502;
          return { status, json: { ok: false, reason: err.kind, error: err.message } };
        }
        return {
          status: 502,
          json: { ok: false, reason: 'network', error: 'Figma probe failed.' },
        };
      }
    },

    async runImport(body: unknown): Promise<FigmaEndpointResult> {
      const req = parseImportRequest(body);
      if (!req) return { status: 400, json: { error: 'mode and url are required' } };
      if (!deps.runImport) {
        return { status: 501, json: { error: 'import is not available in this shell' } };
      }
      try {
        const { summary } = await deps.runImport(req);
        // The summary is the SAME code-generated, enum-coded accounting the CLI
        // prints (DDR-216 D7/D10) — node ids and reason codes, never node text.
        // It is safe to hand to a client precisely BECAUSE of that.
        return { status: 200, json: { ok: true, ...summary } };
      } catch (err) {
        if (err instanceof FigmaApiError) {
          return {
            status: err.kind === 'not_configured' ? 400 : 502,
            json: { ok: false, reason: err.kind, error: err.message },
          };
        }
        // Anything else is reported generically — an import failure message must
        // never become a channel for an upstream string (D10).
        return { status: 500, json: { ok: false, reason: 'failed', error: 'Import failed.' } };
      }
    },
  };
}
