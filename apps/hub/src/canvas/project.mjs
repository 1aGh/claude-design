// What a project IS, to the browser door — Cloud Phase 25 B3.
//
// Reads the checkout the cell already maintains and answers the two questions
// the studio page asks: which canvases exist, and which design system does
// each one render under. Pure filesystem reads, no build, no execution — the
// list has to work even when a canvas does not.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

/** Runtime state (DDR-115) — never a canvas, never listed. */
const RUNTIME_SEGMENT = /^_/;

export function designRootFor(env = process.env) {
  const repoDir = env.MAUDE_REPO_DIR;
  if (!repoDir) return null;
  return join(repoDir, env.MAUDE_DESIGN_ROOT ?? '.design');
}

/** Every canvas under the design root, newest-modified first within its group. */
export function listCanvases(designRoot) {
  if (!designRoot || !existsSync(designRoot)) return [];
  const out = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (RUNTIME_SEGMENT.test(e.name) || e.name === '.git' || e.name === 'node_modules') continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        walk(abs, depth + 1);
      } else if (e.name.endsWith('.tsx')) {
        const rel = relative(designRoot, abs).split(sep).join('/');
        let modified = 0;
        try {
          modified = statSync(abs).mtimeMs;
        } catch {
          /* raced a delete */
        }
        out.push({
          rel,
          name: basename(e.name, '.tsx'),
          group: rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '',
          designSystem: designSystemFor(designRoot, rel),
          modified,
        });
      }
    }
  };
  walk(designRoot);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

/**
 * Which design system a canvas renders under.
 *
 * The same precedence the desktop's `canvasUrl()` uses (DDR-093): a specimen
 * under `system/<ds>/preview/` belongs to that DS; a UI canvas declares one in
 * its `.meta.json`; everything else falls back to the first configured DS.
 * Getting this wrong is not cosmetic — the token ladder is scoped to a root
 * class, so the wrong DS renders a canvas unstyled.
 */
export function designSystemFor(designRoot, rel) {
  const specimen = /^system\/([^/]+)\/preview\//.exec(rel);
  if (specimen) return specimen[1];
  const meta = readMeta(designRoot, rel);
  if (typeof meta?.designSystem === 'string' && meta.designSystem) return meta.designSystem;
  return firstDesignSystem(designRoot);
}

function readMeta(designRoot, rel) {
  try {
    return JSON.parse(readFileSync(join(designRoot, rel.replace(/\.tsx$/, '.meta.json')), 'utf8'));
  } catch {
    return null;
  }
}

let _configCache = null;
export function readProjectConfig(designRoot) {
  if (_configCache && _configCache.root === designRoot) return _configCache.value;
  let value = {};
  try {
    value = JSON.parse(readFileSync(join(designRoot, 'config.json'), 'utf8'));
  } catch {
    value = {};
  }
  _configCache = { root: designRoot, value };
  return value;
}

/** Test seam + config hot-reload. */
export function _forgetProjectConfig() {
  _configCache = null;
}

export function firstDesignSystem(designRoot) {
  const cfg = readProjectConfig(designRoot);
  const first = Array.isArray(cfg.designSystems) ? cfg.designSystems[0] : null;
  if (first?.name) return first.name;
  // No config (or a pre-multi-DS one): fall back to the single folder under
  // `system/`, which is what a scaffolded project has.
  try {
    const dirs = readdirSync(join(designRoot, 'system'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !RUNTIME_SEGMENT.test(e.name))
      .map((e) => e.name);
    return dirs[0] ?? null;
  } catch {
    return null;
  }
}

/** The CSS a canvas needs, as design-root-relative paths (or null when absent). */
export function stylesheetsFor(designRoot, rel) {
  const ds = designSystemFor(designRoot, rel);
  if (!ds) return { tokens: null, components: null, layout: null };
  const cfg = readProjectConfig(designRoot);
  const entry = (cfg.designSystems ?? []).find((d) => d?.name === ds) ?? null;
  const dsPath = entry?.path ?? `system/${ds}`;
  const tokens = entry?.tokensCssRel ?? `${dsPath}/colors_and_type.css`;
  const components = `${dsPath}/preview/_components.css`;
  const layout = /^system\/[^/]+\/preview\//.test(rel) ? `${dsPath}/preview/_layout.css` : null;
  const exists = (p) => (p && existsSync(join(designRoot, p)) ? p : null);
  return { tokens: exists(tokens), components: exists(components), layout: exists(layout) };
}

/** The canvas's sibling `.meta.json`, as the shell injects it. */
export function canvasMeta(designRoot, rel) {
  return readMeta(designRoot, rel) ?? {};
}
