# Feature: Power-user local media generation + native keychain (post-v1)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is the **extracted Phase 5** of `feature-ai-media-generation` (closed at Phase 4, 2026-07-13) — split into its own plan because every task here has a **native/local verification ceiling** a headless session cannot clear (needs `cargo` + a real desktop build + a running local runtime). Owner-dogfood work.

## Description

The BYOK AI-media generation epic (DDR-164, Phases 0–4) shipped the whole cloud spine: image (Nano Banana), audio (ElevenLabs + local Whisper), video (Veo), and the proactive gap-director — all reachable from the UI, the CLI (`maude design generate`), the slash commands, and the ACP chat panel. Keys live in a `0600` `~/.config/maude/keys.json` file (browser tier). What remains is the **power-user / offline tier**:

1. **Native OS-keychain custody** — on the desktop app, provider keys move from the plaintext-ish `0600` file into the macOS Keychain / Windows Credential Manager / Linux Secret Service, read at request time by the sidecar over the same loopback-bridge pattern the GitHub token already uses. The TS half (`keys.ts` bridge hook) is already done; this adds the Rust half.
2. **Local runtime engines** — generate images/video with **zero cloud cost, offline, and fully private** by routing to a locally-running Ollama / LM-Studio (openai-compatible) or ComfyUI, plus a Mac-native Draw Things path. Detected on loopback; surfaced as "engine cards" in Settings with cost/offline/VRAM/download-size and a multi-GB download-consent gate; `preferLocalWhenAvailable` routes to them.
3. **Desktop-e2e coverage** for the Settings/keychain surface.

## User Story

As a **power-user / privacy-conscious / offline Maude creator** I want to **store my provider keys in the OS keychain and generate media with a local model at $0 cost without internet** so that **my prompts and outputs never leave my machine, I'm not metered per generation, and I'm not locked to a cloud provider or a paid account.**

## Problem

Post-Phase-4, generation is **cloud-only and file-key-only**:

- **Keys** sit in `~/.config/maude/keys.json` at mode `0600` — safe from the canvas origin and other users, but plaintext on disk, not in the OS secret store. The native tier the plan always intended (`keys.ts` lines 9–13, 85–124 — bridge hook already written, `MAUDE_GEN_KEY_ENDPOINT`/`_KEY`, `X-Maude-Token-Key`) has **no Rust counterpart** — `generation_keys.rs` does not exist.
- **Every generation costs credits and requires internet + a paid account.** There is no way to run a local model. `config.generation.preferLocalWhenAvailable` exists in the schema but is **inert** ("Inert until local engines ship (Phase 5)") because no `kind: 'local'` adapter is registered. The `SettingsPanel` `ProviderCard` already renders a `Local` pill (`kind === 'local'`, `.is-local`) but no provider ever reports that kind.
- **No desktop-e2e** exercises the Settings/keychain flow.

## Solution

Three independently-shippable tasks on the already-built adapter spine — **no new architecture, the interfaces were designed for exactly this** (`ProviderAdapter`, `descriptor.kind: 'cloud'|'local'`, the registry factory, the keychain-bridge hook):

1. **`generation_keys.rs`** — mirror `keychain.rs` verbatim: per-provider keychain `set/get/delete` (one service per provider, `com.maude.app.gen.<provider>`) + a loopback bridge extending the existing `start_token_bridge`/`bridge_env` handoff, so the sidecar's already-written `getKeyFromBridge` resolves keys from the keychain. The **3-edit Tauri-command rule** (memory `reference_tauri_command_needs_build_rs`): `generate_handler` + `capabilities/default.json` allow-list + `build.rs commands()`. **Verify with a real desktop build** — `cargo check` will NOT catch a missing `build.rs` entry (DDR-045 shipped broken native twice this way).
2. **`adapters/openai-compatible.ts` + `adapters/comfyui-local.ts`** — a `kind: 'local'` adapter shape registered in `registry.ts`; loopback detection probes from the sidecar; "engine cards" in `SettingsPanel` reusing the existing `ProviderCard` `is-local` scaffolding + a multi-GB download-consent component; `preferLocalWhenAvailable` becomes live.
3. **Desktop-e2e `settings-keychain` scenario** — WebdriverIO DOM-driven, asserting a key set in the native app survives restart and never appears in the webview or on disk.

