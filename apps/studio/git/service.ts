// Phase 27 (epic E2) — git service for the in-UI git-awareness layer.
//
// Wraps `isomorphic-git` (DDR-107) so the `/_api/git/*` endpoints can answer the
// non-technical persona's only real question — "what have I changed, and how do
// I Save / Publish / Get latest?" — WITHOUT a terminal. Vocabulary is enforced at
// the UI layer (Save version=commit · Publish=push · Get latest=pull · History=
// log); this module speaks plain git internally and never leaks the words.
//
// Two engines, one surface (Task 3 gotcha):
//   • DEFAULT — pure-JS isomorphic-git. Zero system-git dependency, so a managed
//     clone works on a machine without git installed (the non-technical default).
//   • MAUDE_USE_SYSTEM_GIT=1 — shell out to the `git` binary via Bun.spawn (the
//     api.ts gitCurrentUser pattern). For users who prefer their configured
//     credential helper / SSH agent over a request-body token.
//
// `dir` is the git WORKING DIRECTORY (the repo root that holds `.git`), NOT the
// designRoot. For a managed Maude project (DDR-111) the cloned repo IS the
// project, so dir === repoRoot. A `designPrefix` (the designRoot's path relative
// to the repo, e.g. ".design") scopes status/diff to the user's design files so
// unrelated repo churn never shows up in the non-technical Changes panel.
//
// SECURITY: the GitHub token reaches gitPush/gitPull as an argument and is used
// ONLY for the isomorphic-git `onAuth` callback (or the system-git remote URL).
// It is NEVER logged, persisted, or written to `_server.json`. The endpoint layer
// (http.ts) keeps it main-origin-only + loopback-only (DDR-054 / DDR-109).

import { spawn } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';

const USE_SYSTEM_GIT = /^(1|true|on|yes)$/i.test(process.env.MAUDE_USE_SYSTEM_GIT ?? '');

/** One changed file as the Changes panel renders it. `status` maps to the M/A/D/U
 *  badge (DDR-075 status hues): modified→M, added→A, deleted→D, untracked→U. */
export type GitFileState = 'modified' | 'added' | 'deleted' | 'untracked';

export interface GitFileStatus {
  /** Path relative to the git working dir, forward-slashed (e.g. `.design/ui/Pricing v3.tsx`). */
  path: string;
  status: GitFileState;
}

export interface GitStatusResult {
  /** False when `dir` is not inside a git repo — the UI shows the "not versioned yet" state. */
  repo: boolean;
  branch: string | null;
  files: GitFileStatus[];
  clean: boolean;
  /** LOCAL count of saved versions not yet published (commits ahead of the
   *  remote-tracking ref) — computed with NO network, so the panel can offer
   *  Publish even when the working tree is clean. 0 = up to date / no remote. */
  unpushed: number;
  /** Populated only when a remote check was requested (token given + `checkRemote`). */
  ahead?: number;
  behind?: number;
  remoteAhead?: boolean;
}

export interface GitStatusOpts {
  /** Scope status to files under this repo-relative prefix (the designRoot). Omit = whole repo. */
  designPrefix?: string;
  /** When true AND `token` given, fetch the tracking remote and compute ahead/behind. */
  checkRemote?: boolean;
  token?: string;
  remote?: string;
}

export interface GitCommitResult {
  ok: boolean;
  sha?: string;
  error?: string;
}

export interface GitPushResult {
  ok: boolean;
  /** True when the remote rejected a non-fast-forward push — the only Publish conflict. */
  conflict?: boolean;
  /** True when the operation needs a GitHub sign-in we don't have yet (phase-28
   *  keychain). The iso-git engine can't use a system credential helper, so a
   *  tokenless publish on the default engine lands here → "Sign in to publish". */
  authRequired?: boolean;
  error?: string;
}

export interface GitPullResult {
  ok: boolean;
  /** True when the merge hit a real content conflict; `files` lists the conflicted paths. */
  conflict?: boolean;
  files?: string[];
  /** See GitPushResult.authRequired. */
  authRequired?: boolean;
  error?: string;
}

