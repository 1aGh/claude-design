---
"@1agh/maude": patch
---

`/design:setup-ds` hardening round 2 — the bootstrap no longer silently drops a mandatory per-platform showcase, refuses to call "fine but not wow" output a clean pass, and defaults to restrained, research-faithful typography.

Driven by the `new-studyfi` bootstrap retro. Changes to the design plugin's authoritative spec (`SKILL.md`, `SUB-AGENT-PROMPTS.md`, `commands/edit.md`):

- **Per-platform showcase, never dropped.** The scaffold roster + fan-out now emit a `ui_kits-<platform>-showcase`/`-index` pair per in-scope platform (Q3), and reconciliation asserts the Q3-derived expected set — an absent mobile/tablet showcase is the same hard-fail as a `pending` one. Reconciliation also runs after partial/failed fan-out batches (not just the happy path), and socket-failure recovery routes back through it.
- **Fan-out ceiling 3–4** (was 5–8) with sequential waves of ≤4, reconciling between waves — fixes the cohort socket-budget failure that 8 simultaneous long-running agents triggered.
- **Aspiration bar raised 3.5 → 4.0** ([DDR-056](.ai/decisions/DDR-056-aspiration-pass-bar-raised-to-4.md)). Only `≥ 4.0` prints a clean silent pass; `3.0–4.0` still completes but surfaces the signature-moment-critic's top-2 specific lifts ("what would take this from hezké to wow") instead of a silent "passed". Kolo 2 (Atraktivita) is non-skippable during a first-bootstrap / additional-ds run.
- **Restraint-default typography** (ratio ≤ 1.2, optical-size ≤ 72, display weight ≤ semibold) — opt UP via `/design:edit`, not down. **Research type-fidelity** — mirror the research's primary display-face role exactly; font availability must not flip a grotesque direction into a serif.
- **Showcase-from-real-app** — for an existing product, the showcase sub-agent reads the real `AppLayout` + nav and restyles, rather than inventing a fictional product UX.
- **`/design:edit` fixes** — touch the paired `.tsx` after editing a sibling `.css` (the canvas-build bundle keys on `.tsx` mtime, so a CSS-only edit was otherwise invisible); a matchMedia-first fast-path for motion complaints (headless/OS `prefers-reduced-motion: reduce` correctly suppresses motion — rule that out before chasing CSS).
- **Asset-path correction** — the documented absolute form for specimen assets is `/<designRoot>/system/<ds>/assets/…` (e.g. `/.design/system/<ds>/assets/logo.svg`); the previously-documented `/assets/<ds>/` alias does not exist and 404s.
