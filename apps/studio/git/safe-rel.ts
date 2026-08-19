/**
 * One place that decides whether a relative path is safe to hand to git.
 *
 * WHY A HELPER AND NOT A REGEX PER CALL SITE (F-13 / B12). `designRel` and the
 * per-file rels built on top of it reach git from four directions — the status
 * prefix (`git/endpoints.ts`, `git/watch.ts`), the porcelain filter
 * (`git/service.ts`), and the autocommit staging batch (`sync/autocommit.ts`).
 * Three of those grew their own partial normalisation (`normPrefix` strips
 * slashes and nothing else), and a rule spelled four ways is a rule with three
 * chances to be spelled wrong.
 *
 * WHAT IS AND IS NOT THE RISK HERE, stated plainly so the next reader does not
 * re-derive it:
 *
 *   - **Argv injection is already defused** and this helper is not what defuses
 *     it. Every `runGit` / `run` call that carries a dynamic path puts it after
 *     a `--` separator, so a rel beginning with `-` is a filename to git, not a
 *     flag. The leading-`-` check below is belt-and-braces for a FUTURE call
 *     site that forgets the separator — a cheap guard, not the load-bearing one.
 *   - **Containment is the real risk**, and `--` does nothing about it. A rel
 *     carrying `..` is a perfectly well-formed pathspec that simply names a file
 *     outside the design root: `../../.github/workflows/release.yml` staged by
 *     an autocommit is a repo-wide write primitive reached from a path that is
 *     supposed to be scoped to `.design/`. That is what this refuses.
 *
 * The rules mirror `sync/file-membership.ts`'s `relShape` deliberately — the
 * file plane already refuses exactly these shapes on the way in, and a second
 * gate that disagreed with the first would just be a bug with two spellings.
 */

/** Matches `file-membership.ts` MAX_REL_LEN — the same cap, on purpose. */
export const MAX_GIT_REL_LEN = 512;

/**
 * Is `rel` safe to use as a git pathspec or as a containment prefix?
 *
 * Total: any input that is not a plainly safe repo-relative path is `false`.
 * Never throws, never normalises — callers that want a normalised value use
 * `safeGitPrefix`.
 */
export function isSafeGitRel(rel: unknown): rel is string {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > MAX_GIT_REL_LEN) return false;
  // NUL and other control characters: a NUL truncates the path at the syscall
  // boundary, so `assets/a\0../../x` is two different paths depending on who
  // is looking at it.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing them is the point.
  if (/[\u0000-\u001f\u007f]/.test(rel)) return false;
  // Absolute, Windows-absolute, or backslash-separated — none of these are a
  // repo-relative path, and each reads differently to git than to `path.join`.
  if (rel.startsWith('/') || rel.includes('\\') || /^[A-Za-z]:/.test(rel)) return false;
  // A leading `-` at the START of the whole rel. See the docblock: this is the
  // guard for a future call site that forgets `--`.
  if (rel.startsWith('-')) return false;
  for (const seg of rel.split('/')) {
    if (!seg || seg === '.' || seg === '..') return false;
    // A trailing space is invisible in every UI that would show this path and
    // makes two different files look like one.
    if (/ $/.test(seg)) return false;
  }
  return true;
}

/**
 * Normalise a design-root prefix, or `null` when it is not safe to use.
 *
 * `''` is a legitimate ANSWER, not a refusal: an absent prefix means "no
 * containment filter", which is what `gitStatus` has always done for a caller
 * that passes none. `null` means the caller supplied something and it was
 * refused — a caller must not silently treat that as "no filter", because that
 * would widen the scope rather than narrow it.
 */
export function safeGitPrefix(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') return null;
  const normalised = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (normalised === '') return '';
  return isSafeGitRel(normalised) ? normalised : null;
}

/**
 * Split a batch of rels into the ones git may be handed and the ones it may not.
 *
 * Batch-shaped rather than throw-shaped because the autocommit caller must keep
 * making progress on the rest of a batch: one poisoned path is not a reason to
 * stop committing a person's actual work, and a throw there would wedge the
 * whole queue (the failure mode `partitionForStaging` was written to avoid).
 */
export function partitionSafeGitRels(rels: readonly string[]): {
  safe: string[];
  refused: string[];
} {
  const safe: string[] = [];
  const refused: string[] = [];
  for (const rel of rels) (isSafeGitRel(rel) ? safe : refused).push(rel);
  return { safe, refused };
}
