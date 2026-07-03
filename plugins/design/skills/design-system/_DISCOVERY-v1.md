> **DEPRECATED — kept as reference for transition window.**
>
> Snapshot of the **12-Q / 3-round discovery** that lived in `SKILL.md` lines 99-200 before the 3-stage rewrite (Vision → Research → Refinement, DDR-033, 2026-05-20). Kept verbatim so contributors can diff and understand what changed. Do NOT load this file at runtime — `SKILL.md` is authoritative.
>
> Why it was replaced — see DDR-033. Short version: visual-first inversion (tokens decided before character / purpose), "3 codes are enough" principle ignored (everything balanced, nothing signature), hardcoded fallback ladders surfaced bias even when research succeeded, scope-agnostic assumptions (market-product taxonomy forced onto personal / internal / OSS).

---

### Discovery (Round 0 + Round 1 + Round 2 + Round 3 + confirm)

**Detect target first.**

- Read `<repo>/.design/config.json`. Compute `designRoot` (default `.design`).
- For `first-bootstrap`: check that `<designRoot>/system/` is empty (or `designSystems[]` is empty). Target dirname is `project` (literal — never `<slug-of-project>/`).
- For `additional-ds`: target dirname is the kebab-case slug of the user-provided name (`<name>`).
- For `re-bootstrap`: target is the existing `system/<name>/` dir; refuse unless `--force`.

#### Round 0 — domain research (NEW — runs before any AskUserQuestion)

> **Why Round 0 exists.** Pre-research the discovery questionnaire used a hardcoded option ladder for every project — the same set of mood / signature / iconography / density references regardless of whether the brief was about cooking, sports, science, finance, or a niche craft. The questionnaire pretended to do UX research while actually showing the user the same options every run. Round 0 fixes this by spawning the `design:ux-research-agent` BEFORE the first question is asked. The agent runs 6–8 WebSearch queries across abstract source-type categories (awards / case-studies / indie portfolios / non-English regions / lateral industries / niche publications / heritage references) and surfaces whatever real products fit the brief — no pre-set brand preferences or denylists, no allow-listed reference pool. The questionnaire structure (order, count, intent) is unchanged; only the **option labels** become domain-researched.

**Procedure:**

1. **Resolve `brief`.** Order of precedence: `$ARGUMENTS` brief (e.g. `/design:setup-ds project "recipe scaling and substitution tool"`) → existing `<designRoot>/system/<ds>/README.md` "What this DS is for" line (re-bootstrap mode) → caller-provided `$BRIEF` from `/design:edit` / `/design:new` auto-load → empty (fall back to a single AskUserQuestion to capture the one-liner; this is Q1 batched alone). If brief is captured here, **Q1 is already answered** and Round 1 starts at Q2.

2. **Check cache.** Compute the brief hash: `BRIEF_SHA8=$(printf '%s' "$BRIEF" | shasum -a 256 | cut -c1-8)`. Look for `<designRoot>/_history/_system/<ds>-${BRIEF_SHA8}-domain-research-discovery.json`. If present, **read it and reuse — skip step 3**. Print: `Round 0 cache hit — reusing prior research from <researched_at> (brief-hash match: <BRIEF_SHA8>)`. **The hash match is exact, not fuzzy** — two briefs whose hashes differ get fresh research, even if they're "in the same domain", because the caller wrote a different brief and that intent matters. Re-bootstrap with `--force` ALWAYS re-researches regardless of cache (the domain may have moved in the intervening year — the agent surfaces fresh trends).

3. **Spawn `design:ux-research-agent`** via the `Agent` tool with `subagent_type: "design:ux-research-agent"`. Inputs:
   ```
   brief:           <resolved brief>
   caller:          "setup-ds"
   mode:            "discovery"
   context_paths:
     existing_ds_tokens:  <abs path or empty>
     existing_ds_readme:  <abs path or empty>
     cached_payload:      <abs path to <ds>-<BRIEF_SHA8>-domain-research-discovery.json — only if it exists>
   output_path:     <designRoot>/_history/_system/<ds>-<BRIEF_SHA8>-domain-research-discovery.json
   researched_at:   <current ISO date>
   ```
   The agent runs WebSearch + WebFetch, builds a domain-relevant reference pool, writes the payload, returns a one-line confirmation. Wall time ~30–60s.

