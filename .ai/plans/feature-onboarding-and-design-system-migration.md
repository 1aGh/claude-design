---
name: feature-onboarding-and-design-system-migration
status: planned
created: 2026-07-07
decisions: [DDR-152, DDR-153, DDR-154, DDR-155]  # to be claimed during execution; next-free ≈ 152
---

# Feature: Onboarding & Design-System Migration — bring users (and their existing brand) into Maude

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — most of this plan REUSES shipped infra (tour engine, readiness pattern, video-comp, fetch-asset) rather than building new.

## Description

A designer discovering Maude gave two pieces of feedback:

1. **"It would help to SEE how onboarding works before installing"** — an explainer of what the tool does, how you upload brand material, and how you do the basic setup, without having to run it first.
2. **"If people already have a design system, they need to migrate it into Maude so it's usable."** — bring an existing brand/DS/design in from Figma / PDF / token files.

This plan turns that into three coordinated workstreams: (P1) a **product explainer video + in-app + on-site surfacing** so anyone can watch how it works, (P2) an **in-app guided onboarding path** (quick-setup demo from empty project → design system → first AI edit), and (P3–P4) **migration ingestion** — bringing an existing design system and existing designs into Maude, deterministic first (tokens + brand assets), LLM-vision reconstruction second (Figma frame / PDF page → canvas), as an experimental follow-up.

## User Story

- As a **designer evaluating Maude**, I want to **watch a short explainer and see the setup flow before I install**, so that I understand what the tool is and whether it fits — without a local install.
- As a **designer with an existing brand / design system**, I want to **upload my brand material (tokens, logo, brand manual) and have Maude turn it into a usable design system**, so that I can design in Maude with MY brand, not a generic starter.
- As a **new native-app user**, I want a **guided quick-setup that walks me from empty project to a real design system to my first AI edit**, so that I reach value in minutes without terminal or dev jargon.

## Problem