> **Verification ceiling — load-bearing (why this is a separate, owner-run plan):** every task's `Validate` step needs hardware this repo's headless sessions don't have. **Do NOT attempt to "verify" these by stubbing** — that's exactly the DDR-045 failure mode. Build here (the code can be authored anywhere), but the acceptance gate is a **real desktop build + a running local runtime on the owner's Mac.**

## Metadata

- **Ticket**: (none — internal roadmap item; `integrations.tracker.provider: github`, no issue filed)
- **Type**: New Capability (power-user tier)
- **Complexity**: High (native Rust + local-runtime integration + desktop-e2e; but architecture pre-decided)
- **App/Package**: `apps/desktop` (Rust keychain), `apps/studio` (local adapters, Settings engine cards, loopback detection), `apps/desktop/e2e` (scenario)
- **Affected Systems**: key custody (DDR-108 bridge pattern), generation adapter registry (DDR-164), Settings UI, config routing (`preferLocalWhenAvailable`), Tauri command surface (DDR-108/109 capability ACL), desktop-e2e harness
- **Dependencies (new)**: `ollama` / LM-Studio / ComfyUI / Draw Things are **soft, user-supplied runtimes** (detected, never bundled) — declare in `plugins/design/dependencies.json` with `check` + per-OS `install` hint + `fallbackBehavior: cloud`. No new npm/cargo runtime dep (keychain reuses the existing `keyring`/`tiny_http` crates already in `keychain.rs`).
- **DDR**: extends **DDR-164** (BYOK AI media generation). A **new DDR** is warranted for the local-engine detection + download-consent model and the per-provider keychain-service naming (see Design Decisions → record at execute).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message — independent context loads.

**Native keychain (the exact template — 5.1):**
- `apps/desktop/src-tauri/src/keychain.rs` (whole file, 183 lines) — the GitHub-token pattern to mirror per-provider: `entry()`/`set_token`/`get_token`/`delete_token`, `start_token_bridge` (ephemeral 127.0.0.1 port, `getrandom` fail-closed key, `ct_eq` constant-time compare, single `GET` path → 404/405/403), `bridge_env()`, and the `#[tauri::command] github_is_signed_in`/`github_sign_out` webview surface (never returns the secret).
- `apps/desktop/src-tauri/src/sidecar.rs:142`–`:145` — `if let Some((endpoint, key)) = crate::keychain::bridge_env() { .env("MAUDE_TOKEN_ENDPOINT", endpoint).env("MAUDE_TOKEN_KEY", key) }` — the env handoff to extend with `MAUDE_GEN_KEY_ENDPOINT`/`MAUDE_GEN_KEY_KEY`.
- `apps/desktop/src-tauri/src/lib.rs:16` (`mod keychain;`), `:326`–`:331` (`generate_handler![… keychain::github_is_signed_in, keychain::github_sign_out]`), `:425` (`keychain::start_token_bridge()` at startup) — the 3 wiring sites for the new module + commands + bridge start.
- `apps/desktop/src-tauri/build.rs` (whole file) — the `commands(&[…])` ACL manifest list; every new `#[tauri::command]` MUST be added here or `tauri-build` panics at a real build (NOT at `cargo check`).
- `apps/desktop/src-tauri/capabilities/default.json:4` — the `remote.urls` loopback-wildcard capability; the new commands' generated `allow-*` permissions must be referenced here (DDR-108/109) so the dev-server origin may invoke them.
- `apps/studio/generation/keys.ts:85`–`:124` — **already-written consumer**: `keychainBridgeAvailable()`, `getKeyFromBridge()` (`X-Maude-Token-Key` header, 3 s timeout, 200/404/403 semantics), and `getProviderKey` preferring the bridge then falling through to the file. **This does not change** — the Rust side must speak exactly this protocol (`GET <endpoint>?provider=<id>` → 200 body = key / 404 = unset / 403 = bad key).

