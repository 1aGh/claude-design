# specimen-and-media-editing

**Persona:** A designer maintaining the design system and swapping hero imagery. Expects to select and edit an element **inside a DS specimen** (not just a UI canvas), and to re-point an `<img>` at a different asset and reframe it (`object-fit: cover`) from the Inspector — without leaving the canvas.

**Feature under test:** `feature-element-editing-robustness` — Stage E (element selection + inspect + edit on bare DS specimens) and Stage F (media swap/replace via the AssetPicker + the Media knob section: `object-fit` / `aspect-ratio` / `object-position`).

**Canvases under test:**
- **Specimen:** `.design/system/maude/preview/components-buttons.tsx` — a real DS specimen. Renders **bare markup** (no `<DesignCanvas>` / `[data-dc-screen]`), so it exercises the lite-mount selection path (`canvas-comment-mount.tsx`), not `CanvasShell`. Any `preview/*.tsx` with stamped leaf elements works.
- **UI canvas with an authored `<img>`:** `.design/ui/Element Editing Lab.tsx` (`.eel-img`, `src="assets/eb268f9c.png"`) — the throwaway fixture from `element-editing-resize-and-position`.

## Hypothesis

- ⌘-click on a stamped element inside a **bare specimen** produces a selection: the resize overlay (`.dc-el-resize-handle`) paints around it and the shell Inspector auto-opens on the CSS tab — even though the specimen has 0 artboards (`isBareSpecimen`). Stage E closed a mount/router gap; downstream (`select-set`, Inspector, `edit-css`) is kind-agnostic.
- Editing a curated knob on a specimen element writes through `/_api/edit-css` to the **specimen's own `.tsx` source** (`system/<ds>/preview/*.tsx`), which HMR-reloads.
- Selecting an authored `<img>` reveals the **Media** knob section (an `object-fit` select with `cover/contain/fill/none/scale-down`, plus a **"Replace…"** button) and the right-click menu carries **"Replace image…"**.
- The AssetPicker enumerates the content-addressed `assets/` dir (via `/_api/assets` GET) and picking a different asset re-points the `<img>` `src` through `/_api/edit-attr`; changing `object-fit` writes through `/_api/edit-css`. Both persist to the `.tsx` and are Cmd+Z reversible.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1280×720+ | ✓ |
| web-mobile / ios-phone / ios-tablet / android-phone | — | **SKIPPED** |

Native + mobile **SKIPPED** — desktop-only dev tool; specimen editing and the asset picker have no touch/mobile surface. Record as `SKIPPED reason="DS specimen + media editing is a desktop-only dev tool"`. Parity N/A (single-platform project).

## Preconditions

- Dev server booted with `MAUDE_CANVAS_ORIGIN_SPLIT=0` (see `element-editing-resize-and-position/spec.md` § Preconditions for why).
- The `maude` DS specimens exist under `.design/system/maude/preview/`.
- **Restore any specimen you edit.** Specimen `.tsx` files are versioned (unlike the throwaway UI fixture) — after asserting an edit persisted, revert it (Cmd+Z, or `git checkout -- <specimen>`), so the run leaves the DS clean.

## Driving model

Same as `element-editing-resize-and-position` (shell `eval` → `iframe.contentDocument`; synthetic pointer events for the iframe; real CDP keystrokes / clicks for shell controls). Note the specimen mounts a **lite** overlay — the selected-halo class may differ from a full canvas, but the resize overlay + Inspector confirm the selection.

## Steps

1. **Open the specimen; assert bare-specimen shape.** Open `components-buttons` from the DESIGN SYSTEM tree group. Assert `iframe.contentDocument` has `[data-cd-id]` ≥ 1 and `[data-dc-screen]` **= 0** (bare specimen).
2. **⌘-click a specimen element → select + inspect.** Dispatch a metaKey chain on a stamped `button[data-cd-id]`. Assert `.dc-el-resize-handle` present and the shell Inspector open on the CSS tab. (Scope badge is null — specimens have no component scope.) Screenshot.
3. **Edit a knob → specimen source persists.** `git status` the specimen (assert clean). Change a curated property (e.g. click the Inspector "increase font-size" control). Assert `git status` now shows the specimen **modified** and the diff carries the new value (e.g. `fontSize: "12px"`). **Restore** the specimen (`git checkout`).
4. **Open the UI canvas; select the `<img>`.** Open `Element Editing Lab`, ⌘-click `.eel-img`. Assert the Inspector shows a **Media** section: an `object-fit` control offering `cover/contain/fill/none/scale-down` and a **"Replace…"** button. Screenshot.
5. **Replace the image.** Click **"Replace…"**. Assert the AssetPicker dialog opens listing ≥ 2 asset thumbnails (from `/_api/assets`). Pick a **different** asset (e.g. `e0c86a95.png`). Assert the `.tsx` `src` changed from `assets/eb268f9c.png` to the picked path.
6. **Reframe: object-fit cover → contain.** In the Media section, set `object-fit` to `contain`. Assert the source `objectFit` value updated. (Cmd+Z reverts.)

## Success criteria

- All 6 steps PASS: specimen selection + inspect + a persisted specimen-source edit (then restored), and img replace + object-fit reframe on a UI canvas.
- The specimen `.tsx` is left **clean** (any edit reverted).
- Zero JS console errors in the iframe over the run.
- Parity N/A (web-desktop only; others SKIPPED).

## Follow-ups (not blocking)

- The right-click **"Replace image…"** entry on the `<img>` was confirmed present in the element context menu but the iframe right-click was flaky to open under synthetic dispatch; the shell-side **Media § "Replace…"** button drives the same AssetPicker and was verified end-to-end. A real-CDP-right-click harness could assert the menu path too.
- **Fetch-by-URL** in the AssetPicker is a documented deferral (Task F1) — the picker's list + upload paths are the verified surface.
