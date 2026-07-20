# DDR-188: Convert children to absolute position — reversing a documented non-goal, one batch write, plain-children-only

**Status:** Accepted
**Date:** 2026-07-18
**Tags:** canvas-edit, convert-to-absolute, ast-write, layout, undo, figma-parity, ddr-054

## Context

When a generated flex/grid layout fights a designer's manual tweaks, there was no way to flatten it: the reposition/nudge/align lanes all gate on an element ALREADY being out-of-flow (`position:absolute|fixed`), and two code comments (`contextual-toolbar.tsx`, `use-element-resize.tsx`) explicitly recorded "never convert-to-absolute" as a deliberate non-goal — the codebase's stance was that an implicit convert-on-drag would surprise users and fight the JSX-is-truth model (DDR-027).

The user asked for Figma's "Remove auto layout": right-click a container → freeze its children's computed boxes → rewrite them to `position:absolute` so they can be dragged freely. This DDR reverses the non-goal — but deliberately, as an EXPLICIT opt-in action, not the implicit on-drag conversion the original comments warned against (that stays a non-goal).

## Alternatives considered

**Write path — N calls vs one batch:**
- **N sequential `/_api/edit-css` calls** (one per property per child + the container) — rejected: each is a separate source write + HMR reload + its OWN undo `seq`, so Cmd+Z would unwind one property at a time (dozens of steps to undo one convert) and the canvas would flicker through N intermediate states. The plan's "one whole-file snapshot undo record" is the whole point.
- **One batch AST write over a single parse** — picked. New pure `applyConvertToAbsolute(path, source, spec)` (canvas-edit.ts) parses once and applies every child's `position/left/top/width/height/box-sizing` + the container's `position:relative` to ONE `MagicString`, returning the new source. The async `convertToAbsolute` wrapper writes atomically under the per-file lock; `convertChildrenToAbsoluteOp` (api.ts) snapshots before/after and emits a single `logUndo` `seq`. This rides the EXISTING Stage-I whole-file undo lane (DDR-138) verbatim — the shell's `structuralWrite` relays `record-edit(op:'reorder', seq)` and one Cmd+Z reverts the entire operation via `/_api/reorder-revert`. Zero new undo machinery.

**The multi-property-per-element writer:**
- **Reuse `editStyleProp` N× per child** — rejected: it re-reads the ORIGINAL AST each call, so on a style-less element the 2nd..6th calls each re-insert a fresh `style={{…}}`, producing duplicate attributes. New `setMultipleStyleProps` handles the no-style case with a single combined insert and delegates the existing-style case per-prop (distinct keys → non-overlapping edits; new-key appends stack correctly). A regression test asserts exactly one `style={{` per element.