export interface GitLogEntry {
  sha: string;
  message: string;
  author: string;
  email: string;
  /** ISO-8601 commit date. */
  date: string;
}

export interface GitDiffEntry {
  file: string;
  before: string;
  after: 'workdir';
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Resolve the `.git` dir for `dir`, or null if `dir` isn't in a git repo. We
 *  only support a `.git` directly at `dir` (the managed-clone layout, DDR-111) —
 *  no walk-up, so a `.design/` nested in a larger repo doesn't accidentally
 *  surface the parent repo's unrelated history. */
function isRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}

/** Normalize a status-matrix prefix: strip leading/trailing slashes, forward-slash. */
function normPrefix(p?: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function underPrefix(filepath: string, prefix: string): boolean {
  if (!prefix) return true;
  return filepath === prefix || filepath.startsWith(`${prefix}/`);
}

/** Maude's own runtime/state files under the design root — NEVER user design
 *  content. They must never surface in the Changes panel nor be swept up by a
 *  "Save all" commit. Mirrors fs-watch.ts's exclusions + the isCanvasSafeRoute
 *  `_`-segment convention (server.json/active.json/sync.json + _history/_trash/…).
 *  A real managed project also gitignores these (DDR-056); this is the backstop
 *  for a project that lacks the gitignore block. `_comments`/`_annotations` are
 *  deliberately NOT excluded — they're versionable collab content. */
function isMaudeRuntimeState(p: string): boolean {
  return (
    /(^|\/)_(?:server|active|sync|preflight)\.json$/.test(p) ||
    /(^|\/)_server\.lock$/.test(p) ||
    /(^|\/)_(?:history|trash|draw|smoke)(?:\/|$)/.test(p)
  );
}

/** Map an isomorphic-git statusMatrix row [head, workdir, stage] → our state, or
 *  null when the file is unmodified (so it's dropped from the Changes list).
 *  head:  0 absent in HEAD, 1 present.
 *  workdir: 0 absent, 1 == HEAD, 2 differs.
 *  stage: 0 absent, 1 == HEAD, 2 == workdir, 3 differs from both. */
function classify(head: number, workdir: number, _stage: number): GitFileState | null {
  if (head === 0 && workdir === 0) return null; // never existed / fully removed-and-staged-away
  if (head === 1 && workdir === 0) return 'deleted'; // tracked, now gone
  if (head === 0 && workdir === 2) {
    // New file. "Added" once git has it staged; otherwise brand-new "untracked".
    return _stage === 0 ? 'untracked' : 'added';
  }
  if (head === 1 && workdir === 1) return null; // identical to HEAD
  if (head === 1 && workdir === 2) return 'modified';
  return null;
}

interface GitAuthor {
  name: string;
  email: string;
}

async function resolveAuthor(dir: string): Promise<GitAuthor> {
  // git config user.name / user.email against the repo, with a Maude default so a
  // commit never fails on an unconfigured identity (the non-technical case).
  let name = '';
  let email = '';
  try {
    name = (await git.getConfig({ fs, dir, path: 'user.name' })) ?? '';
  } catch {
    /* unset */
  }
  try {
    email = (await git.getConfig({ fs, dir, path: 'user.email' })) ?? '';
  } catch {
    /* unset */
  }
  return {
    name: name.trim() || 'Maude',
    email: email.trim() || 'maude@localhost',
  };
}

// ── system-git fallback (MAUDE_USE_SYSTEM_GIT=1) ─────────────────────────────

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run `git <args>` in `dir`. `tokenRemote` (when given) replaces the `origin`
 *  URL's userinfo with the token for this one invocation via `-c` config so the
 *  PAT never lands in the on-disk remote URL or the process title's argv beyond
 *  the ephemeral child. */
function runGit(dir: string, args: string[], env?: Record<string, string>): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const child = spawn('git', args, {
      cwd: dir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (e) => resolveRun({ code: 127, stdout, stderr: String(e) }));
    child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
  });
}

// ── status ───────────────────────────────────────────────────────────────────

