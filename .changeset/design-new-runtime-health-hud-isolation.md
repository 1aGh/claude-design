---
'@1agh/maude': patch
---

**Fix four divergences from the 2026-05-27 `design:new` system review (AI-StudyMate / StudyFi Copilot canvas).**

- **D-1 — runtime bundle health probe.** New helper `plugins/design/dev-server/bin/runtime-health.sh` HEAD-probes every `/_canvas-runtime/*.js` URL and compares the served body size to the on-disk pre-built bundle in `dist/runtime/`. Ratio < 0.5 = defective dynamic Bun.build; `--restart` auto-kills + respawns the dev-server. Wired into `/design:new` step 2, `/design:edit` step 2, and `/design:smoke` step 1a. Catches the "parse-clean, fails-at-module-eval" class of bug (`ReferenceError: AcceleratedAnimation is not defined` from a 409-line broken `motion_react.js` instead of the 10056-line pre-built) that previously slipped past the HTTP-200 reality check.

- **D-2 — per-artboard screenshot is a blocker, not a footnote.** `/design:new` step 9 no longer silently falls back to a single 30–60 MB full-page PNG when `screenshot.sh --all-screens` fails. New contract: first pass agent-browser, second pass `--engine playwright`; both fail → `AskUserQuestion` (retry / interactive / accept gap / abort). The final print stamps `Visual verification: SKIPPED` loud when the gap is accepted, instead of burying it in a footnote.

- **D-3 — render-budget cost on artboard-count question.** New step 4.6 in `/design:new` codifies the artboard-count `AskUserQuestion` with explicit pan/zoom perf trade-offs in every option label. The "recommended" tag is reserved for cost-neutral defaults; ≥ 8 artboards stamps `pan/zoom may stutter on trackpad` in the final print so the user can correlate density with interaction feel.

- **D-4 — HUD CSS scope-isolation.** Dev-server chrome (cursor/hand/pan toolbar, world-map minimap, halos, marquees, AI banner, annotations, cursors, participants, export dialog) used to inherit `var(--accent, …)` from the canvas's design system — a violet StudyFi canvas turned the floating toolbar violet. New `--maude-hud-*` token family is injected on the canvas iframe `:root` via a dedicated `HUD_TOKENS_CSS` block; 13 dev-server tsx files now reference `var(--maude-hud-accent, …)` instead. Canvas-content motion helpers (`MotionDemo`, `ReducedMotionToggle`) intentionally keep `var(--accent, …)` so they bind to the canvas DS.

No user-facing breaking changes — the HUD defaults match the previous inline fallback (`#d63b1f`, Maude brand orange-rust), so default-themed canvases look identical. Canvases that intentionally re-themed the HUD by setting `--accent` will now need to set `--maude-hud-accent` instead.
