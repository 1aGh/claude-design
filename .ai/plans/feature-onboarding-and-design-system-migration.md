---
name: feature-onboarding-and-design-system-migration
status: planned
created: 2026-07-07
decisions: [DDR-166, DDR-167, DDR-168, DDR-169, DDR-170]  # to be claimed during execution; next-free ≈ 166 (re-check for races — DDR-152..165 now claimed)
---

# Feature: Onboarding & Design-System Migration — bring users (and their existing brand) into Maude

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — most of this plan REUSES shipped infra (tour engine, readiness pattern, video-comp, fetch-asset) rather than building new.

## Description

A designer discovering Maude gave two pieces of feedback:

1. **"It would help to SEE how onboarding works before installing"** — an explainer of what the tool does, how you upload brand material, and how you do the basic setup, without having to run it first.
2. **"If people already have a design system, they need to migrate it into Maude so it's usable."** — bring an existing brand/DS/design in from Figma / PDF / token files.

A third piece of feedback came from actually trying to use the native app's **ACP chat panel** (AI editing) from a clean machine:

3. **"To even start using the AI chat, I had to leave Maude and do a pile of terminal work."** — install Claude Code in a terminal, run `claude`, click through Claude's own onboarding, `/login`, restart Maude Desktop; the panel then claims you also need to `npm i -g @1agh/maude`; and it points you at the marketplace to install the Maude plugins. Three terminal detours before the very first AI edit — a wall for non-technical users, who are exactly Maude's audience.

This plan turns that into four coordinated workstreams: (P0) a **zero-terminal ACP cold start** so a non-technical user reaches their first AI edit without ever opening a terminal, (P1) a **product explainer video + in-app + on-site surfacing** so anyone can watch how it works, (P2) an **in-app guided onboarding path** (quick-setup demo from empty project → design system → first AI edit), and (P3–P4) **migration ingestion** — bringing an existing design system and existing designs into Maude, deterministic first (tokens + brand assets), LLM-vision reconstruction second (Figma frame / PDF page → canvas), as an experimental follow-up.

## User Story

- As a **designer evaluating Maude**, I want to **watch a short explainer and see the setup flow before I install**, so that I understand what the tool is and whether it fits — without a local install.
- As a **designer with an existing brand / design system**, I want to **upload my brand material (tokens, logo, brand manual) and have Maude turn it into a usable design system**, so that I can design in Maude with MY brand, not a generic starter.
- As a **new native-app user**, I want a **guided quick-setup that walks me from empty project to a real design system to my first AI edit**, so that I reach value in minutes without terminal or dev jargon.
- As a **completely non-technical native-app user**, I want the **AI chat panel to become usable from inside Maude — install what it needs, sign me into my own Claude subscription in the browser, and connect — without ever opening a terminal or restarting the app**, so that "start using AI editing" is a couple of clicks, not a developer setup chore.

## Problem

- **The ACP chat's cold start is terminal-gated — three detours before the first AI edit.** The native panel needs (a) the user's `claude` CLI, (b) the `maude` CLI, and (c) the Maude plugins — and today each pushes the user back to a terminal:
  1. **`claude` install + login.** `acp/probe.ts:71` resolves the CLI with `Bun.which('claude')` and reports only *presence* — it never checks *login state*. When it's missing, `ChatPanel.NotConnected` (`ChatPanel.jsx:1001-1008`) instructs `npm i -g @anthropic-ai/claude-code`, then `claude` + `/login` **in a terminal**, then reopen the panel. Login is invisible to the probe, so a claude that's installed-but-logged-out reads as "available" and only fails on the first prompt; the folk remedy is to `/login` in a terminal and **restart Maude**.
  2. **`maude` CLI is not bundled onto the child's PATH.** Desktop `externalBin` ships `maude-server` + `agent-browser` only (`tauri.conf.json:38`) — **not** the `maude` CLI. So `readiness.ts:191` still shows a red row demanding `npm i -g @1agh/maude`, and the ACP-spawned `claude`'s `/design:edit` → `maude design <verb>` shell-out depends on a *global* install (reachable only via `resolve_login_path()`, `sidecar.rs:44`). The user reasonably expected it bundled.
  3. **Plugins point at the marketplace.** DDR-143 already auto-injects the bundled `design` plugin session-scoped (`acp/plugin-bootstrap.ts`), which should collapse the plugins readiness row to green — yet the user still saw a `/plugin marketplace add … / install design@maude` remediation, meaning the auto-inject isn't firing in the shipped bundle (or `/flow` — intentionally out — is being demanded). (research: `readiness.ts` `probeReadiness`, `ChatPanel.jsx` `NotConnected`, `acp/plugin-bootstrap.ts` `isNativePluginContext`)
