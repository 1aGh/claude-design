// whats-new.ts — server-side loader for the Maude "What's New" feed.
//
// Single source of truth: `<DEV_SERVER_ROOT>/whats-new.json` (DDR-A). The feed
// describes **Maude's own product** updates — it is resolved from the maude
// package root (via paths.ts, NOT cwd), so the dev-server surfaces the same
// product news whether it runs in this repo or a downstream user's project.
//
// Disk paths MUST come from paths.ts (DDR-045) — never
// `dirname(fileURLToPath(import.meta.url))`, which is the virtual `/$bunfs/root`
// inside a `bun --compile` standalone binary.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_SERVER_ROOT } from './paths.ts';

export type WhatsNewKind = 'feature' | 'improvement' | 'usage' | 'fix';

export interface WhatsNewTourStep {
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface WhatsNewEntry {
  id: string;
  version: string | null;
  date: string | null;
  kind: WhatsNewKind;
  title: string;
  summary: string;
  learnMore?: string;
  surface?: string;
  tour?: WhatsNewTourStep[];
}

export interface WhatsNewFeed {
  /** The installed maude version (key the client compares "seen" against). */
  version: string;
  entries: WhatsNewEntry[];
}

let cache: WhatsNewFeed | null = null;

/**
 * Read the installed maude version from the design plugin manifest.
 * `plugins/design/dev-server/` → `plugins/design/.claude-plugin/plugin.json`.
 * That manifest ships in BOTH npm installs and marketplace-cache clones
 * (same rationale as build.ts `readPluginVersion`). Falls back to `dev`.
 */
export function resolveMaudeVersion(root: string = DEV_SERVER_ROOT): string {
  const manifest = join(root, '..', '.claude-plugin', 'plugin.json');
  try {
    const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown };
    if (typeof parsed.version === 'string') return parsed.version;
  } catch {
    /* fall through */
  }
  return 'dev';
}

/**
 * Load `<root>/whats-new.json`. Fails soft to an empty entry list — a missing
 * or malformed feed must never 500 the dev-server (it's a non-critical chrome
 * surface). Caches the default-root result; pass `{ root }` for an uncached
 * read (tests) and `{ fresh: true }` to bypass the cache.
 */
export function loadWhatsNew(opts: { root?: string; fresh?: boolean } = {}): WhatsNewFeed {
  const usingDefaultRoot = opts.root === undefined;
  if (cache && usingDefaultRoot && !opts.fresh) return cache;

  const root = opts.root ?? DEV_SERVER_ROOT;
  const file = join(root, 'whats-new.json');
  let entries: WhatsNewEntry[] = [];
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { entries?: unknown };
      if (Array.isArray(parsed.entries)) entries = parsed.entries as WhatsNewEntry[];
    }
  } catch {
    /* malformed feed → empty, never throw */
  }

  const feed: WhatsNewFeed = { version: resolveMaudeVersion(root), entries };
  if (usingDefaultRoot) cache = feed;
  return feed;
}