- **Discovery is install-gated.** There is no explainer a prospect can watch without running the app. `.design/ui/Maude Video Intro.tsx` is a real, exportable video-comp — but it is a design artifact wired into nothing (not first-run, not Help, not What's-New, not the public site). (research: onboarding-map §3.2)
- **In-app onboarding teaches chrome, not the journey.** The two existing tours (`USAGE_TOUR`, `COLLAB_TOUR`) only explain existing controls. Nothing walks "create a design system → make your first edit." First landing is a dev-jargon empty state (`_active.json`, `_comments/`, `/design`); the friendly `Welcome.tsx` isn't auto-opened, and the Rust welcome-project seeds **no** canvas at all. (research: onboarding-map §1, §3.4–3.5)
- **There is no way to bring an existing design system in.** A DS is created ONLY via interactive `/design:setup-ds` in the terminal — no stage accepts a file. There is **zero** external importer: no Figma/Sketch client, no `tokens.json`/Style-Dictionary parser, no PDF reader. Both asset writers (`fetch-asset` URL-only; `POST /_api/asset` drag-drop) accept PNG/JPG/GIF/WebP + video/audio only and explicitly **reject SVG and PDF**. (research: ds-ingestion-map §1,§4; migration-map §1,§4)

## Solution

Reuse the mature spines; add the two genuinely-missing pieces (an ingestion primitive + an in-app onboarding journey).

- **P1 — Explainer video, surfaced everywhere.** Author a proper product explainer as a video-comp (repurpose `Maude Video Intro.tsx` / `Studio Intro Video.tsx`), export MP4 + GIF + poster through Maude's own capture spine, and wire it into: native first-run wizard, Help menu, a What's-New entry, and — crucially — the **public site** (`/desktop`, getting-started) so a no-install / Intel-Mac prospect can watch it. Fix the first-landing jargon + seed a canvas.
- **P2 — Guided quick-setup.** A new `TourOverlay` step deck ("Quick setup") that walks empty → design system → first AI edit, plus a **design-setup checklist** surface mirroring the `useReadiness`/`ReadinessList` pattern (project ✓ / design system ✓ / first canvas ✓ / brand assets ✓). Add the in-app **entry point** to upload brand material (wired to P3).
- **P3 — Deterministic migration.** A hardened **local-file + SVG + PDF ingestion** primitive (security-reviewed sibling of `fetch-asset`); a **design-token importer** (`tokens.json` / Style-Dictionary / CSS custom props → the DS CSS-variable contract → scaffold/patch `system/<ds>/`); and **`--imprint` generalized into a file-backed brand prior** that seeds the `ux-research-agent` discovery payload and writes the DDR-141 brand specimens.
- **P4 — Vision reconstruction (experimental).** Formalize "drop a Figma-frame PNG / PDF page → agent re-authors it as a token-styled `DCArtboard` canvas + `.meta.json`", gated by the design-critic reality-check loop. Labeled experimental; non-deterministic.

## Metadata

- **Type**: New Capability (multi-workstream program)
- **Complexity**: High (spans `apps/studio` client+server, `plugins/design`, `cli`, `site`; new ingestion surface with real security stakes)
- **App/Package**: `apps/studio`, `plugins/design`, `cli`, `site` (cross-cutting → root `.ai/plans/`)
- **Affected Systems**: onboarding/first-run, tour engine, video-comp/export, asset write surface, design-system bootstrap, public site
- **Dependencies**: reuses `TourOverlay` (DDR-087), `useReadiness` (DDR-128), video-comp (DDR-148), `fetch-asset` (DDR-045/security), `--imprint` + DDR-141 brand Tier-0
- **New runtime deps (candidate, P3+)**: a PDF→raster path (e.g. `pdfjs`/`pdftoppm`) and an SVG sanitizer (e.g. DOMPurify-class) — each gets its own DDR + security review before adding

## Out of scope (explicit)

- **Intel-Mac / native distribution / the "local vs cloud" download-page fix** → covered by the **separate plan `.ai/plans/feature-desktop-intel-mac-support.md`**. This plan does NOT touch `build-desktop.yml`, arch detection, or a hosted trial. The explainer video (P1) intentionally lives on the public site so the no-install answer to "how do I run this" is served regardless of that plan.
- Live Figma REST/plugin API bridge — P4 uses exported PNG/PDF, not a `.fig`/API client (a real API bridge would be its own plan).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read the group for the phase you're on **in parallel in one message**.

**Onboarding / first-run / tour (P1–P2):**
- `apps/studio/client/panels/OnboardingWizard.jsx` — native first-run wizard, 3 doors (GitHub/local/hub); `AiReadiness` strip at :153 is the checklist-surface pattern.
- `apps/studio/client/tour/overlay.jsx` (`TourOverlay` at :64) — the zero-dep tour engine. Step shape `{ target, title, body, placement?, canvas?, inspector?, tab?, requireSelection?, changes?, render? }`.
- `apps/studio/client/tour/usage-tour.js` + `collab-tour.js` — existing step decks to mirror for the new "Quick setup" deck.
- `apps/studio/client/app.jsx` — `startTour` (:6587), `tourBus.setup` (:6595-6612), tour render (:9703), `[data-tour]` anchors (sidebar :1561, menus :2697, viewport :2858, inspector :5971, whatsnew :2821), `st-empty` jargon copy (:2858-2890), first-run mount (:8939), nudges (:6544-6586, :9652-9702).
- `apps/studio/client/panels/ReadinessList.jsx` — `useReadiness` (:13), `ReadinessList` (:122), `ReadinessDialog` (:147). Pattern to mirror for the design-setup checklist.
- `apps/studio/readiness.ts` — `probeReadiness()` (:166); server-side probe pattern for a new "design-setup" probe.
- `apps/desktop/src-tauri/src/lib.rs` — `resolve_project_root` (:41), `write_minimal_design` (:166 — seeds NO canvas; the landing-jargon bug root).
- `apps/studio/scaffold-design.ts` — `STARTER_CANVAS_TSX` → `ui/Welcome.tsx` (:138). Reconcile the Rust vs TS scaffold mismatch here.

**Video-comp (P1):**
- `.design/ui/Maude Video Intro.tsx` (git-modified) + `.design/ui/Studio Intro Video.tsx` — the explainer source canvases.
- `plugins/design/skills/video-comp/SKILL.md` — Remotion iron rules + export (`/design:export mp4|gif --scope artboard`), :216-225.
- `apps/studio/whats-new.json` + `whats-new.schema.json` — feed + `entry.tour[]` shape (7 entries already carry tours).

**Ingestion / migration (P3–P4):**
- `apps/studio/bin/_fetch-asset.mjs` — the hardened confused-deputy sink (SSRF gate, DNS pin, magic-byte sniff, content-addressed flat write). THE security model to mirror for local-file/SVG/PDF ingestion.
- `cli/lib/fetch-asset.mjs` + `cli/lib/fetch-asset.test.mjs` + `apps/studio/bin/fetch-asset.sh` + `cli/commands/design.mjs` (:49) — the verb-registration + test pattern for a new `import-asset`/`import-tokens` verb.
- `apps/studio/http.ts` (`POST /_api/asset` :1783) + `apps/studio/api.ts` (`saveAssetFromStream` :1227, `sniffAssetType` :557, `ASSET_MAX_BYTES` :419) — where the SVG/PDF accept-list is enforced (the reject we must safely loosen).
- `plugins/design/skills/design-system/_bootstrap.md` — Stage 0–4 + LOCK; `vision-brief.json` synth (:224-253), Stage-2 payload handoff (:263-276), moodboard compose (:362-406). Where a file-backed prior seeds discovery.
- `plugins/design/commands/setup-ds.md` — `--imprint` (:24), brief arg (:21). Generalize to `--from-brand`/`--from-tokens`.
- `plugins/design/agents/ux-research-agent.md` — discovery schema (`palette_options[]`, `typography_pairing_options[]`, `signature_treatment_options[]`, `reference_images[]`, `recommendations{}`), :181-366. The seed target.
- `plugins/design/templates/design-system-inspiration/core/colors_and_type.css.tpl` + `_MAPPING.md` — the DS on-disk contract (token families + answer→file-set map) an importer must produce.
- `apps/studio/canvas-lib.tsx` — `DesignCanvas` (:1387), `DCSection` (:1692), `DCArtboard` (:1739). The P4 reconstruction target shape.
- `apps/studio/draw/optimize.ts` — `optimizeSvg`/`isValidSvg` (SVGO validity gate) — the SVG pass-through/validation step for ingested logos.

### Files to Create

- `apps/studio/client/tour/quick-setup-tour.js` — new "Quick setup" step deck (P2).
- `apps/studio/client/panels/SetupChecklist.jsx` — design-setup checklist surface (P2).
- `apps/studio/design-setup-readiness.ts` — server probe (project/DS/canvas/brand) mirroring `readiness.ts` (P2).
- `apps/studio/bin/import-asset.sh` + `apps/studio/bin/_import-asset.mjs` + `cli/lib/import-asset.mjs` + `cli/lib/import-asset.test.mjs` — local-file/SVG/PDF ingestion primitive (P3).
- `apps/studio/bin/import-tokens.sh` + `apps/studio/bin/_import-tokens.mjs` + tests — token-file → DS-CSS-variable mapper (P3).
- `plugins/design/commands/import.md` — `/design:import` slash entry (tokens / brand / reconstruct) (P3–P4).
- `.design/ui/Maude Explainer.tsx` (or repurpose `Maude Video Intro.tsx`) — the surfaced explainer video-comp (P1).
- DDR files (claim next-free numbers during execution): onboarding surfaces + video wiring; **local-file/SVG/PDF ingestion security posture**; token-import mapping contract; vision-reconstruction experimental posture.

### Design canvases

> These `handed-off` mockups ARE the design spec for P1–P2 — lift them, don't re-derive. (design-plugin priors, DDR-127/141)

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Onboarding.tsx` | `handed-off` | First-run wizard — three doors, GitHub-first, "zero terminal, under two minutes". The P1/P2 landing target. |
| `.design/ui/OnboardingTour.tsx` | `handed-off` | Version-control quick course — two-layer infographic + coach-marks over real controls, on the existing tour engine, no git jargon. Template for the P2 "Quick setup" deck. |
| `.design/ui/CreateProject.tsx` | `handed-off` | Start/open/share a project from inside Maude, no terminal. Grounds the P2 setup checklist entry points. |
| `.design/ui/Maude Video Intro.tsx` | git-modified | The explainer video-comp to finish + surface (P1). |
| `.design/ui/Studio Intro Video.tsx` | draft | v5.2 showreel storyboard, one beat per artboard + voiceover — the explainer script/beats. |
| `.design/ui/Studio Hub.tsx`, `Commands Overview.tsx`, `Docs Site.tsx` | — | Supporting surfaces (hub/commands/docs) the explainer references. |

### Documentation

- `plugins/design/skills/video-comp/SKILL.md` — Remotion iron rules, export scope flags — Why: authoring + exporting the explainer.
- `.ai/decisions/DDR-087` (tour engine), `DDR-128`/`DDR-135` (readiness + onboarding affordances), `DDR-141` (brand Tier-0), `DDR-148` (video-comp), `DDR-045` (fetch-asset real-disk paths + security) — Why: the reuse contracts.
- `site/content/docs/getting-started.mdx` + `site/content/docs/desktop/` — Why: where the public explainer + "how to run" answer land.

### Patterns to Follow

- **Verb dispatch**: new CLI capability ships as `apps/studio/bin/<verb>.sh` (+ `_<verb>.mjs` shim) reached via `maude design <verb>`, registered in `cli/commands/design.mjs`, added to `package.json` `files`. Plugin markdown calls `maude design <verb>`, never a raw bin path (DDR-062; `cli/lib/plugin-cli-reachability.test.mjs` enforces).
- **Ingestion security**: mirror `_fetch-asset.mjs` — magic-byte sniff, size/time caps, realpath containment into `<designRoot>/assets/`, content-addressed flat `<sha8>.<ext>`. For the NEW types: SVG must be **sanitized** (strip `<script>`, event handlers, external refs) before write; PDF must be **rasterized page→PNG** (never embedded/executed raw). This is the DDR + security-review gate.
- **Runtime-state taxonomy**: any new `_*` runtime path added must be updated in all THREE lists (`apps/studio/git/service.ts` `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, repo `.gitignore`) — DDR-115.
- **Canvas-origin routes**: any new canvas-reachable route goes in BOTH `CANVAS_SAFE_API` (`http.ts`) AND the `startCanvasServer` `routes` map (`server.ts`); privileged (file-write, import) routes in NEITHER — DDR-088. Ingestion write routes are privileged.

