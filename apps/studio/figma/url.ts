/**
 * @file       figma/url.ts — Figma URL/key parsing (DDR-216 D4, chokepoint 1).
 * @scope      apps/studio/figma/url.ts
 * @purpose    Turn whatever the user pasted into `{ fileKey, nodeId?, surface }`
 *             — and reject everything else.
 *
 * @invariant  THIS IS A REJECTION SURFACE, NOT A CONVENIENCE PARSER.
 *             **The host is never taken from the input.** Nothing this module
 *             returns contributes a scheme, host, port or path prefix to a
 *             request; `client.ts` composes every URL from its own hardcoded
 *             base plus the charset-validated values below. That is what closes
 *             the request-construction SSRF class outright (DDR-216 D4) — the
 *             one closure Round 1 of the security review attacked directly and
 *             could not break, so keep the property, not just the code.
 *
 * @invariant  DEPENDENCY-FREE. No `node:*`, no network, no filesystem. Pure
 *             string work, so it is trivially testable and has no way to
 *             dereference anything it parses (the DDR-172 Decision 2 discipline,
 *             applied to a URL parser instead of an alias resolver).
 */

/** The four public Figma URL shapes carry the surface in the path segment. */
export type FigmaSurface = 'design' | 'board';

export interface FigmaTarget {
  /** Charset-validated document key — safe to interpolate into a path segment. */
  fileKey: string;
  /** Normalized `123:456` node id, when the URL carried one. */
  nodeId?: string;
  /**
   * Which editor authored the document. `design` → frames/tokens translators,
   * `board` → the FigJam stroke translator. `/file/` and `/proto/` are legacy
   * design-side shapes and normalize to `design`.
   */
  surface: FigmaSurface;
}

export class FigmaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigmaUrlError';
  }
}

/**
 * Document keys are opaque base62-ish tokens. The bound is deliberately tight:
 * every character admitted here is one that cannot change the meaning of a URL
 * path segment, so a key can never introduce `/`, `.`, `@`, `#`, `?`, `:` or a
 * percent-escape. Length floor rejects a stray fragment; ceiling rejects a
 * pasted blob.
 */
const FILE_KEY_RE = /^[A-Za-z0-9]{10,64}$/;

/** Figma node ids are always `<number>:<number>` once normalized from `a-b`. */
const NODE_ID_RE = /^[0-9]{1,10}:[0-9]{1,10}$/;

/** Path segment → surface. Anything else is not a document URL we understand. */
const SURFACE_BY_SEGMENT: Readonly<Record<string, FigmaSurface>> = Object.assign(
  Object.create(null),
  {
    design: 'design',
    board: 'board',
    file: 'design', // legacy design URLs
    proto: 'design', // prototype view of a design file
  }
);

/**
 * Hosts we accept a URL *from*. This is a parse-time sanity check on
 * user-pasted input — NOT the egress control. The egress control is that
 * `client.ts` ignores this host entirely and uses its own constant base
 * (DDR-216 D4). Kept strict anyway so a pasted look-alike fails loudly at the
 * point the user can still see what they pasted.
 */
function isFigmaHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'figma.com' || h.endsWith('.figma.com');
}

/**
 * `node-id` arrives URL-encoded as `123-456` (and historically as `123%3A456`).
 * The API wants `123:456`. Anything that doesn't normalize to exactly that
 * shape is dropped rather than guessed — a malformed node id means "import the
 * whole file", never "import some other node".
 */
export function normalizeNodeId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const candidate = raw.trim().replace(/-/g, ':');
  return NODE_ID_RE.test(candidate) ? candidate : undefined;
}

/**
 * Parse a pasted Figma URL or a bare document key.
 *
 * Accepts:
 *   https://www.figma.com/design/<key>/<slug>?node-id=1-2
 *   https://figma.com/board/<key>/<slug>
 *   https://www.figma.com/file/<key>/…   (legacy)
 *   https://www.figma.com/proto/<key>/…
 *   <key>                                 (bare, surface defaults to `design`)
 *
 * Rejects — with a fixed, input-free message — everything else, including
 * userinfo-in-host (`https://api.figma.com@evil.tld/…`), non-figma hosts, IDN
 * look-alikes, `..`/percent-escaped traversal in the key position, non-https
 * schemes, and over-length input.
 */
export function parseFigmaTarget(
  input: string,
  defaultSurface: FigmaSurface = 'design'
): FigmaTarget {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) throw new FigmaUrlError('empty Figma URL or file key');
  // Bound the input before any parsing — a URL this long is not a real one, and
  // it keeps every regex below linear on a fixed budget.
  if (raw.length > 2048) throw new FigmaUrlError('Figma URL is too long');

  // Bare key — the shortest path, and the one that cannot carry a host at all.
  if (FILE_KEY_RE.test(raw)) return { fileKey: raw, surface: defaultSurface };

  // Anything that isn't a bare key must be a URL. Parse with the platform
  // parser rather than a regex: `URL` resolves userinfo, percent-escapes, IDN
  // and backslash quirks the same way a browser would, so the host we then
  // check is the host a browser would actually connect to. A hand-rolled regex
  // is exactly how `https://api.figma.com@evil.tld/` gets misread.
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FigmaUrlError('not a valid Figma URL or file key');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new FigmaUrlError('Figma URL must be http(s)');
  }
  // `URL` puts userinfo in `username`/`password`, never in `hostname` — so this
  // check is what makes `https://api.figma.com@evil.tld/…` fail rather than
  // silently resolving to `evil.tld`.
  if (url.username || url.password) {
    throw new FigmaUrlError('Figma URL must not carry credentials');
  }
  if (!isFigmaHost(url.hostname)) {
    throw new FigmaUrlError('not a figma.com URL');
  }

  // `url.pathname` keeps percent-encoding intact (the parser resolves literal
  // `..` segments but never decodes `%2e%2e`/`%2f`), so validating each segment
  // against a charset that excludes `%` rejects both forms: a resolved `..`
  // cannot produce a key-shaped segment, and an encoded one still carries `%`.
  const segments = url.pathname.split('/').filter((s) => s.length > 0);
  if (segments.length < 2) throw new FigmaUrlError('Figma URL carries no document key');

  const surface = SURFACE_BY_SEGMENT[segments[0].toLowerCase()];
  if (!surface) throw new FigmaUrlError('unrecognized Figma URL shape');

  const fileKey = segments[1];
  if (!FILE_KEY_RE.test(fileKey)) throw new FigmaUrlError('Figma document key is not valid');

  const nodeId = normalizeNodeId(url.searchParams.get('node-id'));
  return nodeId ? { fileKey, nodeId, surface } : { fileKey, surface };
}
