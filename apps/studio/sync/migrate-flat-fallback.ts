// One-shot quarantine of the pre-fix-5 flat fallback twins — fix 4 of the
// 2026-08-10 sync RCA (v0.58.2's `f2a38c46` changed the fallback rule with no
// migration of what the old rule had already written).
//
// Until then the no-path fallback wrote a pulled canvas FLAT at the design root
// (`ui-welcome.tsx`); the group-aware fallback plus the stamp-race fix (phase
// sync-2) stopped producing new ones, but whatever the old rule wrote is still
// on disk NEXT TO the real grouped file — two files, one slug, one document
// (DDR-064 A4's collision class), and the tree lists both.
//
// The rules, in migrate-seed.ts's posture (idempotent, best-effort, never
// throws into boot):
//
//   - Only a flat file WITH a grouped twin of the same slug moves — the flat
//     copy is provably the redundant one. A flat file with NO twin is a
//     genuinely-flat canvas somebody authored; moving it would lose work, so
//     it stays (fix 5 + a future re-sync relocates it).
//   - Quarantine, never delete: the loser goes to `_trash/<slug>-flat-<ts>/`
//     (the established runtime quarantine, DDR-115), `.meta.json`/`.css`
//     siblings riding along. The `<slug>.annotations.svg` sidecar does NOT
//     move — annotations are keyed by the flat slug at the design root and
//     serve the surviving grouped twin.
//   - One log line per move, so a tenant can find their bytes.

import { type Dirent, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';

import { canvasSlugFromRel } from '../canvas-slug.ts';

export interface FlatFallbackMove {
  slug: string;
  /** Design-root-relative flat body that moved. */
  from: string;
  /** Design-root-relative grouped body that made it redundant. */
  keptTwin: string;
  /** Design-root-relative quarantine dir the flat set landed in. */
  trashedTo: string;
}

/**
 * Scan the design root, quarantine every flat body whose slug a grouped file
 * also claims. Returns what moved (empty on a clean tree — the idempotent
 * steady state). Never throws.
 */
export function migrateFlatFallback(opts: {
  designRoot: string;
  /** Design root relative to the repo root (`.design`) — for slug derivation. */
  designRel: string;
  log?: (line: string) => void;
}): FlatFallbackMove[] {
  const { designRoot, designRel } = opts;
  const log = opts.log ?? ((line: string) => console.log(line));
  const moves: FlatFallbackMove[] = [];
  try {
    // slug → every body path claiming it, design-root-relative.
    const claims = new Map<string, string[]>();
    for (const rel of walk(designRoot)) {
      if (!/\.tsx$/i.test(rel)) continue;
      const slug = canvasSlugFromRel(rel, designRel);
      const list = claims.get(slug);
      if (list) list.push(rel);
      else claims.set(slug, [rel]);
    }

    for (const [slug, rels] of claims) {
      const flat = rels.find((rel) => !rel.includes('/'));
      const twin = rels.find((rel) => rel.includes('/'));
      if (!flat || !twin) continue;

      const trashedTo = `_trash/${slug}-flat-${Date.now()}`;
      const base = flat.replace(/\.tsx$/i, '');
      const movedLanes: string[] = [];
      try {
        mkdirSync(path.join(designRoot, trashedTo), { recursive: true });
        for (const lane of [flat, `${base}.meta.json`, `${base}.css`]) {
          const src = path.join(designRoot, lane);
          if (!existsSync(src)) continue;
          renameSync(src, path.join(designRoot, trashedTo, path.basename(lane)));
          movedLanes.push(lane);
        }
      } catch (err) {
        log(
          `[sync/migrate-flat-fallback] could not quarantine ${flat}: ${(err as Error).message} — leaving it in place`
        );
        continue;
      }
      moves.push({ slug, from: flat, keptTwin: twin, trashedTo });
      log(
        `[sync/migrate-flat-fallback] ${flat} duplicated ${twin} (slug ${slug}) — moved ${movedLanes.join(
          ', '
        )} to ${trashedTo}/`
      );
    }
  } catch {
    /* best-effort — a scan failure must never cost the boot */
  }
  return moves;
}

/** Files under `dir`, relative to it, skipping runtime-state (`_*`) and repo
 *  internals — the same exclusions the hub's checkout scan applies. */
function walk(dir: string, prefix = '', out: string[] = []): string[] {
  let entries: Dirent[];
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
      walk(path.join(dir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}