---

## Design Decisions

> UI feature — components resolved against the shipped studio-client + the `maude` DS.

### Components (reuse from repo)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `TourOverlay` | `apps/studio/client/tour/overlay.jsx` | Add a new step deck; no engine changes expected. |
| `ReadinessList` / `useReadiness` | `apps/studio/client/panels/ReadinessList.jsx` | Mirror shape for `SetupChecklist`. |
| `OnboardingWizard` doors | `apps/studio/client/panels/OnboardingWizard.jsx` | Add a "Watch 60s intro" affordance + a "Bring my brand" entry. |
| `VideoComp` | `apps/studio/canvas-lib.tsx` (:122) | The explainer authoring surface. |
| What's-New `entry.tour[]` | `apps/studio/whats-new.json` | Attach the quick-setup tour to the announcement. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| First-run wizard | `.design/ui/Onboarding.tsx` | Design spec for the landing. |
| Tour infographic | `.design/ui/OnboardingTour.tsx` | Design spec for the quick-setup deck. |
| Project create/share | `.design/ui/CreateProject.tsx` | Design spec for checklist entry points. |

### Icons

| Icon | Library | Usage |
| ---- | ------- | ----- |
| play / upload / check-circle / wand | studio icon set (match existing shell) | intro affordance, brand upload, checklist ticks, "generate my system" |

