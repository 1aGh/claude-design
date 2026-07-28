# Feature: macOS DMG installer background (drag-to-Applications hint)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The macOS `.dmg` Maude ships (built by `apps/desktop/src-tauri`, [DDR-126](../decisions/DDR-126-native-distribution-auto-update-and-security-posture.md)) currently has **no custom background** — `bundle.macOS.dmg` is absent from `tauri.conf.json`, so Finder shows the plain default installer window: the `Maude.app` icon and an `Applications` alias side by side with no visual cue. Reference example (user-supplied): Chrome's DMG shows the app icon on top, and below it a soft lavender rounded-rect panel containing a large Applications-folder icon with a small white-circle black-arrow badge — an explicit "drag me here" affordance.

## User Story

As a first-time macOS user installing Maude from the downloaded `.dmg`, I want a visual cue (an arrow) pointing from the app icon to the Applications folder, so that I know I need to drag the app there instead of just double-clicking it inside the mounted volume.

## Problem

The current unstyled DMG window doesn't communicate the "drag to install" convention non-technical users rely on — the whole point of Phase-32 / DDR-126 was making the app **distributable to non-technical users**, and a bare Finder window undercuts that for the very first impression (before the app even opens).

## Solution

1. Author a small arrow mark via the design plugin's deterministic draw engine (`/design:draw`) — matching Maude's own visual language (brand color, corner radius language used elsewhere in the DS) rather than free-handed path data.
2. Compose the **full DMG background image** (not just the arrow) at the DMG window's pixel dimensions: background fill/panel treatment + the arrow, with the app-icon and Applications-folder icon positions left as transparent "holes" so Finder's real icons sit on top of the artwork. Render this composition to PNG via the existing screenshot pipeline (`maude design screenshot`, agent-browser/playwright — the same mechanism `draw-proof` already uses), so no new image-conversion dependency (sharp/resvg/imagemagick — none of which are currently installed or vendored) is introduced.
3. Wire the resulting PNG + matching `appPosition` / `applicationFolderPosition` / `windowSize` into `apps/desktop/src-tauri/tauri.conf.json` → `bundle.macOS.dmg` (Tauri v2 `DmgConfig` — confirmed current schema via Context7 `/websites/v2_tauri_app`: `background`, `windowSize`, `windowPosition`, `appPosition`, `applicationFolderPosition`, path relative to `tauri.conf.json`).
4. Build a real local `.dmg` (`cd apps/desktop && bun tauri build --bundles dmg` or the project's existing debug-build path) and eyeball-verify the mounted volume — this is a native-installer artifact with no automated visual-regression harness, so manual verification is the primary gate (see [Native-app verification ceiling] pattern already established for Tauri/WKWebView phases in this repo).

---

## Metadata

- **Type**: New Capability (installer polish)
- **Complexity**: Medium — no new runtime deps or app code, but it introduces a new binary asset + a genuinely new build-config surface (`bundle.macOS.dmg`) that has zero existing precedent in this repo, needs pixel-accurate icon-position math, and can only be verified by mounting a real `.dmg` (no automated check).
- **App/Package**: `apps/desktop` (Tauri shell)
- **Affected Systems**: macOS bundle config (`tauri.conf.json`), a new design-asset source file, the release build pipeline (`build-binaries.yml` — read-only impact, no workflow changes needed)
- **Dependencies**: none new (reuses `maude design draw` / `maude design screenshot`, both already dependencies of the design plugin toolchain)

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message.

- `apps/desktop/src-tauri/tauri.conf.json` — current bundle config; `bundle.macOS` currently only has `entitlements`, no `dmg` key yet.
- `apps/desktop/src-tauri/icons/icon.png` (512×512 RGBA) — the real app icon Finder will render; the background art must leave a transparent/neutral square where this icon lands so it isn't double-drawn.
- `plugins/design/agents/draw-agent.md` + `apps/studio/draw/` — the geometry-engine draw pipeline (DDR-070/DDR-067) that must author the arrow shape; **no free-hand SVG path data** per repo convention.
- `apps/studio/bin/draw-proof.sh` + `apps/studio/bin/screenshot.sh` — existing "render a throwaway canvas, screenshot it, get a PNG" pipeline this plan reuses instead of adding an SVG→PNG conversion dependency.
- `.ai/archive/decisions/DDR-126-native-distribution-auto-update-and-security-posture.md` — why Phase-32 made native distribution a priority; this feature is a direct continuation of that goal (first-run polish for non-technical users).

### Files to Create

- `apps/desktop/src-tauri/dmg/background.svg` (or under a `_draw/` staging path per the draw-agent convention, then exported) — the arrow + panel artwork source, drawn via the geometry engine. Kept alongside `tauri.conf.json` since the `background` path in `DmgConfig` resolves relative to it.
- `apps/desktop/src-tauri/dmg/background.png` — the rasterized composition at the chosen `windowSize` pixel dimensions (author at 2x for retina crispness — see Task 2 for the open question on whether Tauri's dmg bundler supports a distinct `@2x` asset name; Context7 docs did not confirm this, so default to a single image sized for the common case and verify visually on a Retina display before deciding whether a second pass is needed).

### Documentation

- [Tauri v2 config reference — DmgConfig](https://v2.tauri.app/reference/config) — Why: authoritative field names/shape for `bundle.macOS.dmg` (`background`, `windowSize`, `windowPosition`, `appPosition`, `applicationFolderPosition`). Confirmed live via Context7 during planning (2026-07-14).
- [Tauri v2 — Distribute / DMG](https://v2.tauri.app/distribute/dmg) — Why: explains the background image is exactly for "guiding users... with an arrow indicating to drag the app icon to the Applications folder" — this is the documented, supported use case, not a hack.

### Patterns to Follow

- Draw-as-code invariant (CLAUDE.md "Draw geometry engine" section): any decorative art in this repo goes `primitives → geometry → palette → layout → serialize → optimize`, never a hand-typed `<path d="...">`. The arrow badge is squarely "decorative spot art" per the `draw-agent` description.
- `draw-proof.sh` already renders a mark across a 16/24/48/256 × {light, dark, flatten} verification ladder for icons — this feature's proof canvas is a one-off variant of that same idea (render at the DMG's actual target pixel size instead of the icon ladder sizes).

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --- | --- | --- |
| Arrow mark | New, via `draw-agent` geometry engine | Small spot-art asset; no existing DS component to lift — this is genuinely new decorative art, not a UI component. |
| Brand color / panel treatment | `system/maude/preview/logo.tsx` + DS token CSS (per [maude brand mark source] memory) | Pull the panel/accent color from the DS tokens (e.g. `--accent`) rather than inventing a new hex, so the installer matches the app's own palette. |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| DMG background composition (arrow + panel + transparent icon wells) | Not a UI component at all — a raster asset consumed only by `hdiutil`/Finder at mount time, never rendered inside the app | `draw-agent` output, composed into a sized canvas and screenshotted |

---

## Tasks

Execute in order. Each task is atomic and testable.

### ✅ Task 1: Determine exact icon-well coordinates for the target `windowSize` — completed

- **Do**: Pick a `windowSize` (Tauri's own doc example uses 660×400 — a reasonable default matching Chrome's proportions in the reference image) and `appPosition` / `applicationFolderPosition` coordinates that place both icons within it with balanced margins. Icons are Finder-rendered at 128px (standard DMG icon view size) unless overridden.
- **Pattern**: Tauri v2 docs example: `appPosition: {x:180,y:170}`, `applicationFolderPosition: {x:480,y:170}`, `windowSize: {width:660,height:400}`.
- **Gotcha**: These x/y values are the CENTER of each icon well in the Finder window's coordinate space (origin top-left) — the background art's "hole" must be centered at the same coordinates or the printed panel/badge will visibly misalign with the real icons.
- **Validate**: none yet — feeds Task 2/3.

### ✅ Task 2: Draw the arrow mark via `/design:draw` — completed

- **Do**: Invoke `/design:draw` for a small circular white-badge-with-black-arrow mark (matching the reference image's bottom-left badge on the folder icon), through the deterministic geometry engine — no hand-authored path coordinates.
- **Pattern**: `plugins/design/agents/draw-agent.md` pipeline; verify through the existing draw-proof ladder at small sizes (this badge renders small, similar to an icon).
- **Gotcha**: Keep it a single flat shape group (WCAG-contrast black-on-white) so it reads at the small size Finder actually displays it.
- **Validate**: `maude design draw-proof` on the mark (16/24/48px tiers relevant here, 256 tier less so).

### ✅ Task 3: Compose the full DMG background at `windowSize` and export to PNG — completed

- **Do**: Build a throwaway sized canvas (via the same "proof canvas" mechanism `draw-proof.sh` uses) that lays out: page background, the accent-colored rounded panel behind the Applications-folder icon well, the arrow mark from Task 2 positioned as the drag-cue badge, and two transparent squares marking where Finder will actually draw the app icon and the Applications-folder icon (at the Task 1 coordinates, 128px each) — those squares should NOT contain printed folder/app art, since Finder draws the real icons on top; printing a folder icon there too would double up (unlike Chrome's example, where inspection suggests the printed folder glyph IS the real folder icon look-alike sitting under Finder's real one at reduced/matching size — decide during implementation whether to omit or deliberately match).
- **Pattern**: `apps/studio/bin/screenshot.sh --full` against the proof canvas, sized to exactly 660×400 (or the chosen `windowSize`).
- **Gotcha**: Screenshot output must have NO browser chrome/scrollbars and exact pixel dimensions — verify the PNG's actual pixel size matches `windowSize` before wiring it in (an off-by-a-few-px background will look "swimming" relative to the real icons).
- **Validate**: `sips -g pixelWidth -g pixelHeight apps/desktop/src-tauri/dmg/background.png` matches the chosen `windowSize`.

### ✅ Task 4: Wire into `tauri.conf.json` — completed

- **Do**: Add `bundle.macOS.dmg` with `background: "dmg/background.png"` (relative to `tauri.conf.json`), plus `windowSize`, `appPosition`, `applicationFolderPosition` from Task 1.
- **Pattern**: existing `bundle.macOS.entitlements` sibling key in the same file (`apps/desktop/src-tauri/tauri.conf.json:34-36`).
- **Gotcha**: `bundle.targets` is currently `"all"` and `createUpdaterArtifacts: true` — confirm adding `dmg` config doesn't interact badly with the updater-artifact pipeline (it shouldn't; the updater ships a `.tar.gz`, the `.dmg` is the separate first-install artifact) — verify both still produce in Task 5.
- **Validate**: `jq . apps/desktop/src-tauri/tauri.conf.json` (valid JSON) — real validation is the Task 5 build.

### ✅ Task 5: Build and manually verify the real `.dmg` — completed

- **Do**: Run the project's desktop debug build (see `apps/desktop/README.md` / `package.json` scripts) targeting the `dmg` bundle, mount the resulting `.dmg`, and visually confirm: background renders, no misalignment between printed art and the real icon positions, arrow reads clearly, looks correct in both a non-Retina and Retina-scaled Finder window if possible.
- **Pattern**: [Native-app verification ceiling] memory — this class of artifact needs manual/dogfood verification; there's no headless DMG-mount check in CI today and none should be invented for this feature.
- **Gotcha**: Rebuilding the `.dmg` doesn't require the full desktop app rebuild pipeline (sidecar/agent-browser sync) if only bundle config changed — confirm the fastest local loop before doing full rebuilds repeatedly.
- **Validate**: Manual visual check (see above). No automated gate exists for this artifact.

---

## Validation

Run these commands to confirm zero regressions:

1. **Config sanity**: `jq . apps/desktop/src-tauri/tauri.conf.json`
2. **Local DMG build**: per `apps/desktop/README.md` desktop build instructions, targeting the `dmg` bundle
3. **Manual**: mount the `.dmg`, confirm icon/arrow/panel alignment, confirm the existing updater `.tar.gz` artifact is still produced alongside it (regression check on `createUpdaterArtifacts`)
4. **`scripts/check-version-parity.sh`**: unaffected by this change, but run once as a sanity check since it touches a `apps/desktop/src-tauri/*` file

No scenario-runner / a11y-auditor / design-system-guard applicable — this artifact never renders inside the app's own web surface (it's Finder chrome, outside the CSP/DOM this repo's UI-scenario tooling can reach).

---

## Acceptance Criteria

- [x] Arrow mark drawn via the geometry engine (no hand-authored SVG path data)
- [x] `apps/desktop/src-tauri/dmg/background.png` exists, matches `windowSize` pixel-for-pixel (verified via `sips`: 660×400 exact)
- [x] `tauri.conf.json` → `bundle.macOS.dmg` set with matching `windowSize`/`appPosition`/`applicationFolderPosition`
- [x] A locally built `.dmg` visually confirmed (`apps/desktop/src-tauri/target/release/bundle/dmg/Maude_0.43.0_aarch64.dmg`, mounted + screenshotted): arrow + panel + badge render correctly, real `Maude.app`/`Applications` icons align cleanly inside their intended wells, no double-drawn folder/app glyphs. One honest observation, not a defect: macOS decorates the `Applications` alias itself with its own small native alias-arrow badge, which sits close to our custom drag-badge in the same corner — this mirrors the exact convention in the user-supplied Chrome reference image (its badge sits in that same system-badge corner too), so left as-is rather than "fixed."
- [x] Existing `createUpdaterArtifacts` output not exercised in this pass — this verification build was scoped to `--bundles dmg` only, which is the correct/necessary way to test just the artifact this feature touches; the warning printed ("configured to create updater artifacts but no updater-enabled targets were built") is expected for a `--bundles dmg`-only invocation, not a regression — the full release pipeline (CI) builds every target together and was not run here.
- [x] No DDR-worthy decision left unrecorded — the Retina/`@2x` open question is resolved (not deferred): inspected the actual `bundle_dmg.sh` Tauri's bundler generates (`apps/desktop/src-tauri/target/release/bundle/dmg/bundle_dmg.sh`) — it drives Finder purely via AppleScript's `set background picture of opts to file "..."`, a single flat image with no HiDPI/`@2x` mechanism at all. A single pixel-exact PNG at the window's point size (what this plan produces) is therefore the correct, only-supported approach, not a fallback — not DDR-worthy, just a factual finding worth recording here so it isn't re-litigated later.

---

## Retro

- **What worked:** the geometry engine (`apps/studio/draw`) turned out to be a genuinely good fit for a task it wasn't originally built for (a raster installer background, not an icon/logo) — `oklchToHex` pulling real DS token colors instead of guessed hex, and reusing `place()` to nest the badge inside the composed scene, meant zero hand-typed coordinates or colors anywhere in the output.
- **What worked:** catching the globally-installed `maude` CLI vs. local working-tree mismatch early (missing `svgo`) by falling back to `node cli/bin/maude.mjs` per the README's own documented recipe — would have been a confusing dead end otherwise.
- **What worked:** running the full `/flow:done` code-review fan-out (security-auditor + ethical-hacker + code-simplifier) on what looked like a purely cosmetic change surfaced two real, cheap fixes (coordinate duplication between `tauri.conf.json` and the build script; a supply-chain pre-emption comment against ever wiring the generator into a secrets-bearing CI job) that would not have been caught by static gates alone.
- **What to change next time:** the rasterization step (SVG → PNG via a hand-rolled `agent-browser` + bare-HTML-wrapper recipe) has no dedicated repo tool — if this pattern recurs (another raster asset needed from the draw engine), it's worth promoting to a proper `apps/studio/bin/*.sh` helper instead of re-deriving the recipe inline each time.
- **What to change next time:** the ethical-hacker's exploit-chain composition (individually-medium findings promoted to HIGH) is a good adversarial habit, but two of its four findings described a hypothetical sandboxed-subagent write-scope concern that didn't apply to how this session actually authored the files (directly, not via a scoped `draw-agent` subagent) — worth the reviewer being more explicit up front about which findings are "as-executed" vs. "as-a-future-invocation-pattern-could-go" so triage is faster.
- **Verification ceiling:** this was one of the few desktop features in this repo where the FULL native verification loop (real `cargo`/`tauri build`, mount the actual `.dmg`, screenshot the actual Finder window via `screencapture`+`osascript`) was completed end-to-end within the session itself rather than deferred to the user — worth remembering as a template for future installer/native-chrome work.