4. **Read the payload.** Use `Read` on `output_path`. Bind the relevant arrays into the AskUserQuestion options for the rounds below.

5. **Handle thin-research fallback.** If the payload sets `fallback_used: true`, the agent had thin WebSearch results and filled with LLM-knowledge. Use the payload anyway, but **surface a one-line warning in the final next-step block** ("Round 0 fell back to LLM-knowledge mode for this niche domain — review options carefully"). If the agent itself failed (no payload file written), fall back to the **hardcoded option ladders** in the "Fallback option ladders" section at the end of this file — and surface a warning.

#### `first-bootstrap` (12 Qs across 3 rounds, options sourced from Round 0 payload)

> **Why 12, not 8.** The 8-Q baseline gets you a working DS; it does not get you a pro-grade DS. Round 3 (Q9–Q12) captures the inputs a pro designer would gather from a stakeholder before starting visual exploration: signature treatment, hard-NO list, iconography vibe, density preference. Round 3 is the cheapest single intervention to lift output from "structurally valid" to "portfolio-worthy". Opt out via the slash command's `--quick` flag if the user explicitly wants the 8-Q baseline.

> **Options come from the Round 0 payload.** For every Q where the payload provides domain-relevant choices (Q5, Q9, Q10, Q11, Q12), populate AskUserQuestion `options[]` from the payload arrays — `mood_clusters[]`, `signature_treatment_options[]`, `suggested_hard_NOs[]` + `anti_references[]`, `iconography_vibe_options[]`, `density_options[]`. Each option's `label` is the payload `.label`. Each option's `description` cites the anchor products from the payload. The option flagged `recommended: true` in the payload becomes the FIRST option in the AskUserQuestion list with `(Recommended)` appended to its label (per the AskUserQuestion tool convention). **Always end the list with a `pick-for-me` option** so the user can defer the call.

**Round 1 — Identity** (4 Qs via one AskUserQuestion call — **structural inputs only; options are universally stable**):

- Q1 product one-liner — pre-filled from `brief` if captured in Round 0 step 1; otherwise sketch / reuse from PRD / skip
- Q2 audience — `pro tool` / `consumer app` / `developer tool`. Pre-fill Recommended from payload `audience_hypothesis`.
- Q3 platforms — `desktop only` / `mobile + desktop` / `tablet-first`. Pre-fill Recommended from payload `platform_hypothesis`.
- Q4 theme default — `dark` / `light` / `both equal`

**Round 2 — Brand + content** (4 Qs via a second AskUserQuestion call — **ALL options payload-sourced; do NOT hardcode the SaaS ladder**):

- **Q5 mood references** — single select. **Options sourced from payload `mood_clusters[]`.** Each option's `label` = cluster `label` (composed from its 3 anchor product names from the payload); `description` = cluster `one_line`. Always 3 options + `pick-for-me`. The cluster flagged `recommended: true` in the payload becomes the FIRST option with `(Recommended)` appended. **The payload's option labels are authoritative — do not curate them, do not substitute alternative anchors, do not "polish" the descriptions.** If you see the same anchor names across multiple unrelated projects, that's a research-breadth issue the agent's audit trail (`research_quality_notes`) should reveal — re-running the research with a tighter brief usually surfaces different references.
- **Q6 brand color** — single select. **Options sourced from payload `color_oklch_options[]`.** Each option's `label` = the payload option label (e.g. `cool-clinical L 58–62 C 0.08–0.11 H 200–230`). Each option's `description` = `domain_rationale` (one sentence — why this range fits this domain's heritage). Always 3 payload-sourced options + `I have a hex` (user pastes) + `pick-for-me` (skill picks within the Recommended option's OKLCH range). **NEVER offer "cyan/indigo/emerald/amber default" — those are bias-bait placeholders** that surface in every project regardless of domain. A finance dashboard wants a different range than a children's app than a recipe app; the payload encodes that.
- **Q7 typography** — single select. **Options sourced from payload `typography_pairing_options[]`.** Each option's `label` = pairing label (categorical, e.g. `editorial-serif + grotesque-sans`); `description` = `domain_rationale` (why this pairing fits the domain's reading mode). Always 3 payload-sourced options + `pick-for-me`. A long-form reading product wants different type than a dense pro-tool dashboard than a consumer mobile app; the payload encodes that based on what the research surfaced.
- **Q8 content tone** — single select. **Options sourced from payload `voice_tone_options[]`.** Each option's `label` = tone label with anchor product name from the payload (e.g. `<voice-id> (anchor: <real-product-from-payload>)`); `description` = list of characteristics + `sample_microcopy` from the payload (so the user sees the voice, not just hears the label). Always 3 payload-sourced options + `pick-for-me`. **Do NOT hardcode generic tone labels** ("direct-terse README-grade" / "explanatory-friendly" / "formal-B2B") as universal options — voice is domain-coupled, and the payload anchors each tone to a real product the agent surfaced. If the same 3 voice tones come back across multiple runs in different domains, the payload is broken.

