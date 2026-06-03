# DDR-082 — Scaffold-integrity gates: catch silently-broken bootstrap output that `status: written` trusts

**Status:** Accepted — 2026-06-02.
**Supersedes:** none.
**Related:** [DDR-080](DDR-080-moodboard-direction-gate.md) (the two *visual direction* gates — this DDR is the deferred Round-2 *integrity* layer beneath them: direction gates catch a disliked look, these catch broken/falsely-asserted content), [DDR-049](DDR-049-motion-one-as-canonical-motion-library.md) (extracted `SUB-AGENT-PROMPTS.md` + the three MANDATORY safety blocks — this adds the fourth, CODE HYGIENE), [DDR-068](DDR-068-css-import-contract.md) (the CSS-import contract `/design:smoke` enforces — the real-bundle render gate is the same "build-green ≠ user-visible-green" lesson), [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (`runtime-health.sh`'s "parse-clean, fails-at-module-eval" rationale that A2 cross-links). Instruments: `plugins/design/skills/design-system/_bootstrap.md` (reconcile-time gates + Batch-A contrast note), `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` (CODE HYGIENE block — prevention), `plugins/design/agents/design-system-completeness-critic.md` (C9 / V23 / V24 — durable re-runnable layer).

## Context

The DDR-080 moodboard + hero-preview gates catch a **disliked direction** before the scaffold spends ~15k LOC. They do **not** catch a scaffold that *ran* but produced **silently-broken output**. Four such defects all pass a `status: written` roster row (and even a transpile-only parse check), yet ship broken — and every one was caught by a **user mid-flow, never by the loop**:

1. **0-byte / stub specimens trusted as `written`** — both StudyFi v1 and v2-mid-run masked empty files; reconciliation passed because it only checks the `status` field, never the file's bytes on disk. The roster's `loc:` is a *claim*.
2. **Parse-clean, fails-at-module-eval** — a specimen that transpiles fine but throws `ReferenceError: X is not defined` at module load (e.g. `AcceleratedAnimation is not defined`, or a bare `React.useState` with no `import React`). An `esbuild --bundle=false` / `tsc --noEmit` check sees syntax, not eval-time references.
3. **`*/` inside a `/* … */` CSS block** closes the comment early → the trailing text is invalid CSS → "Bundle failed", specimen renders unstyled. CSS has no nested comments.
4. **Fabricated contrast claims** — generated `colors_and_type.css` asserted `✓ 4.5:1` on a pair that was actually ~2.1:1. The ratio was never computed; the claim tells the reader a failing pair is safe.

The structural completeness-critic is **structural only** — it counts files and greps token names; it cannot see any of these. So they need an explicit gate.

## Decision

Add **four scaffold-integrity gates**, enforced at three layers (prevent → detect-at-bootstrap → detect-durably):

- **Prevention** — a fourth MANDATORY SAFETY BLOCK, **CODE HYGIENE**, in `SUB-AGENT-PROMPTS.md`, cited by name in every slice prompt: no empty/stub files (report the *real* `loc:`), no `*/` inside a CSS comment, every `React.*` needs an explicit `import`, never assert a contrast ratio you didn't compute.
- **Detect at bootstrap** — a `Scaffold-integrity gates` block in `_bootstrap.md` that runs **after reconcile, before visual sanity**: A1 stat-each-written-file (< 20 B = hard-fail, same severity as a `pending` row), A3 the CSS-comment + React-import greps, A4 the contrast-claim grep. A failure routes through the existing bypass-log discipline.
- **Detect durably** — completeness-critic **C9** (non-empty, Core blocker), **V23** (React-import → blocker on hit; stray `*/` → warning), **V24** (contrast-claim → warning per match), so a `/design:critic --system-only` re-run or a hand-edited specimen is caught after bootstrap too.

Two sub-decisions the plan flagged as DDR-worthy:

### A2 — the real-bundle gate is the dev-server render, not a transpile flag

The A1 non-empty check is necessary but not sufficient (defect #2). **The authoritative "does it bundle + module-eval" gate is the dev-server render** — the Hero-preview gate (DDR-080) and Visual sanity check already screenshot every specimen through `_canvas-shell.html?canvas=…`, which runs the real `canvas-build.ts` bundle **and** browser module-eval; a blank iframe or visible error overlay in those screenshots **is** a failed bundle. We do **not** add a separate transpile-only specimen check — and explicitly forbid substituting `esbuild --bundle=false` / `tsc --noEmit` for the render, because transpile sees syntax, not eval-time references. This is the same class `runtime-health.sh` catches for the pre-built runtime bundles.

### A4 — the gate forbids *unverified* claims; it does not auto-compute contrast

The failure mode is **fabricated** ratios, not missing ones. Computing WCAG/APCA from OKLCH token pairs in a bash gate is fragile (OKLCH→sRGB→relative-luminance, gamut clipping, alpha compositing) and out of proportion to a *flag*. So:

- **Computation, when a ratio is to be claimed, lives at authoring time** — the Batch-A main agent (which writes `colors_and_type.css` + README) computes it from the real token pair if it wants to claim it, or labels swatches with token names + OKLCH values instead.
- **The gate is a discipline check, not a calculator** — it greps for ratio-claim substrings and flags each for a "was this computed?" verification (advisory warning). The numerator-≥3 floor (`[3-9](\.[0-9]+)?:1`) isolates WCAG contrast ratios (3:1 / 4.5:1 / 7:1) from type-scale (1.2:1) and grid (2:1) ratios, which are not contrast claims and would otherwise be noise.

## Consequences

- **Positive:** the four "user caught it, loop didn't" defects each fail a gate now — at bootstrap (reconcile) and durably (`--system-only`). Prevention in CODE HYGIENE means a clean run produces no gate hits. A2 codifies the existing render path as *the* bundle gate, closing the "transpile-only is enough" trap.
- **Cost:** the A4 / V24 contrast grep is advisory and can flag a deliberately-computed claim (the operator dismisses it) — accepted, because a fabricated claim is worse than a re-confirmed real one. The CSS-comment check is a **per-file `/*` vs `*/` count-balance** (an early-closed comment leaves an extra `*/`, an unterminated one an extra `/*`); its only blind spot is a literal `/*` / `*/` inside a CSS string or `url()`, which is vanishingly rare in generated specimens.
- **Scope:** markdown / sub-agent-prompt only — no dev-server code, no CLI bin calls (so no `plugin-cli-reachability` surface). Logically independent of the Group B dev-server boot/export hardening ([DDR-083](DDR-083-yjs-boot-preflight.md)); the plan mandated separate branches but per user direction both groups ship on one branch / PR (the two commits stay disjoint, so the separation is preserved in history without two PRs).

## Alternatives considered

- **Auto-compute contrast in the gate** — rejected: fragile OKLCH math in bash, disproportionate to a flag, and the real failure is fabrication not absence.
- **Reconcile-only (no critic checks)** — rejected: a hand-edited or post-bootstrap-regenerated specimen would slip past, since reconcile runs only during bootstrap. The durable C9/V23/V24 layer is cheap (greps the critic already pattern-matches) and makes `--system-only` a real regression net.
- **Add a transpile-only pre-render check** — rejected (A2): it would mask exactly the module-eval class it's meant to catch and lull the flow into "it compiled, ship it."
