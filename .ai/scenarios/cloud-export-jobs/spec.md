# cloud-export-jobs

**Persona:** a designer working on a project in the hosted cloud studio (a browser tab, someone else's machine) who opens ⌘E, exports a PNG and a ZIP, watches the notification center, and downloads both — the exact flow that returned `{"error":"not found"}` before feature-cloud-export-render-workers (DDR-230).

**Feature under test:** `feature-cloud-export-render-workers` (`.ai/plans/feature-cloud-export-render-workers.md`). The render-lane split (`apps/studio/exporters/jobs.ts` + `remote.ts`), the workspace-aware export dialog (`apps/studio/client/app.jsx` — `exportLane` from `/_config`), the reclassified job routes (`apps/hub/src/studio-manifest.mjs`), and the `maude-render` service (`apps/render/`).

**Canvas under test:** any real multi-artboard canvas in the project (e.g. `.design/ui/*.tsx`) — the export targets an artboard, so the scenario needs one canvas with at least one `[data-dc-screen]`.

## Hypothesis

- In a cloud tab with a render service configured (`exportLane: 'remote'`): the ⌘E dialog offers PNG/PDF/PPTX/ZIP; submitting PNG enqueues a job (`202 {jobId}` from `POST /_api/export-jobs`, no `404`), the notification center shows queued → running → done, and the finished PNG downloads with non-empty bytes and dimensions matching the artboard.
- ZIP in the same tab exports **in-cell** (no render service round-trip) and downloads a non-empty archive — proving the browser-free format is unaffected by the lane.
- In a cloud tab with **no** render service (`exportLane: 'none'`): the browser-format cards are disabled with the "needs the render service" note; ZIP stays enabled and works; nothing fires a request that 404s.
- **Desktop regression:** the same PNG export on the desktop app still runs the `local` lane (in-process capture) and produces a byte-identical result to a `local`-lane baseline — the remote path must not have changed desktop behavior.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1280×800 | ✓ (cloud studio in a desktop browser) |
| web-mobile | 390×844 | ✓ (the export dialog must be reachable + legible) |
| ios-phone / ios-tablet / android-phone | — | **SKIPPED** — no native cloud client surface; `platforms` in `.ai/workflows.config.json` is `["web-desktop"]`. Record `skipped: <reason>` per platform, never silently omit. |

## Preconditions

> This scenario needs a **live workspace cell (or self-hosted hub) with the `maude-render` service reachable** — it cannot run against a bare source dev-server, because the lane is `local` there and the whole point is the `remote`/`none` split. Two ways to stand it up:
>
> 1. **Self-host compose (cheapest):** `maude hub workspace-up --local --dev-minio --render --domain localhost --admin-email you@example.com`, then `docker compose up -d`. Gives a hub with the render sidecar on the compose network.
> 2. **Cloud pilot:** a real `<tenant>.cloud.maude.sh` project after `MAUDE_RENDER_URL` is set on the fleet and the tenant cell restarted (T12).
- Isolated `agent-browser --session cloud-export-jobs`, signed in as a member/owner (export is an all-roles capability, but the dialog needs a signed-in session — a bare viewer works too).
- For the desktop regression leg: a local desktop build or source dev-server (`local` lane) exporting the same canvas, kept as the byte-compare baseline.
- **Guard `apps/studio/dist/`** — `git status apps/studio/dist/` before AND after any source-server boot.

## Steps

1. **Open the cloud studio** (remote lane). Navigate to the workspace URL, open a canvas. Screenshot the shell.
2. **Open ⌘E.** Assert the dialog lists PNG, PDF, PPTX, ZIP as enabled cards, no "needs the render service" note. Screenshot.
3. **Export PNG (artboard scope).** Submit. Assert the network call is `POST /_api/export-jobs` returning `202 {jobId}` — NOT `404 {"error":"not found"}`. The dialog closes; the notification center shows the job. Screenshot the notification.
4. **Watch to completion.** Assert the job reaches `done` (queued → running → done via the `export:job` WS). Download it. Assert the file is a non-empty PNG whose pixel dimensions match the artboard (± device-scale). Screenshot.
5. **Export ZIP.** Submit ZIP (project-raw scope). Assert it also completes and downloads a non-empty archive — and (from the render service `/_health` `running`/`queued` counters, or a log) that it did NOT round-trip the render service.
6. **`none`-lane tab** (a second workspace with no render service, or the same one with `MAUDE_RENDER_URL` unset + restarted). Open ⌘E. Assert PNG/PDF/PPTX cards are **disabled** with the note, ZIP is enabled, and clicking a disabled card fires no request. Export ZIP → still works. Screenshot.
7. **Desktop regression.** On the desktop app (`local` lane), export the same canvas to PNG. Assert it completes in-process and the bytes match the `local`-lane baseline (same canvas, same scope, same scale) — the remote lane changed nothing on desktop.

## Success criteria

- Steps 1–5 PASS: the cloud export that used to 404 now enqueues, renders remotely, and downloads real bytes; ZIP exports in-cell.
- Step 6 PASS: the `none` lane is honest — disabled-with-reason, no 404, ZIP still works.
- Step 7 PASS: desktop `local` lane is byte-identical to baseline (no regression).
- `dist/` guard: no unintended bundle churn.
- Cross-platform parity: web-desktop + web-mobile PASS with parity; the 3 native platforms recorded SKIPPED with reason.

## Follow-ups (not blocking)

- A `remote`-lane MP4/WebM leg (video-comp) once the render image's Chromium video encode is confirmed against a real comp — deferred from this scenario because it needs a comp fixture and a longer render budget.
- Fidelity byte-compare of a `remote`-lane PNG vs a `local`-lane PNG of the SAME canvas (the plan's T5 pin) — belongs here once a stable shared fixture canvas exists on both a cloud project and a desktop checkout.
