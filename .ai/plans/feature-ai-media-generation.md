# Feature: AI Media Generation (bring-your-own-key) — photo · video · audio

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is a **multi-phase epic** — execute one phase at a time, each phase is independently shippable and gated.

## Description

Let a Maude user bring their own API keys (Google/Nano Banana for image+video, ElevenLabs for audio) — and optionally run local models — to **generate and edit media inside Maude**: images, video clips, music, sound effects, voiceover, and speech-to-text for automatic subtitles. A proper **Settings page** manages keys, providers, and local engines from the UI. Generation is reachable three ways:

1. **On-demand / prompt-driven** — `/design:new "generate an AI carousel about X"`, `/design:edit "generate a hero image via AI"`, or a UI generate action.
2. **Proactive / AI-initiated** — while editing a reel/canvas, the design agent can *notice a gap* and propose generation ("you have no clip for this beat — generate one?"; "this social post could use a hero — want me to make it?"), surfaced as one confirmable decision.
3. **Composed into existing spines** — a generated clip drops straight into the footage EDL / video-comp; a generated image becomes a photo-editable asset; generated audio becomes an EDL audio track with auto-captions.

Claude Code itself cannot generate pixels/audio, so this is entirely external-provider (+ optional local-model) work bolted onto Maude's existing content-addressed asset + design-plugin spine.

## User Story

As a **Maude creator** I want to **generate and edit photos, video, music, voice, and captions from my own AI provider keys — with the design agent proactively offering to fill gaps** so that **I can produce a complete social/marketing/video deliverable without leaving Maude or hand-sourcing every asset.**

## Problem

Maude can *arrange, edit, and export* media (photo-editor DDR-161, footage→director→reel DDR-163, video-comp DDR-148, content-addressed `assets/` + `/_api/asset` DDR-088) but has **zero ability to create net-new media**. There is no provider abstraction, no key storage, no Settings UI, and no seam for the agent to propose or execute generation. Users must source every clip/image/track externally and drag it in.

## Solution

A **provider-adapter spine** in the dev-server (`apps/studio/generation/`) that normalizes every provider — direct-BYOK provider or local runtime — to one `submit → Job → assets[]` contract, with the produced bytes localized into the existing `assets/<sha8>` store. Keys live in the OS keychain (native) or a `0600` per-user file (browser), are injected **server-side** at request time, and **never cross to the untrusted canvas iframe** (DDR-054). A privileged async route (`/_api/generate-jobs`, modeled on the export-job queue) drives generation; a Settings panel manages keys + engines; a `maude design generate` CLI verb lets slash commands invoke it; and a footage-director-style **media-generation director** agent + a `WANTS_GENERATE` command seam wire up the prompt-driven and proactive paths.

