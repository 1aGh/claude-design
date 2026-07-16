# Feature: Scene-aware keyframe extraction (`footage-keyframes` skill + `smart-frames` helper)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — mirror `probe-footage` / `transcribe` for the helper, and `footage-director` for the skill.

## Description

Package the "understand the video's dynamics, then extract only the frames that carry meaning" pipeline (prototyped in `scripts/video-benchmark/`) into a **standalone, reusable skill** plus a `maude design smart-frames` helper. Today `probe-footage` samples keyframes **blindly** at an even frame rate — it straddles and misses short but meaningful beats (verified: an opening <0.25 s game-action shot before a 7 s interview was skipped entirely). The new extractor selects frames at **scene cuts + semantic action beats + true endpoints** instead, so a downstream analyzer (the `footage-analyst` agent, `/design:reel`, or any Claude vision pass) receives fewer, sharper, context-rich frames.

Three tiers, auto-detected, each a graceful fallback of the next — so **nobody is forced to download Gemma**:

1. **`gemma`** (opt-in, best) — a local Gemma-4 MLX "scout" watches the video natively and flags action beats that are *not* hard cuts (a snap, a run, a reveal inside one continuous shot), merged with ffmpeg scene cuts.
2. **`ffmpeg`** (practical default) — ffmpeg content-scene-detection + endpoints + long-shot midpoints. One common dependency, cross-platform, no model download.
3. **`blind`** (zero-dep floor) — delegates to the existing Chromium-based `probe-footage` (even-spaced), so the helper always works even with neither ffmpeg nor Gemma installed.

## User Story

As a footage-analyst (agent or developer) I want keyframes chosen by the video's real dynamics instead of a blind frame rate, so that my analysis captures every meaningful shot/beat at lower cost — and I want it to keep working whether or not I've installed ffmpeg or a local Gemma model.

## Problem

- `probe-footage` extracts N evenly-spaced frames. Sub-interval shots (a 0.1 s action flash, a quick cut) fall between samples and are lost — the analyzer then can't see them and either misses or hallucinates that beat.
- Raising the frame rate blindly just inflates tokens/cost without guaranteeing the *right* frames land.
- The proven fix lives only in a throwaway benchmark harness (`scripts/video-benchmark/contestants/hybrid.sh`) — not reusable, not referenced by the plugin, not fallback-aware for users without Gemma.

## Solution

A `maude design smart-frames` helper (DDR-062 dispatch, mirrors `probe-footage`) that emits a **superset** of the `probe-footage` manifest (drop-in for `footage-analyst`), plus a standalone `design:footage-keyframes` skill that owns the pipeline contract, the tier/fallback model, env knobs, and the manifest schema. Consumers (`footage-analyst`, `/design:reel`, the benchmark README, CLAUDE.md) **reference the skill** rather than re-deriving the logic.

**Two front doors, one engine:**

1. **Maude Studio Settings** — a "Scene-aware keyframes" section mirroring the existing **Subtitles** section (whisper): an engine radio-group (`auto / gemma / ffmpeg / blind`) persisted to prefs, plus a **one-click Gemma-model download card** (like `WhisperModelCard`) that fetches the MLX model into the Maude-managed cache and shows availability (ffmpeg present? mlx-vlm present? Apple Silicon?) so the user is told what will run and can choose. Explicit choice, never a silent switch — same posture as the transcription-engine card.
2. **Terminal / power users** — the helper's `--engine auto` **self-detects deps** (ffmpeg / mlx-vlm+model / Chromium) with no app or Settings needed, so `maude design smart-frames <clip>` works standalone as a terminal-based video analyzer. When run inside a project the app manages, it honors the persisted `keyframeEngine` pref; standalone it just self-detects.

**One-shot command `/design:video-analyze`** — the whole workflow behind a single verb: smart-frames (visual dynamics) **+** `maude design transcribe` (audio) → the `footage-analyst` watches the smart frames with the transcript folded in → writes the `FootageAnalysis` sidecar + prints a human "what is this about" report. This is the payoff of the whole exploration: **one command that analyzes picture AND sound together** (the original ask), distinct from `/design:reel` (which goes further and assembles a cut). It's a consumer of the skill, not a duplicate of it.

## Metadata

