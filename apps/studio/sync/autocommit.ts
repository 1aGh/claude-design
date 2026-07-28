// Autosave → append-only git commits — Cloud Phase 3 Task 1.
//
// On a laptop, autosave writing a file IS the save: the developer's own git is
// the history, and they commit when they mean to. In a workspace cell there is
// no developer at the keyboard, so an unwritten history means the only record
// of a design is its current bytes — one bad sync away from unrecoverable.
//
// So the cell commits. Three rules make that safe rather than merely noisy:
//
//   1. APPEND-ONLY. `git add` + `git commit`, ever. No amend, no rebase, no
//      reset, no `checkout --` over a dirty tree, and NEVER a force-push. The
//      history is allowed to be ugly; it is not allowed to lose a state that
//      once existed.
//   2. AUTHORSHIP IS THE EDITING HUMAN. git separates author from committer
//      precisely for this: the author is the person whose edit this was (from
//      presence), the committer is the workspace bot. `git blame` then answers
//      "who designed this" instead of "the server did", which is the whole
//      reason to keep history at all.
//   3. QUIESCENCE, NOT KEYSTROKES. Commits fire after edits stop, so a typing
//      session is one commit rather than four hundred.
//
// The disk write has ALREADY happened by the time anything here runs. A git
// failure therefore never loses work — it leaves the change uncommitted and
// retries on the next quiescence. That ordering is deliberate: making the
// commit a precondition of the save would turn a transient git error into
// data loss, which is precisely backwards.

import path from 'node:path';

/** How long the tree must be quiet before a commit fires. */
const DEFAULT_DEBOUNCE_MS = 3000;

export interface GitRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Injected so tests drive a real repo and callers can swap the runner. */
export type GitRunner = (args: string[], opts: { cwd: string }) => Promise<GitRunResult>;

export interface EditAttribution {
  /** Display name from presence, e.g. "Alice Novak". */
  name: string;
  /** Address from presence, or a synthesized stable one. */
  email: string;
}

export interface AutoCommitOptions {
  repoRoot: string;
  run: GitRunner;
  /** Quiescence window. */
  debounceMs?: number;
  /** Committer identity — the machine, never the human. */
  bot?: EditAttribution;
  log?: Pick<Console, 'warn' | 'error' | 'log'>;
}

export interface AutoCommit {
  /**
   * Record that `relPath` changed, attributed to `who`. Repeated calls within
   * the debounce window coalesce into one commit.
   */
  note(relPath: string, who?: EditAttribution | null): void;
  /** Force the pending commit now (branch switch, shutdown). */
  flush(): Promise<CommitOutcome | null>;
  /** Pending paths, for tests + status surfaces. */
  pending(): string[];
  stop(): void;
}

export type CommitOutcome =
  | { ok: true; sha: string; files: string[]; author: EditAttribution }
  | { ok: false; reason: 'nothing-to-commit' | 'git-failed'; detail?: string; files: string[] };

const DEFAULT_BOT: EditAttribution = {
  name: 'Maude Workspace',
  email: 'workspace@maude.local',
};

/**
 * Attribution for an edit whose author we don't know.
 *
 * Deliberately NOT the bot: attributing an anonymous human's work to the server
 * makes `git blame` lie in a way that is hard to notice later. "Unknown" is
 * honest, and it is visibly wrong in a way that prompts a fix.
 */
export const UNKNOWN_AUTHOR: EditAttribution = {
  name: 'Unknown editor',
  email: 'unknown@maude.local',
};

/**
 * Sanitize a presence-supplied identity before it reaches a git argument.
 *
 * Presence comes from peers over the hub, which is semi-trusted (DDR-054): a
 * name is attacker-influenceable text. Newlines are the specific hazard —
 * `git commit --author` takes `Name <email>`, and an embedded newline could
 * forge trailer lines in the commit message. Everything is passed as argv (no
 * shell), so this is about the git format, not shell quoting.
 */
export function sanitizeAttribution(who: EditAttribution | null | undefined): EditAttribution {
  if (!who) return UNKNOWN_AUTHOR;
  const clean = (s: string, fallback: string) => {
    const out = String(s ?? '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point.
      .replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 96);
    return out || fallback;
  };
  return {
    name: clean(who.name, UNKNOWN_AUTHOR.name),
    email: clean(who.email, UNKNOWN_AUTHOR.email),
  };
}

/** `Name <email>` as git's `--author` wants it. */
export function formatAuthor(who: EditAttribution): string {
  const s = sanitizeAttribution(who);
  return `${s.name} <${s.email}>`;
}

/**
 * Commit subject. Names WHAT changed rather than "autosave", because a history
 * of four hundred identical subjects is the same as no history.
 */