### Tokens

Use the `maude` DS tokens only (`.design/system/maude/colors_and_type.css`): `--bg-*`, `--fg-*`, `--accent` (the single indigo), `--border-*`, `--status-*`, `--dur-*`/`--ease-*`. No hardcoded colors; motion via duration/easing tokens (motion-critic gate).

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `SetupChecklist` | No design-setup progress surface exists | mirrors `ReadinessList` |
| `quick-setup-tour` deck | No journey tour exists (only chrome tours) | `TourOverlay` step shape |
| Brand-upload panel | Net-new — no in-app ingestion surface exists at all | new, wired to `maude design import-*` |

---

## Tasks

Execute in phase order. Each phase is independently shippable. Task IDs `T#` for `/flow:resume`.

### Phase 1 — Explainer video + first-run surfacing (discovery; smallest, highest reach)

**T1: FINISH the explainer video-comp**
- **Do**: Complete `.design/ui/Maude Video Intro.tsx` (or fork to `Maude Explainer.tsx`) into a 30–60s reel: what Maude is → open/create project → design system → AI edit → export. Use the `Studio Intro Video.tsx` storyboard beats. Frame-driven only (video-comp iron rules).
- **Pattern**: `plugins/design/skills/video-comp/SKILL.md`; assets dropped into `.design/assets/`.
- **Validate**: `/design:export mp4 --scope artboard` + `gif` + a poster PNG render clean; scrub in Player.

