# Video-analysis benchmark

Takes **one clip**, has each contestant produce visual+audio metadata + a "what is
this about" report, and measures **wall-clock / peak RAM / CPU load** per
contestant. Qualitative outputs are saved verbatim — the harness never judges
quality; you read the outputs yourself.

## Run

```sh
./bench.sh [video] [contestant ...]
# default video: .design/assets/caaftv-local.mp4 (8s, real Czech speech)
# default set:   gemma4-e2b gemma4-e4b qwen25-vl own-sonnet
./bench.sh ~/clip.mp4 gemma4-e4b own-sonnet          # pick a clip + subset
./bench.sh ~/clip.mp4 qwen3-omni                     # native audio+video (large MoE, may OOM on 16GB)
```

Output: `results/<slug>-<stamp>/REPORT.md` (metrics table + every contestant's raw
output + the whisper transcript for reference).

## Contestants

| name | model | modality | notes |
|---|---|---|---|
| `gemma4-e2b` | gemma-4-e2b-it-4bit (MLX) | native audio + native video | two passes (joint call is broken in mlx-vlm) |
| `gemma4-e4b` | gemma-4-e4b-it-4bit (MLX) | native audio + native video | bigger sibling |
| `qwen25-vl` | Qwen2.5-VL-7B-4bit (MLX) | **vision-only** (no audio) | strong local video baseline |
| `qwen3-vl` | Qwen3-VL-8B-4bit (MLX) | vision-only | optional |
| `qwen3-omni` | Qwen3-Omni-30B-A3B-4bit (MLX) | native audio+video (joint) | ~18GB, will likely OOM on 16GB |
| `own-sonnet` | Sonnet 5 via local `claude` CLI | keyframes + whisper transcript | the "own solution": ffmpeg + whisper → frontier text model |
| `hybrid` | Gemma scout + ffmpeg scene-detect → Sonnet | scene-aware frames + whisper | **the recommended pipeline** — see below |

Add/adjust models in the `REG` map at the top of `bench.sh`.

> **Productionized:** this hybrid pipeline now ships as skill **`footage-keyframes`**
> (`maude design smart-frames`) in the design plugin — three tiers (gemma → ffmpeg →
> blind), a superset-of-`probe-footage` manifest, and Studio Settings wiring. This
> harness is the proving ground; the skill is the canonical version consumers use.

## The `hybrid` pipeline (recommended)

Instead of blind frame-rate screenshots, understand the video's **dynamics** and
extract only the frames that carry meaning, then let Sonnet analyze that tight set:

1. **ffmpeg scene detection** (`select=gt(scene,SCENE_THRESH)`) → precise shot-cut
   timestamps (where the picture genuinely changes).
2. **Gemma semantic scout** (native video) → action-beat timestamps that are *not*
   hard cuts (a snap, a run, a reveal inside one continuous shot).
3. Merge (+ always the true first & last frame), dedup within 0.4 s, extract those
   exact frames.
4. **Sonnet** analyzes them **with their real timestamps** — so its shot times are
   accurate instead of hallucinated, and it reads far fewer frames.

Why it wins over `own-sonnet` (blind 16 frames): fewer, meaningful frames → fewer
Sonnet Read turns → **cheaper** (≈ $0.49 vs $0.61 on the test clip) with **accurate
shot boundaries** aligned to the real cuts. Audio is unchanged (whisper).

Knobs: `SCENE_THRESH` (0.3 — lower = more cuts), `SCOUT_FPS` (4 — Gemma scout
density), `MAX_SHOTS` (12 — hard cap on extracted frames), `GEMMA_MODEL`,
`SONNET_MODEL`. Note: on a mostly-static clip the Gemma scout can over-sample a long
still shot; raise `SCENE_THRESH` or lower `SCOUT_FPS` to lean on cuts alone.

## Controlling analysis density

How finely each model looks at the video is tunable:

```sh
BENCH_FPS=4 ./bench.sh clip.mp4              # sample 4 frames/sec instead of 2
```

- **`BENCH_FPS`** (default 2) drives everything: how many keyframes prep extracts
  (`fps × duration`, capped 24) AND Gemma's native `--fps`. Higher = denser temporal
  coverage → catches short shots sparse sampling misses (verified: at fps=1 Gemma
  called an 8 s clip "a football game"; at fps=4 it caught the interview shot). Cost:
  more prompt tokens + VRAM, slower. Gemma has an internal ceiling (~32 frames).
- Per-contestant overrides (env): **`FPS`** (Gemma native video), **`MAX_TOKENS`**,
  and for Qwen **`MAX_IMAGES`** (default 8) + **`IMG_WIDTH`** (default 512 — the token
  budget that keeps the 4bit build from degenerating).

```sh
FPS=4 MAX_TOKENS=1000 ./bench.sh clip.mp4 gemma4-e4b     # dense Gemma pass
MAX_IMAGES=12 IMG_WIDTH=448 ./bench.sh clip.mp4 qwen25-vl # more, smaller frames for Qwen
```

## How it works

- `lib/prep-inputs.sh` — ffmpeg extracts ~1 fps keyframes + a 16 kHz mono WAV;
  whisper.cpp transcribes it. Keyframes + transcript are the **own-pipeline** input;
  the WAV is reused by the MLX audio pass (MLX can't read an mp4 container directly).
- `lib/measure.sh` — wraps a command: 0.5 s RSS/CPU sampler over the process group +
  `/usr/bin/time -l` for authoritative peak RSS & CPU-seconds. No sudo → GPU/Metal
  utilization is **not** captured; the MLX-reported "Peak memory" (unified memory) is
  parsed from each run instead.
- `lib/task-prompt.txt` — identical task given to every contestant (shots / audio /
  tags / summary / best moment).
- Each contestant reloads weights from disk per invocation (no persistent server), so
  wall-clock is the real per-clip CLI cost.

## Dependencies

- `ffmpeg`, `whisper-cli` + a ggml model at `~/.cache/whisper-models/ggml-base.bin`
  (or `$MAUDE_WHISPER_MODEL`)
- Python venv with `mlx-vlm` (git main — needs the Gemma-4 audio fix, PR #931) at
  `/tmp/gemma4-test-venv` (or `$MAUDE_BENCH_VENV`)
- `claude` CLI on PATH (own-sonnet uses your subscription, no API key)

## Known local-stack gotchas (July 2026)

- mlx-vlm 0.6.4 (PyPI) has a Gemma-4 audio weight-shape bug — use **git main** (0.6.5+).
- mlx-vlm's `generate` CLI has **no `--top-p` / `--top-k`** flags (only `--temperature`).
- `--audio` can't read an mp4 — feed it the extracted `.wav`.
- The **joint** `--video`+`--audio` call silently drops audio for Gemma 4 — run two passes.