export function commitMessage(files: string[], who: EditAttribution): string {
  // Strip from the FIRST dot, not the last: `Screen.tsx` and `Screen.meta.json`
  // are one canvas, and counting them as two would make every commit subject
  // overstate what changed.
  const canvases = [...new Set(files.map((f) => path.basename(f).replace(/\..*$/, '')))].sort();
  const subject =
    canvases.length === 1
      ? `design: update ${canvases[0]}`
      : `design: update ${canvases.length} canvases`;
  const body = [
    '',
    canvases.length > 1 ? canvases.map((c) => `- ${c}`).join('\n') : '',
    '',
    `Edited by ${who.name} <${who.email}> via the Maude workspace.`,
    'Autosaved — append-only; this history is never rewritten.',
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n');
  return `${subject}\n${body}`;
}

export function createAutoCommit(opts: AutoCommitOptions): AutoCommit {
  const {
    repoRoot,
    run,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    bot = DEFAULT_BOT,
    log = console,
  } = opts;

  const touched = new Set<string>();
  let author: EditAttribution | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<CommitOutcome | null> | null = null;
  let stopped = false;

  function note(relPath: string, who?: EditAttribution | null): void {
    if (stopped) return;
    touched.add(relPath);
    // Last writer wins for attribution. A commit that coalesced two people's
    // edits can only name one author; the message body names them, and the
    // alternative (splitting per author) would fight the quiescence batching
    // that keeps this history readable.
    if (who) author = who;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  async function flush(): Promise<CommitOutcome | null> {
    if (inFlight) return inFlight;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (touched.size === 0) return null;

    const files = [...touched].sort();
    const who = sanitizeAttribution(author);
    touched.clear();
    author = null;

    inFlight = (async (): Promise<CommitOutcome> => {
      try {
        // Stage ONLY what changed. `git add -A` in a workspace would sweep in
        // whatever else is in the tree — including files a future feature drops
        // there — and the cell must never commit something it wasn't told about.
        const add = await run(['add', '--', ...files], { cwd: repoRoot });
        if (add.code !== 0) {
          log.warn?.(`[autocommit] git add failed: ${add.stderr.trim()}`);
          return { ok: false, reason: 'git-failed', detail: add.stderr.trim(), files };
        }

        // Nothing staged ⇒ the write was a no-op (an echo, or identical bytes).
        // Not an error, and committing an empty change would be noise.
        const staged = await run(['diff', '--cached', '--name-only'], { cwd: repoRoot });
        if (staged.code === 0 && staged.stdout.trim() === '') {
          return { ok: false, reason: 'nothing-to-commit', files };
        }

        const commit = await run(
          [
            '-c',
            `user.name=${bot.name}`,
            '-c',
            `user.email=${bot.email}`,
            'commit',
            '--author',
            formatAuthor(who),
            '--only',
            '--message',
            commitMessage(files, who),
            '--',
            ...files,
          ],
          { cwd: repoRoot }
        );
        if (commit.code !== 0) {
          log.warn?.(`[autocommit] git commit failed: ${commit.stderr.trim()}`);
          // The bytes are on disk. Re-queue so the next quiescence retries
          // rather than silently dropping the change from history.
          for (const f of files) touched.add(f);
          return { ok: false, reason: 'git-failed', detail: commit.stderr.trim(), files };
        }

        const head = await run(['rev-parse', 'HEAD'], { cwd: repoRoot });
        const sha = head.stdout.trim();
        log.log?.(`[autocommit] ${sha.slice(0, 8)} ${files.length} file(s) by ${who.name}`);
        return { ok: true, sha, files, author: who };
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  return {
    note,
    flush,
    pending: () => [...touched].sort(),
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Push to a mirror remote, refusing anything that would rewrite it.
 *
 * A cell that force-pushes destroys work that exists only on the remote —
 * exactly the hazard DDR-119 was written about, arriving from the other
 * direction. On rejection the correct behaviour is to STOP and surface it, not
 * to "resolve" it: a non-fast-forward means someone else's commits are there,
 * and the cell has no way to know whether merging them is right.
 */
export async function pushMirror({
  repoRoot,
  run,
  remote = 'origin',
  branch,
  log = console,
}: {
  repoRoot: string;
  run: GitRunner;
  remote?: string;
  branch: string;
  log?: Pick<Console, 'warn'>;
}): Promise<{ ok: boolean; rejected: boolean; detail?: string }> {
  // No --force, no --force-with-lease, no +refspec. If this ever needs one,
  // that is a design conversation, not a flag.
  const res = await run(['push', remote, `refs/heads/${branch}:refs/heads/${branch}`], {
    cwd: repoRoot,
  });
  if (res.code === 0) return { ok: true, rejected: false };
  const detail = `${res.stderr}\n${res.stdout}`.trim();
  const rejected = /\brejected\b|non-fast-forward|fetch first/i.test(detail);
  if (rejected) {
    log.warn?.(
      '[autocommit] mirror push REJECTED — someone else saved first. Stopping rather than ' +
        'rewriting their work; the local history is intact and nothing was lost.'
    );
  }
  return { ok: false, rejected, detail };
}