- **Type**: New Capability
- **Complexity**: Medium-High (new bin helper + tiered engine + skill + cross-references + CLI wiring + soft-deps + tests; non-UI)
- **App/Package**: `apps/studio/bin` (helper), `plugins/design/skills` (skill), `cli/commands/design.mjs` (dispatch)
- **Affected Systems**: design plugin footage pipeline, `maude design` CLI surface, dependency manifest, `footage-analyst` agent, `/design:reel`
- **Dependencies**: ffmpeg (new **soft** dep — scene tier), mlx-vlm + a Gemma-4 MLX model (new **soft**, opt-in — gemma tier), Chromium via existing `probe-footage` (floor). No new **hard** deps.

---

## Context References

### Must-Read Files

> Read these in parallel in a single message during `/flow:execute`.

- `scripts/video-benchmark/contestants/hybrid.sh` — **the proven prototype.** Port its timestamp logic: ffmpeg scene-detect (`select='gt(scene,THRESH)',showinfo` → `pts_time`), the Gemma scout prompt + M:SS/`TIME=` beat parser, and the merge (endpoints + cuts-inside-new-shot + long-shot midpoints + beats, dedup within 0.4 s, cap MAX_SHOTS). Drop the Sonnet step — analysis stays with the consumer.
- `scripts/video-benchmark/lib/prep-inputs.sh` (frame block) — exact-timestamp seek incl. t=0 & t=end (the endpoint fix that recovered the missed opening shot).
- `apps/studio/bin/probe-footage.sh` + `apps/studio/bin/_probe-footage-playwright.mjs` — the helper shim pattern (`.sh` → `.mjs`), the manifest shape (`{ asset, durationSec, width, height, frames:[{index,t,png}] }`) to superset, and the blind-tier delegate.
- `apps/studio/bin/transcribe.sh` — soft-dep detection + explicit-engine pattern (`--provider`, "SAYS which it chose", exit codes) to mirror for `--engine`.
- `cli/commands/design.mjs` (lines 38-105 `BIN_VERBS`, 121-137 dispatch) — add the new verb to the whitelist with a comment block like the `probe-footage` one.
- `plugins/design/agents/footage-analyst.md` (§1 "Extract keyframes") — the current `probe-footage` call to swap for `smart-frames`; keep it vision-only.
- `plugins/design/skills/footage-director/SKILL.md` (frontmatter + head) — skill file format + `name: design:<slug>` convention (DDR-006).
- `plugins/design/dependencies.json` (whisper-cpp entry ~line 200) — the soft-dep schema to copy for ffmpeg + mlx-vlm.
- `cli/lib/plugin-cli-reachability.test.mjs` — the DDR-062 guard the new markdown must satisfy (invoke via `maude design smart-frames`, never a raw `bash …/bin/*.sh`).
- `apps/studio/generation/whisper-models.ts` — **the model-download template.** Mirror it for Gemma: frozen registry, XDG-aware `~/.cache/` dir (`whisperModelsDir` → `gemmaModelsDir`), `list/resolve/path`, `downloadWhisperModel` (redirect-apex allowlist, atomic rename). Gemma differs: multi-file HF snapshot, not one `.bin` — download the whole `mlx-community/<model>` repo dir.
- `apps/studio/http.ts` (lines 684-3262: `whisperDownload` closure state + `/_api/generate/whisper-model` GET/POST, and 3037-3054: `/_api/generate/prefs` for `transcriptionProvider`) — mirror both: a `/_api/generate/keyframe-model` download route and a `keyframeEngine` field on `/_api/generate/prefs`.
- `apps/studio/client/panels/SettingsPanel.jsx` (`TranscriptionEngineCard` ~186-258, `WhisperModelCard` ~259-360) — the two UI components to clone: a radio-group card (persist to `/_api/generate/prefs`) + a model-download card (poll `/_api/generate/keyframe-model`).

### Files to Create

- `plugins/design/skills/footage-keyframes/SKILL.md` — the standalone skill (name `design:footage-keyframes`). Owns: pipeline description, the 3-tier/fallback model, the `maude design smart-frames` contract, the manifest schema, env knobs, and a "consumers reference this" pointer list.
- `apps/studio/bin/smart-frames.sh` — thin shim (mirror `probe-footage.sh`): prefer `node`, fall back to `bun`, exec `_smart-frames.mjs`. `--help` header.
- `apps/studio/bin/_smart-frames.mjs` — the engine: ffprobe metadata → tier selection (`--engine auto|gemma|ffmpeg|blind`) → timestamps → extract frames → emit superset manifest to stdout. Blind tier shells to `probe-footage`.
- `apps/studio/bin/_smart-frames.test.mjs` — unit test for the merge/dedup/cap math + tier-selection logic (pure functions; no clip needed). Mirror `_transcribe.test.mjs`.
- `apps/studio/generation/gemma-models.ts` — Gemma-4 MLX model registry + cache dir + list/resolve/download + `mlxVlmAvailable()` detection. Mirror `whisper-models.ts`.
- `plugins/design/commands/video-analyze.md` — the `/design:video-analyze` one-shot command (`name: design:video-analyze`, `category: daily`). Orchestrates smart-frames + transcribe + footage-analyst → combined visual+audio metadata sidecar + report.

