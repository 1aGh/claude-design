# video-timeline-badge

**Persona:** A designer with a video artboard (`kind="video"`, or a `<VideoComp>`-bearing subtree) who wants to jump into the Timeline editor directly from the canvas — click the small timeline badge in the artboard's label strip, no menu-diving required. This must work in whichever tool they happen to be in, most commonly the default working tool, Move.

**Feature under test:** issue-78 fix (`apps/studio/input-router.tsx`) — the capture-phase `click` listener inside `useInputRouter` used to unconditionally `preventDefault()` + `stopImmediatePropagation()` every click classified as `select` (i.e. every bare click while in the Move tool), which silently swallowed clicks on artboard-chrome controls living outside `.dc-artboard-body` — specifically `.dc-artboard-video-badge` (`apps/studio/canvas-lib.tsx`, DDR-148), whose `onClick` posts `{dgn:'open-timeline-request', artboardId}` to open the Timeline panel (`apps/studio/client/app.jsx`, `setTimelineOpen(true)`). The fix adds `yieldsClickToArtboardChrome(wouldRouteKind, target, modifiers)` (mirroring the existing `yieldsToArtboardDrag` used by the pointerdown/mousedown handlers) and gates the click handler's suppression on it, so a bare click (no Cmd/Ctrl) on artboard chrome outside `.dc-artboard-body` still reaches React.

