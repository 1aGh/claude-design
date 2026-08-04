// What this cell HOLDS, as counts — Cloud Phase 26 Stage 3.
//
// The control plane has never known how much work lives in a project, and it
// deliberately should not: `apps/cloud/schema.sql` earns its "a total loss of
// this database costs a customer nothing" by holding no design content at all.
// So the cell counts its own, the hourly reconcile sweep already asks it
// `/health`, and the numbers land in Analytics Engine rather than in D1.
//
// COUNTS ONLY. Not one canvas name, not one path, not one design-system name —
// a size and a tally are operational facts about capacity; the names are the
// customer's work.
//
// THREE-VALUED, AND THAT IS THE WHOLE POINT. A cell running an older image
// simply omits `stats`, and the operator board renders an em-dash. A `0` there
// would say "this customer has done nothing", which is a very different and
// much more actionable claim than "we cannot see".

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { countCanvases } from './export.mjs';

/**
 * How long a computed answer is reused.
 *
 * `/health` is polled — by the router, by `maude hub status`, by the cell's own
 * compose healthcheck, and hourly by the control plane. Walking the design root
 * on each of those would make the probe the most expensive thing the cell does,
 * and a probe that costs is a probe somebody turns down.
 */
export const STATS_TTL_MS = 5 * 60 * 1000;

/** A canvas is read this far and no further, so one huge file cannot make the
 *  health probe expensive. */
const MAX_CANVAS_READ = 2_000_000;

let cached = null;

/** Test seam. */
export function _resetTenantStats() {
  cached = null;
}

/**
 * Count `<DCArtboard` across every canvas in the root.
 *
 * A regex over known vocabulary, in the same house style as
 * `_canvas-rects-static.mjs`: parsing every canvas properly would mean a
 * transpiler in the health path, and the number is a capacity signal rather
 * than a fact anybody bills on. Approximate and cheap beats exact and slow
 * here — and the approximation only ever undercounts a dynamically-generated
 * artboard, which is rare and not what the figure is for.
 */
function countArtboards(root, depth = 0) {
  if (depth > 3) return 0;
  let n = 0;
  try {
    for (const e of readdirSync(root, { withFileTypes: true })) {
      if (e.name.startsWith('_') || e.name === '.git') continue;
      const full = join(root, e.name);
      if (e.isDirectory()) {
        n += countArtboards(full, depth + 1);
      } else if (e.name.endsWith('.tsx')) {
        try {
          // Bounded read: a pathological canvas must not be able to make the
          // health probe expensive.
          const src = readFileSync(full, 'utf8').slice(0, MAX_CANVAS_READ);
          n += (src.match(/<DCArtboard[\s/>]/g) ?? []).length;
        } catch {
          /* an unreadable canvas contributes nothing rather than failing health */
        }
      }
    }
  } catch {
    /* an unreadable directory contributes nothing */
  }
  return n;
}

/** Immediate subdirectories of `system/` — one per design system. */
function countDesignSystems(designRoot) {
  try {
    return readdirSync(join(designRoot, 'system'), { withFileTypes: true }).filter(
      (e) => e.isDirectory() && !e.name.startsWith('_')
    ).length;
  } catch {
    return 0;
  }
}

function dirBytes(dir, depth = 0) {
  if (depth > 4) return 0;
  let total = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) total += dirBytes(full, depth + 1);
      else if (e.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
          /* a file that vanished mid-walk contributes nothing */
        }
      }
    }
  } catch {
    /* no assets directory is a real answer: zero bytes of media */
  }
  return total;
}

/**
 * The `stats` block `/health` reports, or `null` when this hub serves no
 * project at all (a self-hosted sync hub with no workspace).
 *
 * `null` and not a zeroed object: "there is nothing to count here" and "we
 * counted and found nothing" are different, and only the second is a metric.
 *
 * @param {object} args
 * @param {string|null} args.designRoot  absolute path, or null when unknown
 */
export function tenantStats({ designRoot, now = Date.now() } = {}) {
  if (!designRoot) return null;
  if (cached && cached.designRoot === designRoot && now - cached.at < STATS_TTL_MS) {
    return cached.value;
  }
  let value;
  try {
    value = {
      canvases: countCanvases(designRoot),
      artboards: countArtboards(designRoot),
      designSystems: countDesignSystems(designRoot),
      assetsBytes: dirBytes(join(designRoot, 'assets')),
      // So a reader can tell a fresh count from a five-minute-old one without
      // having to know the TTL.
      countedAt: now,
    };
  } catch {
    // A failure to count is not a failure of the cell, and health must not
    // start answering 503 because a directory walk threw.
    return null;
  }
  cached = { designRoot, at: now, value };
  return value;
}