### Documentation

- ffmpeg scene filter — `select='gt(scene,<0..1>)'` + `showinfo` → `pts_time`. Why: precise shot-cut timestamps (the ffmpeg-tier backbone).
- `scripts/video-benchmark/README.md` "The hybrid pipeline" section — Why: already documents the tier logic + knobs; the skill supersedes it and the README should link to the skill.

### Patterns to Follow

- **DDR-062 dispatch**: `maude design smart-frames <asset> --root <repo> [--out-dir DIR] [--frames N] [--engine auto|gemma|ffmpeg|blind]` — never a raw bin path in markdown.
- **DDR-045 path resolution**: any disk path in `_smart-frames.mjs` resolves relative to the bin dir / real disk, never a computed `import.meta` under `bun --compile`.
- **Soft-dep honesty (transcribe.sh precedent)**: the chosen engine is explicit and self-announcing; auto-detect degrades loudly in the manifest (`method` field) and on stderr, never silently.

---

## Design Decisions

### Tiered engine (the core decision — record as DDR ≈183, verify number at record time)

| Tier | Signal | Needs | When |
| ---- | ------ | ----- | ---- |
| `gemma` | scene cuts **+** Gemma semantic beats | ffmpeg **+** mlx-vlm + Gemma-4 MLX model (Apple Silicon) | opt-in; richest, catches beats inside continuous shots |
| `ffmpeg` | scene cuts + endpoints + long-shot midpoints | ffmpeg | **default** when ffmpeg present; cross-platform, no download |
| `blind` | even-spaced (delegate to `probe-footage`) | Chromium (already shipped) | floor; neither ffmpeg nor Gemma installed |

`--engine auto` (default) probes availability: Gemma resolvable (`$MAUDE_MLX_PYTHON`/`python3 -c 'import mlx_vlm'` **and** a model) → `gemma`; else ffmpeg present → `ffmpeg`; else → `blind`. Explicit `--engine X` forces a tier and errors if its deps are missing (no silent downgrade when the user asked for a specific one). **Rationale**: honors "fallback to plain ffmpeg if you don't want to download Gemma"; keeps zero-dep floor so no regression for current `probe-footage` users; Gemma stays a niche Mac-only enhancement, not a hard dep on a Node/Bun plugin.

### `/design:video-analyze` — audio folding without breaking `reel`

The one-shot command combines picture + sound; the existing `footage-analyst` is deliberately **vision-only** (referenced by `/design:reel`, which must stay audio-free). Resolution: the analyst gains an **optional transcript input** — when `/design:video-analyze` hands it a whisper transcript, the analyst fills the `FootageAnalysis` AUDIO/`speech` field (a small additive schema field); when `/design:reel` spawns it **without** a transcript, it behaves exactly as today (vision-only). So audio is folded at the orchestration boundary, not baked into every analyst run. The command owns: source resolution (`<clip>` | `<folder>` | `--from-canvas`), engine passthrough (`--engine`, `--frames`), `--no-audio` skip, and the final human report. It **reuses** `smart-frames` + `transcribe` + `footage-analyst` — no new analysis engine.

### Naming (proposed — confirm at execute)

- Skill folder/name: `footage-keyframes` (`design:footage-keyframes`) — fits the `footage-*` family (`footage-analyst`, `footage-director`).
- Helper verb: `smart-frames` (`maude design smart-frames`) — descriptive; the `.sh`/`.mjs` share the basename.

### Manifest = superset of probe-footage (drop-in)

```jsonc
{ "asset": "assets/<sha8>.mp4", "durationSec": 8.0, "width": 1280, "height": 720,
  "method": "ffmpeg",                       // which tier actually ran
  "sceneCuts": [0.233, 6.533],              // ffmpeg scene-detect (empty in blind)
  "scoutBeats": [{ "t": 6.9, "what": "run play" }],  // gemma only (empty otherwise)
  "outDir": "/tmp/...",
  "frames": [ { "index": 1, "t": 0.0, "png": "…/f_01.png" }, … ] }  // probe-footage-compatible
```
`footage-analyst` already reads `frames[]`; the extra fields are additive and ignorable.

### Frame extraction engine