**T2: SURFACE the video in the native app**
- **Do**: Add a "Watch the 60-second intro" affordance to `OnboardingWizard` (Welcome door area) + a Help ▸ "Watch intro" item. Play the exported MP4 (bundled asset, resolved via `paths.ts`, not the served project).
- **Pattern**: Help-menu items at `app.jsx:2380-2385`; asset resolution via `paths.ts` (DDR-045).
- **Validate**: desktop-e2e scenario opens wizard → intro affordance visible + launches (add `data-testid="onboarding-watch-intro"`).

**T3: SURFACE the video on the public site (the no-install answer)**
- **Do**: Embed the exported MP4/poster on `site/` getting-started + `/desktop`. This is what a prospect (incl. no-install / Intel Mac) watches. Keep the file self-hosted (GitHub release asset or `site/public`), poster fallback.
- **Pattern**: existing landing demo-video slot in `README.md` / `site/app/(home)`.
- **Validate**: `pnpm --filter @maude/site build`; agent-browser loads the page, video element present with poster.

**T4: ANNOUNCE via What's-New + attach the quick-setup tour hook**
- **Do**: Append a pending What's-New entry (via `whats-new-entry` skill) with `tour[]` pointing at the P2 deck (added in T7).
- **Validate**: `apps/studio/test/whats-new.test.ts`; badge/toast render.

**T5: FIX first-landing jargon + scaffold mismatch**
- **Do**: (a) Make the Rust `write_minimal_design()` seed the friendly `Welcome.tsx` (reconcile with TS `scaffoldDesign()` so welcome-project + "Set up Maude here" both land on a canvas, not empty). (b) Replace the `st-empty` dev-jargon copy (`app.jsx:2858-2890`) with designer-friendly copy + a "Start quick setup" button.
- **Gotcha**: adding a `#[tauri::command]` needs 3 edits incl. `build.rs` (memory `reference_tauri_command_needs_build_rs`) — verify with a real desktop build, not `cargo check`.
- **Validate**: desktop-e2e first-run scenario lands on a visible canvas + friendly empty-state copy.

### Phase 2 — In-app guided onboarding path ("quick setup demo")

**T6: BUILD the design-setup readiness probe**
- **Do**: `apps/studio/design-setup-readiness.ts` — probe project ✓ / design-system-present ✓ / first-canvas ✓ / brand-assets-present ✓. Expose `GET /_api/setup-readiness` (main-origin-only, `no-store`, Origin-gated — mirror `/_api/preflight` at `http.ts:753`).
- **Pattern**: `apps/studio/readiness.ts` `probeReadiness`.
- **Validate**: route returns the 4-item envelope; unit test on the probe.

