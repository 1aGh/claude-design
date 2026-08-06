// The headless workspace agent — Cloud Phase 16 Task 1.
//
// THE HOLE THIS FILLS. Until now, autosave-to-git ran only in the CLIENT
// (apps/studio/sync/index.ts). A project opened from a phone, or from a
// browser, or simply with no desktop attached, therefore had no history at
// all — its only record was its current bytes, one bad sync from
// unrecoverable. Worse, "GitHub mirror" would have been a false claim: there
// would have been nothing truthful to push.
//
// So the server commits. It subscribes to its own hub's documents, projects
// each one onto the checkout, and drives the SAME `createAutoCommit` the
// desktop uses — same append-only rule, same author≠committer contract, same
// quiescence batching. One implementation, so a server-made commit and a
// desktop-made commit are indistinguishable in the log.
//
// CONTAINMENT (DDR-193 §2) IS UNTOUCHED. This agent syncs, writes and commits
// bytes. It does not import a canvas, does not bundle one, does not evaluate
// one, and does not spawn anything that could. The canvas body is a string
// from a Y.Text to a file on disk and nothing in between ever looks inside it.

import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { createAutoCommit } from '../../studio/sync/autocommit.ts';
import { createGitRunner, ensureRepo, gitAvailable } from './git-runner.mjs';
import {
  attributionFor,
  committableLanes,
  defaultBodyPath,
  filesForCanvas,
  indexCanvasPaths,
  readDocContent,
  siblingPaths,
} from './workspace-files.mjs';

/** Documents are `ws/<workspace>/<branch>/<slug>`; anything else is legacy-flat. */
const DOC_NAME = /^ws\/[^/]+\/[^/]+\/([^/]+)$/;

/**
 * Slug carried by a document name.
 * Returns null for names this agent must not touch — a name it cannot parse is
 * a name whose destination it would have to guess, and guessing writes a
 * tenant's work to the wrong file.
 */
export function slugFromDocName(name) {
  const m = DOC_NAME.exec(String(name ?? ''));
  if (m) return m[1];
  // Legacy flat slugs predate the namespace and are still valid documents.
  if (/^[a-z0-9._-]+$/.test(String(name ?? ''))) return String(name);
  return null;
}

/** Recursively list files under `dir`, relative to it. Missing dir → []. */
function listFiles(dir, prefix = '', out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_') || entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      listFiles(join(dir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function readIfPresent(abs) {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Write via temp + rename, so a reader never observes a half-written canvas.
 * The temp file is a sibling: rename is only atomic within one filesystem, and
 * /tmp in a container frequently is not the same one as /repo.
 */
function atomicWrite(abs, text) {
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, abs);
}

/**
 * @param {object} opts
 * @param {string} opts.repoDir      the checkout root
 * @param {string} [opts.designRel]  design root, relative to repoDir
 * @param {number} [opts.debounceMs] quiescence window before a commit
 * @param {Function} [opts.run]      injected GitRunner (tests)
 * @param {object}   [opts.log]
 */