**Local runtime engines (5.2):**
- `apps/studio/generation/registry.ts` (whole file) — `PROVIDERS` map (id → `{ descriptor, adapter-factory }`), `listProviders`, `providersForModality`, `createAdapter(providerId, ctx)`. A local adapter is one more entry — no route change (the generate route is provider-agnostic).
- `apps/studio/generation/types.ts` — `ProviderAdapter`, `ProviderDescriptor` (`kind: 'cloud'|'local'`, `auth`, `modalities`), `Job`, `GenRequest`, `GenResult`. The `fal-queue`/`openai-compatible`/`comfyui-local` shapes are documented here.
- `apps/studio/generation/adapters/gemini.ts` + `adapters/elevenlabs.ts` — the two built adapters to mirror: the `submit → Job` contract, async-poll lifecycle (Veo in gemini.ts is the closest precedent for ComfyUI's `POST /prompt` → `/history` poll → `/view`), and the `assertSafeBase` + `readTextCapped`/`readBytesCapped` egress discipline (adapt to **loopback-only** hosts for local — a different allowlist: `127.0.0.1`/`localhost` on the known ports, NOT the public-host SSRF gate).
- `apps/studio/generation/download.ts` — localizes a URL/base64/file result into `assets/<sha8>` via `api.saveAsset`; a ComfyUI `/view` image URL localizes through here.
- `apps/studio/client/panels/SettingsPanel.jsx:58`–`:165` (`ProviderCard`) — **already renders the `Local` pill** (`provider.kind === 'local'` → `.st-pill.is-local`), modalities, notes, keyUrl, masked key row, "test connection" status. Engine cards extend this: add a VRAM + download-size line + a cost badge (`Free · your hardware`) + the download-consent affordance for `kind: 'local'`.
- `apps/studio/config.schema.json` `generation.preferLocalWhenAvailable` (already present, `default: false`, marked "Inert until local engines ship (Phase 5)") — flip it live; `generation/registry.ts` + the generate route consult it when a local engine is detected.
- `apps/studio/context.ts` `loadConfig`/`reloadConfig` (hot-reloadable set) — `preferLocalWhenAvailable` + any local-host override must be in the hot-reload set (already is, via the full-swap `reloadConfig`).

**Download-consent precedent (5.2):**
- `apps/studio/generation/whisper-models.ts` + the `/_api/generate/whisper-model` route + the Settings "Local subtitle models" card (Task 2.7, committed `07ab3e16`) — **the direct precedent**: a frozen model registry, SSRF-hardened streamed download into `~/.cache/maude/…`, progress-polled, DELETE-to-reclaim, size-aware consent. The multi-GB local-model download reuses this exact shape + UI component.
- `@imgly/background-removal` lazy-load + model-host fetch (DDR-161, `photo-bg-remove.sh`) — the other zero-install auto-download-on-first-use precedent.

**Desktop-e2e (5.3):**
- `apps/desktop/e2e/` (WebdriverIO + `@wdio/tauri-service`) + the `desktop-e2e` skill — the harness. `data-testid` convention `<area>-<thing>` (established: `canvas-list`, `canvas-row-<slug>`, `canvas-frame` in `apps/studio/client/app.jsx`). The `SettingsPanel` needs testids added in the same change.
- `apps/desktop/src-tauri/src/lib.rs:486`–`:493` (`#[cfg(debug_assertions)]` `tauri_plugin_wdio_webdriver::init()`) — the debug-only WebDriver registration the scenario drives.
- memory `project_desktop_e2e_harness_wdio_gotchas` — the 5 fixes that make the harness green (pin tauri-service 1.1.0, distinct id, embeddedPort, first-run honors `MAUDE_PROJECT_ROOT`, testid slug strips `.design/`).

### Files to Create

- `apps/desktop/src-tauri/src/generation_keys.rs` — per-provider keychain `set/get/delete` (service `com.maude.app.gen.<provider>`, provider-id validated slug), the generation key-bridge (`start_generation_key_bridge` / `generation_bridge_env` mirroring `keychain.rs`, single `GET /_tauri/gen-key?provider=<id>` path), and the webview commands (`gen_key_set` / `gen_key_delete` / `gen_key_configured` — status-only, never returns a key). **May instead extend `keychain.rs`** with a second entry-family + a second bridge route rather than a new file — decide at execute (a new file keeps GitHub vs generation custody visibly separate; reuse keeps one bridge thread). Record the choice in the DDR.
- `apps/studio/generation/adapters/openai-compatible.ts` — Ollama / LM-Studio local adapter (`kind: 'local'`, `auth: 'none'`, loopback host, `POST /v1/chat/completions` / `/v1/images/generations` shape where supported; probe `GET /api/tags` (Ollama) / `/v1/models` (LM-Studio)).
- `apps/studio/generation/adapters/comfyui-local.ts` — ComfyUI local adapter (`POST /prompt` → `/history/<id>` poll → `/view` image fetch → `download.ts`); async `Job` mirroring the Veo lifecycle in `gemini.ts`. Optional Draw Things Mac path (its own loopback port) folded in or a sibling file.
- `apps/studio/generation/local-detect.ts` — loopback engine detection (`~100–300 ms` `GET` probes at `11434` Ollama / `1234` LM-Studio / `8188` ComfyUI / Draw Things port), returns which engines are live + their models. Cached with a short TTL; probed from the sidecar (main-origin), never the canvas realm.
- `apps/desktop/e2e/scenarios/settings-keychain.e2e.ts` (or the harness's scenario shape) — the desktop-e2e scenario.
- New DDR — local-engine detection + download-consent model + per-provider keychain-service naming (extends DDR-164).

### Design canvases

> No `.design/` canvas matches "keychain / local / engine / settings" — the only visual surface is the **Settings engine cards**, which are studio-client chrome extending the existing `ProviderCard`, not a `.design/` canvas. Design against `SettingsPanel.jsx`'s existing idiom + the Task-2.7 "Local subtitle models" card (the direct download-consent precedent), not a moodboard. (Recent `.design/` activity — Photo Editor Trailer, Maude Showcase — is unrelated.)

### Documentation

- Ollama API: `GET /api/tags` (model list), `POST /api/generate` / OpenAI-compat `/v1/*` — re-verify the current surface before hardcoding.
- ComfyUI API: `POST /prompt`, `GET /history/{prompt_id}`, `GET /view?filename=…` — the async node-graph flow.
- Draw Things HTTP API (Mac) — loopback server + its port; verify it exposes a scriptable generate endpoint.
- Tauri v2 keychain via the `keyring` crate (already a dep, used by `keychain.rs`) + the ACL/capability model for remote-origin command invokes (DDR-108/109).

### Patterns to Follow

- **Loopback bridge** (`keychain.rs`): ephemeral `127.0.0.1:0` bind, `getrandom` fail-closed key (never a time-seed), `ct_eq` constant-time header compare, single `GET` path → 404/405/403, key handed to the sidecar via env at spawn, secret never logged / never a Tauri command return value.
- **3-edit Tauri-command rule** (memory `reference_tauri_command_needs_build_rs`): `generate_handler![]` + `capabilities/default.json` `allow-*` + `build.rs commands(&[…])`. Missing `build.rs` → hard panic at a **real desktop build**, invisible to `cargo check`. Verify with an actual bundle.
- **Local egress is NOT the public-SSRF gate.** The cloud adapters' `assertSafeBase` rejects non-allowlisted hosts to prevent key exfil; local adapters do the inverse — **only** `127.0.0.1`/`localhost` on the known engine ports, and there is **no key** to protect, but still cap response bytes (`readBytesCapped`) and magic-byte-sniff before writing an asset.
- **Download-consent** (Task 2.7 `whisper-models.ts`): frozen registry, checksum-verified resumable stream into a Maude-managed gitignored cache dir (`~/.cache/maude/…`, NEVER `assets/`, NEVER committed), progress-polled, size-aware HARD consent, DELETE-to-reclaim.
- **Runtime-state taxonomy (DDR-115)**: any local-engine scratch/cache uses the `_underscore/` convention (if under `<designRoot>/`) or the `~/.cache/maude/` dir; add any new `<designRoot>/_*` path to ALL THREE lists (`git/service.ts isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, root `.gitignore`). Final generated assets stay in `assets/` (versioned).
- **Env-scrub (DDR-123)**: the generation key-bridge env (`MAUDE_GEN_KEY_*`) must NOT leak into the ACP `claude` subprocess — confirm `acp/env.ts` `scrubAgentEnv`/`PROVIDER_REDIRECT_RE` covers it (this is DDR-164 follow-up **F3**, explicitly deferred to Phase 5.1).

---

## Design Decisions

> UI surface reuses the existing `SettingsPanel` idiom — minimal net-new components.

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `ProviderCard` | `apps/studio/client/panels/SettingsPanel.jsx:58` | Already renders `kind === 'local'` → `.st-pill.is-local`. Extend for engine cards: add VRAM + download-size line, cost badge, download-consent affordance. |
| Local-model download card | `apps/studio/client/panels/SettingsPanel.jsx` (Task-2.7 "Local subtitle models" card) | The download-consent + progress + DELETE-reclaim precedent; reuse the component shape for multi-GB image/video model downloads. |
| `TranscriptionEngineCard` radio idiom | `SettingsPanel.jsx:186` | The "explicit choice, never silent-switch" selector precedent for the `preferLocalWhenAvailable` toggle framing. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Settings panel | `apps/studio/client/panels/SettingsPanel.jsx` | The whole surface — provider cards + transcription card already live; add an "Engines" / "Local" section. |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| `cloud` (existing local Lucide-line path) | inline in `SettingsPanel.jsx:39` | 12 | Cloud/Local pill (already present) |
| local/hardware glyph (new, same Lucide-line family) | inline path | 12–16 | Local engine card pill |
| download / progress | inline path (match Task-2.7 card) | 16 | Download-consent affordance |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Cost badge (free) | existing `--fg-2`/accent | No hardcoded colors; match provider cost-badge idiom |
| Local pill | `.st-pill.is-local` | Already styled in `client/styles/4-components.css` |
| Download consent / warning | existing warn token | Reuse Task-2.7 card's tokens |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Engine card (local) | Local runtime needs VRAM/download-size/cost surface | `ProviderCard` |
| Multi-GB download-consent modal | image/video models are 7–23 GB | Task-2.7 whisper-model download card |

### DDR-worthy decisions (record at execute)

1. **Keychain module: new `generation_keys.rs` vs extend `keychain.rs`.** New file = visibly-separate GitHub vs generation custody; extend = one bridge thread. (Recommend a new file + a second bridge, sharing the `random_hex`/`ct_eq` helpers.)
2. **Per-provider keychain service naming** — `com.maude.app.gen.<provider>` (one entry per provider) vs one JSON blob entry. (Recommend one-per-provider, mirroring `keychain.rs`'s single-purpose entry.)
3. **Local-engine detection cadence + trust** — probe TTL, which ports, and that detection runs main-origin/sidecar only.
4. **Download-consent + cache location** for multi-GB local models (reuse Task-2.7 model).

---

## Tasks

Execute in phase order. Each is independently shippable; the **acceptance gate for every task is owner-run on a real desktop build / local runtime** — author the code in any session, but do NOT mark a task `✅` on a stubbed verify.

### Phase 5.1 — Native OS-keychain custody

#### Task 1: CREATE the native generation-key keychain + bridge (Rust)
- **Do**: `generation_keys.rs` (or extend `keychain.rs` — DDR decision 1) — per-provider `set/get/delete` (service `com.maude.app.gen.<provider>`, provider-id validated against the same slug shape as `keys.ts`'s `PROVIDER_ID_RE`), `start_generation_key_bridge()` + `generation_bridge_env()` mirroring `start_token_bridge`/`bridge_env` (ephemeral loopback, `getrandom` fail-closed key, `ct_eq`, single `GET /_tauri/gen-key?provider=<id>` → 200 key / 404 unset / 403 bad-key), and webview commands `gen_key_set(provider, key)` / `gen_key_delete(provider)` / `gen_key_configured(provider) -> bool` (status only — a key value NEVER crosses to the webview).
- **Pattern**: `keychain.rs` verbatim; `keys.ts:85`–`:124` is the already-written consumer — match its protocol exactly (`?provider=` query, `X-Maude-Token-Key` header).
- **Gotcha**: **3-edit rule** — `lib.rs` `generate_handler![]` (3 new commands) + `lib.rs` `start_generation_key_bridge()` at startup (next to `:425`) + `sidecar.rs` env handoff (`.env("MAUDE_GEN_KEY_ENDPOINT", …).env("MAUDE_GEN_KEY_KEY", …)` next to `:142`) + `build.rs commands(&[… "gen_key_set", "gen_key_delete", "gen_key_configured"])` + `capabilities/default.json` `allow-*`. Missing `build.rs` = panic at bundle, invisible to `cargo check`.
- **Validate** (owner, real desktop build): `pnpm --filter … tauri build` (or the desktop dev build) succeeds; set a key in the app → `gen_key_configured` true; the sidecar's `getProviderKey` resolves it via the bridge (generate an image with the keychain key, `keys.json` absent); the key never appears in the webview (DevTools/`localStorage`) nor on disk in the repo (`grep -r` the key over `.design/` + `~/.config/maude/`).

#### Task 2: WIRE the SettingsPanel to the native keychain path + close the env-scrub follow-up (F3)
- **Do**: on the desktop app, the `ProviderCard` key write/delete goes through the Tauri command (`gen_key_set`/`gen_key_delete`) when running natively, falling back to the existing `/_api/generate/keys` POST in the browser; the status probe uses `gen_key_configured`. Confirm `acp/env.ts` `scrubAgentEnv` strips `MAUDE_GEN_KEY_ENDPOINT`/`MAUDE_GEN_KEY_KEY` from the ACP `claude` subprocess env (DDR-164 follow-up **F3**) — add to `PROVIDER_REDIRECT_RE`/the scrub set + a test.
- **Pattern**: `IdentityBar.jsx` native-vs-web command dispatch (`window.__TAURI__`); `acp/env.ts:34`–`:38`.
- **Gotcha**: the browser tier (`keys.json`) must keep working unchanged — this is an ADDITIVE native path, not a replacement.
- **Validate**: (unit) env-scrub test green; (owner) native app key write lands in the keychain not the file; browser build unchanged.

#### Task 3: Phase-5.1 gate
- **Do**: security fan-out (defender + ethical-hacker) on the new bridge + command surface (focus: bridge key unguessability/fail-closed, no key in webview/logs, capability ACL scope, env-scrub); What's New pending entry ("Store your keys in the OS keychain"); DDR (decisions 1+2). Roadmap regen.
- **Validate**: `bun test` studio suite + canvas-origin gate green; security 0 blockers ≥ medium; **owner desktop-build sign-off**.

### Phase 5.2 — Local runtime engines

#### Task 4: CREATE loopback engine detection
- **Do**: `generation/local-detect.ts` — probe `127.0.0.1` at `11434` (Ollama `GET /api/tags`), `1234` (LM-Studio `GET /v1/models`), `8188` (ComfyUI `GET /system_stats` or `/`), and the Draw Things port; `~100–300 ms` timeout each; return live engines + their available models; short-TTL cache. Sidecar/main-origin only.
- **Pattern**: the cloud adapters' `fetch` + timeout discipline, but loopback-only host allowlist (the inverse of `assertSafeBase`).
- **Gotcha**: detection must never block a request path — probe async, cache, degrade to "no local engine" silently.
- **Validate**: (unit) stubbed-probe test; (owner) with Ollama running, detection reports it + its models.

#### Task 5: CREATE the local adapters (openai-compatible + comfyui-local)
- **Do**: `adapters/openai-compatible.ts` (Ollama/LM-Studio — `kind: 'local'`, `auth: 'none'`, image/text where the local model supports it) + `adapters/comfyui-local.ts` (`POST /prompt` → `/history/<id>` poll → `/view` → `download.ts`, async `Job` mirroring the Veo lifecycle) + optional Draw Things path; register all in `registry.ts`.
- **Pattern**: `adapters/gemini.ts` (Veo async poll = ComfyUI's closest precedent); `download.ts` for the `/view` image; `registry.ts` factory entry.
- **Gotcha**: bytes still capped + magic-byte-sniffed before an `assets/` write; a ComfyUI graph is a template the adapter fills (prompt/dims), not user-injectable node JSON from the canvas.
- **Validate**: (unit) stubbed lifecycle; (owner) with a local runtime up, generate an image that lands in `assets/` at $0.

#### Task 6: WIRE engine cards + `preferLocalWhenAvailable` into Settings + routing
- **Do**: extend `ProviderCard` (or an "Engines"/"Local" Settings section) with local engine cards — cost badge (`Free · your hardware`), local/cloud pill (exists), VRAM + download-size line, multi-GB download-consent (reuse the Task-2.7 whisper-model download card); make `config.generation.preferLocalWhenAvailable` live — when a local engine is detected for a modality and the toggle is on, `registry.ts`/the generate route route local. Declare the runtimes as soft deps in `plugins/design/dependencies.json` (check + per-OS install hint + `fallbackBehavior: cloud`).
- **Pattern**: `SettingsPanel.jsx` `ProviderCard` + the Task-2.7 "Local subtitle models" card; `dependencies.json` soft-dep + graceful fallback (`photo-bg-remove.sh` shape).
- **Gotcha**: no hardcoded colors; download-consent is HARD (multi-GB); the model cache lives in `~/.cache/maude/…`, gitignored, never `assets/`.
- **Validate**: (owner) engine card lights up with a runtime running; toggle on → a generate request routes locally at $0; toggle off → cloud; a11y-auditor on the new Settings section.

#### Task 7: Phase-5.2 gate
- **Do**: design/a11y critics on the engine cards; security fan-out (focus: loopback-only egress, no node-JSON injection into ComfyUI, download-consent + checksum); What's New; DDR (decisions 3+4). Roadmap regen.
- **Validate**: `bun test` + gate green; a11y 0 blockers on Settings; **owner local-runtime sign-off**.

### Phase 5.3 — Desktop-e2e coverage

#### Task 8: ADD the `settings-keychain` desktop-e2e scenario
- **Do**: add `data-testid`s to the `SettingsPanel` key-entry surface (`settings-panel`, `settings-key-input-<provider>`, `settings-key-configured-<provider>`), then a WebdriverIO scenario: open Settings → set a (stub) key → assert "configured" → restart the app → assert the key is still configured (keychain persistence) → assert the key value is nowhere in the webview DOM/`localStorage`.
- **Pattern**: `apps/desktop/e2e/` existing scenarios + the `desktop-e2e` skill; memory `project_desktop_e2e_harness_wdio_gotchas`.
- **Gotcha**: needs the fresh `.app` from Task 1 (keychain commands are `#[cfg(debug_assertions)]`-gated with the wdio plugin — the test build carries both); rebuild the committed client bundle release-minified if `app.jsx`/SettingsPanel testids change (the studio-client rebuild rule).
- **Validate**: (owner) `pnpm test:e2e:desktop:build` then `pnpm test:e2e:desktop` — scenario green; key survives restart, absent from webview.

---

## Validation

Per phase — **the gate is owner-run on real hardware; a stubbed pass is NOT acceptance** (DDR-045):

1. **Static**: `bun tsc --noEmit` (DDR-026 baseline unchanged) + biome clean on changed TS/JS; `cargo fmt`/`clippy` on the Rust (owner, where cargo exists).
2. **Tests**: `bun test` (studio suite + new local-detect/adapter unit tests, stubbed) + CLI reachability + `test/canvas-origin-gate.test.ts` (any new route absent from the canvas allowlists) + the env-scrub test (F3).
3. **Real desktop build** (owner, 5.1/5.3): the `.app`/`.dmg` builds (proves the `build.rs`/capability wiring); a keychain key never surfaces in the webview or on disk.
4. **Real local runtime** (owner, 5.2): with Ollama/ComfyUI running, an engine card lights up and generation routes locally at $0.
5. **Security fan-out** (every phase — new bridge + secret surface + local egress + untrusted ComfyUI-graph handling): `security-auditor` + `ethical-hacker`. Focus: bridge-key fail-closed, no key in webview/logs, capability ACL scope, env-scrub (F3), loopback-only egress, no node-JSON injection, download checksum/consent.
6. **Design/a11y critics** on the Settings engine cards; `a11y-auditor` on the new Settings section.
7. **Desktop-e2e** (5.3): `settings-keychain` scenario green on a real test build.

---

## Scenario Coverage (UI tasks)

**New scenarios to create:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `settings-keychain` (desktop-e2e) | key set in native app → configured → survives restart → never in webview/disk | 🆕 new (Task 8) |
| `local-engine-generate` (owner-manual) | local runtime detected → engine card → generate at $0 → asset in `assets/` | 🆕 owner-manual (no headless coverage possible) |

> Studio scenarios run web-desktop only (the other 4 platforms are SKIPPED, like every studio scenario). The keychain + local-engine paths are **native/local by nature** — their real coverage is the desktop-e2e scenario + owner-manual verification, not the 5-platform matrix.

---

## Acceptance Criteria

- [ ] Phase tasks complete; `/flow:utils-verify` passes (stubbed unit level) after each.
- [ ] `/validate`: static + stubbed tests + canvas-origin gate + env-scrub test green; security fan-out 0 blockers ≥ medium; a11y 0 blockers on Settings.
- [ ] **Owner desktop-build sign-off** (5.1/5.3): keychain key set in the native app survives restart, never appears in the webview or on disk in the repo; the `.app` builds (proves `build.rs`/capability wiring).
- [ ] **Owner local-runtime sign-off** (5.2): with a local runtime up, an engine card lights up and a generation routes locally at $0 cost.
- [ ] The generation key-bridge env (`MAUDE_GEN_KEY_*`) is scrubbed from the ACP `claude` subprocess (F3 closed).
- [ ] Local model downloads are checksum-verified, consented (multi-GB), cached in `~/.cache/maude/…` (gitignored, never `assets/`, never committed).
- [ ] DDR recorded (extends DDR-164); What's New pending entry; roadmap regen (`pnpm --filter @maude/site gen:roadmap`).
- [ ] Browser tier (`keys.json`, cloud providers) unchanged — no regression to the shipped Phase 0–4 paths.
- [ ] Code follows project conventions; no regressions.