**Round 3 — Pro-designer inputs** (4 Qs via a third AskUserQuestion call, **options sourced from Round 0 payload**):

- **Q9 signature visual treatment** — single select. **Options sourced from payload `signature_treatment_options[]`.** Always 3 domain-relevant options + `none / restrained` (universal opt-out) + `pick-for-me`. Recommended pre-fill from payload `recommended: true`. The chosen treatment is baked into `_layout.css` chrome (body background, h1 text-shadow, sectioning rules) AND surfaces in at least one signature specimen (typically `colors-accent.tsx` brand-spotlight + `ui_kits-*-showcase.tsx` hero).
- **Q10 hard NO list** — multi-select. **Options assembled from payload `suggested_hard_NOs[]` AND payload `anti_references[]`** (one suggested NO per anti-reference, derived from its `why_to_avoid` field). The list is a checklist — user picks any subset. Recommended pre-checks the suggested NOs that are clear domain consensus (e.g. for recipe: "no popup recipe-introduction text" is consensus). Universal options always appended: `no decorative gradients` · `no animations beyond hover` · `anything goes (skip)`. Every checked item becomes a guardrail surfaced in the DS README and the per-DS SKILL.md. Sub-agents authoring specimens MUST read this list before writing.
- **Q11 iconography vibe** — single select. **Options sourced from payload `iconography_vibe_options[]`.** Always 3 domain-relevant options + `pick-for-me`. Recommended from payload `recommended: true`. Drives `iconography.tsx` specimen content + the 3–5 example SVGs scaffolded into `assets/glyphs/`.
- **Q12 density preference** — single select. **Options sourced from payload `density_options[]`.** Always 3 domain-relevant options + `pick-for-me (derive from Q2 audience)`. Recommended from payload `recommended: true`. Sets `--space-*` usage conventions and the default padding values in `_layout.css`.

**Confirm.** Echo a **3-sentence** proposed direction (one sentence per round: identity + brand + visual signature). Wait for explicit yes / corrections. On "no", restart the affected round (max 2 retries each before "scaffold-with-current and iterate via /design:edit").

#### Fallback option ladders (used ONLY when Round 0 payload is missing or `fallback_used == true`)

**These are emergency-only options when the ux-research-agent failed entirely** (no payload file written) — they intentionally reference the SaaS-tool ladder because at this point we've already lost the domain-research battle and only need to keep the questionnaire functional. If you find yourself reaching for this section regularly, the agent is the bug — fix the agent, don't normalize the fallback. **ALWAYS surface a prominent warning in the final next-step block when fallback was used**, including a recommendation to re-run with `--force` after addressing whatever caused the agent to fail.

