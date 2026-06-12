// Per-machine sync journal — hub-sync cold-start safety (DDR-102).
//
// Records, per slug, the content hash of the LAST state this machine
// successfully reconciled disk↔doc. It answers git's "do I have uncommitted
// changes?" question for sync: a cold-start hub-wins overwrite of local disk
// is allowed ONLY when hash(local) == journal hash (a clean fast-forward —
// everything local was already synced, the hub is just ahead). Any other
// combination is divergence and takes the conflict protocol (cold-start.ts:
// dual snapshot + newest-wins).
//
// Per-machine, per-hub: the file lives at `<designRoot>/_state/sync-journal.json`
// (`_state/` is already in the DDR-056 gitignore block) and carries the hub URL
// it was recorded against. Relinking to a DIFFERENT hub invalidates every
// entry — hashes recorded against one hub's docs say nothing about another's.
//
// Posture mirrors status.ts: best-effort, NEVER throws into the boot path. A
// corrupt/unparseable file is treated as absent; the decision module then
// degrades to the conservative "potential divergence" path, which is safe
// (snapshot + newest-wins), never destructive. Hashes come exclusively from
// `hashBytes` (echo-guard.ts) so the journal compares apples to apples with
// the echo guard and the cold-start decision inputs.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { atomicWrite } from './atomic-write.ts';

/** Debounce window for persisting the journal to disk. */
export const JOURNAL_FLUSH_MS = 1_000;

export interface JournalEntry {
  /** hashBytes() of the canvas body as last reconciled disk↔doc. */
  bodyHash: string;
  /** hashBytes() of the sibling .css, when one was reconciled. */
  cssHash?: string;
  /** ms epoch of the checkpoint. */
  at: number;
}

interface JournalFileShape {
  hubUrl: string | null;
  updatedAt: number;
  slugs: Record<string, JournalEntry>;
}

export interface SyncJournal {
  /** Last-reconciled hashes for a slug, or null when never checkpointed. */
  get(slug: string): JournalEntry | null;
  /** Checkpoint a successful disk↔doc traversal. Lanes checkpoint
   *  independently (body flush vs css flush), so omitted hashes MERGE with the
   *  existing entry instead of clearing it. Schedules a debounced persist. */
  record(slug: string, hashes: { bodyHash?: string; cssHash?: string }): void;
  /** Relinked to a different hub → wipe every entry (hashes are per-hub). */
  invalidateIfHubChanged(url: string): void;
  /** Persist now (cancels the pending debounce). Best-effort. */
  flush(): void;
  /** Flush + cancel timers. */
  stop(): void;
  /** Test/inspection — number of slugs tracked. */
  size(): number;
}

export interface LoadJournalOptions {
  /** Override the persist debounce. Tests use 0 to persist synchronously. */
  flushMs?: number;
  now?: () => number;
  /** Injected for tests — defaults to atomicWrite. */
  writer?: (path: string, bytes: string) => void;
}

/** Absolute path of the journal file for a design root. */
export function journalPath(designRoot: string): string {
  return path.join(designRoot, '_state', 'sync-journal.json');
}

export function loadJournal(designRoot: string, opts: LoadJournalOptions = {}): SyncJournal {
  const file = journalPath(designRoot);
  const flushMs = opts.flushMs ?? JOURNAL_FLUSH_MS;
  const now = opts.now ?? Date.now;
  // atomicWrite mkdirs the parent (`_state/`) on demand, so no explicit mkdir.
  const writer = opts.writer ?? ((p: string, bytes: string) => void atomicWrite(p, bytes));

  let hubUrl: string | null = null;
  let slugs: Record<string, JournalEntry> = {};
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  // Load once at construction. Corrupt / unreadable / wrong-shape → absent.
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<JournalFileShape>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        hubUrl = typeof parsed.hubUrl === 'string' ? parsed.hubUrl : null;
        const rawSlugs = parsed.slugs;
        if (rawSlugs && typeof rawSlugs === 'object' && !Array.isArray(rawSlugs)) {
          for (const [slug, raw] of Object.entries(rawSlugs)) {
            const e = raw as JournalEntry;
            if (e && typeof e === 'object' && typeof e.bodyHash === 'string') {
              slugs[slug] = {
                bodyHash: e.bodyHash,
                ...(typeof e.cssHash === 'string' ? { cssHash: e.cssHash } : {}),
                at: typeof e.at === 'number' ? e.at : 0,
              };
            }
          }
        }
      }
    }
  } catch {
    /* corrupt journal → treat as absent; the decision module degrades safely */
  }

  function persist(): void {
    if (!dirty) return;
    dirty = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const payload: JournalFileShape = { hubUrl, updatedAt: now(), slugs };
    try {
      writer(file, `${JSON.stringify(payload, null, 2)}\n`);
    } catch (err) {
      // Best-effort: a failed persist must never throw into the sync hot path.
      console.warn('[sync/journal] persist failed:', err instanceof Error ? err.message : err);
    }
  }

  function schedulePersist(): void {
    dirty = true;
    if (stopped) return;
    if (flushMs === 0) {
      persist();
      return;
    }
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      persist();
    }, flushMs);
  }

  return {
    get(slug) {
      return slugs[slug] ?? null;
    },

    record(slug, hashes) {
      const prev = slugs[slug];
      const cssHash = hashes.cssHash ?? prev?.cssHash;
      slugs[slug] = {
        // An entry created by a css-only checkpoint carries an empty bodyHash —
        // it can never match a real body hash, so the decision module stays
        // conservative (divergence path) until a body traversal checkpoints.
        bodyHash: hashes.bodyHash ?? prev?.bodyHash ?? '',
        ...(cssHash !== undefined ? { cssHash } : {}),
        at: now(),
      };
      schedulePersist();
    },

    invalidateIfHubChanged(url) {
      if (hubUrl === url) return;
      if (hubUrl !== null) {
        // Different hub than the one these hashes were recorded against — every
        // entry is meaningless there. Wipe so the decision module stays
        // conservative (divergence → snapshot) instead of false-fast-forwarding.
        slugs = {};
      }
      hubUrl = url;
      schedulePersist();
    },

    flush: persist,

    stop() {
      persist();
      stopped = true;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    },

    size() {
      return Object.keys(slugs).length;
    },
  };
}