**Shared / repeated children — confirm vs abort:**
- **Route shared-component children through an "affects N instances" confirm dialog** (the plan's original idea) — the Stage-H "shared instance" surface turned out to be a passive Inspector BADGE, not a blocking modal; there is no confirm-dialog primitive to reuse. Building one was out of scope.
- **Plain-children-only, honest abort for the rest** — picked. The canvas iframe pre-filters: it refuses (all-or-nothing, with a clear toast) if ANY direct child is unstamped, or if any child/container `data-cd-id` appears more than once in the artboard (a `.map()`ed list or a shared-component instance — one source element can't hold N distinct absolute positions). The AST writer's `resolveUsageId` guard is the server-side backstop: a child whose `idIndex` resolves to a different `<Component/>` usage throws. This is a correct SUBSET, not a workaround — converting repeated/mapped content to absolute is genuinely ill-defined; refusing it is the right behavior, and it covers the stated use case (hand-authored flex heroes) cleanly. The "affects N instances" confirm for true component instances is a deferred follow-up.

**Box fidelity (zero visual delta):**
- Measured client-side: each child's border-box in WORLD units (`getBoundingClientRect` is post-zoom screen px, divided by `worldZoomFor`; computed border widths are unscaled world px). `left`/`top` are measured from the container's PADDING edge (where CSS absolute positioning originates); `width`/`height` are the border-box, and we also write `box-sizing:border-box` so the outer rectangle is preserved regardless of the child's own box model (inner content may reflow within an unchanged box — Figma-consistent). The container becomes `position:relative` only when it's currently `static`.

## Decision

Ship an explicit context-menu action "Convert children to absolute position", container-gated (`hidden` unless the element has stamped direct children). It measures each direct stamped child's frozen border-box (world units, padding-relative) in the canvas, posts a `convert-to-absolute-request` up to the main-origin shell (DDR-054 — canvas requests, shell writes), which calls the new main-origin-only `/_api/convert-to-absolute` route → `convertChildrenToAbsoluteOp` → `convertToAbsolute` → one `MagicString` pass → one `logUndo` seq. Plain, globally-unique children only; unstamped / repeated / component-instance children abort with a clear message. The two non-goal comments are updated to point here: the IMPLICIT convert-on-drag remains a non-goal; this EXPLICIT action is the opt-in flatten path.

## Consequences

- One atomic Cmd+Z reverts a whole convert (rides the existing DDR-138 lane).
- After converting, the flow layout is flattened: children can be dragged/nudged/aligned freely (they're now out-of-flow, satisfying every reposition-lane gate). Grid-track editing (web plan) no longer applies to converted children — surfaced as a toast when the container was a grid.
- A "convert back to flow" is intentionally NOT offered (undo is the reversal — the operation is one-way by design).
- Security posture: the route is main-origin-only (absent from `CANVAS_SAFE_API` + `startCanvasServer`), `sameOriginWrite` + loopback-Host gated, rate-limited via `takeStructuralToken`, every numeric field bounded (|v| ≤ 1e6), children capped at 500, ids validated against `CD_ID_RE` — identical to the other structural write ops.

## Addendum (2026-07-19) — the component-instance confirm shipped

The originally-deferred "affects N instances" path landed in the follow-up session: when any direct child's `data-cd-id` repeats in the artboard, the canvas asks a `window.confirm` (the shell-side count is client-computable — no extra parse round-trip) and, on yes, sends `allowShared: true` + a per-child `idIndex` (DOM occurrence). Server-side, `resolveUsageId` routes each such child's write to its own `<Component/>` **usage** tag (the Stage-H3 local-instance model — position stays local to the instance; the shared definition is untouched; the component must forward `style` to paint, the same assumption whole-instance drag-reposition makes). A `.map()`ed child still refuses regardless — detected as two children resolving to the SAME target element ("repeated source element"), which is the one shape that genuinely cannot hold N absolute positions. Covered by two new unit cases (per-usage boxes; `.map` refusal). **Verified live end-to-end** (2026-07-19): context-menu gating, frozen-box payload, one-seq write, zero visual delta after HMR.

## Addendum 2 (2026-07-19/20) — "convert nic nedělá": sandboxed confirm, visible feedback, artboard-level convert

**Root cause of the user's "convert does nothing":** the canvas iframe runs with `sandbox="allow-scripts allow-same-origin"` (no `allow-modals`), so the T8b `window.confirm()` **silently returned `false`** — any container with repeated children (component instances are everywhere in real canvases) aborted invisibly. Compounding it, a SUCCESSFUL convert is zero-visual-delta *by design*, and server refusals only went to `console.warn` — success and failure both looked like "nothing happened."

Fixes:
1. **`canvasConfirm()`** (use-canvas-media-drop.tsx) — a sandbox-safe promise-based in-canvas dialog (overlay + two buttons, Esc/backdrop/Enter). Replaces every `window.confirm` on the canvas surface.
2. **Visible outcome, both ways** — the shell's `structuralWrite` now posts a `dgn:'op-toast'` down: success = "Converted N elements to absolute — press V and drag them freely (⌘Z to undo)"; failure = the server's actual refusal text (e.g. the `.map` message).
3. The shell hop itself was **verified end-to-end** via a forged `MessageEvent` (real `source: iframe.contentWindow`, so the DDR-054 confused-deputy gate ran for real): handler → `/_api/convert-to-absolute` → one-pass source rewrite + seq.

**Artboard-level convert (user steer: "convert vše na absolute" for marketing graphics).** `applyConvertToAbsolute` now accepts a `containers[]` batch — the whole artboard's stamped-container tree flattened to absolute in ONE pass / ONE undo seq. The root level (`.dc-artboard-body`, already `position:relative` engine chrome with no cd-id) takes children boxes with no container write; an element that is both a converted child and a container gets exactly ONE `position` key (absolute wins — it is itself a positioning context). Client walk is recursive top-down (canvas-shell `postConvertArtboardToAbsolute`). Reachable from (a) the artboard context menu ("Convert layout to absolute…") and (b) a `canvasConfirm` offer when switching an artboard's kind to **Digital or Print** ("Switch + freeze" / "Just switch") — those two kinds are the freely-composed marketing surfaces; `web` stays flow-first. Deliberately NOT a literal reparent-flatten of the JSX tree: moving subtrees out of their parents would break scoped styles, component boundaries, and `.map`s — recursive per-container freezing gives the same "drag anything anywhere" outcome (children ride with their parent, Figma-group-like) without destroying the document structure.

**Detach component** (same session, user request): `applyDetachComponent` clones the component's definition under a fresh name (`CardDetached`, `CardDetached2`, …) and repoints ONE usage at the clone — behavior-preserving for ANY component (props/children flow unchanged; no substitution heuristics), and subsequent edits resolve LOCAL. Surfaced as a "Detach" button on the Inspector's Shared scope badge (`/_api/detach-component`, whole-file undo seq). This — together with the existing Stage-H3 usage-level box writes — is the answer to "an absolute child inside a reused component moved in every artboard": per-instance BOXES go on the usage tag; anything deeper, detach first.

Authoring guidance landed in the design plugin (`new.md` marketing-graphic brief cue + `edit.md` §0.9 absolute-layout awareness): digital/print marketing compositions author absolute-first; per-instance positions go on usage tags; never "normalize" an absolute layout back into flow.