- `gemma`/`ffmpeg` tiers extract at exact timestamps with `ffmpeg -ss <t> -i <clip> -frames:v 1` (endpoints inclusive — the benchmark's endpoint fix).
- `blind` tier delegates to `probe-footage` (Chromium), so it needs no ffmpeg.
- The gemma scout spawns `python -m mlx_vlm.generate` (resolved via `$MAUDE_MLX_PYTHON`, default `python3`); model via `$MAUDE_GEMMA_MODEL` (default `mlx-community/gemma-4-e4b-it-4bit`). Never assume the benchmark's `/tmp` venv.

### Env knobs (documented in the skill)

`MAUDE_SMARTFRAMES_ENGINE`, `SCENE_THRESH` (0.3), `SCOUT_FPS` (4), `MAX_FRAMES` (12), `MAUDE_MLX_PYTHON`, `MAUDE_GEMMA_MODEL`.

### Studio Settings integration (mirror the whisper/Subtitles section)

- **Prefs**: add `keyframeEngine` (`auto|gemma|ffmpeg|blind`, default `auto`) alongside `transcriptionProvider` on `/_api/generate/prefs` (`readKeyframeEngine`/`writeKeyframeEngine`, a validator like `isTranscriptionProvider`). This is the persisted user choice.
- **Model download**: `/_api/generate/keyframe-model` GET (registry + downloaded state + `mlxVlmAvailable` + `ffmpegAvailable`) / POST (start download, closure-scoped in-flight progress — exactly `whisperDownload`'s shape). Model cache: Maude-managed, XDG-aware, per-machine, gitignored — same as whisper models.
- **UI**: two cards in `SettingsPanel.jsx` under a "Scene-aware keyframes" group — `KeyframeEngineCard` (radio-group → prefs) and `GemmaModelCard` (download + progress). The card **surfaces availability and sets expectations**: it names which tier will actually run (ffmpeg present → "ffmpeg tier active"), flags that the Gemma scout needs **Apple Silicon + mlx-vlm** (multi-GB model; `pip install mlx-vlm` is a manual step the app can't do for you — mirror whisper's "engine binary is still a soft dep, the MODEL half is one click"), and disables/annotates the download button when mlx-vlm is absent. Explicit choice, self-announcing, never a silent switch.
- **Config vs self-detect (the load-bearing split)**: the `smart-frames` helper, when it can see the served project's prefs, honors `keyframeEngine`; run standalone in a terminal it **ignores prefs and self-detects** — so power users get a zero-config terminal video analyzer and app users get the Settings choice. Neither path requires the other.
- **Bundle rebuild (CLAUDE.md rule)**: editing `client/panels/SettingsPanel.jsx` (+ any CSS) requires rebuilding the committed `dist/client.bundle.js` + `dist/styles.css` **release-minified** (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) in the same change — whatever is committed is what ships.

---

## Tasks

Execute in order. Each atomic and testable.

### Task 1: CREATE `_smart-frames.mjs` engine (pure logic + ffmpeg tier)

- **Do**: Node script. Parse args (`asset`, `--root`, `--out-dir`, `--frames`/`--max-frames`, `--engine`, `--scene-thresh`). ffprobe → `{durationSec,width,height}`. Implement the `ffmpeg` tier: run scene-detect, parse `pts_time`, compute the merged timestamp set (endpoints + inside-cut + long-shot midpoints, dedup 0.4 s, cap), extract each with `ffmpeg -ss`. Emit the superset manifest to stdout. Factor the merge/dedup/cap and tier-selection into **exported pure functions** for the test.
- **Pattern**: `_probe-footage-playwright.mjs` (manifest + arg shape), `hybrid.sh` (merge math), DDR-045 (paths).
- **Gotcha**: ffmpeg/ffprobe are soft — detect with `command -v`; if absent and tier resolved to `ffmpeg`, error with the install hint (brew/apt).
- **Validate**: `node apps/studio/bin/_smart-frames.mjs .design/assets/caaftv-local.mp4 --root . --engine ffmpeg` prints a manifest with `sceneCuts:[~0.233,~6.533]` and ≥5 frames incl. t=0.

### Task 2: ADD the `gemma` tier to `_smart-frames.mjs`

- **Do**: Resolve `$MAUDE_MLX_PYTHON`/`python3 -c 'import mlx_vlm'` + a model. Spawn the scout (`python -m mlx_vlm.generate --model … --video … --fps SCOUT_FPS --prompt <scout>`), parse `TIME=<sec>` **and** `M:SS |` beats (both formats — the benchmark parser), merge with scene cuts, set `method:"gemma"`, populate `scoutBeats`.
- **Pattern**: `hybrid.sh` scout prompt + `BEATS` parser.
- **Gotcha**: Gemma timestamps are coarse and cluster on static shots (benchmark finding) — cap contribution and always keep ffmpeg cuts as the precise backbone. If the scout errors/empties, degrade to the `ffmpeg` tier and note it in `method` + stderr.
- **Validate**: on Apple Silicon with mlx-vlm installed, `--engine gemma` yields `scoutBeats` non-empty and `method:"gemma"`; on a machine without it, `--engine auto` silently lands on `ffmpeg`.

### Task 3: ADD the `blind` tier (delegate to probe-footage)

- **Do**: When tier resolves to `blind` (no ffmpeg, no gemma) or `--engine blind`, shell to `maude design probe-footage` (resolve via the same maude-on-PATH contract) and re-emit its manifest with `method:"blind"`, `sceneCuts:[]`, `scoutBeats:[]`.
- **Pattern**: existing `probe-footage` manifest is already the frame shape — pass through.
- **Validate**: `--engine blind` returns evenly-spaced frames identical to today's `probe-footage` (no regression).

### Task 4: CREATE `smart-frames.sh` shim

- **Do**: Mirror `probe-footage.sh` — `--help` header, prefer `node` else `bun`, `exec` the `.mjs` with `"$@"`. Exit codes: 0 ok / 2 usage / 3 missing-forced-engine-dep / 4 decode error / 1 other.
- **Validate**: `bash apps/studio/bin/smart-frames.sh --help` prints usage; `maude design smart-frames` (after Task 5) dispatches.

### Task 5: WIRE the verb into `cli/commands/design.mjs`

- **Do**: Add `'smart-frames'` to `BIN_VERBS` with a comment block (cite this feature + the tier model). Add it to the `usage()` verb list line near `ingest-footage · probe-footage`.
- **Pattern**: the `probe-footage` entry (lines 83-89).
- **Gotcha**: NOT a `BOOT_VERBS` member (no dev server needed, like probe-footage).
- **Validate**: `node cli/bin/maude.mjs design smart-frames --help` runs the shim.

### Task 6: CREATE the `footage-keyframes` skill

- **Do**: `plugins/design/skills/footage-keyframes/SKILL.md`, `name: design:footage-keyframes`. Document: the problem (blind sampling misses beats), the 3-tier/fallback model + auto-detect, the `maude design smart-frames` contract + manifest schema, env knobs, and a **"Consumers"** section listing who references it (`/design:video-analyze`, `footage-analyst`, `/design:reel`, the benchmark). Standalone — a reader needs nothing else to use it.
- **Pattern**: `footage-director/SKILL.md` structure + frontmatter.
- **Validate**: frontmatter parses; `name:` has the `design:` prefix (DDR-006).

### Task 7: UPDATE `footage-analyst.md` to use the skill + helper (+ optional transcript)

- **Do**: Replace the §1 `maude design probe-footage` call with `maude design smart-frames` (same manifest → frames[]); add a one-line "frame selection is owned by skill `footage-keyframes` (scene-aware, Gemma-optional, ffmpeg-fallback)" pointer. Note the analyst can read `method`/`scoutBeats` as hints. **Add an OPTIONAL transcript input**: if the orchestrator hands a whisper transcript (only `/design:video-analyze` does), fill the `FootageAnalysis` AUDIO/`speech` field; absent one (e.g. `/design:reel`), stay vision-only exactly as today.
- **Gotcha**: keep backward-compatible — superset manifest; the transcript is opt-in so reel's vision-only contract is untouched. The `speech` field is additive to the sidecar schema (`apps/studio/footage/schema.ts`).
- **Validate**: reachability test still green; the agent doc invokes only `maude design …` (no raw bin path); a no-transcript run is byte-for-byte the old behavior.

### Task 8: REFERENCE the skill from the other consumers

- **Do**: `/design:reel` (`reel.md`) — add a pointer that per-clip frame extraction now flows through skill `footage-keyframes`. `scripts/video-benchmark/README.md` — link the productionized skill as the canonical version of the hybrid pipeline. `CLAUDE.md` — add `smart-frames` to the `apps/studio/bin/` helper table and the design entry-points list.
- **Validate**: grep confirms each consumer names `footage-keyframes` / `smart-frames`.

### Task 15: CREATE the `/design:video-analyze` one-shot command

- **Do**: `plugins/design/commands/video-analyze.md`, `name: design:video-analyze`, `category: daily`, `argument-hint: "<clip|folder> [--from-canvas] [--engine auto|gemma|ffmpeg|blind] [--frames N] [--no-audio] [--out <path>]"`. Body orchestrates: resolve source → `maude design smart-frames` (visual) → `maude design transcribe` unless `--no-audio` (audio) → spawn `footage-analyst` with the frames **and** the transcript → write the `FootageAnalysis` sidecar (now incl. `speech`) → print a human "what is this about" report (TL;DR + shots + on-screen text + audio + best moment). Reference skill `footage-keyframes` + `maude design transcribe` + agent `footage-analyst` in the body. Register in `plugins/design/CATEGORIES.md` (daily group table) and confirm `/design:help` renders it from the `category:` frontmatter.
- **Pattern**: `reel.md` (source resolution + agent fan-out + `maude design` verbs), but analysis-only (no director/codegen/critics).
- **Gotcha**: DDR-062 — invoke helpers via `maude design <verb>`, never raw bin paths (reachability test). Keep it a thin orchestrator; the intelligence lives in the skill + analyst.
- **Validate**: `/design:help` lists `/design:video-analyze`; a dry run on `.design/assets/caaftv-local.mp4` produces a sidecar with both visual shots and an audio/`speech` section; `--no-audio` skips transcribe.

### Task 9: CREATE `gemma-models.ts` (registry + cache + download + detection)

- **Do**: Mirror `whisper-models.ts`: a frozen Gemma-4 MLX registry (`gemma-4-e4b-it-4bit` default, `gemma-4-e2b-it-4bit` smaller), XDG-aware `gemmaModelsDir()`, `list/resolve/path`, and a `downloadGemmaModel` (multi-file HF snapshot of `mlx-community/<id>` — reuse the redirect-apex allowlist). Add `mlxVlmAvailable()` (resolve `$MAUDE_MLX_PYTHON`/`python3 -c 'import mlx_vlm'`) and `ffmpegAvailable()`.
- **Pattern**: `whisper-models.ts` (registry, dir, atomic download); `_smart-frames.mjs` Task 2 (mlx detection).
- **Gotcha**: multi-file snapshot ≠ whisper's single `.bin` — "downloaded" = the model dir exists + is non-empty. Apple-Silicon-only; never block on it.
- **Validate**: `listGemmaModels()` reports downloaded state; `mlxVlmAvailable()` is false on a machine without mlx-vlm and true on the dev Mac.

### Task 10: ADD prefs field + download route to `http.ts`

- **Do**: Add `keyframeEngine` to `/_api/generate/prefs` (GET returns it, POST validates `auto|gemma|ffmpeg|blind` + persists via `writeKeyframeEngine`). Add `/_api/generate/keyframe-model` (GET: registry + downloaded + `mlxVlmAvailable` + `ffmpegAvailable` + in-flight progress; POST: start download, closure-scoped `keyframeDownload` state).
- **Pattern**: `transcriptionProvider` prefs (3037-3054) + `whisperDownload` route (684-3262) — copy both shapes.
- **Gotcha**: privileged main-origin routes only — NOT in `CANVAS_SAFE_API` (DDR-088). Guard with the canvas-origin gate test.
- **Validate**: `curl /_api/generate/prefs` includes `keyframeEngine`; POST persists; `curl /_api/generate/keyframe-model` lists models + availability.

### Task 11: ADD the two Settings cards + rebuild the client bundle

- **Do**: In `SettingsPanel.jsx`, add a "Scene-aware keyframes" group with `KeyframeEngineCard` (radio `auto/gemma/ffmpeg/blind` → `/_api/generate/prefs`, mirror `TranscriptionEngineCard`) and `GemmaModelCard` (download + poll `/_api/generate/keyframe-model`, mirror `WhisperModelCard`). Surface availability (which tier runs; Apple-Silicon + mlx-vlm needed for Gemma; multi-GB; `pip install mlx-vlm` is manual). Add any CSS to `client/styles/4-components.css`. Then rebuild the committed bundle release-minified (CLAUDE.md rule): `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.
- **Pattern**: `TranscriptionEngineCard` + `WhisperModelCard`.
- **Gotcha**: don't boot the source dev-server without the `--release` rebuild afterward (it regenerates unminified dev bundles — CLAUDE.md).
- **Validate**: Settings shows the group; choosing an engine persists; download button gated on `mlxVlmAvailable`; desktop E2E (or agent-browser) reaches the new `data-testid`s.

### Task 12: WIRE `smart-frames` to honor the `keyframeEngine` pref (app) with terminal self-detect

- **Do**: When `--engine` is unset AND a served-project pref is resolvable, `_smart-frames.mjs` reads `keyframeEngine` from prefs; otherwise (standalone terminal) it self-detects (`auto`). An explicit `--engine`/`MAUDE_SMARTFRAMES_ENGINE` always wins.
- **Gotcha**: standalone MUST NOT require the app/prefs — that's the power-user path. Reading prefs is best-effort.
- **Validate**: with a pref set to `ffmpeg`, the app-driven run uses ffmpeg; a bare `maude design smart-frames <clip>` in a scratch dir self-detects with no prefs file.

### Task 13: ADD soft-deps to `dependencies.json`

- **Do**: Add `ffmpeg` (soft; `check: ffmpeg -version`; darwin `brew install ffmpeg`, linux apt/dnf; `fallbackBehavior`: "scene tier of `maude design smart-frames`; without it the extractor falls back to blind Chromium via probe-footage"). Add `mlx-vlm` (soft, opt-in; `fallbackBehavior`: "gemma scout tier; Apple-Silicon only; without it smart-frames uses the ffmpeg or blind tier"). `usedBy` both → the skill + helper.
- **Validate**: `node cli/bin/maude.mjs doctor` reports them as soft/optional, not blocking.

### Task 14: CREATE `_smart-frames.test.mjs`

- **Do**: `node --test` (mirror `_transcribe.test.mjs`). Cover the pure functions: merge (endpoints always present; inside-cut offset; long-shot midpoints), dedup within 0.4 s, cap-to-N even subsample, beat-parser (both `TIME=` and `M:SS |`), and tier auto-selection given faked availability flags (incl. the pref-vs-self-detect precedence from Task 12).
- **Validate**: `node --test apps/studio/bin/_smart-frames.test.mjs` passes.

---

## Validation

Run to confirm zero regressions:

1. **Reachability guard**: `node --test cli/lib/plugin-cli-reachability.test.mjs` — 0 offenders (no raw bin invocation snuck into the new/edited markdown).
2. **Unit**: `node --test apps/studio/bin/_smart-frames.test.mjs` — merge/dedup/cap/parser/tier logic.
3. **CLI dispatch**: `node cli/bin/maude.mjs design smart-frames --help` and `… design help` list the verb.
4. **Real extraction, all three tiers** on `.design/assets/caaftv-local.mp4`:
   - `--engine ffmpeg` → manifest with the two real cuts + endpoint frames (incl. the t=0 game shot).
   - `--engine blind` → matches today's `probe-footage` output (no regression).
   - `--engine gemma` (Apple Silicon w/ mlx-vlm) → `scoutBeats` populated; on a bare machine `--engine auto` degrades to ffmpeg/blind without error.
5. **Consumer smoke**: run the `footage-analyst` path (or `/design:reel` on a tiny clip folder) and confirm it consumes the new manifest and still watches frames in t-order.
5b. **`/design:video-analyze` end-to-end**: on `.design/assets/caaftv-local.mp4`, one command produces a sidecar with visual shots **and** an audio/`speech` section + a human report; `--no-audio` skips transcribe; `/design:reel` on the same clip stays vision-only.
6. **doctor**: `node cli/bin/maude.mjs doctor` — ffmpeg/mlx-vlm show as soft/optional.
7. **Settings UI**: `/_api/generate/prefs` round-trips `keyframeEngine`; `/_api/generate/keyframe-model` lists models + availability; the Settings cards render, the engine radio persists, and the Gemma download button is gated on `mlxVlmAvailable` (drive via agent-browser / desktop-e2e against the rebuilt bundle).
8. **Canvas-origin gate**: `test/canvas-origin-gate.test.ts` — the new privileged routes are NOT reachable from the canvas origin.
9. **Bundle committed**: `dist/client.bundle.js` + `dist/styles.css` rebuilt `--release` and committed (not dev-unminified).
10. **Manual**: a clip with an action beat *inside* a long continuous shot (no hard cut) — confirm the `gemma` tier surfaces a beat the `ffmpeg` tier misses (the raison d'être).

---

## Acceptance Criteria

- [ ] `maude design smart-frames` runs all three tiers; `auto` degrades gemma→ffmpeg→blind with no crash on a machine that has neither ffmpeg nor Gemma.
- [ ] Manifest is a strict superset of `probe-footage`'s → `footage-analyst` consumes it unchanged.
- [ ] Standalone `design:footage-keyframes` skill documents the whole contract; `footage-analyst`, `/design:reel`, benchmark README, and CLAUDE.md all **reference** it.
- [ ] **Studio Settings** has a "Scene-aware keyframes" section: engine radio-group persisted to `keyframeEngine`, a Gemma-model download card (progress + availability), and clear notice of what runs / what Gemma needs (Apple Silicon + mlx-vlm) — mirroring the Subtitles/whisper section.
- [ ] Helper honors the `keyframeEngine` pref when app-served; **self-detects deps standalone** in a terminal with no app/prefs (power-user path intact).
- [ ] `/design:video-analyze` runs the whole workflow in one command — smart-frames + transcribe + footage-analyst → a combined **visual + audio** metadata sidecar + human report; `--no-audio` skips transcription; listed in `/design:help`. `/design:reel` stays vision-only (no transcript passed).
- [ ] ffmpeg + mlx-vlm added as **soft** deps (no new hard dep; no regression for users of neither).
- [ ] Committed `dist/client.bundle.js` + `dist/styles.css` rebuilt `--release`.
- [ ] `plugin-cli-reachability.test.mjs` + `_smart-frames.test.mjs` + `canvas-origin-gate.test.ts` green.
- [ ] `whats-new.json` entry added (user-visible Settings addition) via the `whats-new-entry` skill on `/done`.
- [ ] DDR (≈183, verify) recorded for the tiered-engine decision.
- [ ] No blind-sampling regression: `--engine blind` == current `probe-footage`.

---

## Risks

- **mlx-vlm as a plugin dep is unusual** (Python, Apple-Silicon-only) — mitigated by making it strictly opt-in soft with ffmpeg as the real default and a zero-dep floor. Do NOT let any code path hard-require it.
- **ffmpeg not currently a plugin dep** — the scene tier introduces it; the blind floor keeps ffmpeg-less machines working, so it's additive, not breaking.
- **Gemma timestamp coarseness** (benchmark finding: over-samples static shots, thinks an 8 s clip is 39 s) — never trust scout timing for extraction; ffmpeg cuts are the precise backbone, scout only *adds* candidate beats.
- **Scope creep into analysis** — this feature is frame *selection* only; the metadata/analysis stays with `footage-analyst`. Keep the Sonnet step out of the helper.
- **Settings promises a runtime the app can't install** — the Gemma card downloads the MODEL but `mlx-vlm` (Python) is a manual `pip install` (mirrors whisper's binary being a soft dep). The card must SAY this and gate the button on `mlxVlmAvailable`, so a user isn't left with a downloaded model and no runtime.
- **Client bundle drift** — forgetting the `--release` rebuild ships a 3.6 MB dev bundle or stale UI. It's an explicit task + acceptance item.
- **Multi-GB download on non-Mac** — the Gemma tier is Apple-Silicon-only; on other platforms the card should present ffmpeg as the recommended tier and not push a model the machine can't run.
```

---

## Retro

- **What worked:** porting the proven benchmark `hybrid.sh` logic into `_smart-frames.mjs` made the core low-risk — the merge/dedup/cap math was already validated on real clips, so unit tests + live tier runs passed fast. Mirroring the whisper-model infra (registry / route / Settings card) made the app vertical mechanical.
- **What the security pass caught (the real value):** the defender found a CSRF spawn-storm DoS (fixed: `sameOriginRead` + TTL-cached probes); the attacker found the same DoS plus a model supply-chain gap (fixed: pinned revisions + HF-endpoint guard) plus the structural trifecta (F2). F2 forced the best architectural outcome: the user's "unify reel + video-analyze, no duplicate workflow" and the security fix are the SAME change — an egress-free (`tools: Read`) `footage-analyst` with the orchestrator owning all I/O. Two requirements, one design.
- **What to change next time:** the tiered-engine + Settings + security surface was genuinely bigger than a "Medium" plan — a heavy download route + a Python-runtime dep + an agent trust boundary each deserved their own DDR line up front. The plan under-weighted the agent-trust dimension (F2 only surfaced in review, not planning). For any feature that folds untrusted external content (video/audio/web) into an agent, add a planning checklist item: "which agent ingests this, and does it have egress?"
- **Deferred (honest):** a live visual drive of the new Settings "Video" tab (routes + build verified, render low-risk); path-scoping the analyst's `Read` to the frames dir (framework gap — the residual weak read-echo channel is documented + accepted).
- **Verification held up:** tsc baseline unchanged (0 new) across ~10 touched TS files; full dev-server suite 2904/0-fail after the security fixes; both new privileged routes verified against the compiled binary with correct same-origin + availability gating.