**T7: BUILD the "Quick setup" tour deck + checklist**
- **Do**: `apps/studio/client/tour/quick-setup-tour.js` (empty → create design system → first AI edit) using `TourOverlay` step shape + new `[data-tour]` anchors where missing. `apps/studio/client/panels/SetupChecklist.jsx` consuming `useSetupReadiness()` (mirror `useReadiness`). Add checklist to the wizard + a persistent "Setup" affordance until complete.
- **Pattern**: `usage-tour.js` / `collab-tour.js`; `ReadinessList.jsx`; design spec `.design/ui/OnboardingTour.tsx`.
- **Gotcha**: `requireSelection` steps wait for a real ⌘-click — the DS-creation step can't be a real terminal `/design:setup-ds` from inside the tour; make it a guided coach-mark + link, not an executed command (native app is no-terminal by posture, DDR-126/128).
- **Validate**: `apps/studio/test/tour-overlay.test.tsx` extended; desktop-e2e runs the deck end-to-end.

**T8: ADD the "Bring my brand" entry point**
- **Do**: A wizard/checklist action "Bring my existing brand" that opens the brand-upload panel (built in P3, T12). Until P3 lands, it links to docs. Add `data-testid="onboarding-bring-brand"`.
- **Validate**: entry visible; routes to the panel/doc.

### Phase 3 — Migration: deterministic ingestion ("bring your existing design system in")

**T9: RECORD the ingestion-security DDR (do FIRST)**
- **Do**: Author the DDR (next-free ≈ 152/153) for local-file + SVG + PDF ingestion: threat model (SVG XSS/script/external-ref, PDF parser CVEs + local-file/SSRF via embedded refs, zip-bomb/size), the sanitize-SVG + rasterize-PDF-page decision, chosen deps, and the write-path containment. This gates all of P3.
- **Pattern**: `_fetch-asset.mjs` security header + `.ai/decisions/DDR-045`.
- **Validate**: DDR reviewed by `ethical-hacker` + `security-auditor` subagents before code.

**T10: BUILD `maude design import-asset` (local file + SVG + PDF)**
- **Do**: `apps/studio/bin/import-asset.sh` + `_import-asset.mjs` + `cli/lib/import-asset.mjs`. Accepts a LOCAL path (sibling of URL-only `fetch-asset`): raster → sniff+cap+content-address write; **SVG → sanitize then `optimizeSvg` validity gate** then write; **PDF → rasterize each page → PNG** then write. Realpath containment into `<designRoot>/assets/`. Register verb in `cli/commands/design.mjs`; add dirs to `package.json` `files`.
- **Gotcha**: `fetch-asset` deliberately rejects `file://` and non-image (tests assert it) — `import-asset` is a SEPARATE, explicitly-local primitive, not a loosening of `fetch-asset`.
- **Validate**: `cli/lib/import-asset.test.mjs` — malicious SVG stripped, oversized/zip-bomb rejected, PDF→PNG produced, path-traversal blocked. Live: import a logo SVG + a 2-page PDF into a scratch `.design/`.

**T11: BUILD `maude design import-tokens` (token file → DS CSS variables)**
- **Do**: `import-tokens.sh` + `_import-tokens.mjs`. Parse `tokens.json` (W3C design-tokens) / Style-Dictionary / a CSS custom-properties file → map to the DS token contract (`--bg-*`, `--fg-*`, `--accent*`, `--space-*`, `--type-*`, modular scale…) → **scaffold OR patch** `system/<ds>/colors_and_type.css` + a `.design/config.json` `designSystems[]` entry. Emit a mapping report (unmapped tokens surfaced, never silently dropped).
- **Do**: Author the token-mapping-contract DDR (next-free) — the canonical name→variable map.
- **Pattern**: DS contract in `core/colors_and_type.css.tpl` + `_MAPPING.md`; verb pattern from T10.
- **Validate**: `import-tokens.test.mjs` (fixtures: a Style-Dictionary export, a raw CSS-vars file, a partial set). Live: import a real `tokens.json` → `design-system-completeness-critic` passes on the produced DS.

