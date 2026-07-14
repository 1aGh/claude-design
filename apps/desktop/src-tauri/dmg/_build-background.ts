// Composes the full DMG background (panel + connecting arrow + drag badge +
// caption) at the exact `bundle.macOS.dmg.windowSize` pixel dimensions, using
// only apps/studio/draw primitive constructors (no hand-authored path data)
// and colors resolved from the Maude dark-theme DS tokens
// (.design/system/maude/colors_and_type.css) via the engine's own
// `oklchToHex` — never a guessed hex.
//
// Regen recipe (from repo root, using the LOCAL cli — the globally npm-installed
// `maude` binary may lag this working tree's draw engine / deps):
//
//   node cli/bin/maude.mjs design draw-build \
//     --script apps/desktop/src-tauri/dmg/_build-background.ts \
//     --out apps/desktop/src-tauri/dmg/background.svg
//
// Then rasterize to PNG at the exact `bundle.macOS.dmg.windowSize` pixel size
// (this script only emits vector output — no SVG->PNG step exists in the repo's
// own toolchain, so reuse agent-browser, already a dependency, as a headless
// renderer instead of adding one):
//
//   inline background.svg into a bare <html><body style="margin:0"> page
//   agent-browser open file://<path-to-that-page>
//   agent-browser set viewport 660 400
//   agent-browser screenshot apps/desktop/src-tauri/dmg/background.png
//
// Verify the PNG is pixel-exact before wiring into tauri.conf.json:
//   sips -g pixelWidth -g pixelHeight apps/desktop/src-tauri/dmg/background.png
//
// SECURITY: do not add this script (or draw-build in general) to
// tauri.conf.json's beforeBuildCommand/beforeDevCommand. That job runs with
// TAURI_SIGNING_PRIVATE_KEY(_PASSWORD) and the APPLE_* notarization secrets in
// scope (DDR-126); this script executes arbitrary Bun with no sandboxing.
// Regeneration stays a manual, human-run step.
import { arrowBadgePrimitives } from './_arrow-badge.ts';

const E = await import(process.env.MAUDE_DRAW_ENGINE);
const { rect, polygon, text, place, toSvg, optimizeSvg, oklchToHex } = E;

// Single source: read window/icon-well geometry from tauri.conf.json itself
// rather than duplicating those numbers here, so the painted art can't drift
// out of sync with where Finder actually places the real icons.
const tauriConf = await Bun.file(new URL('../tauri.conf.json', import.meta.url)).json();
const dmgConf = tauriConf.bundle.macOS.dmg;
const WIDTH = dmgConf.windowSize.width;
const HEIGHT = dmgConf.windowSize.height;
const APP_POS = dmgConf.appPosition;
const FOLDER_POS = dmgConf.applicationFolderPosition;

// Maude dark-theme tokens (.design/system/maude/colors_and_type.css) — resolved
// through the engine's OKLCH math, not a hand-typed hex.
const BG_0 = oklchToHex({ l: 0.165, c: 0.012, h: 255 }); // canvas bg
const ACCENT = oklchToHex({ l: 0.68, c: 0.18, h: 268 }); // brand accent
const FG_2 = oklchToHex({ l: 0.66, c: 0.01, h: 250 }); // muted caption text
// Panel: a touch lighter + more saturated than bg-0 so the "drop zone" reads
// as a distinct surface without competing with the real Finder icon.
const PANEL = oklchToHex({ l: 0.23, c: 0.045, h: 268 });

const background = rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: BG_0 });

const panelSize = 200;
const panel = rect({
  x: FOLDER_POS.x - panelSize / 2,
  y: FOLDER_POS.y - panelSize / 2,
  width: panelSize,
  height: panelSize,
  rx: 24,
  fill: PANEL,
});

// Connecting arrow: app icon well -> panel, built from a rounded shaft rect +
// a computed triangular head (never a typed path `d`).
const shaftX1 = APP_POS.x + 96;
const shaftX2 = FOLDER_POS.x - panelSize / 2 - 14;
const shaftY = APP_POS.y;
const shaft = rect({
  x: shaftX1,
  y: shaftY - 3,
  width: shaftX2 - shaftX1,
  height: 6,
  rx: 3,
  fill: ACCENT,
});
const head = polygon({
  points: [
    { x: shaftX2 + 20, y: shaftY },
    { x: shaftX2, y: shaftY - 14 },
    { x: shaftX2, y: shaftY + 14 },
  ],
  fill: ACCENT,
});

// "Drag here" badge — same geometry the standalone proof asset verified,
// nested at the panel's inner (app-facing) corner, matching the reference
// image's badge placement relative to the folder icon.
const badge = place(arrowBadgePrimitives(E, { r: 18, ringFill: '#ffffff', arrowColor: PANEL }), {
  x: FOLDER_POS.x - panelSize / 2 + 4,
  y: FOLDER_POS.y + panelSize / 2 - 4,
});

const caption = text({
  x: WIDTH / 2,
  y: HEIGHT - 34,
  content: 'Drag Maude to Applications to install',
  fill: FG_2,
  fontSize: 14,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontWeight: 500,
  textAnchor: 'middle',
});

const prims = [background, panel, shaft, head, badge, caption];

const svg = optimizeSvg(
  toSvg(prims, {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    width: WIDTH,
    height: HEIGHT,
    a11y: { decorative: true },
  })
);

if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, svg);
console.log(`background colors: bg=${BG_0} panel=${PANEL} accent=${ACCENT} caption=${FG_2}`);
