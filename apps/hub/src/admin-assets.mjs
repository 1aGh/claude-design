// Admin UI asset loader. Reads the 3 files at module init from <here>/admin/.
//
// Dev:    <here> = src/                → src/admin/{index.html, style.css, app.js}
// Bundle: <here> = dist/               → dist/admin/{index.html, style.css, app.js}
//                  (build.ts copies src/admin → dist/admin alongside hub.bundle.mjs)
//
// Reads happen once at module load; everything after is in-memory. Bundling
// inlines this module into hub.bundle.mjs, so import.meta.url resolves to
// `file://.../dist/hub.bundle.mjs` and the sibling `admin/` directory is
// what we read.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = join(HERE, 'admin');

function loadOrEmpty(name) {
  try {
    return readFileSync(join(ADMIN_DIR, name), 'utf8');
  } catch (err) {
    if (process.env.MAUDE_HUB_DEBUG) {
      console.warn(`[hub] admin asset ${name} not found at ${ADMIN_DIR}: ${err.message}`);
    }
    return '';
  }
}

export const ADMIN_HTML = loadOrEmpty('index.html');
export const ADMIN_CSS = loadOrEmpty('style.css');
export const ADMIN_JS = loadOrEmpty('app.js');
export const ADMIN_DIR_RESOLVED = ADMIN_DIR;

export function adminAssetsLoaded() {
  return ADMIN_HTML !== '' && ADMIN_CSS !== '' && ADMIN_JS !== '';
}