export function createWorkspaceAgent(opts) {
  const repoDir = resolve(opts.repoDir);
  const designRel = (opts.designRel ?? '.design').replace(/^\/+|\/+$/g, '');
  const designRoot = join(repoDir, designRel);
  const log = opts.log ?? console;
  const run = opts.run ?? createGitRunner();

  let auto = null;
  let ready = false;
  let pathIndex = new Map();

  /**
   * Resolve the checkout before accepting any document. Reports rather than
   * throws — see ensureRepo.
   */
  /**
   * NOTHING IN HERE MAY THROW.
   *
   * This is not defensive style, it is the design. Losing history is bad;
   * refusing to open the project because history is unavailable is worse — the
   * tenant's work is intact and reachable, and a cell that will not boot is a
   * cell nobody can fix the permissions on either.
   *
   * The first run of this code against a real image proved the point: /repo
   * existed but was root-owned, `mkdirSync` threw from outside the try, and the
   * ENTIRE HUB crash-looped. A read-only or wrongly-owned volume must cost the
   * tenant their history, never their workspace.
   */
  async function start() {
    try {
      if (!(await gitAvailable(run))) {
        log.warn?.(
          '[workspace] git is not available in this image — the workspace will sync and serve, ' +
            'but it will keep NO history. Install git in the runtime image (Cloud Phase 16 T2).'
        );
        return { state: 'failed', reason: 'git not on PATH' };
      }
      try {
        mkdirSync(designRoot, { recursive: true });
      } catch (err) {
        return {
          state: 'failed',
          reason:
            `cannot create ${designRoot} (${err.code ?? err.message}) — ` +
            'the checkout volume is not writable by the hub user',
        };
      }
      const repo = await ensureRepo(repoDir, run);
      if (repo.state === 'failed') {
        log.error?.(`[workspace] git unavailable: ${repo.reason} — continuing without history`);
        return repo;
      }
      pathIndex = indexCanvasPaths(listFiles(designRoot));
      auto = createAutoCommit({
        repoRoot: repoDir,
        run,
        debounceMs: opts.debounceMs,
        log,
      });
      ready = true;
      log.log?.(
        `[workspace] server-side history active — ${repo.state} at ${repoDir} ` +
          `(${pathIndex.size} canvas${pathIndex.size === 1 ? '' : 'es'} indexed)`
      );
      return repo;
    } catch (err) {
      return { state: 'failed', reason: err.message };
    }
  }

  /**
   * One document finished storing. Project it onto the checkout and hand the
   * touched paths to autocommit.
   *
   * Never throws: this runs inside a Hocuspocus hook, and an exception there
   * takes down the store for every OTHER document too. A projection failure
   * must cost this canvas its commit, not the tenant their sync.
   */
  async function onDocumentStored({ documentName, document, user }) {
    if (!ready || !auto) return null;
    const slug = slugFromDocName(documentName);
    if (!slug) {
      log.warn?.(
        `[workspace] ignoring unparseable document name: ${String(documentName).slice(0, 80)}`
      );
      return null;
    }

    try {
      const bodyRel = pathIndex.get(slug) ?? defaultBodyPath(slug);
      const sib = siblingPaths(bodyRel);
      const abs = (rel) => join(designRoot, rel);

      // Path containment. `slug` is already charset-constrained by the hub's
      // documentName regex, but this is the last point before a write and the
      // consequence of being wrong is writing outside the tenant's checkout.
      for (const rel of [bodyRel, sib.meta, sib.css, sib.annotations]) {
        const target = resolve(abs(rel));
        if (target !== designRoot && !target.startsWith(designRoot + sep)) {
          log.error?.(`[workspace] refusing write outside the design root: ${rel}`);
          return null;
        }
      }

      const content = readDocContent(document);
      const onDisk = {
        body: readIfPresent(abs(bodyRel)),
        meta: readIfPresent(abs(sib.meta)),
        css: readIfPresent(abs(sib.css)),
        annotations: readIfPresent(abs(sib.annotations)),
      };
      const writes = filesForCanvas({ bodyRel, content, onDisk });

      // WHAT TO COMMIT IS NOT WHAT WE WROTE — desktop ↔ cloud live pairing.
      //
      // This used to `note` exactly the paths this function had just written,
      // which was correct while the hub was the only writer. Under pairing
      // (DDR-213) it is not: the studio child's doc→file projector writes the
      // same bytes from the same doc, and usually WINS the race. The hub then
      // reads disk, finds it already identical, writes nothing — and, noting
      // nothing, never commits. The tenant's edits were safely on the cell's
      // disk and permanently absent from its history, which is the one thing a
      // cell owns on their behalf (`MAUDE_SYNC_NO_AUTOCOMMIT=1` disables the
      // child's own autocommit precisely because the hub is meant to do this).
      //
      // `committableLanes` answers "which lanes may be staged", applying the
      // SAME gates as the write path — see workspace-files.mjs for why the two
      // are neighbours and why the meta lane in particular must not diverge.
      const committable = committableLanes({ bodyRel, content, onDisk });

      if (writes.length === 0 && committable.length === 0) return null;

      const who = attributionFor(user);
      const toStage = new Set(committable);
      for (const w of writes) {
        atomicWrite(abs(w.relPath), w.text);
        toStage.add(w.relPath);
      }
      for (const rel of toStage) {
        // autocommit stages paths relative to the REPO root, not the design root.
        auto.note(relative(repoDir, abs(rel)).split(sep).join('/'), who);
      }
      // A brand-new canvas becomes indexable immediately, so a second event in
      // the same session does not re-derive the default flat path.
      if (!pathIndex.has(slug)) pathIndex.set(slug, bodyRel);

      return { slug, bodyRel, written: writes.map((w) => w.relPath), staged: [...toStage] };
    } catch (err) {
      log.error?.(`[workspace] projecting ${slug} failed: ${err.message}`);
      return null;
    }
  }

  return {
    start,
    onDocumentStored,
    /** Force any pending commit now. The shutdown path depends on this. */
    flush: () => (auto ? auto.flush() : Promise.resolve(null)),
    async stop() {
      ready = false;
      if (!auto) return null;
      // Flush BEFORE stopping. A cell is migrated mid-session as the normal
      // path, not the exception — dropping the pending commit on SIGTERM
      // would lose the last few seconds of every session the platform moves.
      //
      // The outcome is RETURNED, not swallowed. The first live SIGTERM test
      // left the tree staged-but-uncommitted and there was no way to tell
      // whether the flush had run and failed or never run at all.
      const outcome = await auto.flush();
      auto.stop();
      auto = null;
      return outcome;
    },
    /** Test/diagnostic surface. */
    get indexed() {
      return pathIndex.size;
    },
  };
}
