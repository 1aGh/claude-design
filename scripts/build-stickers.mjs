#!/usr/bin/env node
// build-stickers.mjs — one-shot asset-prep for the whiteboard sticker picker
// (feature-whiteboard-annotation-improvements, Phase 4).
//
// Rasterizes each pack's source stickers (a mix of SVG and PNG, as delivered)
// into PNG at a shipping size, and writes them to apps/studio/stickers/<pack>/.
// PNG is the shipping format for every pack regardless of source format: the
// `/_api/asset` upload sniffer (api.ts) only accepts png/jpg/gif/webp by
// design — that endpoint is reachable from the untrusted canvas origin, so
// loosening it to accept SVG would widen what an in-canvas actor could plant,
// a bigger blast radius than rasterizing 4 curated packs once. Rasterizing
// here means every sticker — whichever pack it came from — flows through the
// EXACT same createImageFromFile → POST /_api/asset path with zero new trust
// surface (see the plan's "Sticker sourcing" section for the full reasoning).
//
// Uses the project's existing `playwright` devDependency (already a fallback
// engine for screenshot.sh / canvas-rects.sh) — zero new dependencies.
//
// Usage:
//   node scripts/build-stickers.mjs --contact-sheets   # curation pass: also
//                                                       # writes one contact-
//                                                       # sheet PNG per pack to
//                                                       # /tmp for visual review
//   node scripts/build-stickers.mjs                     # normal build

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from '../apps/studio/bin/_pw-launch.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIR = '/Users/iagh/Downloads/Stickers';
const OUT_DIR = join(REPO_ROOT, 'apps/studio/stickers');
const SHIP_SIZE = 256; // shipped sticker PNG size (square canvas, content centered)
const CONTACT_CELL = 96; // contact-sheet cell size — small, just enough to recognize

const PACKS = [
  { dir: 'Project status stickers (Community) - Iconfinder', slug: 'project-status' },
  { dir: 'Life Style Stickers (Community) - Pelin ŞENOĞLU', slug: 'life-style' },
  { dir: 'FigJam Doodle Stickers - CJ Xue', slug: 'figjam-doodle' },
  { dir: 'Opposing Thoughts Stickers - Erik Leib', slug: 'opposing-thoughts' },
];

function slugifyName(name) {
  return name
    .toLowerCase()
    .replace(/[!?.]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listStickerFiles(dir) {
  return readdirSync(dir)
    .filter((f) => /\.(svg|png)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Wrap raw SVG markup in a minimal page sized to SHIP_SIZE, transparent bg. */
function svgPageHtml(svgMarkup) {
  // width/height 100% (not max-width/max-height) — these source SVGs carry
  // small intrinsic pixel dimensions (e.g. 27×23), and max-* only caps growth
  // relative to that intrinsic size, leaving a tiny icon adrift in the
  // SHIP_SIZE canvas. Forcing 100% scales it up to fill the box; the SVG's
  // own viewBox + default preserveAspectRatio="xMidYMid meet" keeps the
  // aspect ratio correct (centered, not stretched) without extra markup.
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;}
    .wrap{width:${SHIP_SIZE}px;height:${SHIP_SIZE}px;padding:24px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;}
    svg{width:100%;height:100%;}
  </style></head><body><div class="wrap">${svgMarkup}</div></body></html>`;
}

function pngPageHtml(dataUrl) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;}
    .wrap{width:${SHIP_SIZE}px;height:${SHIP_SIZE}px;padding:12px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;}
    img{width:100%;height:100%;object-fit:contain;}
  </style></head><body><div class="wrap"><img src="${dataUrl}"/></div></body></html>`;
}

function contactSheetHtml(cells) {
  const items = cells
    .map(
      (c) => `<div class="cell">
        <img src="${c.dataUrl}" />
        <div class="label">${c.label}</div>
      </div>`
    )
    .join('');
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:8px;background:#1a1a1a;font-family:monospace;}
    .grid{display:grid;grid-template-columns:repeat(8, ${CONTACT_CELL}px);gap:6px;}
    .cell{width:${CONTACT_CELL}px;display:flex;flex-direction:column;align-items:center;background:#2a2a2a;border-radius:4px;padding:4px;box-sizing:border-box;}
    .cell img{width:${CONTACT_CELL - 16}px;height:${CONTACT_CELL - 16}px;object-fit:contain;background:#fff;border-radius:3px;}
    .label{color:#9ad;font-size:8px;text-align:center;word-break:break-all;margin-top:2px;line-height:1.15;}
  </style></head><body><div class="grid">${items}</div></body></html>`;
}

async function main() {
  const contactSheets = process.argv.includes('--contact-sheets');
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await launchChromium();
  try {
    const ctx = await browser.newContext({
      viewport: { width: SHIP_SIZE, height: SHIP_SIZE },
      deviceScaleFactor: 2, // ship @2x for crispness at typical picker-tile sizes
    });

    for (const pack of PACKS) {
      const srcDir = join(SOURCE_DIR, pack.dir);
      if (!existsSync(srcDir)) {
        console.error(`skip ${pack.slug}: source dir not found: ${srcDir}`);
        continue;
      }
      const outDir = join(OUT_DIR, pack.slug);
      mkdirSync(outDir, { recursive: true });
      const files = listStickerFiles(srcDir);
      console.log(`${pack.slug}: ${files.length} files`);

      const contactCells = [];
      for (const file of files) {
        const srcPath = join(srcDir, file);
        const ext = extname(file).toLowerCase();
        const stem = basename(file, ext);
        const outName = `${slugifyName(stem)}.png`;
        const outPath = join(outDir, outName);

        const page = await ctx.newPage();
        if (ext === '.svg') {
          const svg = readFileSync(srcPath, 'utf8');
          await page.setContent(svgPageHtml(svg));
        } else {
          const b64 = readFileSync(srcPath).toString('base64');
          await page.setContent(pngPageHtml(`data:image/png;base64,${b64}`));
        }
        await page.locator('.wrap').screenshot({ path: outPath, omitBackground: true });
        await page.close();

        if (contactSheets) {
          const shipped = readFileSync(outPath).toString('base64');
          contactCells.push({
            dataUrl: `data:image/png;base64,${shipped}`,
            label: `${stem}\n→ ${outName}`,
          });
        }
      }

      if (contactSheets && contactCells.length) {
        const sheetPage = await ctx.newPage();
        await sheetPage.setViewportSize({ width: 900, height: 100 });
        await sheetPage.setContent(contactSheetHtml(contactCells));
        const outPath = `/tmp/sticker-contact-${pack.slug}.png`;
        await sheetPage.locator('.grid').screenshot({ path: outPath });
        await sheetPage.close();
        console.log(`  contact sheet: ${outPath}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main();
