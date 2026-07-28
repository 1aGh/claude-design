// Document namespace, client side — `ws/<workspace-id>/<branch>/<slug>` (DDR-192 §5).
//
// ⚠ THE GRAMMAR IS MIRRORED in `apps/hub/src/doc-namespace.mjs` and the two are
// pinned to each other by `test/sync-doc-name.test.ts`, which imports the hub's
// implementation and asserts both agree over the same corpus. They are separate
// files on purpose: the hub image installs frozen against its own bun.lock and
// must not reach into apps/studio. Change one, change the other.
//
// WHAT IS NAMESPACED AND WHAT IS NOT: only the WIRE name changes. Every local
// map — the provider registry, the sync agent, the projection, `_history/`,
// `_comments/` — stays keyed by the flat slug. The namespace exists to keep two
// projects (or two branches) from colliding INSIDE A HUB; on disk they already
// live in different directories.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The prefix that marks a namespaced documentName. */
export const DOC_NAMESPACE_PREFIX = 'ws';

/** Max length of one path component (workspace id / branch / slug). */
export const COMPONENT_MAX = 64;

export interface DocNamespace {
  workspaceId: string;
  branch: string;
  slug: string;
}

/**
 * Normalize one path component into the namespace charset. `/` is the
 * separator, so a git branch like `feature/foo` becomes `feature-foo`.
 */
export function sanitizeComponent(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, COMPONENT_MAX)
    .replace(/[-.]+$/g, '');
}

/** Build `ws/<workspace-id>/<branch>/<slug>`. Throws if a component is empty. */
export function buildDocName({ workspaceId, branch, slug }: DocNamespace): string {
  const w = sanitizeComponent(workspaceId);
  const b = sanitizeComponent(branch);
  const s = sanitizeComponent(slug);
  if (!w) throw new Error('buildDocName: workspaceId is empty after normalization');
  if (!b) throw new Error('buildDocName: branch is empty after normalization');
  if (!s) throw new Error('buildDocName: slug is empty after normalization');
  return `${DOC_NAMESPACE_PREFIX}/${w}/${b}/${s}`;
}

/** Parse a documentName; null means a legacy flat slug (expected, not an error). */
export function parseDocName(name: string): DocNamespace | null {
  if (typeof name !== 'string' || name.length === 0) return null;
  const parts = name.split('/');
  if (parts.length !== 4) return null;
  const [prefix, workspaceId, branch, slug] = parts;
  if (prefix !== DOC_NAMESPACE_PREFIX) return null;
  if (!workspaceId || !branch || !slug) return null;
  return { workspaceId, branch, slug };
}

/** True when `name` is a namespaced documentName. */
export function isNamespaced(name: string): boolean {
  return parseDocName(name) !== null;
}

// ---------------------------------------------------------------------------
// Resolution — where the workspace id and the branch actually come from
// ---------------------------------------------------------------------------

/**
 * Current branch, read straight from `.git/HEAD` (no subprocess — the same
 * source `collab/git-lifecycle.ts` watches).
 *
 * A detached HEAD yields `detached-<sha7>`, which is a *stable* name for that
 * commit: two peers detached at the same commit meet, and a peer on a branch
 * never accidentally shares a doc with a detached checkout.
 *
 * Returns null when there is no git repo at all.
 */
export function readBranch(repoRoot: string): string | null {
  const headPath = path.join(repoRoot, '.git', 'HEAD');
  if (!existsSync(headPath)) return null;
  let head: string;
  try {
    head = readFileSync(headPath, 'utf8').trim();
  } catch {
    return null;
  }
  const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
  if (ref?.[1]) return ref[1];
  if (/^[0-9a-f]{7,40}$/i.test(head)) return `detached-${head.slice(0, 7)}`;
  return null;
}

/**
 * Read the `origin` remote URL from `.git/config` without shelling out.
 * Returns null when there is no origin (a purely local repo).
 */
