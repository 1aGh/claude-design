---
name: design:reel
category: daily
description: From a folder of raw clips (or the clips on the active canvas) to a directed, graphics-laden video cut — in one prompt. Ingests + content-addresses the footage, fans out the footage-analyst to WATCH each clip (vision keyframes), has the footage-director assemble an Edit Decision List, generates a Timeline-parseable `<TransitionSeries>` video-comp, and runs the motion + design critics. Vision-only (no audio analysis). Wraps `maude design ingest-footage`/`probe-footage` + the footage-analyst/footage-director agents + skill footage-director.
argument-hint: "<Name> [<folder-path>] \"<brief>\" [--from-canvas] [--target-seconds N] [--fps N] [--aspect 16:9|9:16|1:1] [--frames N] [--music assets/<sha8>.mp3] [--no-critic]"
---

# /design:reel — footage → director → cut, one prompt

Turns raw footage into a finished, editable cut. This is the **front half** the
`video-comp` skill never had: Maude **understands the footage first** (finds the
good shots, reads the character of each clip), then directs them like an editor
into a `<TransitionSeries>` composition with titles/graphics — which you can then
scrub on the Timeline and export to MP4 (DDR-148 capture spine, no binaries).

**Vision-only.** Analysis looks at frames, never audio. A music track (if you
pass `--music`) rides UNDER the finished cut as a plain `<Audio>` layer; it does
not drive the edit.

Load skill **`footage-director`** (the EDL vocabulary + codegen contract) and
skill **`video-comp`** (the Remotion iron rules) before generating.

## Input `$ARGUMENTS`

| Arg | Meaning |
|---|---|
| `<Name>` | Canvas name → `<designRoot>/ui/<Name>.tsx` + slug for `<slug>.edl.json`. |
| `<folder-path>` | A directory of raw clips to ingest (e.g. a Google-Drive-synced `…/podklady/video`). Omit if using canvas clips. |
| `"<brief>"` | Tone / purpose / must-includes ("30s calm rebrand reel, exterior-led, end on the logo"). Passed **verbatim** to the director + analysts. |
| `--from-canvas` | Instead of (or in addition to) a folder, use the video assets already referenced on the active canvas. |
| `--target-seconds N` | Desired cut length (default 20). |
| `--fps N` | Output fps (default 30). |
| `--aspect 16:9\|9:16\|1:1` | Output aspect → dimensions (default 16:9 → 1920×1080). |
| `--frames N` | Keyframes per clip the analyst samples (default 12; more for long clips). |
| `--music assets/<sha8>.mp3` | Optional music bed (must already be an ingested asset). |
| `--no-critic` | Skip the post-generation critic panel. |

## Step 0 — Pre-flight

1. Resolve config + designRoot (`maude design prep --shell-export --root "$REPO"` /
   `bootstrap-check`). Fail loud if there's no `.design/`.
2. Ensure the dev server is up and capture the port: `PORT=$(maude design server-up --root "$REPO")`.
   The analyst/director write through the loopback `/_api/footage` route on this port.

## Step 1 — Ingest the footage → content-addressed assets

- **Folder given:** `maude design ingest-footage "<folder-path>" --root "$REPO"`
  (add `--recursive` if the user says so). Parse the JSON manifest: `clips[]`
  (each `{asset, src, bytes, category}`) + `skipped[]`. **Surface the skipped
  list to the user** (oversized / unrecognised files — never silently dropped).
  Keep only `category === 'video'` clips for analysis (images/audio ingested for
  later use).
- **`--from-canvas`:** read the active canvas TSX and collect every
  `assets/<sha8>.<video-ext>` it references.
- Deduplicate. If **zero** video clips result, stop and tell the user.

## Step 2 — Analyze each clip (fan out the footage-analyst)

For each video clip, spawn `design:footage-analyst` (Task tool), **capped at 3–4
concurrent** (the setup-ds fan-out ceiling). **Cache:** skip a clip whose
`assets/<sha8>.footage.json` already exists (GET `/_api/footage?asset=<sha8>`
returns non-empty) — footage analysis is deterministic per clip hash, so
re-running `/design:reel` on the same folder re-probes nothing.

```
Task tool → subagent_type: "design:footage-analyst"
prompt: "ASSET=assets/<sha8>.mp4  ROOT=<repo>  PORT=<port>  BRIEF=\"<brief verbatim>\"  FRAMES=<--frames>.
         Probe the clip, watch the keyframes, write its FootageAnalysis sidecar via PUT /_api/footage.
         Return your JSON verdict."
```

Collect the verdicts. Drop clips that returned `{ error: "no video track" }`
(surface them). If **no** clip yielded a usable shot, stop and report.

## Step 3 — Direct the cut (footage-director → EDL)

Spawn `design:footage-director` **once**, after all analysts finish:

```
Task tool → subagent_type: "design:footage-director"
prompt: "ROOT=<repo>  PORT=<port>  SLUG=<slug>  BRIEF=\"<brief verbatim>\"
         TARGET={seconds:<--target-seconds>, fps:<--fps>, width:<W>, height:<H>}
         MUSIC=<--music or none>.
         Read every assets/*.footage.json, assemble the Edl, PUT it via /_api/footage?slug=<slug>.
         Return your JSON verdict."
```

## Step 4 — Generate the composition (codegen — skill `footage-director`)

Read the EDL (`GET /_api/footage?slug=<slug>`) and generate
`<designRoot>/ui/<Name>.tsx` following the skill's **EDL → `<TransitionSeries>`
codegen contract**: one **literal** `<TransitionSeries.Sequence name>` block per
beat (NEVER `.map()`), `<OffthreadVideo startFrom>` for each in-point, literal-sum
`TOTAL`, DS-token'd overlays, the `<Audio>` bed if `music` is set, and the
`<VideoComp>` meta from the EDL's fps/dimensions. Write a `<Name>.meta.json`
sidecar (title/subtitle/tags `["reel","video"]`) as `/design:new` does.

## Step 5 — Verify + critics

1. **Runtime health**: `maude design runtime-health --restart` (the comp must
   mount clean, not just parse).
2. **Motion over time** (DDR-094/DDR-148): screenshot two different frames (or
   scrub) and confirm the frame changes — a frozen video passes a single
   screenshot. 
3. Unless `--no-critic`: spawn the **motion-critic** (always — the comp animates)
   and **design-critic** on the canvas. Apply blocker fixes.

## Step 6 — Report

- The generated canvas path + the EDL path.
- Clips ingested / analyzed / used; beats; approx duration; anything skipped.
- Next step: **scrub** in the Player / Timeline (View → Timeline), tweak beats by
  hand, then `/design:export mp4 --scope artboard`.
- Surface the Remotion license note once (per `video-comp`).

## Notes

- The analyst/director are the only writers of the footage sidecars, over
  loopback — the route is main-origin-only (privileged), never canvas-reachable.
- Everything runs from this one command; each sub-step is independently
  re-runnable (analyses cache; the EDL + comp regenerate).