> **Owner product principles (2026-07-11) — load-bearing, apply to every phase:**
> 1. **BYOK, direct providers only — no aggregator.** Google (image/video) + ElevenLabs (audio). The user brings their own key per provider; we don't build a breadth-broker (fal) for them. fal/OpenRouter/Vercel-AI-Gateway stay out; the adapter interface remains open so one could drop in later.
> 2. **Generation is never a dead-end modal.** A finished asset **lands on the canvas / in the spine automatically** (image → placed on the active artboard; clip → EDL beat; audio → EDL track). The modal is at most a prompt bar; manual "insert" is a secondary affordance, not the path.
> 3. **Generation is agent-drivable, not just UI.** Every modality is reachable from **`maude design generate` (CLI), `/design:generate` + `WANTS_GENERATE` in `/design:edit`/`/design:new` (slash), the `ai-generation` skill, AND the ACP chat panel** (which drives the user's own `claude`). The key is always resolved server-side, so the agent triggers generation but never holds the key.

**Approach decisions taken (rationale in Design Decisions → Architecture):**

- **Direct-BYOK only — NO aggregator (decided 2026-07-11, owner).** Direct adapters for the flagship providers the user named: Google **Nano Banana** for image (+ Veo for video), **ElevenLabs** for the whole audio stack — truest BYOK, cheapest (no aggregator markup), the user's own key → the provider directly. **fal.ai is dropped** — the owner's call is "don't build the aggregator abstraction for the user; keep it simple, they bring their own direct-provider key." Google + ElevenLabs cover image/video/audio/STT for v1. The adapter interface stays aggregator-ready (`fal-queue` shape documented) so fal/Replicate can drop in later as an optional adapter if breadth is ever wanted — but it is **not built** now. Consequence: the model breadth fal would have added (FLUX/Recraft/Ideogram/Seedream, Kling/Seedance/Hailuo) is **out of scope**; image = Nano Banana, video = Veo, audio = ElevenLabs.
- **Poll/SSE, never webhooks.** A laptop has no public URL. Veo (`operation.done` poll), ComfyUI (WS + poll) support this. Webhook branch stays unused. (fal's SSE `/status/stream` is moot now that fal is dropped.)
- **Local generation is post-v1; local *background-removal* and local *transcription* ship early** — bg-removal already exists client-side (@imgly, DDR-161) and local whisper.cpp gives free, no-key, word-timestamped subtitles. Full local *image/video generation* (ComfyUI/Draw Things, 7–23 GB downloads, GPU-gated, 2–4× slower on Mac) is a later "power-user/offline" engine behind the same adapter.
- **Phased, image-first backbone.** Phase 0 stands up the whole spine (adapter, keys, route, Settings shell, CLI verb) and proves it end-to-end with the *simplest* modality — **image via Nano Banana** (synchronous, single REST call, base64 out, drops into the existing asset + photo-editor spine with almost no new surface). Audio (highest user-stated value) and video (async, heaviest UX) follow on the proven spine. **This ordering is a de-risking choice, not a value judgment — it is swappable** (see Open Questions).

## Metadata

- **Type**: New Capability (epic)
- **Complexity**: High
- **App/Package**: `apps/studio` (spine, routes, Settings client), `apps/desktop` (keychain), `cli/` (`maude design generate` + deps), `plugins/design` (commands/agents/skills for prompt-driven + proactive paths)
- **Affected Systems**: dev-server HTTP + trust boundary (DDR-054/088), asset pipeline (DDR-088), config schema, keychain bridge (DDR-123-adjacent), footage EDL (DDR-163), video-comp (DDR-148), photo-editor (DDR-161), design-plugin commands/agents
- **Dependencies (new)**: `ollama` (soft, post-v1 local), `whisper.cpp`/`whisper-cli` (soft, for local subtitles), provider HTTP clients (no SDK required — plain `fetch` in the sidecar). ~~`fal` client~~ — dropped (no aggregator).
- **DDR**: ✅ **DDR-164 written + accepted 2026-07-11** — "BYOK AI media generation — provider-adapter spine, key custody, trust boundary" (`.ai/decisions/DDR-164-byok-ai-media-generation-provider-adapter-spine.md`).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message — independent context loads.

**Trust boundary + routes (load-bearing):**
- `apps/studio/http.ts:604` (`createHttp` signature), `:772` (route table), `:2616` (`CANVAS_SAFE_API`), `:2627` (`isCanvasSafeRoute`), `:178` (`sameOriginWrite`), `:110`/`:158` (canvas/capture CSP) — Why: a new `/_api/generate*` route must be **privileged** (in none of the three canvas allowlists) + `sameOriginWrite`+`isLoopbackHost` gated.
- `apps/studio/server.ts:141` (`Bun.serve` routes), `:228`–`:257` (`startCanvasServer` second allowlist), `:301` (403 fallthrough) — Why: the second allowlist that must NOT list the generate route.

**Key custody (the exact template):**
- `apps/desktop/src-tauri/src/keychain.rs` (whole file) — GitHub-token pattern: `set/get/delete_token`, per-launch loopback token bridge (`start_token_bridge`, random key, constant-time compare, single GET path). Why: BYOK keys mirror this, one keychain service per provider (`com.maude.app.<provider>`).
- `apps/desktop/src-tauri/src/sidecar.rs:138`–`:145` (env handoff `MAUDE_TOKEN_ENDPOINT`/`_KEY` to the sidecar) — Why: the generation key bridge extends this handoff.
- `apps/studio/github/token.ts:22` (`getGithubToken` — fetch-at-request-time, never cache, never log, null in non-Tauri) — Why: exact template for `apps/studio/generation/keys.ts`.
- `apps/studio/sync/hubs-config.ts:24`–`:60` + `cli/lib/hubs-config.mjs:25` (`~/.config/maude/hubs.json`, mode `0600`, XDG, world-readable warning) — Why: the browser/non-Tauri fallback key store.
- `apps/studio/acp/env.ts:34`–`:38` (`scrubAgentEnv` / `PROVIDER_REDIRECT_RE`) — Why: BYOK env vars must NOT leak into the ACP `claude` subprocess (DDR-123); generation keys must not be set as inheritable env.

**Asset spine (where generated bytes land):**
- `apps/studio/http.ts:2162` (`/_api/asset`), `apps/studio/api.ts:1389` (`saveAssetFromStream`), `:673` (`sniffAssetType` — image/video/audio magic-byte), `:1530` (`listAssets` — note: does NOT list audio, extend if the picker needs it) — Why: reuse the streaming, content-addressed, capped write path for generated bytes.
- `apps/studio/bin/_fetch-asset.mjs:405` (`fetchAsset` — https-only, DNS-pinned SSRF gate, magic-byte, content-addressed, realpath-contained; currently **rejects non-image** — must extend to accept generated video/audio URLs) + `apps/studio/bin/fetch-asset.sh` — Why: the egress-hardening template every provider download must copy; the **Veo** "output is an expiring URL" path (Phase 3) localizes through this.

**Modality-attach seams:**
- Photo-editor: `apps/studio/photo/schema.ts:143` (`PhotoEdit`, `source`), `apps/studio/http.ts:983` (`/_api/photo-edit`), `plugins/design/commands/photo.md` — Why: a generated image is a valid `PhotoEdit.source`; image-gen composes with the parametric editor.
- Footage/EDL: `apps/studio/footage/schema.ts:205` (`Edl`), `:175` (`EdlBeat.clip`), `:193` (`EdlMusic` — the ONLY audio today, a single bed; must extend to an audio-track list), `apps/studio/http.ts:1020` (`/_api/footage`, main-origin-only) — Why: a generated clip is a new `EdlBeat.clip`; generated audio/captions extend the EDL.
- Video-comp: `plugins/design/skills/video-comp/SKILL.md:118`–`:154` (`<Audio>`/`<OffthreadVideo src="assets/…">`, assets-only), `apps/studio/exporters/video.ts:151` (audio only survives the `renderMediaOnWeb` path; frame-step fallback is silent) — Why: generated media references + the audio-in-export gap the audio phase must close.
- Async job UX to clone: `apps/studio/exporters/jobs.ts`, `apps/studio/http.ts:2256` (`/_api/export-jobs`), `apps/studio/client/export-center.jsx` (menubar badge/toast/panel + `export:job` WS push) — Why: generation is slow (seconds–minutes) → model it on the export job-queue + notification-center, not a blocking request.

**Command / agent / skill seams (prompt-driven + proactive):**
- `plugins/design/commands/edit.md:401`–`:437` (step 4.6 `WANTS_DRAW` → `draw-agent`, `output_mode:"inline"`, jump to step 7) — Why: **exact structural template** for a sibling `WANTS_GENERATE` branch.
- `plugins/design/commands/new.md:102` (video-comp brief cue → load skill), `:541`–`:553` (brand-assets block), `:934`–`:948` (step 9.6 custom-art → `draw-agent`) — Why: where a generation pre-pass inserts.
- `plugins/design/agents/footage-director.md` + `footage-analyst.md` + `ux-research-agent.md` — Why: the read-only "analysis → decision artifact, never edits the canvas" contract to copy for a `media-generation-director` agent.
- `plugins/flow/skills/debate-protocol/SKILL.md:57`,`:83` ("one AskUserQuestion, rendered by the command, never by a seat") — Why: the proactive proposal is surfaced by the command, never by the agent's own turn.
- `plugins/design/agents/signature-moment-critic.md:276`–`:325` (`top_blockers[]` + `fix:` intentions, "what you don't do") — Why: the shape of a proactive *gap finding* a critic/analyst emits.

**CLI + config + deps:**
- `cli/commands/design.mjs:28` (`BIN_VERBS`), `:104` (`runBinDispatch`), `:51` (`photo-adjust`/`photo-bg-remove` — closest "verb hits a dev-server media route" precedent) — Why: add a `generate` verb.
- `apps/studio/config.schema.json` (`additionalProperties:false`, keys listed) + `apps/studio/context.ts:162` (`loadConfig`), `:308` (`reloadConfig` — add generation prefs to the hot-reloadable set) — Why: schema must be extended before a `generation` block validates; live-reload so Settings saves take effect without a restart.
- `plugins/design/dependencies.json` (+ `.schema.json`) — Why: declare `ollama`/`whisper.cpp` as **soft** deps with `check` + per-OS `install` + `fallbackBehavior`.

**Settings UI precedents:**
- `apps/studio/client/app.jsx:2846` (`Menubar`), `:2478` (`DropdownMenu`), `:1009` (`ExportDialog` — clone this modal shape: top-level `useState(null)` + conditional mount + `onClose`), `:~10265` (command-palette registry entry) — Why: add a "Settings…" entry + `<SettingsPanel>`.
- `apps/studio/client/panels/OnboardingWizard.jsx` (multi-step form layout), `IdentityBar.jsx` (credential-state UI) — Why: closest layout + credential-state precedents.
- `apps/desktop/src-tauri/src/menu.rs` (native ⌘, menu item), `apps/desktop/src-tauri/src/prefs.rs` (`prefs.json` non-secret toggles) — Why: native Settings entry + non-secret provider toggles.

### Files to Create

- `apps/studio/generation/types.ts` — `ProviderDescriptor`, `ModelDescriptor`, `ProviderAdapter`, `Job`, `GenRequest`, `GenResult`, `Modality` (dependency-free, imported by server + client).
- `apps/studio/generation/registry.ts` — provider/model registry + capability lookup; `listModels()` refresh.
- `apps/studio/generation/keys.ts` — request-time key resolution (keychain bridge → `~/.config/maude` fallback), never cached/logged.
- `apps/studio/generation/adapters/gemini.ts` — Nano Banana image (+ Veo video in the video phase): sync `:generateContent`, base64 out.
- `apps/studio/generation/adapters/elevenlabs.ts` — Music / SFX / TTS / Scribe STT.
- ~~`apps/studio/generation/adapters/fal.ts`~~ — **DROPPED** (owner decision 2026-07-11, no aggregator). The `fal-queue` shape stays documented in `types.ts` so it can be added later, but no adapter is built.
- `apps/studio/generation/adapters/openai-compatible.ts` — local Ollama/LM Studio/whisper-server only (post-v1 local). (OpenAI image/TTS de-scoped with the aggregator decision — direct providers are Google + ElevenLabs.)
- `apps/studio/generation/jobs.ts` — generation job queue (mirror `exporters/jobs.ts`: counting semaphore, in-memory Map, cost/usage capture).
- `apps/studio/generation/download.ts` — localize a URL/base64/file result into `assets/<sha8>` via the hardened egress path (reuse/extend `_fetch-asset.mjs` discipline).
- `apps/studio/generation/captions.ts` — word-timestamp JSON → SRT/VTT + re-flow (shared by every STT provider).
- `apps/studio/bin/generate.sh` + `apps/studio/bin/_generate.mjs` — CLI helper behind `maude design generate` (curl-to-`/_api/generate-jobs`, mirrors `photo-adjust.sh`).
- `apps/studio/bin/transcribe.sh` + `apps/studio/bin/_transcribe.mjs` — local whisper.cpp subtitle helper (spawns the binary, emits SRT/VTT; mirrors `ingest-footage`/`probe-footage` shims, no server).
- `apps/studio/client/panels/SettingsPanel.jsx` + `apps/studio/client/generate-dialog.jsx` — Settings (keys + engines) + the generate action UI; `generation-center` notification reuse of `export-center.jsx`.
- `apps/desktop/src-tauri/src/generation_keys.rs` — keychain set/get/delete per provider + bridge extension (+ the 3-edit Tauri-command wiring: `generate_handler`, capabilities allow-list, `build.rs` `commands()`).
- `plugins/design/agents/media-generation-director.md` — read-only gap→generation-plan agent (footage-director contract).
- `plugins/design/skills/ai-generation/SKILL.md` — the AI-media generation vocabulary (provider capability map, prompt conventions, licensing caveats, asset-localization rule) + auto-load triggers.
- `plugins/design/commands/generate.md` — `/design:generate` explicit entry point (+ the `WANTS_GENERATE` seam added to `edit.md`/`new.md`). Reachable the same way from the **ACP chat panel** (the panel drives the user's own `claude`, which has the design plugin loaded) — see the ACP validation task.
- `.ai/decisions/DDR-164-byok-ai-media-generation-provider-adapter-spine.md` — the decision record (**written; Phase 0 accepted 2026-07-11**).

### Design canvases

> No existing `.design/` canvas matched "ai / generation / settings / provider" by tag or slug. The only net-new *visual* surface is the **Settings panel** (keys + engine cards) and the **generate dialog** — both are studio-client chrome, not `.design/` canvases. Design them against the studio client's existing panel/dialog idiom (`OnboardingWizard.jsx`, `ExportDialog`, `export-center.jsx`), not a moodboard. (Recent `.design/` activity — alligators reel cuts, photo-editor smoke — is unrelated.)

### Documentation

- Provider async/output/pricing specifics are captured in the research appendix at the bottom of this plan (image / video / audio / architecture), each with source links — Why: the model ids, output shapes (URL vs base64), and pricing re-price ~monthly; re-verify the official page before hardcoding any number or model id.

### Patterns to Follow

- **Privileged route** (guards): every write route in `http.ts` (e.g. `/_api/ai/start` `:1120`) applies `sameOriginWrite(req)` + `isLoopbackHost(req.headers.get('host'))` → 403. Copy verbatim.
- **Egress hardening**: `_fetch-asset.mjs` (https-only, resolved-IP SSRF gate + DNS pin, fixed non-interpolated argv, magic-byte sniff, realpath containment). Every provider download and every provider POST must be this disciplined. **Never hand-author curl.**
- **Canonical async handle**: fal's queue shape generalized — `submit → Job`; **sync providers (Gemini image, ElevenLabs TTS) return an already-`done` Job** so callers never branch on sync/async.
- **Runtime-state taxonomy (DDR-115)**: any per-machine generation scratch/cache (e.g. in-flight job state, request logs) uses the `_underscore/` convention and is added to ALL THREE lists (`git/service.ts` `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, root `.gitignore`). Final generated assets go in `assets/` (VERSIONED/committed).
- **Tauri command 3-edit rule** (memory `reference_tauri_command_needs_build_rs`): `generate_handler` + capabilities allow-list + `build.rs` `commands()`; verify with a real desktop build, `cargo check` won't catch a missing `build.rs`.

---

## Design Decisions

### Architecture — the provider-adapter spine

Normalize every provider to one contract (full sketch in the architecture research appendix):

```ts
type Modality = 'image' | 'video' | 'audio' | 'transcription';
interface ProviderAdapter {
  descriptor: ProviderDescriptor;        // id, label, kind: 'cloud'|'local', auth, keychainService?, modalities
  listModels?(): Promise<ModelDescriptor[]>;
  submit(req: GenRequest): Promise<Job>; // returns immediately, even for sync
}
interface Job { id; status(); events(): AsyncIterable<JobEvent>; result(): Promise<GenResult>; cancel(); }
interface GenResult { assets: { kind; url?; bytes?; mime }[]; usage?: { cost?; ms? }; raw }
```

Three adapter *shapes* cover ~80%: `fal-queue` (fal, +Replicate/Eachlabs variants), `direct` (Gemini, ElevenLabs — each small, sync-ish), `openai-compatible` (OpenAI + local Ollama/LM-Studio/whisper-server), plus `comfyui-local` (post-v1). Auth is **declarative** (`auth` + `keychainService` on the descriptor); the host injects the credential at call time so key custody stays in one place. Output normalizes to `assets[]` and always **downloads to a local `assets/<sha8>`** (CSP + expiring-URL safety).

### Provider selection (v1)

> **fal / aggregator column dropped (owner decision 2026-07-11).** Direct BYOK only. The "Aggregator (breadth)" column below is struck — kept greyed for the record so a future re-scope knows exactly what breadth was deferred.

| Modality | Direct BYOK (flagship — BUILT) | ~~Aggregator (breadth — DROPPED)~~ | Local |
| --- | --- | --- | --- |
| **Image** | **Google Nano Banana** `gemini-2.5-flash-image` (+ Pro `gemini-3-pro-image`) — sync, base64, gen+maskless-edit+text+4K | ~~fal → FLUX/Recraft/Ideogram/Seedream~~ | bg-removal already exists (@imgly, DDR-161); rembg/BiRefNet-ONNX optional |
| **Audio** | **ElevenLabs** — Music + SFX + TTS v3 (+ cloning) + Scribe STT (one key covers the stack) | ~~fal (audio breadth)~~ | — |
| **Subtitles/STT** | ElevenLabs Scribe (accuracy) / Groq Whisper (managed, $0.04/hr) — optional cloud fallback | — | **whisper.cpp `large-v3-turbo` — the default, no key**, SRT/VTT + word timestamps, ~10× RT on Apple Silicon |
| **Video** | **Google Veo 3.1** (Gemini API, native synced audio + i2v) | ~~fal → Kling / Seedance / Hailuo~~ | none v1 (24GB+ GPU, minutes/clip) |

Explicitly **avoid OpenAI Sora 2** (API sunsets 2026-09-24). **Avoid building on Suno/Udio** (no official API — grey-market wrappers only). Surface **licensing caveats** in the UI (music commercial-rights tiers, voice-cloning consent, MusicGen non-commercial weights).

### Trust & security posture (load-bearing)

- Keys: OS keychain per provider (native) / `~/.config/maude/keys.json` `0600` outside the served tree (browser). Read at request time, never cached, never logged, redacted from any iframe-visible error.
- The generate route + key-management routes are **privileged** — absent from all three canvas allowlists; canvas reaches only the *result asset*, never the key or the raw provider call. `sameOriginWrite`+`isLoopbackHost` gated.
- Egress: every provider POST/download SSRF-hardened like `_fetch-asset.mjs`; results magic-byte-sniffed before write.
- **Prompt-injection**: the proactive director reads canvas/footage content that could contain injected instructions → treat canvas text as data, never as tool-authorizing instructions; the director only *proposes* (emits a plan artifact), the command executes after the one-AskUserQuestion, and generation never runs unattended without user consent.
- Env: generation keys must not be inheritable env for the ACP `claude` subprocess (DDR-123 scrub).

### Icons / tokens (Settings UI)

Use the studio client's existing Lucide-line icon set + theme tokens (no hardcoded colors). Engine cards carry a cost badge (`Free · your hardware` vs `~$0.04/image`), a local/cloud pill, and (local) a VRAM + download-size line. Match `OnboardingWizard.jsx` density.

---

## Tasks

Execute in phase order. Each phase is independently shippable; `/flow:done` at each phase boundary.

### Phase 0 — Spine + key custody + Settings shell + image proof

**Goal:** the whole architecture end-to-end, proven with the simplest modality (Nano Banana image). After this phase a user can paste a Google key in Settings and generate an image into `assets/`.

#### Task 0.1: CREATE the adapter contract
- **Do**: `apps/studio/generation/types.ts` — the interfaces above. Dependency-free. Unit-test the type-level invariants via a fake adapter.
- **Pattern**: `apps/studio/photo/schema.ts` (dependency-free, hand-rolled validators) + `footage/schema.ts`.
- **Validate**: `bun test apps/studio/generation/`

#### Task 0.2: CREATE key custody (browser tier first)
- **Do**: `apps/studio/generation/keys.ts` — resolve a provider key at request time from `~/.config/maude/keys.json` (`0600`, XDG, world-readable warning). Never cache/log.
- **Pattern**: `apps/studio/sync/hubs-config.ts` + `github/token.ts`.
- **Gotcha**: file must live OUTSIDE the served `.design/` tree so canvas file-routes can't read it.
- **Validate**: `bun test` (0600 assert, missing-key returns null).

#### Task 0.3: CREATE the Gemini image adapter + registry
- **Do**: `adapters/gemini.ts` (`gemini-2.5-flash-image` + `gemini-3-pro-image`; base64 out; returns an already-`done` Job) + `registry.ts`. `download.ts` localizes base64 → `assets/<sha8>.png` via `saveAsset`.
- **Pattern**: `api.ts:1389` `saveAssetFromStream`; `_fetch-asset.mjs` discipline for the outbound POST.
- **Validate**: stub the Gemini HTTP response, assert an asset lands + sidecar-free image renders.

#### Task 0.4: CREATE the privileged generate route + job queue
- **Do**: `generation/jobs.ts` (clone `exporters/jobs.ts`) + `POST /_api/generate-jobs` (202+jobId, non-blocking) + `GET /_api/generate-jobs` (list) in `http.ts`. `sameOriginWrite`+`isLoopbackHost` gated. **Absent from CANVAS_SAFE_API + startCanvasServer routes.**
- **Pattern**: `http.ts:2256` `/_api/export-jobs`; guard `:1120`.
- **Gotcha**: add a `test/canvas-origin-gate.test.ts` case asserting the route 403s from the canvas origin.
- **Validate**: `bun test` gate + queue tests.

#### Task 0.5: EXTEND the config schema
- **Do**: add a `generation` block to `config.schema.json` (non-secret only: `defaultImageProvider`, model prefs, `preferLocalWhenAvailable`, per-provider `enabled`, custom local host:port). Add to the hot-reloadable set in `context.ts:308`.
- **Gotcha**: `additionalProperties:false` — schema MUST be extended before the block validates; `$schema` points at the published raw file.
- **Validate**: `maude doctor` config-lint clean; live-reload takes effect without restart.

#### Task 0.6: CREATE the Settings panel (keys + provider status)
- **Do**: `client/panels/SettingsPanel.jsx` (masked key entry, "test connection", provider enable toggles, cost/licensing notes) + "Settings…" menubar item + command-palette entry (⌘,) + top-level conditional mount. Keys POST to a privileged `/_api/generate/keys` (write-only from main origin; never echoes a key back — returns `{configured:true}` like `github_is_signed_in`).
- **Pattern**: `ExportDialog` (`app.jsx:1009`) modal shape; `IdentityBar.jsx` credential-state; export-center badge for status.
- **Validate**: agent-browser: paste a (fake) key → "configured"; no key value ever returned by GET.

#### Task 0.7: CREATE the `maude design generate` CLI verb + generate dialog
- **Do**: `bin/generate.sh` + `_generate.mjs` (curl → `/_api/generate-jobs`, poll, print `/assets/<sha8>.<ext>`) + `BIN_VERBS` entry. `client/generate-dialog.jsx` (prompt + model + aspect → enqueue → notification-center via reused `export-center` pattern).
- **Pattern**: `bin/photo-adjust.sh`; `cli/lib/plugin-cli-reachability.test.mjs` (no raw bin paths in plugin md).
- **Validate**: `maude design generate "a red circle" --provider gemini --root <repo>` → asset on disk; reachability test green.

#### Task 0.8: Phase-0 gate + DDR
- **Do**: DDR-16x (spine, custody, trust boundary). Security fan-out (defender + ethical-hacker) on the new egress + secret + route surface. What's New pending entry. Live-verify image gen end-to-end split-origin.
- **Validate**: full studio suite + CLI reachability + `canvas-origin-gate` + security review 0 blockers ≥ medium.

### Phase 1 — Image: auto-insert + editing + agent/command/ACP seam (fal DROPPED)

> **Re-scoped 2026-07-11 (owner).** fal is out (Task 1.1 deleted). The through-line of this phase is the owner's two hard requirements: **(a) generation is not a dead-end modal — a finished image lands ON the canvas automatically**, and **(b) generation is agent-drivable — from `/design:generate`, from a prompt in `/design:edit`/`/design:new`, AND from the ACP chat panel**, not only the UI. Image breadth stays Nano Banana only.

#### ~~Task 1.1: ADD the fal-queue adapter~~ — **DROPPED (no aggregator).** The `fal-queue` shape stays documented in `types.ts`; no adapter is built. The expiring-URL localizer it needed is deferred to Phase 3 (Veo returns a URL) — that is where the SSRF-hardened URL egress in `download.ts` (gated off in Phase 0) is first wired.

#### Task 1.1 (new): AUTO-INSERT a generated image onto the active canvas (default UX)
- **Do**: make "generate → land on the canvas" the default, not a manual modal step. On job `done`, splice an `<img src="assets/<sha8>.png">` into the **active artboard** of the active canvas via the existing main-origin source-write path (mirror `/_api/insert-element` / the AssetPicker drop flow), positioned sensibly (artboard-centered or at the last click). The `generate-dialog.jsx` built in Phase 0 collapses to a lightweight **prompt bar** whose primary action is "Generate → insert" (the manual "Copy path"/"Insert" buttons stay only as a secondary affordance for "generate without placing").
- **Pattern**: the AssetPicker → canvas insert flow (`onAssetPicked` in `app.jsx`); `/_api/insert-element` (main-origin source-write, DDR-054); the `WANTS_DRAW` inline-output convention (`output_mode:"inline"`).
- **Gotcha**: the insert is a **source-write** — main-origin only; the canvas iframe never writes. Content-addressed `assets/<sha8>` ref only (no data: URL). Respect the active-canvas + selected-artboard signals (`_active.json`) so it lands where the user is looking.
- **Validate**: open a canvas → Generate "a red circle" → the image appears **on the artboard** with no manual insert step; the `.tsx` source gains a content-addressed `<img>`; live-verify in split-origin.

#### Task 1.2: WIRE image-editing to the photo-editor
- **Do**: a generated image is a valid `PhotoEdit.source`; maskless-edit prompts (Nano Banana — `sourceAsset` read into an `inlineData` part alongside the text) are exposed as a generate op that writes a **new** asset the photo-editor can then adjust. Extend `listAssets` to surface generated images in the AssetPicker. (Inpaint via FLUX Fill/Recraft is **out** — that was fal; Nano Banana maskless-edit is the v1 edit path.)
- **Pattern**: `photo/schema.ts:143`; `/_api/photo-edit`; the Phase-0 `sourceAsset` field already validated in `types.ts`.
- **Validate**: generate → the image is on the canvas (Task 1.1) → open in Photo tab → adjust → sidecar persists; "edit this image: <prompt>" produces a new Nano-Banana-edited asset.

#### Task 1.3: ADD the `/design:generate` command + `WANTS_GENERATE` seam (agent + prompt driven)
- **Do**: `plugins/design/commands/generate.md` (`/design:generate`) + a `WANTS_GENERATE` grep branch in `edit.md` (alongside step 4.6) and a generation pre-pass in `new.md` (alongside 5a/9.6) routing to `maude design generate` and **splicing the `/assets/<sha8>` ref in** (same auto-insert as Task 1.1). `plugins/design/skills/ai-generation/SKILL.md` (auto-load triggers + capability map + prompt conventions + licensing caveats + assets-only rule). This is the layer that lets **an AI agent generate via the CLI** (`maude design generate` already ships from Phase 0).
- **Pattern**: `edit.md:401`–`:437` `WANTS_DRAW`→`draw-agent` (`output_mode:"inline"`, jump to render).
- **Validate**: `/design:edit "generate a hero image of X via AI"` produces + inserts an asset; `/design:new "generate an AI carousel about X"` scaffolds with generated imagery.

#### Task 1.4: WIRE generation into the ACP chat panel (agent-in-app path)
- **Do**: make "generate an image of X" work **from the native ACP chat panel**. The panel already drives the user's own `claude` CLI with the design plugin loaded, so once Task 1.3 lands the transitive path exists — this task makes it **explicit and tested**: confirm the ACP `claude` can reach the running dev server's generate route (the key is resolved **server-side** from the 0600 file, so the DDR-123 env-scrub does NOT block it — the agent triggers, it never holds the key), the `ai-generation` skill auto-loads in that session, and the produced asset lands on the canvas via the same auto-insert. Document the flow in the `ai-generation` skill so the ACP agent knows to prefer `/design:generate` / `maude design generate` over hand-rolling.
- **Pattern**: DDR-123 ACP sidepanel; `acp/env.ts` scrub (assert generation keeps working *because* the key is server-side, not in the agent env); the Phase-0 `maude design generate` verb.
- **Gotcha**: the ACP agent must NOT be handed a key — it calls the verb/command, the sidecar resolves the key. Prompt-injection posture: an ACP turn that generates is still user-initiated (the user typed the request); the unattended-proposal path is Phase 4, gated separately.
- **Validate**: in the native app, type "generate a hero image of a mountain lake" in the ACP chat → an image is generated and inserted onto the active canvas, end-to-end, without the user touching the modal.

#### Task 1.5: Phase-1 gate — critics (draw/graphic/brand), security, What's New, live-verify auto-insert + ACP path.

### Phase 2 — Audio: ElevenLabs stack + local-Whisper subtitles + EDL audio

#### Task 2.1: ADD the ElevenLabs adapter
- **Do**: `adapters/elevenlabs.ts` — Music (`composition_plan`), SFX (`/v1/sound-generation`), TTS (`/text-to-speech/:voice_id` + v3 `eleven_v3`, voice list, cloning), Scribe STT. Localize audio → `assets/<sha8>.mp3`.
- **Gotcha**: Music rejects prompts naming artists/songs/lyrics; surface the commercial-rights tier + cloning-consent notes in the UI.
- **Validate**: stubbed per-capability; asset lands; `listAssets` extended to include audio for the picker.

#### Task 2.2: CREATE local-Whisper subtitles (default, no key)
- **Do**: `bin/transcribe.sh` + `_transcribe.mjs` (spawn `whisper-cli`/whisper.cpp `large-v3-turbo`, `-osrt -ovtt`, word timestamps) + `generation/captions.ts` (word-JSON → SRT/VTT + re-flow, shared with Scribe/Groq). Declare `whisper.cpp` a **soft** dep in `dependencies.json` (check + per-OS install + fallback to Groq/Scribe when absent). `maude design transcribe` verb.
- **Pattern**: `bin/_probe-footage-playwright.mjs`/`ingest-footage` shim shape (no server); `photo-bg-remove.sh` (soft-dep + graceful fallback).
- **Validate**: transcribe a real `assets/*.mp4` audio track → SRT with sane word timings (read the SRT).

#### Task 2.3: EXTEND the EDL for audio tracks + captions; close the export-audio gap
- **Do**: extend `footage/schema.ts` `EdlMusic` (single bed) → an audio-**track** list (music/VO/SFX per-beat + whole-reel), add a captions/overlay track fed by `captions.ts`; render `<Audio>` + caption overlays in the video-comp codegen. Teach the frame-step exporter to mux audio (today only the `renderMediaOnWeb` path carries sound — `exporters/video.ts:151`).
- **Pattern**: `footage/schema.ts:193`; video-comp SKILL `<Audio>` conventions; reel.md codegen.
- **Validate**: a reel with generated music + VO + auto-captions exports to MP4 **with audio** on the frame-step path; captions burned/rendered in sync.

#### Task 2.4: Phase-2 gate — motion/copy critics (captions), security, What's New.

> **✅ Task 2.5 IMPLEMENTED (2026-07-11, /flow:execute, DDR-164).** Pure keyword scorer (`generation/audio-library.ts`); durable per-asset intent sidecar `assets/<sha8>.audio.json` (written by the generate route on every audio job) via `api.writeAudioIntent`; `api.searchAudioLibrary` over the sidecars; ElevenLabs History `listHistory`/`fetchHistoryAudio` on the adapter; privileged `/_api/generate/audio-search` (GET) + `/_api/generate/audio-reuse` (POST) routes (main-origin, in the canvas-origin gate); `maude design audio-search --query … [--reuse <id>]` verb; `ai-generation` skill documents reuse-first (agent-path default; interactive = choice). Tests: `audio-library.test.ts` (scorer), `elevenlabs.test.ts` (parseHistory/listHistory/fetchHistoryAudio). Not committed.

#### Task 2.5 (follow-up): Library-search-first for AUDIO — reuse before you pay
> **Owner decision (2026-07-11).** Reuse-first is **AUDIO-ONLY**. Images are cheap, mostly single-use, and already land in `assets/` where the agent can pick them up again — so **no image generation cache** (a repeat image request just generates; content-addressing already dedups identical bytes). For **music + SFX** (and re-usable voiceover), the value is real: **always run a query-search into the audio library first and prefer an existing suitable track before spending credits on a new generation.** Not built in the initial Phase-2 increment (Tasks 2.1–2.4, shipped) — this is the tracked enhancement. **DDR-worthy** (exact vs fuzzy match; reuse-first-silent vs surface-a-choice; provider-history vs local index).

- **Do**: before an **audio** `submit` (music/SFX; opt-in for VO), run a **query-search over two sources** and prefer a match over generating new:
  1. **ElevenLabs History** — `GET /v1/history` (+ `GET /v1/history/{id}/audio` to pull the bytes). The user's OWN past generations; **re-downloading spends NO credits** (already paid). Match on the stored source text/prompt + `voice_id`/settings metadata. Localize the chosen item into `assets/<sha8>.mp3` like any generated asset.
  2. **Maude-local generated audio** — the project's own `assets/*.mp3`. Needs a small **intent index** so local audio is searchable by *what it was for*, not just by bytes: extend the Phase-0 `_generate-history.json` ledger to record the request `(modality, kind, prompt, params)` per produced asset (or an `assets/<sha8>.audio.json` sidecar). Byte-content-addressing already dedups identical outputs; this adds *semantic* "do we already have a warm lo-fi loop?" lookup.
- **UX / matching**: exact/keyword match first (cheap, deterministic); fuzzy/embedding similarity is a later nicety (see the cost table in the plan discussion). **Surface it as a choice on the interactive path** — *"You already have `assets/abc.mp3` for a similar prompt — reuse (free) or generate new?"* — with a `--reuse` / `--fresh` CLI flag; default **reuse-first on the agent / proactive-director path** (Phase 4): the director MUST search the audio library before proposing a paid generation for a reel beat. A new `maude design audio-search "<query>"` verb (or a search step folded into `maude design generate --modality audio`) exposes it.
- **Pattern**: the Phase-0 job ledger (`generation/jobs.ts` `_generate-history.json`); the content-addressed `assets/` store; the ElevenLabs adapter's `assertSafeBase` + `readBytesCapped` discipline for the History fetch (same egress hardening — the History audio URL localizes through the hardened path, NOT a raw fetch).
- **Gotcha**: ElevenLabs History is **cross-project + includes non-Maude generations** (privacy + relevance) → don't auto-import blindly; match on metadata and surface provenance. History re-download is free but the LIST call may be rate-limited — cache the listing. A TTS of *exact* text is usually wanted fresh; scope reuse to music/SFX by default.
- **Validate**: generate a music track; issue a near-identical request → the search offers the existing asset and (on reuse) NO new ElevenLabs credit is spent (assert via the History re-download path / local hit, not a new `/v1/music` POST); the reel/proactive path reuses a fitting existing bed instead of regenerating.

> **✅ Task 2.6 IMPLEMENTED (2026-07-11, /flow:execute, DDR-164).** `maude design transcribe --provider whisper|elevenlabs|groq` explicit selector (no `auto`); `generation.transcription.provider` config default (schema-added, non-secret) read via `resolveProvider` (flag → config → whisper, printing which); cloud path posts to the generate route (key server-side), local stays server-free. New `groq` adapter (OpenAI-compatible verbose_json → `CaptionWord[]` → `captions.ts`, the single reflow point). Cloud STT lands `assets/<sha8>.srt` via new `api.writeCaptionSidecar` (the deferred caption-output wiring, finished in the generate route). Settings radio (Local whisper / ElevenLabs Scribe / Groq) persists via the privileged `/_api/generate/prefs` route + hot-reload. No-silent-switch UX: a chosen-but-unavailable engine errors naming its fix AND the alternative, never runs the other. Tests: `groq.test.ts`, `prefs.test.ts`, `resolveProvider` in `_transcribe.test.mjs`, gate + biome green. Not committed.

#### Task 2.6 (follow-up): USER-CHOSEN transcription engine — local whisper vs cloud Scribe/Groq
> **Owner decision (2026-07-11).** The transcription engine is an **explicit USER CHOICE, NOT an automatic fallback.** Maude must never silently pick or switch engines. The user selects: **local whisper.cpp** (free, offline, no key) OR **cloud** (ElevenLabs Scribe / Groq Whisper — accuracy/managed, needs a key). The shipped Phase-2 increment built only the local `maude design transcribe` (whisper-only; on missing whisper it just prints guidance, it does NOT auto-call the cloud). This task adds the **selectable switch** + finishes the cloud path.

- **Do**:
  - **CLI**: `maude design transcribe --provider whisper|elevenlabs|groq` — an EXPLICIT selector (no `auto` mode). Absent flag ⇒ read the user's configured default (below); if none is set, **do nothing clever — use `whisper` and say so**, never silently reach for a paid cloud engine.
  - **Config default**: `generation.transcription.provider` in `.design/config.json` (`"whisper"` default) so the user sets their preference once. Add to `config.schema.json` (non-secret).
  - **UI**: a transcription-engine selector in the Settings panel (radio: Local whisper.cpp / ElevenLabs Scribe / Groq), with the cost/key/offline note per engine (mirrors the provider cost badges).
  - **Routing**: `whisper` → the local `_transcribe.mjs` shim (server-free, key-free — already built); `elevenlabs`/`groq` → the dev-server generation route (`modality:transcription`, key resolved server-side). This requires **finishing the deferred caption-output wiring** (Task 2.3 left `localizeGenAsset` guarding transcription text): a cloud STT result must land its SRT/VTT somewhere usable — a `<sha8>.srt` sidecar next to the source and/or straight into the EDL `captions` track.
  - **No-silent-switch failure UX**: if the CHOSEN engine is unavailable (whisper.cpp/model missing, or no cloud key) → a clear error naming that engine's fix **and** the other option (“install whisper.cpp, or pick ElevenLabs in Settings”) — but never auto-run the other one.
- **Pattern**: the ElevenLabs adapter's existing `transcription` method (`adapters/elevenlabs.ts`, already emits an SRT via `captions.ts`); the generate-route job flow (Phase 0); the Settings provider-selector idiom.
- **Gotcha**: local + cloud must produce the SAME caption shape (both already funnel through `captions.ts` — keep that the single reflow point). Groq is an OpenAI-compatible Whisper endpoint (word timestamps via `response_format=verbose_json`); ElevenLabs Scribe returns its own word JSON — both normalize to `CaptionWord[]` before `captions.ts`.
- **Validate**: `--provider whisper` transcribes locally; `--provider elevenlabs` (with a key) transcribes via the cloud route and lands an SRT; with NO flag + NO config, it uses whisper and prints which engine it chose; a chosen-but-unavailable engine errors without falling through to the other.

> **✅ Task 2.7 BUILT via approach A (2026-07-11, /flow:execute, owner decision, DDR-164).** The spike proved approach B (in-process transformers.js whisper) *works*, but building B hit a hard blocker: `@huggingface/transformers` hard-deps `sharp` + `onnxruntime-node` — the native class **DDR-070 excludes** (a clean `npm add` is impossible; B needs vendoring + a CDN allowlist, DDR-worthy). Owner chose **A**: keep the fast native whisper.cpp the owner already validated, remove the friction instead. Shipped: (1) managed model download — `generation/whisper-models.ts` + `/_api/generate/whisper-model` route + a Settings "Local subtitle models" card (frozen ggml registry, SSRF-hardened streamed download into `~/.cache/maude/whisper-models/`, progress-polled, DELETE to reclaim) with `--provider whisper` **auto-resolving** a downloaded model (no `--model`); (2) **auto-ffmpeg** transcode of non-WAV inputs to 16 kHz mono WAV (kills GOTCHA C) when ffmpeg is present; (3) an English-only-model + non-`en`-lang warning. `generation.transcription.whisperModel` config field. No new runtime dep. Tests: `whisper-models.test.ts` (registry/resolve/download-stub/cap) + gate. Spike record: `apps/studio/generation/whisper-spike-results.md`.

#### Task 2.7 (follow-up): One-click LOCAL-subtitle setup — zero-install WASM whisper + "Download & enable"
> **Owner decision (2026-07-11) — approach B (zero-install WASM/JS whisper), IF the feasibility spike passes.** Local subtitles must be **one-click**: a button in Settings that downloads the model and it just works — no manual `brew install`, no hand-fetching a ggml file from Hugging Face, no `--model` path wrangling. The chosen mechanism is **in-process WASM/JS whisper** so the ONLY setup is a model download; native whisper.cpp (approach A below) is demoted to an OPTIONAL "make it faster" upgrade, not the default. Today (shipped Phase-2) the local path needs binary + model + path all by hand — this closes that gap. **DDR-worthy** (WASM-first decision; which/what-size model; bundle-vs-download; multi-GB consent; storage location).

- **Chosen — B. Zero-install WASM/JS whisper.** Run whisper in-process via a WASM/JS build (**transformers.js `Xenova/whisper-*`** is the leading candidate — real Whisper support, runs in Node + browser; whisper.cpp-WASM is the fallback candidate) so the ONLY setup is a **model download that auto-fires on first use** — NO system binary, NO brew. This mirrors the ML pattern Maude ALREADY ships: `@imgly/background-removal` (DDR-161) lazy-loads and auto-downloads its model. Same shape → "click enable, it downloads once, then transcribes offline forever." Slower than native, but it genuinely *just works* with one button. Both WASM + native still normalize to `CaptionWord[]` → `captions.ts` (the single reflow point, Task 2.6).
- **Feasibility spike FIRST (the "pokud to jde" gate).** Before committing the WASM path, a small spike must confirm on target hardware: (1) transformers.js / whisper-WASM produces **word-level timestamps** good enough for subtitles (Whisper's `return_timestamps: 'word'`); (2) acceptable speed on a real clip (WASM is ~several× slower than native — a few minutes of audio should still finish in a tolerable wall-clock, else surface an ETA); (3) memory fits (a `base`/`small` model, not necessarily `large-v3-turbo`, may be the right default for WASM); (4) it runs **MAIN-origin / in the sidecar** (like transcription already does — NOT the CSP-split untrusted canvas realm). If the spike fails on perf/word-timestamps, fall back to **A** (native whisper.cpp + a managed model-download button) as the shipped mechanism and keep the same one-click UX.
- **A. Native whisper.cpp + managed model download (fallback / optional "faster" tier).** Keep the fast native binary, add a **"Download model"** button that fetches the ggml model into a Maude-managed dir with consent + progress; `_transcribe.mjs` auto-resolves it (no `--model` needed). STILL needs the whisper.cpp *binary* → guide/auto-install (`maude doctor --fix` per-OS, or bundle a per-platform binary like agent-browser's `externalBin`).
- **UX**: Settings → **Local subtitles** card → **"Download & enable"** → a size-aware consent ("one-time · stays on your machine · ~N MB/GB for the chosen model") → progress → done. After that, choosing `--provider whisper` / the Settings "Local" radio (Task 2.6) needs nothing else. The model lives in a Maude-managed, gitignored location (never `assets/`, never committed). A "Remove downloaded model" affordance to reclaim disk. Offer a model-size choice (faster-smaller vs accurate-larger) with the accuracy/size tradeoff noted.
- **Pattern**: `@imgly/background-removal` lazy-load + model-host fetch (DDR-161, `PhotoLayer`/`photo-bg-remove.sh`) — the direct precedent for a zero-install, auto-downloading client-side ML model; the Phase-5 local-engine multi-GB download-consent + "engine card" UX (§Task 5.2) — reuse that consent component; agent-browser's bundled-`externalBin` per-platform binary shape if the spike forces fallback to native (A).
- **Gotcha**: the model download is large → HARD consent + resumable/verified download (checksum). Don't bundle the model in npm/the app (bloat) — always download on demand. WASM whisper must run MAIN-origin/sidecar (no canvas CSP surface). transformers.js pulls model weights from a host (HF/CDN by default) — pin/allowlist the host per the egress discipline, and document the offline story (once downloaded, no network).
- **Validate**: fresh machine, no whisper installed → click "Download & enable" → model downloads with progress → transcription works **offline** with zero further setup, via the WASM engine (or native if the spike fell back); word timestamps land a sane SRT (read it).

### Phase 3 — Video: async generation into the EDL/video-comp

> **✅ Task 3.1 IMPLEMENTED (2026-07-11, /flow:execute, DDR-164).** `gemini.ts` extended with **Veo 3.1** (async): `submit(video)` returns a real running Job that POSTs `:predictLongRunning` → polls the operation (10 s cadence, wall-clock capped, abortable/cancelable) → extracts the video URI (defensive `extractVideoUri` walk across preview shapes) → downloads the MP4 **with the key** (the Veo URI is on Google's host and needs `x-goog-api-key`, so the adapter downloads it — re-asserting https + the Google host so a rerouted response can't exfil the key — rather than handing a key-bearing URL to `download.ts`) → returns video bytes the existing `localizeGenAsset`/`saveAsset` lands as `assets/<sha8>.mp4`. Registry auto-serves gemini for `video` (same descriptor, `modalities:['image','video']`); the generate route already gates modality. Optional i2v seed wired (a `sourceAsset` image → `image` param) for Task 3.2. **fal DROPPED** (owner) — Veo only. Tests: `gemini.test.ts` adds extractor units + a full stubbed start→poll(done)→download lifecycle + an off-host-URI key-exfil rejection + video registration (5 new; 103 generation+gate pass). Not committed with a live key — the Veo live-gate (paid, minutes/clip) is owner-run. **Deferred to 3.2:** the `.footage.json` analyzable sidecar + the EDL-beat wiring.

#### Task 3.1: ADD Veo (Gemini) + fal video to the adapters
- **Do**: extend `gemini.ts` with Veo 3.1 (`operation.done` poll → MP4) + `fal.ts` video models (Kling/Seedance/Hailuo/Veo — all image-to-video, most with native audio). Localize MP4 → `assets/<sha8>.mp4` (extend `_fetch-asset.mjs` to accept video). Generate the `.footage.json` sidecar so a generated clip is analyzable.
- **Gotcha**: clips take 1–10 min → the job-queue + notification-center UX (Phase 0) carries progress; poll ~10s, never webhook.
- **Validate**: stubbed operation lifecycle; a generated clip lands + is footage-ingestable.

#### Task 3.2: WIRE generated clips into the reel/video-comp
- **Do**: a generated clip becomes a new `EdlBeat.clip` (i2v seeded from a generated still to keep style consistent); expose "generate a clip for this beat" from the reel flow.
- **Pattern**: `footage/schema.ts:175`; reel.md EDL→codegen.
- **Validate**: generate a clip → insert as a beat → scrub in Timeline → export MP4.

#### Task 3.3: Phase-3 gate — footage-director integration test, security, What's New.

### Phase 4 — Proactive AI-initiated generation ("want me to generate this?")

#### Task 4.1: CREATE the media-generation director agent
- **Do**: `plugins/design/agents/media-generation-director.md` — read-only; reads the canvas/EDL + a coverage-gap context; emits a **generation-plan artifact** (per slot: `prompt, kind: image|video|audio, aspect, placement, why`) via a privileged route; **never edits the canvas**.
- **Pattern**: `footage-director.md` contract (analysis → decision artifact); `signature-moment-critic` `top_blockers`+`fix` shape for the gap finding.
- **Validate**: on a reel with a missing beat, the director emits a plan naming the gap + a prompt.

#### Task 4.2: WIRE the proactive proposal into the loop
- **Do**: a gap finding surfaces in the critic/analyst verdict; the **command** renders ONE AskUserQuestion ("generate the missing clip / hero / caption?"); on yes → execute the plan slot-by-slot via `maude design generate`/`transcribe`, localize, splice in.
- **Pattern**: debate-protocol "one AskUserQuestion, rendered by the command" invariant; `new.md` step 3.6/4.6 AskUserQuestion shape.
- **Gotcha**: never let the agent prompt the user or run generation in its own turn — proposal is a data artifact, execution is command-driven + consent-gated (prompt-injection posture).
- **Validate**: end-to-end: reel with a gap → agent proposes → user confirms → clip generated + inserted.

#### Task 4.3: Phase-4 gate — security (prompt-injection focus), scenario, What's New.

### Phase 5 (post-v1) — Local generation engines + native keychain

#### Task 5.1: ADD OS-keychain custody (native tier)
- **Do**: `apps/desktop/src-tauri/src/generation_keys.rs` — per-provider keychain set/get/delete + bridge extension (sidecar reads via the loopback bridge); `keys.ts` prefers keychain when the bridge env is present, falls back to the `0600` file.
- **Pattern**: `keychain.rs` + `sidecar.rs:138` + `github/token.ts`. **3-edit Tauri-command rule** + real desktop-build verify.
- **Validate**: desktop build; a key set in the app never appears in the webview or on disk in the repo.

#### Task 5.2: ADD local runtime engines (image/video)
- **Do**: `adapters/openai-compatible.ts` (Ollama/LM-Studio) + `comfyui-local` (`POST /prompt` → `/history` poll → `/view`) + a `Draw Things` Mac path; localhost detection probes from the sidecar (~100–300ms `GET` at 11434/1234/8188); "engine cards" in Settings with cost/offline/VRAM/download-size + explicit multi-GB download consent + "prefer local when available".
- **Pattern**: the architecture research appendix (§3 detection table).
- **Validate**: with a local runtime running, an engine card lights up and generation routes locally at $0 cost.

#### Task 5.3: Phase-5 gate + desktop-e2e scenario for Settings/keys.

---

## Validation

Per phase:

1. **Lint/format**: `bun tsc --noEmit` (DDR-026 baseline unchanged) + biome clean on changed files.
2. **Tests**: `bun test` (studio suite green; new generation/adapters/captions/gate tests) + CLI reachability (`plugin-cli-reachability.test.mjs`).
3. **Canvas-origin gate**: `test/canvas-origin-gate.test.ts` asserts `/_api/generate*` + key routes 403 from the canvas origin.
4. **Security fan-out** (every phase — this feature adds egress + secrets + untrusted-content reads): spawn `security-auditor` + `ethical-hacker`. Focus: key custody/leak, SSRF on provider egress, canvas-origin exclusion, prompt-injection via canvas/footage content, env-scrub (DDR-123), licensing/consent surfacing.
5. **Live gate** (owner): each modality generated end-to-end **in the default split-origin mode** (the CSP is the point — same-origin masks bugs, per the photo-editor lesson) with a real key.
6. **Design/motion/copy critics** on the Settings UI + any generated-content canvases; a11y-auditor on the Settings panel.

## Scenario Coverage (UI)

- `ai-generation-settings` — open Settings, add a (stub) provider key, see "configured", toggle a provider — web-desktop (dev tool → other 4 platforms SKIPPED, like every studio scenario).
- `generate-image-into-canvas` — `/design:generate` / dialog → asset appears → editable in Photo tab.
- `reel-generate-missing-beat` (Phase 4) — director proposes a gap → confirm → clip inserted.
- Desktop-e2e (Phase 5): `settings-keychain` — key set in native app survives restart, never in webview.

## Acceptance Criteria (per phase)

- [ ] Phase tasks complete; `/flow:utils-verify` passes after each (Edit-Verify Loop, max 3).
- [ ] `/validate`: static + tests + build green; security fan-out 0 blockers ≥ medium; canvas-origin gate green; a11y 0 blockers on Settings.
- [ ] No provider key is ever readable by the canvas origin, cached, logged, or committed.
- [ ] Every generated asset is content-addressed in `assets/`, magic-byte-verified, and renders under both origins.
- [ ] Licensing/consent caveats surfaced in the Settings UI for music/voice.
- [ ] DDR recorded; What's New pending entry; roadmap regen (`pnpm --filter @maude/site gen:roadmap`).
- [ ] Code follows project conventions; no regressions.

---

## Open Questions (prose — decide before/at execute)

1. **First-modality ordering.** ✅ **DECIDED — image-first** (Phase 0 done + live-gated 2026-07-11). Phase 1 completes image (auto-insert + editing + agent/ACP seam), then audio (Phase 2). Video last.
2. **v1 scope.** ✅ **DECIDED — v1 = Phases 0–2** (spine + image + audio). Video (Phase 3), proactive (Phase 4), local engines (Phase 5) are fast-follows.
3. **Aggregator dependency.** ✅ **DECIDED (2026-07-11, owner) — NO aggregator. Direct BYOK only: Google + ElevenLabs.** fal is dropped ("don't solve breadth for the user; they bring their own direct-provider key"). Google + ElevenLabs cover image/video/audio/STT for v1. The `fal-queue` shape stays documented so an optional fal/Replicate adapter can drop in later, but it is not built.
4. **Local subtitles dependency.** whisper.cpp as a **soft** dep (auto-detected, graceful fallback to Groq/Scribe cloud when absent) — **recommended default**; revisit at Phase 2 if the local dep is unwanted.
5. **Reuse-before-generate.** ✅ **DECIDED (2026-07-11, owner) — AUDIO-ONLY, library-search-first.** Music/SFX: always query the audio library (ElevenLabs History — free re-download — + Maude-local generated audio) and prefer an existing suitable track before paying for a new generation. **Images are explicitly OUT** — cheap, single-use, and already reusable straight from `assets/`, so no image cache. Tracked as **Task 2.5** (follow-up, DDR-worthy); not in the shipped Phase-2 increment (2.1–2.4).
6. **Transcription engine choice.** ✅ **DECIDED (2026-07-11, owner) — USER PICKS, not automatic.** The subtitle engine is an explicit user choice (local whisper.cpp vs cloud ElevenLabs Scribe / Groq) via a `--provider` flag + a `generation.transcription.provider` config default + a Settings selector — **no silent auto-fallback** (a chosen-but-unavailable engine errors clearly, it never quietly runs the other). Tracked as **Task 2.6** (follow-up); the shipped increment built local whisper only, so this adds the switch + finishes the cloud caption-output path.
7. **Local-subtitle onboarding.** ✅ **DECIDED (2026-07-11, owner) — zero-install WASM whisper (approach B), if the feasibility spike passes.** Local subtitles get a one-click "Download & enable" — an in-process WASM/JS whisper (transformers.js candidate) whose only setup is an auto-downloading model (the `@imgly/background-removal` pattern Maude already ships), NO brew/binary. A spike gates it on word-timestamps + perf + memory (running MAIN-origin/sidecar); if it fails, fall back to native whisper.cpp + a model-download button (same one-click UX). Native stays available as the optional "faster" tier. Tracked as **Task 2.7**.

## Research Appendix

> Full provider landscape (image / video / audio / architecture), model ids, output shapes, pricing (dated July 2026 — re-verify before hardcoding), and source links are captured in the plan research and summarized in Design Decisions → Provider selection. Key invariants: Nano Banana = sync base64; Veo = async poll, URL out (expiring); ElevenLabs = one key for the audio stack; local whisper.cpp = free no-key subtitles with word timestamps; avoid Sora 2 (sunset) and Suno/Udio (no official API). **fal / aggregator = dropped (owner, 2026-07-11) — direct BYOK only.**