export async function gitStatus(dir: string, opts: GitStatusOpts = {}): Promise<GitStatusResult> {
  if (!isRepo(dir)) {
    return { repo: false, branch: null, files: [], clean: true, unpushed: 0 };
  }
  const prefix = normPrefix(opts.designPrefix);
  const result = USE_SYSTEM_GIT ? await statusSystem(dir, prefix) : await statusIso(dir, prefix);

  // Local "saved but not published" count — no network (uses the cached
  // remote-tracking ref). Lets the panel offer Publish even on a clean tree.
  result.unpushed = await localUnpushed(dir, result.branch, opts.remote || 'origin').catch(() => 0);

  if (opts.checkRemote) {
    try {
      const { ahead, behind } = await remoteAheadBehind(dir, opts.token, opts.remote);
      result.ahead = ahead;
      result.behind = behind;
      result.remoteAhead = behind > 0;
    } catch {
      // Remote unreachable / no tracking branch — leave the nudge fields unset so
      // the UI just doesn't show a "Get latest" banner. Never fatal to status.
    }
  }
  return result;
}

async function statusIso(dir: string, prefix: string): Promise<GitStatusResult> {
  const branch = (await git.currentBranch({ fs, dir, fullname: false })) ?? null;
  const matrix = await git.statusMatrix({
    fs,
    dir,
    filter: prefix ? (f) => underPrefix(f, prefix) : undefined,
  });
  const files: GitFileStatus[] = [];
  for (const [filepath, head, workdir, stage] of matrix) {
    if (isMaudeRuntimeState(filepath)) continue;
    const state = classify(head, workdir, stage);
    if (state) files.push({ path: filepath, status: state });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { repo: true, branch, files, clean: files.length === 0, unpushed: 0 };
}

async function statusSystem(dir: string, prefix: string): Promise<GitStatusResult> {
  const br = await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = br.code === 0 ? br.stdout.trim() || null : null;
  // -z NUL-delimited porcelain v1 so filenames with spaces survive intact.
  const st = await runGit(dir, ['status', '--porcelain', '-z', '--untracked-files=all']);
  const files: GitFileStatus[] = [];
  if (st.code === 0) {
    const records = st.stdout.split('\0').filter(Boolean);
    for (const rec of records) {
      // Each record: `XY <path>` (rename's second path arrives as its own record).
      const xy = rec.slice(0, 2);
      const path = rec.slice(3).replace(/\\/g, '/');
      if (!path || !underPrefix(path, prefix) || isMaudeRuntimeState(path)) continue;
      const state = classifyPorcelain(xy);
      if (state) files.push({ path, status: state });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { repo: true, branch, files, clean: files.length === 0, unpushed: 0 };
}

function classifyPorcelain(xy: string): GitFileState | null {
  if (xy === '??') return 'untracked';
  const x = xy[0];
  const y = xy[1];
  if (x === 'D' || y === 'D') return 'deleted';
  if (x === 'A') return 'added';
  if (x === 'M' || y === 'M' || x === 'R' || x === 'C') return 'modified';
  return null;
}

// ── commit (Save version) ─────────────────────────────────────────────────────

/** Save selected files as one version. `files` are repo-relative paths the user
 *  checked; an empty/undefined list means "Save all" (every changed file under
 *  `designPrefix`). Each file is staged add-or-remove based on its workdir
 *  presence, then one commit lands. Returns the new sha. */
export async function gitCommit(
  dir: string,
  message: string,
  files?: string[],
  opts: { designPrefix?: string } = {}
): Promise<GitCommitResult> {
  if (!isRepo(dir)) return { ok: false, error: 'This project is not versioned yet.' };
  const msg = (message ?? '').trim();
  if (!msg) return { ok: false, error: 'A version needs a short message.' };

  const prefix = normPrefix(opts.designPrefix);
  // Resolve the working set: explicit selection, else every changed file in scope.
  const status = await gitStatus(dir, { designPrefix: prefix });
  if (status.clean) return { ok: false, error: 'Nothing to save.' };

  let selected: GitFileStatus[];
  if (files?.length) {
    const want = new Set(files.map((f) => f.replace(/\\/g, '/')));
    selected = status.files.filter((f) => want.has(f.path));
    if (!selected.length) return { ok: false, error: 'None of the selected files have changes.' };
  } else {
    selected = status.files;
  }

  return USE_SYSTEM_GIT ? commitSystem(dir, msg, selected) : commitIso(dir, msg, selected);
}

async function commitIso(
  dir: string,
  message: string,
  selected: GitFileStatus[]
): Promise<GitCommitResult> {
  try {
    for (const f of selected) {
      if (f.status === 'deleted') {
        await git.remove({ fs, dir, filepath: f.path });
      } else {
        await git.add({ fs, dir, filepath: f.path });
      }
    }
    const author = await resolveAuthor(dir);
    const sha = await git.commit({ fs, dir, message, author });
    return { ok: true, sha };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function commitSystem(
  dir: string,
  message: string,
  selected: GitFileStatus[]
): Promise<GitCommitResult> {
  for (const f of selected) {
    const args = f.status === 'deleted' ? ['rm', '--', f.path] : ['add', '--', f.path];
    const r = await runGit(dir, args);
    if (r.code !== 0) return { ok: false, error: r.stderr.trim() || 'stage failed' };
  }
  // -m via argv (message is server-side; no shell interpolation through spawn).
  const c = await runGit(dir, ['commit', '-m', message]);
  if (c.code !== 0) return { ok: false, error: c.stderr.trim() || 'commit failed' };
  const head = await runGit(dir, ['rev-parse', 'HEAD']);
  return { ok: true, sha: head.stdout.trim() };
}

// ── discard (revert a change) ───────────────────────────────────────────────

export interface GitDiscardResult {
  ok: boolean;
  discarded?: string[];
  error?: string;
}

/** Throw away the unsaved changes to `files` — the Changes-panel per-file undo.
 *  A tracked file (modified/deleted) is restored from HEAD; an untracked file is
 *  deleted (it has no HEAD version to restore). Destructive by intent; the UI
 *  confirms first. Each path is the endpoint-validated repo-relative form. */
export async function gitDiscard(
  dir: string,
  files: string[],
  opts: { designPrefix?: string } = {}
): Promise<GitDiscardResult> {
  if (!isRepo(dir)) return { ok: false, error: 'This project is not versioned yet.' };
  if (!files?.length) return { ok: false, error: 'Nothing selected to discard.' };
  const prefix = normPrefix(opts.designPrefix);
  const status = await gitStatus(dir, { designPrefix: prefix });
  const byPath = new Map(status.files.map((f) => [f.path, f.status]));
  const targets = files.map((f) => f.replace(/\\/g, '/')).filter((f) => byPath.has(f));
  if (!targets.length) return { ok: false, error: 'None of those files have changes.' };

  try {
    for (const f of targets) {
      if (byPath.get(f) === 'untracked') {
        await fs.promises.rm(join(dir, f), { force: true });
      } else if (USE_SYSTEM_GIT) {
        const r = await runGit(dir, ['checkout', 'HEAD', '--', f]);
        if (r.code !== 0) return { ok: false, error: r.stderr.trim() || 'discard failed' };
      } else {
        await git.checkout({ fs, dir, filepaths: [f], ref: 'HEAD', force: true });
      }
    }
    return { ok: true, discarded: targets };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ── push (Publish) ─────────────────────────────────────────────────────────

/** Publish. `token` is optional in phase-27: the system-git engine falls back to
 *  the user's configured credential helper / SSH, so a developer-ish user who
 *  cloned with system git can publish today (no in-UI token). The iso-git default
 *  engine needs the token (no helper integration) → `authRequired` when absent,
 *  which the UI renders as "Sign in to publish" (phase-28 keychain fills it). */
export async function gitPush(
  dir: string,
  token: string | undefined,
  opts: { remote?: string; ref?: string } = {}
): Promise<GitPushResult> {
  if (!isRepo(dir)) return { ok: false, error: 'This project is not versioned yet.' };
  const remote = opts.remote || 'origin';
  return USE_SYSTEM_GIT
    ? pushSystem(dir, token, remote, opts.ref)
    : pushIso(dir, token, remote, opts.ref);
}

async function pushIso(
  dir: string,
  token: string | undefined,
  remote: string,
  ref?: string
): Promise<GitPushResult> {
  if (!token) return { ok: false, authRequired: true, error: 'Sign in to publish.' };
  try {
    const branch = ref || (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
    const res = await git.push({
      fs,
      http,
      dir,
      remote,
      ref: branch,
      // GitHub PAT over HTTPS basic-auth: token as username, empty password
      // (Task 3 gotcha — NOT a Bearer header). isomorphic-git never logs this.
      onAuth: () => ({ username: token, password: '' }),
    });
    // PushResult.ok is true on success; a rejected ref carries an error string.
    if (res.ok) return { ok: true };
    const errors = Object.values(res.refs ?? {})
      .map((r) => (r as { error?: string }).error)
      .filter(Boolean) as string[];
    const blob = `${res.error ?? ''} ${errors.join(' ')}`.toLowerCase();
    if (isNonFastForward(blob)) return { ok: false, conflict: true };
    return { ok: false, error: errors[0] || res.error || 'Publish failed.' };
  } catch (e) {
    const msg = errMsg(e);
    if (isNonFastForward(msg)) return { ok: false, conflict: true };
    return { ok: false, error: msg };
  }
}

async function pushSystem(
  dir: string,
  token: string | undefined,
  remote: string,
  ref?: string
): Promise<GitPushResult> {
  const branch = ref || (await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  if (!isSafeGitPositional(remote) || (branch && !isSafeGitPositional(branch))) {
    return { ok: false, error: 'Invalid remote or draft name.' };
  }
  // With a token, inject it via an ephemeral http.extraheader (never lands on
  // disk). Without one, fall through to the user's configured credential helper /
  // SSH agent — the phase-27 "I cloned with system git" publish path.
  const args = tokenHeaderArgs(token);
  args.push('push', remote, branch || 'HEAD');
  const r = await runGit(dir, args);
  if (r.code === 0) return { ok: true };
  if (isNonFastForward(`${r.stderr} ${r.stdout}`.toLowerCase()))
    return { ok: false, conflict: true };
  return { ok: false, error: r.stderr.trim() || 'Publish failed.' };
}

/** Defense-in-depth (security re-review): the endpoint already validates
 *  `remote`/`ref`, but the system-git engine passes them as bare argv positionals,
 *  so a dash-led value would be parsed as an OPTION (argument injection, A1). This
 *  is a SECOND guard — a future relaxation of the endpoint regex can't silently
 *  re-open the class. A real git remote/ref/branch never starts with `-`. */
const SAFE_GIT_POSITIONAL = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
function isSafeGitPositional(v: string): boolean {
  return SAFE_GIT_POSITIONAL.test(v);
}

/** Ephemeral `git -c http.extraheader=…` args carrying a token as HTTPS basic
 *  auth, or `[]` when no token (fall back to the user's credential helper). The
 *  header is per-invocation so the PAT never lands in the on-disk remote URL. */
function tokenHeaderArgs(token: string | undefined): string[] {
  if (!token) return [];
  const auth = Buffer.from(`x-access-token:${token}`).toString('base64');
  return ['-c', `http.extraheader=Authorization: Basic ${auth}`];
}

function isNonFastForward(blob: string): boolean {
  return (
    blob.includes('non-fast-forward') ||
    blob.includes('not a simple fast-forward') ||
    blob.includes('fetch first') ||
    blob.includes('rejected') ||
    blob.includes('updates were rejected')
  );
}

// ── pull (Get latest) ─────────────────────────────────────────────────────

/** Get latest. Same optional-token model as gitPush (see its doc comment). */
export async function gitPull(
  dir: string,
  token: string | undefined,
  opts: { remote?: string; ref?: string } = {}
): Promise<GitPullResult> {
  if (!isRepo(dir)) return { ok: false, error: 'This project is not versioned yet.' };
  return USE_SYSTEM_GIT
    ? pullSystem(dir, token, opts.remote || 'origin', opts.ref)
    : pullIso(dir, token, opts.remote || 'origin', opts.ref);
}

async function pullIso(
  dir: string,
  token: string | undefined,
  remote: string,
  ref?: string
): Promise<GitPullResult> {
  if (!token) return { ok: false, authRequired: true, error: 'Sign in to get the latest.' };
  try {
    const branch = ref || (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
    const author = await resolveAuthor(dir);
    await git.pull({
      fs,
      http,
      dir,
      remote,
      ref: branch,
      singleBranch: true,
      author,
      onAuth: () => ({ username: token, password: '' }),
    });
    return { ok: true };
  } catch (e) {
    // isomorphic-git surfaces a real content conflict as MergeConflictError, whose
    // `data` is the list of conflicted filepaths. DiffView opens on these.
    const conflictFiles = mergeConflictFiles(e);
    if (conflictFiles) return { ok: false, conflict: true, files: conflictFiles };
    return { ok: false, error: errMsg(e) };
  }
}

async function pullSystem(
  dir: string,
  token: string | undefined,
  remote: string,
  ref?: string
): Promise<GitPullResult> {
  const branch = ref || (await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  if (!isSafeGitPositional(remote) || (branch && !isSafeGitPositional(branch))) {
    return { ok: false, error: 'Invalid remote or draft name.' };
  }
  const args = tokenHeaderArgs(token);
  args.push('pull', '--no-rebase', remote, branch || 'HEAD');
  const r = await runGit(dir, args);
  if (r.code === 0) return { ok: true };
  const blob = `${r.stderr}\n${r.stdout}`;
  if (/conflict/i.test(blob)) {
    // Parse `CONFLICT (content): Merge conflict in <path>` lines.
    const files = [...blob.matchAll(/Merge conflict in (.+)/g)].map((m) => m[1].trim());
    return { ok: false, conflict: true, files: files.length ? files : undefined };
  }
  return { ok: false, error: r.stderr.trim() || 'Get latest failed.' };
}

function mergeConflictFiles(e: unknown): string[] | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { code?: string; caller?: string; data?: unknown };
  const isConflict =
    err.code === 'MergeConflictError' ||
    err.code === 'MergeNotSupportedError' ||
    err.code === 'CheckoutConflictError';
  if (!isConflict) return null;
  if (Array.isArray(err.data)) return err.data.map(String);
  return [];
}

// ── log (History) ─────────────────────────────────────────────────────────

export async function gitLog(dir: string, limit = 30): Promise<GitLogEntry[]> {
  if (!isRepo(dir)) return [];
  return USE_SYSTEM_GIT ? logSystem(dir, limit) : logIso(dir, limit);
}

async function logIso(dir: string, limit: number): Promise<GitLogEntry[]> {
  try {
    const commits = await git.log({ fs, dir, depth: limit });
    return commits.map((c) => {
      const a = c.commit.author;
      return {
        sha: c.oid,
        message: c.commit.message.trim().split('\n')[0] ?? '',
        author: a.name,
        email: a.email,
        date: new Date(a.timestamp * 1000).toISOString(),
      };
    });
  } catch {
    return [];
  }
}

async function logSystem(dir: string, limit: number): Promise<GitLogEntry[]> {
  // Unit-separator field delimiter, record-separator line delimiter — survives
  // any message punctuation.
  const fmt = '%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e';
  const r = await runGit(dir, ['log', `-n${limit}`, `--pretty=format:${fmt}`]);
  if (r.code !== 0) return [];
  return r.stdout
    .split('\x1e')
    .map((rec) => rec.replace(/^\n/, '').trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, message, author, email, date] = rec.split('\x1f');
      return { sha, message, author, email, date };
    });
}

// ── diff (visual before/after) ─────────────────────────────────────────────

/** Files that differ between commit `sha` and the working tree, scoped to
 *  `designPrefix`. DiffView uses each entry to drive the screenshot pipeline
 *  (render `before` sha vs `after`=workdir). `sha` defaults to HEAD, in which
 *  case this is exactly the current dirty set. */
export async function gitDiff(
  dir: string,
  sha = 'HEAD',
  opts: { designPrefix?: string } = {}
): Promise<GitDiffEntry[]> {
  if (!isRepo(dir)) return [];
  const prefix = normPrefix(opts.designPrefix);
  return USE_SYSTEM_GIT ? diffSystem(dir, sha, prefix) : diffIso(dir, sha, prefix);
}

async function diffIso(dir: string, sha: string, prefix: string): Promise<GitDiffEntry[]> {
  try {
    const ref = await git.resolveRef({ fs, dir, ref: sha }).catch(() => sha);
    const changed = await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref }), git.WORKDIR()],
      map: async (filepath, entries) => {
        if (filepath === '.') return;
        if (prefix && !underPrefix(filepath, prefix)) return;
        if (isMaudeRuntimeState(filepath)) return;
        const [tree, work] = entries;
        const treeOid = tree ? await tree.oid().catch(() => undefined) : undefined;
        const workOid = work ? await work.oid().catch(() => undefined) : undefined;
        // Different content (or added/removed) → it's a diff entry.
        if (treeOid === workOid) return;
        // Skip directories.
        const tType = tree ? await tree.type().catch(() => 'blob') : 'blob';
        const wType = work ? await work.type().catch(() => 'blob') : 'blob';
        if (tType === 'tree' || wType === 'tree') return;
        return filepath;
      },
    });
    return (changed as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((file) => ({ file, before: sha, after: 'workdir' as const }));
  } catch {
    return [];
  }
}

async function diffSystem(dir: string, sha: string, prefix: string): Promise<GitDiffEntry[]> {
  // Second guard (the endpoint already anchors the sha regex): a dash-led rev
  // would be parsed as a `git diff` option even with the trailing `--` (which
  // only protects the pathspec). A real rev never starts with `-`.
  if (!isSafeGitPositional(sha)) return [];
  const r = await runGit(dir, ['diff', '--name-only', '-z', sha, '--']);
  if (r.code !== 0) return [];
  return r.stdout
    .split('\0')
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f && underPrefix(f, prefix) && !isMaudeRuntimeState(f))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({ file, before: sha, after: 'workdir' as const }));
}

// ── show a file at a past version (DiffView "before" render) ────────────────

/** The text content of `repoRelPath` as it was at commit/ref `sha`, or null if
 *  unavailable. Drives the DiffView "before" pane (build the canvas from this
 *  source). `sha` is positional-guarded (no argument injection) and the path is
 *  containment-checked. Read-only; same exposure class as reading the current
 *  design file. */
export async function gitShowFile(
  dir: string,
  sha: string,
  repoRelPath: string
): Promise<string | null> {
  if (!isRepo(dir)) return null;
  if (!isSafeGitPositional(sha)) return null;
  const rel = repoRelPath.replace(/\\/g, '/');
  if (!isContainedRepoPath(dir, rel)) return null;
  try {
    if (USE_SYSTEM_GIT) {
      const r = await runGit(dir, ['show', `${sha}:${rel}`]);
      return r.code === 0 ? r.stdout : null;
    }
    const oid = await git.resolveRef({ fs, dir, ref: sha }).catch(() => sha);
    const { blob } = await git.readBlob({ fs, dir, oid, filepath: rel });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

// ── local "unpushed" (saved-but-not-published) — NO network ─────────────────

/** Count local commits not yet on the remote-tracking ref `<remote>/<branch>`,
 *  using only on-disk refs (no fetch). When no tracking ref exists but a remote
 *  is configured, every commit counts as unpushed (never published). 0 when
 *  there's no remote or no branch. Best-effort; callers swallow errors → 0. */
async function localUnpushed(dir: string, branch: string | null, remote: string): Promise<number> {
  if (!branch) return 0;
  // Guard parity with the other system-git callsites — `branch`/`remote` are
  // server-derived today, but never interpolate an unguarded positional into git
  // argv (defense-in-depth so a future caller can't re-open the injection class).
  if (!isSafeGitPositional(branch) || !isSafeGitPositional(remote)) return 0;
  if (USE_SYSTEM_GIT) {
    const r = await runGit(dir, ['rev-list', '--count', `${remote}/${branch}..HEAD`]);
    if (r.code === 0) return Number(r.stdout.trim()) || 0;
    // No tracking ref — count all commits if a remote exists, else 0.
    const remotes = await runGit(dir, ['remote']);
    if (!remotes.stdout.trim()) return 0;
    const all = await runGit(dir, ['rev-list', '--count', 'HEAD']);
    return all.code === 0 ? Number(all.stdout.trim()) || 0 : 0;
  }
  const trackingOid = await git
    .resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${branch}` })
    .catch(() => null);
  const localLog = await git.log({ fs, dir, ref: 'HEAD', depth: 500 }).catch(() => []);
  if (!trackingOid) {
    const remotes = await git.listRemotes({ fs, dir }).catch(() => []);
    return remotes.length ? localLog.length : 0;
  }
  const remoteSet = new Set(
    (await git.log({ fs, dir, ref: trackingOid, depth: 500 }).catch(() => [])).map((c) => c.oid)
  );
  let n = 0;
  for (const c of localLog) {
    if (remoteSet.has(c.oid)) break; // shared history → the rest is published
    n++;
  }
  return n;
}

// ── remote ahead/behind (Get latest nudge) ─────────────────────────────────

/** Fetch the tracking remote and count commits ahead (local-only) / behind
 *  (remote-only). `behind > 0` is what surfaces the "Get latest" banner. Network;
 *  callers guard with try/catch so an offline poll never breaks local status. */
export async function remoteAheadBehind(
  dir: string,
  token: string | undefined,
  remote = 'origin'
): Promise<{ ahead: number; behind: number }> {
  if (USE_SYSTEM_GIT) return remoteAheadBehindSystem(dir, token, remote);
  const branch = (await git.currentBranch({ fs, dir, fullname: false })) || 'main';
  await git.fetch({
    fs,
    http,
    dir,
    remote,
    ref: branch,
    singleBranch: true,
    tags: false,
    onAuth: () => ({ username: token ?? '', password: '' }),
  });
  const localOid = await git.resolveRef({ fs, dir, ref: branch });
  const remoteOid = await git
    .resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${branch}` })
    .catch(() => null);
  if (!remoteOid || remoteOid === localOid) return { ahead: 0, behind: 0 };

  const localSet = new Set(
    (await git.log({ fs, dir, ref: localOid, depth: 500 })).map((c) => c.oid)
  );
  const remoteSet = new Set(
    (await git.log({ fs, dir, ref: remoteOid, depth: 500 })).map((c) => c.oid)
  );
  let ahead = 0;
  let behind = 0;
  for (const oid of localSet) if (!remoteSet.has(oid)) ahead++;
  for (const oid of remoteSet) if (!localSet.has(oid)) behind++;
  return { ahead, behind };
}

async function remoteAheadBehindSystem(
  dir: string,
  token: string | undefined,
  remote: string
): Promise<{ ahead: number; behind: number }> {
  const branch = (await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim() || 'main';
  if (!isSafeGitPositional(remote) || !isSafeGitPositional(branch)) {
    throw new Error('invalid remote or branch');
  }
  const args = tokenHeaderArgs(token);
  args.push('fetch', remote, branch);
  const f = await runGit(dir, args);
  if (f.code !== 0) throw new Error(f.stderr.trim() || 'fetch failed');
  const counts = await runGit(dir, [
    'rev-list',
    '--left-right',
    '--count',
    `${branch}...${remote}/${branch}`,
  ]);
  if (counts.code !== 0) return { ahead: 0, behind: 0 };
  const [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
  return { ahead: ahead || 0, behind: behind || 0 };
}

// ── shared ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Guard: a repo-relative path that stays inside `dir` (no traversal, no abs).
 *  The endpoint layer validates user-supplied `files[]` with this before they
 *  reach gitCommit so a poisoned path can't stage outside the repo. */
export function isContainedRepoPath(dir: string, repoRelative: string): boolean {
  if (typeof repoRelative !== 'string' || !repoRelative) return false;
  if (repoRelative.includes('\0')) return false;
  if (isAbsolute(repoRelative)) return false;
  const resolved = join(dir, repoRelative);
  const rel = relative(dir, resolved);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.startsWith(`..${sep}`);
}

export const __testing = {
  classify,
  classifyPorcelain,
  isNonFastForward,
  normPrefix,
  isMaudeRuntimeState,
  isSafeGitPositional,
};
