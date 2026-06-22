# DDR-106: Showcase-grounded canvas generation — the platform `ui_kits-<platform>-showcase` is a Tier-0 layout prior for `/design:new` + `/design:edit`

- **Date:** 2026-06-22
- **Status:** Accepted (implemented — `.ai/plans/feature-showcase-grounded-canvas-generation.md`)
- **Tags:** design, design-system, pattern-priors, showcase, ui-kit, envelope, design-system-keeper, layout-reuse, consumer-side
- **Related:** [DDR-010](./DDR-010-design-system-keeper-agent.md) (the per-class pattern-reinvention audit this extends to the shell level), [DDR-043](./DDR-043-bias-free-design-plugin-templates.md) (bias-free templates — unaffected; this is a consumer-side change, no template edits), [DDR-061](./DDR-061-sidecar-cache-monitor-background-orchestration.md) (the DS-context cache the edit-path pre-load lives beside). Spec: `plugins/design/commands/{new,edit}.md`, `plugins/design/skills/design/SKILL.md` § "Generation envelope", `plugins/design/agents/design-system-keeper.md`, `plugins/design/templates/design-system-inspiration/_MAPPING.md` § "Always-on (ui_kit …)". Plan: [`feature-showcase-grounded-canvas-generation.md`](../plans/feature-showcase-grounded-canvas-generation.md).

## Context

The DS bootstrap (`/design:setup-ds`) produces, per in-scope platform, a `ui_kits-<platform>-showcase.tsx` specimen — described in `_MAPPING.md` as "the single highest-leverage 'DS in use' artifact": a full product mock composing the DS chrome (nav / sidebar / toolbar / main / status) into the platform's canonical shell. The producer side treats it as non-optional (the completeness-critic V12/V13 hard-fails an absent in-scope-platform showcase).

But the **consumer side never read it.** Confirmed by grep — `ui_kit` / `showcase` appeared **zero** times in `commands/new.md`, `commands/edit.md`, the design `SKILL.md` generation path, and `agents/design-system-keeper.md`:

- `/design:new` step 5a collected pattern priors by globbing **only** `preview/components-*.tsx` — the component specimens — and explicitly skipped `ui_kits-*-showcase.tsx`. The layout skeleton never entered the generation envelope.
- The envelope's `## Pattern priors` section had subsections for existing canvases + component specimens, but no showcase tier and no directive to adopt the shell.
- `/design:edit` step 1.5 pre-loaded `_components.css` + `colors_and_type.css` + canvas-lib, but never the showcase — so an edit that *placed a new surface* had no view of the established shell.
- `design-system-keeper` audited per-**class** reinvention (`.dc-card` re-derived as `.pcard`) but had no layout/shell-level check.

Net effect: every new feature canvas re-derived the product shell ("kde to bude") from scratch, even though the DS already shipped the canonical answer. The user reported this directly — they want new functionality to **slot into the existing mobile/desktop showcase layout**, and the design skills to **always** consult reusable components AND showcases before inventing layout.

## Decision

Wire the platform showcase in as a **Tier-0 prior** (above existing-canvas and component priors) on both the generate and extend paths, framed as **reference, not a wireframe**.

