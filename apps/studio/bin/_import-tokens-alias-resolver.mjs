// _import-tokens-alias-resolver.mjs — DDR-172 Decision 2: whole-value-only
// alias resolution.
//
// PURE MODULE, NO I/O. This file must never import `fs`/`node:fs`,
// `net`/`node:net`, `http(s)`/`node:http(s)`, `dns`/`node:dns`,
// `child_process`/`node:child_process`, and must never reference the global
// `fetch`/`XMLHttpRequest` — apps/studio/test/import-tokens.test.ts asserts
// this by grepping this file's own source, not by trusting this comment
// (DDR-172's own lesson, quoting DDR-167: "policy prose alone is exactly the
// failure mode this codebase has already hit once"). This is what makes "the
// resolver never dereferences a path/URL" an ENFORCED invariant rather than
// an intention a later refactor (e.g. someone "helpfully" adding real
// `$ref`-file support) could silently violate.
//
// Only WHOLE-VALUE single-alias substitution is resolved — a value must,
// once trimmed, be ENTIRELY one `{group.token.path}` reference. A value that
// merely *contains* a `{...}` span alongside other text (`"{a} solid"`,
// `"{a} {b}"`) is NOT alias syntax at all here; it is returned unresolved, as
// literal text, so the caller's grammar validation rejects it (no grammar
// admits `{`/`}`). This gives each token AT MOST ONE outgoing alias edge,
// which structurally caps total resolution work at O(tokens × maxDepth)
// regardless of fan-out or a real Style-Dictionary "{a} {a}"-style
// multi-reference doubling bomb — neither a branching term nor a doubling
// term is reachable by construction, not merely bounded by a budget.

const WHOLE_VALUE_ALIAS_RE = /^\{([^{}]+)\}$/;

export class AliasResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {Record<string, string>} tokens - `Object.create(null)` map of
 *   flattened token path -> raw (pre-alias) value. Non-string values are
 *   passed through unresolved (only strings can be whole-value aliases).
 * @param {{ maxDepth?: number }} [opts]
 * @returns {{ resolved: Record<string, unknown>, statuses: Record<string, string> }}
 *   `resolved[path]` is the alias-resolved literal for every token that
 *   resolved cleanly (including non-aliased passthroughs). `statuses[path]`
 *   is set ONLY for tokens that did NOT resolve — `'unresolved-alias'`,
 *   `'circular-alias'`, or `'alias-chain-too-deep'` — the caller reports
 *   these, never guesses a value for them.
 */
export function resolveAliases(tokens, { maxDepth = 16 } = {}) {
  const resolved = Object.create(null);
  const statuses = Object.create(null);

  function resolveOne(path, chain) {
    if (path in resolved) return resolved[path];
    if (path in statuses) return undefined;
    const raw = tokens[path];
    if (typeof raw !== 'string') {
      resolved[path] = raw;
      return raw;
    }
    const m = WHOLE_VALUE_ALIAS_RE.exec(raw.trim());
    if (!m) {
      resolved[path] = raw;
      return raw;
    }
    const targetPath = m[1].trim();
    if (chain.has(targetPath) || targetPath === path) {
      statuses[path] = 'circular-alias';
      return undefined;
    }
    if (chain.size + 1 >= maxDepth) {
      statuses[path] = 'alias-chain-too-deep';
      return undefined;
    }
    if (!(targetPath in tokens)) {
      statuses[path] = 'unresolved-alias';
      return undefined;
    }
    const nextChain = new Set(chain);
    nextChain.add(path);
    const val = resolveOne(targetPath, nextChain);
    if (val === undefined) {
      // Target itself failed to resolve — propagate the SAME failure reason
      // rather than inventing a new one, but only if this token doesn't
      // already have its own status set.
      if (!(path in statuses)) statuses[path] = statuses[targetPath] || 'unresolved-alias';
      return undefined;
    }
    resolved[path] = val;
    return val;
  }

  for (const path of Object.keys(tokens)) {
    if (!(path in resolved) && !(path in statuses)) resolveOne(path, new Set());
  }
  return { resolved, statuses };
}
