// Where a tenant's media lives in the bucket — Cloud Phase 15.
//
// ONE function, imported by both the reader (assets.mjs) and the writer
// (asset-lane.mjs), because the failure mode of them disagreeing is silent:
// the sweep uploads to one key and the proxy 404s on another, and the only
// symptom is a hosted project whose images do not load.
//
// WHY A PREFIX AT ALL. Until Cloud Phase 15 every asset key was
// content-addressed — the name WAS the hash of the bytes — so cells could
// share one flat `assets/` namespace safely: a collision meant identical
// content by definition. Widening the shape to admit a design system's own
// authored files (`graphics/camo-bg.png`, `fonts/Gators-Bold.woff2`) broke
// that property instantly: two tenants both have a `graphics/camo-bg.png`, and
// without scoping the second one to boot overwrites the first one's brand.
//
// So the namespace is scoped per tenant. A self-hosted hub sets no prefix and
// keeps the flat layout it has always had — this is additive, and an existing
// bucket keeps working.

/** Normalize a prefix: no leading or trailing slashes, empty means "none". */
export function normalizePrefix(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

/**
 * The object key for one asset.
 *
 * @param {string} key    the parsed asset path (`deadbeef.png`, `graphics/x.png`)
 * @param {string} prefix tenant scope, or '' for an unscoped (self-hosted) hub
 */
export function assetObjectKey(key, prefix = '') {
  const p = normalizePrefix(prefix);
  return p ? `${p}/assets/${key}` : `assets/${key}`;
}

/** The tenant scope from environment. Empty on a self-hosted hub. */
export function assetPrefixFromEnv(env = process.env) {
  // The cell entrypoint derives this from MAUDE_TENANT_ID, which it has
  // already validated against a strict charset — a traversal or wildcard here
  // would let one cell read or overwrite another tenant's media, which is the
  // single worst failure this system can have.
  const raw = normalizePrefix(env.MAUDE_TENANT_PREFIX ?? '');
  if (!raw) return '';
  if (!/^[a-z0-9][a-z0-9/-]*$/.test(raw)) {
    throw new Error(
      `MAUDE_TENANT_PREFIX must be lowercase alphanumeric with inner hyphens/slashes (got: ${raw})`
    );
  }
  return raw;
}