1. **`/design:new` collects the showcase as Tier-0 (step 5a) and grounds the envelope on it (step 5b).** A new `### Platform showcase layout — the canonical shell (adopt this skeleton)` subsection sits above the existing two, carrying the resolved `ui_kits-<platform>-showcase.tsx` path + its role (read from the file's `/** SPECIMEN: … */` header — showcases carry no `.meta.json` sidecar) + the `-index` catalog as a secondary line. The directive: for any full-screen surface, ADOPT the showcase's spatial skeleton + chrome material; reinvent only with a one-line JSX comment. The resolved reference path also rides the envelope's `## Constraints` (`platform_showcase:`) into the generation prompt, and the resolution outcome surfaces in the step-12 print (`Shell grounding:`).

2. **`/design:edit` pre-loads the showcase for add-surface edits (step 1.5).** Gated behind an add-surface heuristic (feedback names add/new-surface verbs, EN + CZ; or a structural non-AST-path edit) — a cosmetic/copy/single-attribute edit must NOT pay the (large) showcase read. When it fires, the showcase TSX is `Read` and passed to `frontend-design` as the placement reference.

3. **Platform → showcase resolution is per-canvas, with a graceful fallback chain.** There is deliberately **no new `platforms` field in `config.json`** — platform stays per-canvas (`--mobile`/name detection in `new`, `.meta.json.platform` in `edit`). Mapping: `desktop`→desktop showcase, `mobile`→mobile showcase, `tablet`→mobile (tablet rides the mobile family per `_MAPPING.md`). Fallback when the exact-platform showcase is absent: any showcase the DS ships, used as a chrome reference only, with an explicit note; else skip the showcase prior entirely. **Never fatal** — a desktop-only DS (like this repo's `maude` + `project`, which ship no `ui_kits-mobile-showcase`) must still generate mobile canvases, just without shell grounding, and say so.

4. **`design-system-keeper` gains a conservative Pass A.6 (product-shell reuse).** It fires only when the candidate builds a ≥ 2-region shell AND a `platform_showcase_path` was passed. It surfaces **one** finding: **info** on partial reuse (shares ≥ 1 shell root), **warning** on full reinvention (shares zero shell roots across a multi-region shell). It never self-promotes to blocker on its own. Shell detection is fuzzier than per-class matching, so the bar to flag is deliberately high — a false "you reinvented the shell" is worse than a missed nudge.

5. **Reference, not prescription — envelope discipline preserved.** Every directive points at the showcase file and says "adopt the skeleton"; none enumerates the showcase's regions as a required checklist. The generator keeps ownership of element-level decisions and the signature moment. The ~30–50-line envelope target and the signature-moment axis are unaffected.

## Consequences

- **New mental model: pattern priors are tiered.** Tier 0 = platform showcase shell (placement), Tier 1 = existing same-DS canvases, Tier 2 = component specimens. The CLAUDE.md "Pattern priors come first" rule now names the showcase as the Tier-0 *placement* prior, distinct from the component-level lifting it already covered.
- **`wrapper pattern` vs `product shell` are now distinct in the spec.** The design `SKILL.md` "Generation envelope" previously conflated "reference layouts for the wrapper pattern" (the canvas-lib `DesignCanvas`/`DCArtboard` frame) with the product shell. They are now separate reference lines.
- **`design-system-keeper` takes a new optional input** `platform_showcase_path`; absent/empty → Pass A.6 no-ops (back-compatible — existing spawns that don't pass it simply skip the pass).
- **No code, no template, no config-schema change.** Pure consumer-side instruction-markdown change. Templates stay bias-free (DDR-043 untouched); `config.json` gains no field.

## Alternatives considered

- **Hard-block shell reuse (keeper promotes shell-reinvention to a blocker).** Rejected — over-prescriptive and brittle. Shell detection is heuristic; a hard block on a fuzzy signal would false-positive on legitimately-novel surfaces (a marketing splash that genuinely shouldn't wear the app shell) and fight envelope discipline. Grounding is a strong *default*, enforced as a visible nudge, not a gate.
- **Add a `platforms: []` field to `config.json` and resolve showcases from it.** Rejected — platform is already a per-canvas property (a single project mixes desktop and mobile canvases); a DS-level platforms array would be the wrong granularity and a redundant source of truth against the per-canvas `--mobile`/`.meta.json.platform` signal already in use.
- **Feed the showcase only to the keeper (audit-only, no envelope grounding).** Rejected — that catches reinvention *after* it happens, costing a fix iteration. The higher-leverage fix is upstream: put the showcase in front of the generator as a prior so the shell is reused on the first pass. The keeper pass is the backstop, not the mechanism.
- **Inline the showcase's full region list into the envelope as a checklist.** Rejected — that is exactly the wireframe-spec over-prescription the envelope discipline forbids; it would lock the generator to the showcase region-by-region and kill the signature-moment leap. Pointer + "adopt the skeleton" keeps it a brief.