export function readOriginUrl(repoRoot: string): string | null {
  const cfgPath = path.join(repoRoot, '.git', 'config');
  if (!existsSync(cfgPath)) return null;
  let raw: string;
  try {
    raw = readFileSync(cfgPath, 'utf8');
  } catch {
    return null;
  }
  const section = raw.match(/\[remote "origin"\]([\s\S]*?)(?=\n\[|$)/);
  const url = section?.[1]?.match(/^\s*url\s*=\s*(.+)$/m)?.[1]?.trim();
  return url && url.length > 0 ? url : null;
}

/**
 * Reduce a git remote URL to a stable `<owner>-<repo>` identity, so
 * `git@github.com:1aGh/maude.git` and `https://github.com/1aGh/maude` — the
 * same project cloned two different ways — produce the SAME workspace id.
 *
 * Getting this wrong is not a cosmetic bug: two peers of one project that
 * derive different ids would stop meeting, and each would see the other's docs
 * as absent.
 */
export function workspaceIdFromRemote(url: string): string {
  let s = url.trim().replace(/\.git$/i, '');
  s = s.replace(/^[a-z0-9+.-]+:\/\//i, ''); // scheme
  s = s.replace(/^[^@/]+@/, ''); // user@
  s = s.replace(/^([^/:]+):/, '$1/'); // scp-style host:path → host/path
  const segments = s.split('/').filter(Boolean);
  const tail = segments.slice(-2); // <owner>/<repo>
  return sanitizeComponent(tail.join('-'));
}

export interface ResolveWorkspaceOpts {
  /** Explicit id from config — authoritative when present (the cloud sets it). */
  explicit?: string | undefined;
  repoRoot: string;
}

/**
 * Resolve the workspace id, or null when it cannot be derived in a way that is
 * STABLE ACROSS MACHINES.
 *
 * Order: explicit config → git origin remote. There is deliberately no
 * directory-name fallback: a local path is not the same on two machines, so
 * deriving from it would split peers of the same project into separate
 * documents — the exact failure the namespace exists to prevent, arrived at
 * from the other direction. No stable id ⇒ stay flat (see `createDocNameResolver`).
 */
export function resolveWorkspaceId({ explicit, repoRoot }: ResolveWorkspaceOpts): string | null {
  const fromConfig = sanitizeComponent(explicit ?? '');
  if (fromConfig) return fromConfig;
  const origin = readOriginUrl(repoRoot);
  if (!origin) return null;
  const derived = workspaceIdFromRemote(origin);
  return derived || null;
}

export interface DocNameResolver {
  /** Map a local canvas slug to the name used on the wire. */
  (slug: string): string;
}

export interface DocNameResolverOpts {
  repoRoot: string;
  /** `linkedHub.workspaceId` when the config carries one. */
  explicitWorkspaceId?: string | undefined;
  /** `MAUDE_HUB_NAMESPACED` — '1' forces on, '0' forces off, absent = auto. */
  flag?: string | undefined;
  /** Test seam: override branch detection. */
  branch?: string | undefined;
}

/**
 * Build the slug → documentName mapping for this process.
 *
 * Rollout rule (DDR-192 §5): namespacing CHANGES DOC IDENTITY, so it is opt-in
 * for now and becomes default-on in workspace mode (Phase 3).
 *
 *   MAUDE_HUB_NAMESPACED=0  → always flat, even with an explicit workspace id
 *   MAUDE_HUB_NAMESPACED=1  → namespaced, and it is an ERROR to be unable to
 *                             (an operator who asked for isolation gets a loud
 *                             failure, never a silent fallback into a shared doc)
 *   unset                   → namespaced only when config declares a workspace
 *                             id explicitly; otherwise flat
 *
 * The auto case is deliberately NOT "namespace whenever a git origin exists":
 * flipping identity under an existing linked hub would make every doc look
 * freshly empty. DDR-076 keeps that from eating local files, but the hub-side
 * history would be orphaned, and nobody asked for that on upgrade.
 */
export function createDocNameResolver(opts: DocNameResolverOpts): DocNameResolver {
  const flag = opts.flag;
  if (flag === '0') return (slug) => slug;

  const workspaceId = resolveWorkspaceId({
    explicit: opts.explicitWorkspaceId,
    repoRoot: opts.repoRoot,
  });
  const branch = sanitizeComponent(opts.branch ?? readBranch(opts.repoRoot) ?? '');

  if (flag === '1') {
    if (!workspaceId) {
      throw new Error(
        'MAUDE_HUB_NAMESPACED=1 but no workspace id could be resolved. Set ' +
          '`linkedHub.workspaceId` in .design/config.json, or give the repo an ' +
          '`origin` remote. Refusing to fall back to flat slugs — that would put ' +
          'this project in a shared document namespace (DDR-192 §5).'
      );
    }
    if (!branch) {
      throw new Error(
        'MAUDE_HUB_NAMESPACED=1 but the current branch could not be read from ' +
          '.git/HEAD. Refusing to fall back to flat slugs (DDR-192 §5).'
      );
    }
  }

  const explicitlyDeclared = sanitizeComponent(opts.explicitWorkspaceId ?? '') !== '';
  const on = flag === '1' || (explicitlyDeclared && !!workspaceId && !!branch);
  if (!on || !workspaceId || !branch) return (slug) => slug;

  return (slug) => buildDocName({ workspaceId, branch, slug });
}
