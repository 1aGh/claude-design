// The shape of a History row — the one answer both committers produce.
//
// A commit row is drawn by the same `GitPanel` renderer whether it came from
// the desktop's own repo (`git/service.ts` → `/_api/git/log`) or from the cloud
// cell that owns a linked project's history (`apps/hub/src/history.mjs` →
// `/api/history`). Two spellings of "how a log line is asked for and parsed" is
// how a cloud row and a local row come to differ in a field the renderer reads
// — and the drift would surface as a blank author or an unparseable date on ONE
// of the two surfaces, which is precisely the class of bug nobody notices until
// the surface they don't use every day is the one that matters.
//
// ONE COPY, TWO RUNTIMES (the `apps/hub/Dockerfile` rule). The hub imports this
// file rather than re-typing it in `.mjs`, exactly as it does for
// `sync/autocommit.ts`, `sync/canvas-path.ts` and `cloud/mirror.mjs`: re-typing
// a guarantee is re-typing it without its tests. Hence React-free and
// dependency-free — no `node:*`, nothing a plain-Node hub or a bun-compiled
// sidecar has to resolve.

/** One commit, as every History surface renders it. */
export interface GitLogRecord {
  sha: string;
  message: string;
  author: string;
  email: string;
  /** ISO-8601 commit date. */
  date: string;
}

/**
 * Unit-separator field delimiter, record-separator line delimiter — survives
 * any message punctuation (a commit subject may contain newlines, tabs, quotes
 * and every separator a "sensible" format would have picked).
 */
export const GIT_LOG_FORMAT = '%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e';

/**
 * `git log` argv for `limit` commits, optionally scoped to one `filepath`.
 *
 * The `--` terminator makes `filepath` strictly positional — git can't read it
 * as an option (no argument injection even if it began with a dash, which the
 * caller's containment validation already rejects upstream).
 *
 * THE CALLER MUST ALSO SET `GIT_LITERAL_PATHSPECS=1` whenever `filepath` is
 * present — see `gitLogEnv`. That hardening is a recorded phase-27.1 security
 * re-review outcome, and it lives beside the argv precisely so a second call
 * site cannot pick up one half of the pair.
 */
export function gitLogArgs(limit: number, filepath?: string): string[] {
  const args = ['log', `-n${limit}`, `--pretty=format:${GIT_LOG_FORMAT}`];
  if (filepath) args.push('--', filepath);
  return args;
}

/**
 * The env `gitLogArgs`'s output must run under, or undefined when unscoped.
 *
 * GIT_LITERAL_PATHSPECS — match `filepath` VERBATIM, never as pathspec magic
 * (`:(top)`, `:(exclude)`, globs). Callers already restrict it to the design
 * tree; this makes system-git treat it as a plain path regardless, closing the
 * pathspec-magic surface the `--` terminator alone doesn't.
 */
export function gitLogEnv(filepath?: string): { GIT_LITERAL_PATHSPECS: '1' } | undefined {
  return filepath ? { GIT_LITERAL_PATHSPECS: '1' } : undefined;
}

/**
 * Parse `git log --pretty=format:GIT_LOG_FORMAT` stdout into records.
 *
 * Total and forgiving in one direction only: a record short of its five fields
 * yields empty strings rather than `undefined`, so a renderer never has to
 * defend against a half-parsed row. Garbage in is an empty list, never a throw.
 */
export function parseGitLog(stdout: string): GitLogRecord[] {
  return String(stdout ?? '')
    .split('\x1e')
    .map((rec) => rec.replace(/^\n/, '').trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, message, author, email, date] = rec.split('\x1f');
      return {
        sha: sha ?? '',
        message: message ?? '',
        author: author ?? '',
        email: email ?? '',
        date: date ?? '',
      };
    });
}