- **Q5 mood fallback:** `dashboard-pragmatic / documentation-editorial / terminal-pro / pick-for-me` (the labels intentionally do NOT include product names — the agent's job is to provide product anchors; if the agent failed, the skill refuses to invent them)
- **Q6 color fallback:** `pick-for-me (skill chooses OKLCH per Q2 audience heuristic)` / `I have a hex` — **no preset OKLCH options without research**, because every preset becomes the default bias
- **Q7 typography fallback:** `pick-for-me (skill chooses per Q1 reading-mode heuristic)` — no preset pairings without research
- **Q8 content tone fallback:** `direct-terse` / `explanatory-friendly` / `formal-B2B` / `pick-for-me` (labels only — no anchor products; agent's job)
- **Q9 signature treatment fallback:** `none / restrained` · `gradient discipline` · `CRT scanlines + phosphor glow` · `glassmorphism (frosted blur)` · `brutalism (hard edges, no shadows)` · `soft-shadow depth ladder` · `neumorphism (inset shadows)` · `pick-for-me`
- **Q10 hard NOs fallback:** `no decorative gradients` · `no animations beyond hover` · `no emoji in chrome` · `no rounded corners > 12px` · `no centered hero layouts` · `no marketing-style CTAs` · `anything goes (skip)`
- **Q11 iconography fallback:** `terminal glyphs (1px stroke, ASCII-leaning)` · `product icons (rounded, balanced)` · `industry-specific (domain nouns dominant)` · `flat-illustrative (solid silhouettes)` · `pick-for-me`
- **Q12 density fallback:** `dense pro-tool (chrome at space-2/3, dense tables)` · `balanced (chrome at space-3/4)` · `roomy (chrome at space-4/5, more whitespace)` · `pick-for-me (derive from Q2 audience)`

Note that the fallback labels **deliberately do not name products**. Product naming in the fallback was the original bias source — every fallback run was effectively a recycled questionnaire. The fallback now degrades to abstract labels so the user knows immediately something is wrong (no anchor names = no research happened).

#### `additional-ds` (12 Qs, different shape)

**Sequence (load-bearing — DO NOT batch the picker with the confirm at the end):**

```
Q_purpose → Round 0 (research the new DS's domain — NOT the existing one) → Round 1 (Q2–Q4) → Round 2 (Q5–Q8) → INHERITANCE PICKER → Round 3 (Q9–Q12, with picks pre-filled from inherited DS where applicable) → 3-sentence confirm
```

- **Q_purpose** — "What is this DS for, distinct from your existing DS?" (replaces Q1). Answer becomes the `brief` input for Round 0.
- **Round 0** — same procedure as `first-bootstrap`. Cache key includes the DS slug, so each additional DS gets its own research payload (a "marketing" DS researches marketing-site design; an "admin" DS researches B2B-admin patterns).
- Q2–Q12 same as first-bootstrap (with "Inherit from `<existing-ds>`" Recommended option on Q7, Q8, Q11, Q12; payload-sourced options on Q5, Q9, Q10, Q11, Q12)

**Inheritance picker — fires AFTER Q8, BEFORE Round 3** (multiSelect AskUserQuestion). Position is load-bearing because Round 3 questions overlap inheritance-eligible fields (Q11 iconography especially); deferring the picker until after Round 3 lets users answer Q11 only to have the answer silently overridden by inheritance. The retro `setup-ds-studio-2-review.md` (BAD-7) caught this drift.

```
Inherit from <existing-ds>? (multi-select; "None" = define fresh)
  [x] Typography (font_display, font_body, font_mono)
  [ ] Voice / content tone
  [ ] Iconography family            ← if checked, Q11 in Round 3 is skipped + value taken from inherited DS
  [x] Motion durations
  [ ] None
```

Inherited values are pre-baked into the new DS's `colors_and_type.css`; discovery answers for inherited fields are ignored. If `Iconography family` is inherited, **skip Q11 in Round 3**.

#### `re-bootstrap` (12 Qs, pre-filled)

Read `system/<ds>/colors_and_type.css` + `system/<ds>/README.md` + `_layout.css` to pre-fill answers (Round 3 derived from `_layout.css` body background + body::before/::after presence + iconography.tsx curation). User hits enter on each to keep current; only changed answers cause re-generation of affected files.

**Round 0 in re-bootstrap mode** — ALWAYS re-research (`--force` implies a year may have passed; cached payload is stale by definition). Brief is reconstructed from the existing DS README's "What this DS is for" line. The fresh payload may surface new domain references that the original bootstrap didn't have access to; those new references update the option labels in Round 2/3, so even a "keep all current answers" pass shows the user what's changed in the domain since the original bootstrap.