**T12: GENERALIZE `--imprint` into a file-backed brand prior + in-app upload panel**
- **Do**: Extend `/design:setup-ds` with `--from-brand <file(s)>` (PDF/images/logo): run T10 ingestion → extract palette + type cues + logo → seed the `ux-research-agent` discovery payload (schema at `ux-research-agent.md:181-366`) AND write DDR-141 brand specimens (`preview/logo.*`, `assets/logos/`). Thread through Stage 2→3→4 unchanged (payload-driven). Build the in-app **Brand-upload panel** (from T8) calling `maude design import-*` + kicking the seeded bootstrap.
- **Pattern**: `--imprint` steer (`setup-ds.md:24`); `_bootstrap.md` Stage-2 payload handoff (:263-276).
- **Gotcha**: extraction is best-effort — the LOCK gate still lets the user correct; never present extracted values as final without the Stage-3/4 confirm.
- **Validate**: `/design:setup-ds test --from-brand <fixtures>` produces a DS whose accent/type/logo trace to the upload; completeness-critic passes.

**T13: RE-CUT the explainer to show the real upload→setup flow**
- **Do**: Update the P1 video-comp to include the now-real "upload brand manual → get a design system" beat. Re-export MP4/GIF/poster; refresh site + What's-New.
- **Validate**: re-export clean; site build green.

### Phase 4 — Migration: LLM-vision reconstruction (experimental follow-up)

**T14: RECORD the vision-reconstruction DDR (experimental posture)**
- **Do**: DDR (next-free) — scope (Figma-frame PNG / PDF page → ONE `DCArtboard` canvas), the non-determinism + quality-gate stance, the reality-check loop, and the "labeled experimental" surfacing.
- **Validate**: reviewed; sets acceptance bar for T15.

**T15: BUILD `/design:import --reconstruct` (image → canvas)**
- **Do**: `plugins/design/commands/import.md` reconstruct mode: ingest source image via T10 (PDF page→PNG) → agent `Read`s the image → hand-authors a token-styled `DCArtboard` `.tsx` + `.meta.json` (`layout.artboards[]` world position) → screenshot the reconstruction → design-critic reality-check vs the source → iterate to convergence (hard cap). Reuse the `/design:edit` step-3.5 reality-check pattern.
- **Pattern**: `canvas-lib.tsx` `DCArtboard` shape; migration-map §2a; `/design:new` ingest mode (DDR-085) as the nearest structural precedent.
- **Gotcha**: vision model is barred from reading exact text/colors from images elsewhere (draw-critic rule) — reconstruction must transcribe text/colors from the SOURCE deliberately, and flag low-confidence regions rather than hallucinate.
- **Validate**: reconstruct a known Figma-frame PNG → screenshot parity acceptable to design-critic; label output `kind`/meta as reconstructed-experimental.

---

## Validation