- **Discovery is install-gated.** There is no explainer a prospect can watch without running the app. `.design/ui/Maude Video Intro.tsx` is a real, exportable video-comp — but it is a design artifact wired into nothing (not first-run, not Help, not What's-New, not the public site). (research: onboarding-map §3.2)
- **In-app onboarding teaches chrome, not the journey.** The two existing tours (`USAGE_TOUR`, `COLLAB_TOUR`) only explain existing controls. Nothing walks "create a design system → make your first edit." First landing is a dev-jargon empty state (`_active.json`, `_comments/`, `/design`); the friendly `Welcome.tsx` isn't auto-opened, and the Rust welcome-project seeds **no** canvas at all. (research: onboarding-map §1, §3.4–3.5)
- **There is no way to bring an existing design system in.** A DS is created ONLY via interactive `/design:setup-ds` in the terminal — no stage accepts a file. There is **zero** external importer: no Figma/Sketch client, no `tokens.json`/Style-Dictionary parser, no PDF reader. Both asset writers (`fetch-asset` URL-only; `POST /_api/asset` drag-drop) accept PNG/JPG/GIF/WebP + video/audio only and explicitly **reject SVG and PDF**. (research: ds-ingestion-map §1,§4; migration-map §1,§4)

## Solution

Reuse the mature spines; add the two genuinely-missing pieces (an ingestion primitive + an in-app onboarding journey).

- **P0 — Zero-terminal ACP cold start.** Make the chat panel's three dependencies self-heal from inside the app, always on the user's *own* Claude subscription (never our token / never the embedded SDK — the ToS line, memory `reference_claude_subscription_via_users_cli_not_sdk`, DDR-123):
  - **Install `claude` for the user, no terminal.** A one-click "Set up AI editing" action provisions the real `@anthropic-ai/claude-code` (mirroring the `_ensure-browser.mjs` first-use provisioning pattern — download/install into a Maude-managed location, add it to the ACP child's PATH), so `npm i -g …` never appears.
  - **Sign in from Maude, browser-native, no restart.** A "Sign in to Claude" button triggers `claude`'s *own* browser login (the user authenticates their own Anthropic/Pro-Max account), polls for completion (precedent: the GitHub device-flow shape in `oauth.rs`), then **hot-reconnects the bridge** — killing the "restart Maude Desktop" step. Extend `probe.ts` to detect *logged-in* state (not just binary presence) so the panel shows an honest "signed in ✓ / sign in" affordance instead of a false "available".
  - **Bundle the `maude` CLI.** Add `binaries/maude` to `externalBin` and expose it on the ACP child's PATH, so the readiness `maude` row is green out of the box and `/design:edit` shells out with no global install.
  - **Guarantee plugin auto-inject in the shipped bundle.** Verify + fix DDR-143 `isNativePluginContext()` / `DESIGN_PLUGIN_DIR` resolution so the `design` plugin is always session-injected in the packaged app (add a desktop-e2e assertion), and make the readiness `plugins` row never surface a marketplace remediation on the native path.
- **P1 — Explainer video, surfaced everywhere.** Author a proper product explainer as a video-comp (repurpose `Maude Video Intro.tsx` / `Studio Intro Video.tsx`), export MP4 + GIF + poster through Maude's own capture spine, and wire it into: native first-run wizard, Help menu, a What's-New entry, and — crucially — the **public site** (`/desktop`, getting-started) so a no-install / Intel-Mac prospect can watch it. Fix the first-landing jargon + seed a canvas.
- **P2 — Guided quick-setup.** A new `TourOverlay` step deck ("Quick setup") that walks empty → design system → first AI edit, plus a **design-setup checklist** surface mirroring the `useReadiness`/`ReadinessList` pattern (project ✓ / design system ✓ / first canvas ✓ / brand assets ✓). Add the in-app **entry point** to upload brand material (wired to P3).
- **P3 — Deterministic migration.** A hardened **local-file + SVG + PDF ingestion** primitive (security-reviewed sibling of `fetch-asset`); a **design-token importer** (`tokens.json` / Style-Dictionary / CSS custom props → the DS CSS-variable contract → scaffold/patch `system/<ds>/`); and **`--imprint` generalized into a file-backed brand prior** that seeds the `ux-research-agent` discovery payload and writes the DDR-141 brand specimens.
- **P4 — Vision reconstruction (experimental).** Formalize "drop a Figma-frame PNG / PDF page → agent re-authors it as a token-styled `DCArtboard` canvas + `.meta.json`", gated by the design-critic reality-check loop. Labeled experimental; non-deterministic.

## Metadata

- **Type**: New Capability (multi-workstream program)
- **Complexity**: High (spans `apps/studio` client+server, `plugins/design`, `cli`, `site`; new ingestion surface with real security stakes)
- **App/Package**: `apps/studio`, `plugins/design`, `cli`, `site` (cross-cutting → root `.ai/plans/`)
- **Affected Systems**: ACP chat bridge + cold-start readiness (P0), desktop Rust shell (`externalBin`, a new claude-install/login command), onboarding/first-run, tour engine, video-comp/export, asset write surface, design-system bootstrap, public site
- **Dependencies**: reuses `TourOverlay` (DDR-087), `useReadiness` (DDR-128), video-comp (DDR-148), `fetch-asset` (DDR-045/security), `--imprint` + DDR-141 brand Tier-0; P0 builds on the ACP panel (DDR-123), plugin auto-inject (DDR-143), native no-terminal posture (DDR-126), and the "drive the user's own `claude`, never the embedded SDK" ToS line (memory `reference_claude_subscription_via_users_cli_not_sdk`)
- **New runtime deps (candidate, P3+)**: a PDF→raster path (e.g. `pdfjs`/`pdftoppm`) and an SVG sanitizer (e.g. DOMPurify-class) — each gets its own DDR + security review before adding

## Out of scope (explicit)

- **Intel-Mac / native distribution / the "local vs cloud" download-page fix** → covered by the **separate plan `.ai/plans/feature-desktop-intel-mac-support.md`**. This plan does NOT touch `build-desktop.yml`, arch detection, or a hosted trial. The explainer video (P1) intentionally lives on the public site so the no-install answer to "how do I run this" is served regardless of that plan.
- Live Figma REST/plugin API bridge — P4 uses exported PNG/PDF, not a `.fig`/API client (a real API bridge would be its own plan).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read the group for the phase you're on **in parallel in one message**.

**ACP cold start (P0):**
- `apps/studio/acp/probe.ts` — `probeAcpAvailability()` (:92), `resolveClaudePath()` (:71, presence-only — the login-state gap), `resolveAdapterEntry()` (:36). Extend to detect *logged-in* state.
- `apps/studio/acp/plugin-bootstrap.ts` — `isNativePluginContext()` (:93), `computeSessionPlugins()` (:66). DDR-143 auto-inject; the guard that must reliably fire in the shipped bundle.
- `apps/studio/readiness.ts` — `probeReadiness()` (:166: claude/maude/plugins rows + remediations), `scanPlugins()` (:130), `resolveOnPath()`. Where the `maude` red row + plugin remediation live.
- `apps/studio/client/panels/ChatPanel.jsx` — `NotConnected` (:989) + terminal-remediation copy (:1001-1008); `useReadiness` + `recheck` hot-reconnect wiring (:1234-1240). The panel surface to turn into buttons.
- `apps/studio/client/panels/ReadinessList.jsx` — `useReadiness` (:13) / `ReadinessList` (:122). The rows P0 flips to green + gets action buttons.
- `apps/desktop/src-tauri/src/sidecar.rs` — `resolve_login_path()` (:44), sidecar env/PATH wiring (:90-163). Where a bundled `maude` joins the ACP child's PATH.
- `apps/desktop/src-tauri/src/oauth.rs` — GitHub **device-flow** (pop browser → poll → store, no terminal). The *shape* to mirror for a "sign in to Claude from Maude" command (driving claude's OWN login, not our OAuth app).
- `apps/desktop/src-tauri/tauri.conf.json` — `externalBin` (:38, `maude-server`+`agent-browser` only). Add `binaries/maude`.
- `apps/studio/bin/_ensure-browser.mjs` — first-use provisioning precedent (:1-16, download chrome-headless-shell → cache → PATH). The pattern for provisioning `claude`.
- `apps/desktop/src-tauri/src/lib.rs` — `generate_handler` + capabilities; a new `#[tauri::command]` needs 3 edits incl. `build.rs` (memory `reference_tauri_command_needs_build_rs`).

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

- `apps/desktop/src-tauri/src/claude_setup.rs` (or fold into `sidecar.rs`) — `#[tauri::command]`s: provision/install `claude`, launch its browser login, poll completion (P0). Wire into `lib.rs` `generate_handler` + capabilities + `build.rs`.
- `apps/studio/acp/login-state.ts` (or extend `probe.ts`) — logged-in detection backing an honest "signed in ✓ / sign in" affordance (P0).
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

Execute in phase order. Each phase is independently shippable. Task IDs `T#` for `/flow:resume` (Phase 0 uses `T0a`–`T0f` so the existing `T1`–`T15` refs stay stable).

### Phase 0 — Zero-terminal ACP cold start (the barrier before any AI edit; ship first)

> Highest-priority gate: until this lands, a non-technical user can't use the chat at all. Independently shippable and independent of P1–P4. **Non-negotiable constraint:** always the user's OWN `claude` + OWN Anthropic login (their Pro/Max sub) — never embed the Agent SDK with our token, never our OAuth app for Claude auth (DDR-123; memory `reference_claude_subscription_via_users_cli_not_sdk`).

**T0a: RECORD the zero-terminal-cold-start DDR (do FIRST)**
- **Do**: Author the DDR (next-free ≈ **166** — plan header's "152" is stale; re-check the decisions dir before claiming, memory `project_ddr_numbering_races_on_shared_main`). Scope: provision-`claude`-from-app, browser-login-from-app + hot-reconnect, bundle-`maude`, guarantee-plugin-inject. Nail the trust posture: user's own binary + own login, no token custody by Maude, opt-out env for locked-down/CI, what Maude does/doesn't touch in `~/.claude`.
- **Validate**: reviewed by `ethical-hacker` + `security-auditor` (spawning an installer + a browser-login flow from the app is a real surface).

**T0b: BUNDLE the `maude` CLI onto the ACP child's PATH**
- **Do**: Add `binaries/maude` to `externalBin` (`tauri.conf.json:38`) and prepend its dir to the sidecar child's PATH so the ACP-spawned `claude` reaches `maude design …` with no global install. Flip `readiness.ts` `maude` row: treat the bundled binary as satisfied on the native path (mirror the agent-browser bundled-capability logic already in `probeReadiness`).
- **Gotcha**: `resolve_login_path()` (`sidecar.rs:44`) currently relies on the login shell — the bundled dir must win/merge so a user WITHOUT a global `maude` still resolves it.
- **Validate**: readiness `maude` row green in a packaged `.app` with no global maude; `/design:edit` shell-out works. `check-tarball-shape.sh` + `files` stay green if the CLI ships via npm too.

**T0c: PROVISION `claude` from inside the app (no `npm i`)**
- **Do**: A `#[tauri::command]` (+ `lib.rs` handler + capabilities + `build.rs` — memory `reference_tauri_command_needs_build_rs`) that installs the real `@anthropic-ai/claude-code` into a Maude-managed location and exposes it to the ACP child's PATH. Model the first-use, cache-once, add-to-PATH flow on `_ensure-browser.mjs`. Surface as a "Set up AI editing" button in `ChatPanel.NotConnected`.
- **Gotcha**: it's the USER's CLI (their subscription) — we only install the binary, we never wrap it with our credentials. Verify with a real desktop build (`cargo check` won't catch the missing `build.rs` entry).
- **Validate**: from a machine with no `claude`, the button installs it and the probe flips to "installed, sign in".

**T0d: SIGN IN TO CLAUDE FROM MAUDE + hot-reconnect (kill the restart)**
- **Do**: A "Sign in to Claude" action that launches `claude`'s OWN browser login, polls for completion (device-flow *shape* per `oauth.rs`), then re-probes + reconnects the bridge in place — no app restart. Extend `probe.ts`/`login-state.ts` to detect logged-in state so the panel shows "signed in ✓" vs "sign in", not a false "available".
- **Gotcha**: never intercept/store Claude credentials — the login lands in the user's own `~/.claude`; Maude only observes completion. Reduced-motion / a11y on the waiting state.
- **Validate**: logged-out → click → browser login → panel connects live (no restart); logged-out-but-installed no longer reads as "available".

**T0e: GUARANTEE plugin auto-inject in the shipped bundle**
- **Do**: Verify + fix `isNativePluginContext()` / `DESIGN_PLUGIN_DIR` resolution (`acp/plugin-bootstrap.ts`, `paths.ts`) so the `design` plugin is ALWAYS session-injected in the packaged `.app`; ensure `readiness.ts` `plugins` row never shows a marketplace remediation on the native path. If the user's report traces to `/flow` being demanded, confirm the design-only gate is correct and the copy doesn't imply a flow install.
- **Validate**: desktop-e2e asserts `/design:*` commands are available in a fresh chat session with a pristine `~/.claude` (no marketplace add); plugins row green.

**T0f: COLLAPSE the not-connected panel into a guided, button-driven cold start**
- **Do**: Replace the terminal-instruction copy (`ChatPanel.jsx:1001-1008`) with the P0 action ladder — Install `claude` (T0c) → Sign in (T0d) → (maude + plugins already green via T0b/T0e) → Connect. Reuse `ReadinessList` rows with inline actions; keep a "power user? do it in a terminal" disclosure for the manual path. Add `data-testid`s (`acp-setup-install`, `acp-setup-signin`).
- **Validate**: desktop-e2e `acp-cold-start` scenario walks a pristine machine to a connected panel with zero terminal use; rebuild the committed studio bundle `--release` after the client change.

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

**T12a: RECORD the content-handoff DDR (do FIRST — gates T12, per DDR-167's own explicit scope boundary)**
- **Do**: DDR-167 (T9) covers the byte-ingestion pipeline only and explicitly says T12's hand-off of extracted file content into `ux-research-agent`'s discovery payload is OUT of its scope and needs its own review before it ships (an ethical-hacker Round-1 finding on DDR-167 — "T12 is the actual trifecta-completing step and has no DDR gate"). Author that DDR (or a DDR-167 amendment): extracted text/labels (visible SVG `<text>`/`<title>`/`<desc>`, OCR'd/rendered PDF-page text) must be threaded into the agent payload as untrusted DATA, never as instructions — mirroring `sanitizeReuseText` (DDR-164 §G3) — with no auto-triggered `WebFetch`/`WebSearch` off file-derived URLs.
- **Validate**: reviewed by `ethical-hacker` + `security-auditor` before T12 code, same discipline as T9/T14.

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
6. **Security (MANDATORY for P0 + P3/P4)**: spawn `security-auditor` + `ethical-hacker` over (a) the P0 cold-start surface — the app-driven `claude` installer + the browser-login flow (no credential custody by Maude, no privilege escalation, PATH-injection safety) — and (b) the ingestion surface (SVG sanitize, PDF rasterize, path containment, canvas-origin route classification). 0 findings at/above `security.severityFloor`.
7. **Native E2E**: `desktop-e2e` scenarios — ACP cold start walks a pristine machine to a connected panel with zero terminal (T0c/T0d/T0f), design commands available with pristine `~/.claude` (T0e), first-run lands on a canvas (T5), watch-intro affordance (T2), quick-setup deck runs (T7). Add `data-testid`s in the same change.
8. **Design-system guard + critics**: for the explainer canvas + any new studio-client UI, run `design-system-keeper` + the critic panel (motion-critic fires on the video-comp).
9. **A11y**: `a11y-auditor` over the new onboarding surfaces (checklist, brand-upload panel, intro modal — focus, labels, reduced-motion on the video).
10. **Manual**: import a real third-party `tokens.json` + a real brand PDF end-to-end on an Intel Mac via the CLI path (the designer's actual environment) — confirms the no-native-app path works.

---

## Scenario Coverage (UI tasks — required)

Primary platform per config: `web-desktop` (studio) + the native shell (desktop-e2e). Mobile/tablet N/A for the studio.

**New scenarios to create:**
- `acp-cold-start` — pristine machine (no `claude`, logged out, pristine `~/.claude`) → open chat → "Set up AI editing" installs `claude` → "Sign in to Claude" browser login → panel connects live (no restart) → `/design:*` available, no marketplace add. (native, desktop-e2e — stub the installer + login-completion behind an e2e Cargo feature per memory `feedback_prefer_dom_driven_e2e_not_computer_use`)
- `onboarding-first-run` — first launch → wizard → watch intro → land on a seeded canvas. (native, desktop-e2e)
- `quick-setup-journey` — empty project → guided "Quick setup" tour → design system created (coach-marked) → first AI edit. (native, desktop-e2e)
- `bring-my-brand` — upload a brand PDF + tokens file → design system produced → design with it. (web-desktop/agent-browser against `maude design serve`)

**Existing infra reused:** `apps/studio/test/tour-overlay.test.tsx`, `whats-new.test.ts`, `desktop-e2e` harness (testids: `canvas-list`, `canvas-row-<slug>`, `canvas-frame`).

---

## Acceptance Criteria

- [ ] All phase tasks completed (P0–P4; P4 shipped labeled experimental)
- [ ] **Zero-terminal ACP cold start (P0): a non-technical user reaches their first AI edit with no terminal and no app restart** — `claude` installed from the app, signed into their own subscription via browser, `maude` bundled, plugins auto-loaded (`acp-cold-start` desktop-e2e green)
- [ ] P0 respects the ToS line: the user's OWN `claude` + OWN Anthropic login only; Maude never embeds the SDK with its own token and never takes custody of Claude credentials (DDR-123; memory `reference_claude_subscription_via_users_cli_not_sdk`)
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
- [ ] DDRs recorded: **zero-terminal ACP cold-start posture** (P0), onboarding/video wiring, **ingestion security posture**, token-mapping contract, vision-reconstruction posture (claim next-free numbers — plan header's DDR-152.. is stale; next-free ≈ **166**; re-check for races before the closing commit — memory `project_ddr_numbering_races_on_shared_main`)
- [ ] Runtime-state taxonomy + canvas-origin allowlists updated if any new `_*` path or route was added (DDR-115/088)
- [ ] Out-of-scope boundary held: no changes to `build-desktop.yml` / arch detection (that's `feature-desktop-intel-mac-support.md`)
- [ ] No regressions; code follows project conventions
```

---

## Risks & notes

- **P0 must not cross the Claude ToS line.** The whole point of the ACP panel is that it drives the user's OWN `claude` on their OWN Pro/Max subscription (DDR-123). Automating install + login must NOT become "Maude signs you in with our OAuth app" or "Maude embeds the Agent SDK with a token" — both are the exact trap memory `reference_claude_subscription_via_users_cli_not_sdk` flags. We install the real binary and *launch* Claude's own login; the credential lands in the user's `~/.claude`, never in Maude's custody.
- **Login-state detection is subtle.** `probe.ts` today reports presence, not auth. Detecting "logged in" without spawning a full session (and without parsing private `~/.claude` credential formats that may change) needs a robust, forward-compatible signal — treat a wrong "available" as worse than a conservative "sign in", and hot-reconnect on real completion so the panel never demands a restart.
- **App-driven installer = a real security surface.** Spawning an installer and a browser-login from a GUI app is exactly what `ethical-hacker` should adversarially probe (PATH/`build.rs` command wiring, no privilege escalation, no arbitrary-binary execution). Do T0a (DDR + threat model) before P0 code, same discipline as T9 for ingestion.
- **P0 is Mac-first like the rest of the desktop shell** — Windows/Linux install-`claude` paths differ; scope P0 to the shipping desktop targets and note the others as follow-up rather than half-doing them.
- **Security is the load-bearing risk.** SVG and PDF are rejected today *for a reason* (XSS/script, parser CVEs, SSRF via embedded refs). P3 must sanitize SVG and rasterize PDF, go through `_fetch-asset.mjs`-grade containment, and pass the security fan-out. Do T9 (the DDR + threat model) before any P3 code.
- **Vision reconstruction (P4) is non-deterministic** — ship it labeled experimental, gated by the reality-check loop; never present it as lossless.
- **Native no-terminal posture** (DDR-126/128) means the quick-setup tour can't execute `/design:setup-ds` from inside the app — it coach-marks + links. Keep the terminal `/design:*` path as the power route.
- **Bundle discipline**: any studio-client change needs the committed `dist/client.bundle.js` rebuilt `--release` before commit (whats-new/CLAUDE.md rule) — easy to forget.
- **DDR numbering races on shared `main`** — re-check the decisions dir + uncommitted README index before the closing commit.