**Canvas under test:** `.design/ui/Video Timeline Badge Lab.tsx` — a **throwaway verification fixture** (`@opt_out full`, `@ds maude`). One `DCArtboard` (`vtb-alpha`) with an explicit `kind="video"` prop (no real `<VideoComp>` content needed — the scenario proves the CLICK reaches React, not real timeline content; the Timeline panel's own empty-state, `[data-testid="timeline-empty"]`, is sufficient proof the panel opened). Regenerable — delete and re-author from this description if absent.

## Relationship to `artboard-kinds`

`artboard-kinds/spec.md` covers the `kind` prop's chrome (icon chip + tint) but explicitly does NOT cover the video-timeline badge's click-to-open-timeline behavior — that badge is a *separate* interactive control (`hasVideo` gate, `apps/studio/canvas-lib.tsx` ~L2299), not part of the kind-chip chrome. Kept as its own minimal scenario rather than folded into `artboard-kinds` because: (a) the feature under test is a distinct bug in the input-router's click-arbitration, unrelated to the AST write-lane / context-menu / Inspector-picker surfaces `artboard-kinds` exercises, and (b) folding it in would blur `artboard-kinds`' own hypothesis (kind-chrome rendering + persistence) with an unrelated input-routing regression. Both scenarios share the same dev-server preconditions.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1280×720+ | ✓ |
| web-mobile / ios-phone / ios-tablet / android-phone | — | **SKIPPED** |

Native + mobile **SKIPPED** — the Maude Studio dev-server is desktop-development tooling; the artboard label-strip chrome (including the video-timeline badge) has no touch/mobile parity surface. Same rationale as `artboard-kinds` / `canvas-figjam-feel`. Record as `SKIPPED reason="canvas editor is a desktop-only dev tool; no touch/mobile parity story"`. Project `platforms` config is single-platform, so parity is N/A (not a gap).

## Preconditions

- Dev server booted in **same-origin mode** so the harness can reach the canvas iframe via `iframe.contentDocument`:
  `MAUDE_CANVAS_ORIGIN_SPLIT=0 MAUDE_SKIP_RUNTIME_BUILD=1 bun run apps/studio/server.ts --root . --port <N>`
- `.design/ui/Video Timeline Badge Lab.tsx` present (re-author from the fixture description above if absent).
- Browser viewport ≥ 1280×720. Isolated `agent-browser --session <name>`.
- Boot tool posture is **Browse** (`ToolProvider`'s `initial='browse'`, DDR-187) — the scenario MUST explicitly arm **Move** before the click, since that's the reported repro's tool state (a bare click is a native pass-through in Browse and would false-pass regardless of the bug).

## Driving model (agent-browser)

Same as `artboard-kinds`: with `MAUDE_CANVAS_ORIGIN_SPLIT=0` the canvas iframe (`[data-testid="canvas-frame"]`) is same-origin, reachable via `contentDocument`/`contentWindow` from a shell-frame `eval`.

- **Tool arm:** post `{dgn:'tool-set', tool:'move'}` to `canvasFrame.contentWindow` — the same lane `canvas-shell.tsx`'s `tool-set` message handler and the palette/keyboard-shortcut (`V`) both drive, so this exercises the real tool-state store (`use-tool-mode.tsx`), not a shortcut around it. Assert `.dc-canvas[data-active-tool="move"]` before clicking.
- **Click drive:** per `canvas-figjam-feel`'s proven pattern (headless CDP coordinate clicks on iframe content are unreliable per the `structural-and-scope` caveat), dispatch a full **bubbling** pointer-event chain (`pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click`, all `bubbles:true, cancelable:true, button:0`, no `metaKey`/`ctrlKey`) directly on `.dc-artboard-video-badge`. This event chain still runs through the input-router's CAPTURE-phase listeners bound to the host ancestor — the exact code path the bug lives in — so it reproduces (and disproves) the regression faithfully; it is not a shortcut that bypasses the router.
- **Assertion:** the Timeline panel renders in the **top-level shell document** (`app.jsx`, NOT inside the canvas iframe) — check `document.querySelector('.tl-panel')` / `[data-testid="timeline-empty"]` from the shell-frame eval, no iframe traversal needed for this half.

## Steps

1. **Open the fixture; baseline.** Open the shell, click the `canvas-row-ui-video-timeline-badge-lab` tree row (scroll into view first — sorted alphabetically near the end of a 32-canvas list), wait for the iframe. Assert `.dc-artboard-video-badge` exists with `aria-label="Open timeline — Alpha"`, active tool is the boot default `browse`, and `.tl-panel` is absent from the shell. Screenshot (`step-1-canvas-open.png`).
2. **Arm Move tool.** Post `tool-set` → `move` to the iframe. Assert `.dc-canvas[data-active-tool="move"]`. Screenshot (`step-2-move-tool-armed.png`).
3. **Bare click the badge; Timeline panel opens.** Dispatch the bubbling pointer chain on `.dc-artboard-video-badge` (no modifiers). Assert `document.querySelector('.tl-panel')` is truthy and `[data-testid="timeline-empty"]` is present (no real video content in the throwaway fixture, so the panel's own empty-state is the truthful assertion — not scope-creeping into Timeline content testing). Screenshot (`step-3-timeline-panel-open.png`). Zero JS console errors in either frame over the run.

## Regression proof (pre-fix vs post-fix)

This scenario was piloted BOTH ways to confirm it actually gates the bug (not a vacuously-true assertion):

- **Pre-fix** (`git stash apps/studio/input-router.tsx` back to the parent commit's version, fresh dev-server restart): steps 1–2 identical; step 3's dispatched click leaves `.tl-panel` **absent** — the click is swallowed by the router's unconditional `preventDefault`/`stopImmediatePropagation`, and the artboard is merely re-selected (visible in the shell status bar: `SELECTED [data-dc-screen="vtb-alpha"]`) instead of the badge's own `onClick` firing.
- **Post-fix** (`git stash pop`, fresh dev-server restart): identical steps, identical click dispatch — `.tl-panel` renders with the empty-state message.

This confirms the scenario is a faithful regression gate, not a false-positive. Evidence: `step-3-REGRESSION-evidence-panel-does-not-open-pre-fix.png` alongside the post-fix `step-3-timeline-panel-open.png` in the run directory.

## Success criteria

- Steps 1–3 PASS on web-desktop.
- The pre-fix pilot (documented above, not part of the repeatable runner) reproduces the reported bug — the same click dispatch leaves the Timeline panel closed on the parent commit's `input-router.tsx`.
- Zero JS console errors in either frame over the run.
- Cross-platform parity: N/A (web-desktop only by design; the other 4 documented as SKIPPED).

## Follow-ups (not blocking)

- No `data-testid` on `.dc-artboard-video-badge` itself (selector reach relies on the stable `.dc-artboard-video-badge` CSS class, which is acceptable per this codebase's convention for canvas-iframe chrome — see `artboard-kinds` using `.dc-artboard-kind-chip` similarly — but a `data-testid="artboard-video-badge"` would remove the CSS-class dependency if the class ever gets restyled/renamed).
- The pure-function decision (`yieldsClickToArtboardChrome`) already has thorough DOM-free unit coverage in `apps/studio/test/input-router.test.ts` (mirroring `yieldsToArtboardDrag`'s existing suite) — this scenario is the complementary end-to-end proof that the real DOM click path (capture-phase listener → browser event dispatch → React's delegated `onClick`) behaves as the unit tests predict, not a substitute for it.