Run to confirm zero regressions:

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Tests**: `pnpm test && pnpm test:dev-server` (incl. new `import-asset`/`import-tokens`/tour/readiness tests)
4. **Build**: `pnpm --filter @maude/site build` (site explainer surfacing) + committed studio bundle rebuild release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) whenever client surfaces change — commit `dist/client.bundle.js` + `dist/styles.css`.
5. **Parity/tarball/tokens/site-content gates**: `bash scripts/check-version-parity.sh`, `check-tarball-shape.sh`, `sync:tokens:check`, `gen:reference`/`gen:stats` (per `config.quality`). New `files` entries (bins) must keep tarball-shape green.
6. **Security (MANDATORY for P3/P4)**: spawn `security-auditor` + `ethical-hacker` over the ingestion surface (SVG sanitize, PDF rasterize, path containment, canvas-origin route classification). 0 findings at/above `security.severityFloor`.
7. **Native E2E**: `desktop-e2e` scenarios — first-run lands on a canvas (T5), watch-intro affordance (T2), quick-setup deck runs (T7). Add `data-testid`s in the same change.
8. **Design-system guard + critics**: for the explainer canvas + any new studio-client UI, run `design-system-keeper` + the critic panel (motion-critic fires on the video-comp).
9. **A11y**: `a11y-auditor` over the new onboarding surfaces (checklist, brand-upload panel, intro modal — focus, labels, reduced-motion on the video).
10. **Manual**: import a real third-party `tokens.json` + a real brand PDF end-to-end on an Intel Mac via the CLI path (the designer's actual environment) — confirms the no-native-app path works.

---

## Scenario Coverage (UI tasks — required)

Primary platform per config: `web-desktop` (studio) + the native shell (desktop-e2e). Mobile/tablet N/A for the studio.

**New scenarios to create:**
- `onboarding-first-run` — first launch → wizard → watch intro → land on a seeded canvas. (native, desktop-e2e)
- `quick-setup-journey` — empty project → guided "Quick setup" tour → design system created (coach-marked) → first AI edit. (native, desktop-e2e)
- `bring-my-brand` — upload a brand PDF + tokens file → design system produced → design with it. (web-desktop/agent-browser against `maude design serve`)

**Existing infra reused:** `apps/studio/test/tour-overlay.test.tsx`, `whats-new.test.ts`, `desktop-e2e` harness (testids: `canvas-list`, `canvas-row-<slug>`, `canvas-frame`).

---

## Acceptance Criteria

- [ ] All phase tasks completed (P1–P4; P4 shipped labeled experimental)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (types, lint, format)
  - [ ] Tests (full suite incl. new ingestion/tour/readiness tests)
  - [ ] Build (+ committed studio bundle rebuilt `--release` for any client change)
  - [ ] **`security-auditor` + `ethical-hacker`: 0 findings ≥ severityFloor on the ingestion surface** (hard gate for P3/P4)
  - [ ] `design-system-keeper` + critic panel: 0 blockers on new UI + the explainer canvas
  - [ ] `a11y-auditor`: 0 blockers on onboarding surfaces
  - [ ] `desktop-e2e`: first-run + quick-setup scenarios green
- [ ] Explainer video is watchable **on the public site without installing** (the designer's core ask)
- [ ] A real third-party `tokens.json` + a brand PDF successfully become a usable `system/<ds>/` (completeness-critic passes)
- [ ] DDRs recorded: onboarding/video wiring, **ingestion security posture**, token-mapping contract, vision-reconstruction posture (claim next-free numbers; re-check for races before the closing commit — memory `project_ddr_numbering_races_on_shared_main`)
- [ ] Runtime-state taxonomy + canvas-origin allowlists updated if any new `_*` path or route was added (DDR-115/088)
- [ ] Out-of-scope boundary held: no changes to `build-desktop.yml` / arch detection (that's `feature-desktop-intel-mac-support.md`)
- [ ] No regressions; code follows project conventions
```

---

## Risks & notes

- **Security is the load-bearing risk.** SVG and PDF are rejected today *for a reason* (XSS/script, parser CVEs, SSRF via embedded refs). P3 must sanitize SVG and rasterize PDF, go through `_fetch-asset.mjs`-grade containment, and pass the security fan-out. Do T9 (the DDR + threat model) before any P3 code.
- **Vision reconstruction (P4) is non-deterministic** — ship it labeled experimental, gated by the reality-check loop; never present it as lossless.
- **Native no-terminal posture** (DDR-126/128) means the quick-setup tour can't execute `/design:setup-ds` from inside the app — it coach-marks + links. Keep the terminal `/design:*` path as the power route.
- **Bundle discipline**: any studio-client change needs the committed `dist/client.bundle.js` rebuilt `--release` before commit (whats-new/CLAUDE.md rule) — easy to forget.
- **DDR numbering races on shared `main`** — re-check the decisions dir + uncommitted README index before the closing commit.
