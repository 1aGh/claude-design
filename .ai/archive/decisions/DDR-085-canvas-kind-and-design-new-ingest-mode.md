# DDR-085 — Canvas `kind` field + overloading `/design:new` with an annotation-ingest mode

**Status:** Accepted — 2026-06-03.
**Supersedes:** none. **First of its kind:** introduces the first canvas-`kind` concept in `.meta.json`.
**Related:** Phase 21 (sticky + standalone-text annotation vocabulary — the brief-writing primitives this mode reads); Phase 5.1 (annotation persistence to `<slug>.annotations.svg` — the file the reader parses); Phase 23 (canvas images + link chips — the media strokes the reader forward-reads so a later ingest picks them up without a reader change); [DDR-062](DDR-062-plugins-reach-executable-logic-via-maude.md) (`/design:new` reaches the reader via `maude design read-annotations`, never a raw bin path); [DDR-061](DDR-061-sidecar-cache.md) (the `brief_sha` short-circuit this mirrors for `annotations_sha`); [DDR-025](DDR-025-canvas-lib-single-source-in-dev-server.md) (the `@maude/canvas-lib` envelope the brief-board template imports).
**Instruments:** `plugins/design/commands/new.md` (mode resolution step 1.6, blank step 3.5, ingest step 6b, `kind`/`annotations_sha` stamps); `plugins/design/templates/brief-board.tsx.template` (the blank board envelope); `plugins/design/dev-server/bin/read-annotations.{mjs,sh}` (the headless SVG → JSON reader); `plugins/design/dev-server/test/read-annotations.test.ts` (the serializer-drift contract test); `cli/commands/design.mjs` (`read-annotations` verb dispatch).

## Context

A canvas was born only one way: from a text brief (`/design:new "<name>" "<brief>"`), which always generates artboards. There was no path to **start from a blank surface, sketch intent with sticky notes / text / arrows, and then ask Claude to read that sketch and propose designs into it** — the "brief board" the user asked for ("otevřít nový canvas na který můžu dělat jen annotations … pak do něj vložit návrhy").

Two facts made this newly possible without a server/schema change:

1. **Phase 21** shipped the sticky-note + standalone-text vocabulary — the two primitives a user reaches for to write a brief on the canvas.
2. **Annotations already persist machine-readably.** A sticky's text and a text node's content survive in `<designRoot>/<slug>.annotations.svg` as element text + `data-*` attributes with world coordinates (the `strokesToSvg` contract in `annotations-layer.tsx`). But they were **write-only** — nothing read them back as instructions.

So the gap was two coupled decisions: (a) how to mark a canvas as "this is a board to annotate, not a finished design," and (b) how to turn the annotations into generated artboards **in the same canvas**, next to the notes.

## Decision

### 1. A canvas `kind` field in `.meta.json` — additive, default `"canvas"`

Introduce `kind?: "canvas" | "brief-board"` on the canvas sidecar. This is the **first** canvas-kind concept in the project (verified — no prior kind field existed). It is purely additive and back-compatible: a brief board stamps `kind: "brief-board"`; normal generation stamps `kind: "canvas"` going forward, and **every consumer treats an absent field as `"canvas"`** so the thousands of existing kind-less canvases keep working untouched. The meta API already merge-preserves arbitrary fields (it round-trips `brief_sha`, `opt_out_scope`, …), so no producer/consumer plumbing was needed beyond the stamp + the one consumer (`/design:new` ingest detection). An optional file-tree badge for brief boards is deferred.

### 2. Overload `/design:new` with an ingest mode (Edit-into-active) — not a new verb, not a sibling file

`/design:new` resolves one of three modes in step 1.6:

- **normal** (default) — generate a new multi-artboard canvas file (unchanged).
- **blank** (`--blank`) — write an annotation-only board from `brief-board.tsx.template` (one empty framed `DCArtboard`, `kind: "brief-board"`), set it active, and **exit**. Skips UX research / envelope / generate / critic → **zero model cost**.
- **ingest** — when the **active** canvas is a `brief-board` whose `.annotations.svg` is non-empty (or `--from-annotations` on any active canvas): read the notes **verbatim**, generate artboards, and **Edit them into the same `.tsx`** below the brief frame. The annotation layer (a sibling file) is never touched, so notes stay floating over the inserted artboards.

Escape hatches: `--from-annotations` (force ingest on any active canvas), `--fresh` (ignore a board's notes, scaffold a new file). Identical-annotations re-ingest **short-circuits to a no-op** (a stamped `annotations_sha`, mirroring the step-3.6 `brief_sha` guard) so a re-run doesn't duplicate artboards.

The reader is a **headless, zero-dep Node cousin** of the browser parser `svgToStrokes` — a separate implementation of the same fixed `strokesToSvg` vocabulary (plain Node has no DOMParser, like `sanitizeAnnotationSvg` which is also regex-by-design). A contract test (`read-annotations.test.ts`) rebuilds strokes through the **canonical** serializer and asserts the reader recovers them, so any Phase-21/23/24 change to the SVG shape fails loud rather than silently drifting.

### Why these shapes (alternatives considered)

- **Canvas `kind` vs. a separate registry / directory convention** — a `.meta.json` field is the lightest possible marker: additive, already-persisted, already-read by the commands that need it. A naming convention (`*.brief.tsx`) or a separate index file would add a parallel source of truth to keep in sync. Rejected.
- **A dedicated `/design:brief-board` verb** vs. overloading `/design:new`. The user framed it as "přes třeba design:new" — they create AND fill a board through one command. A separate verb would split the loop across two commands the user has to remember and would duplicate `/design:new`'s name-resolution / server-lifecycle / critic machinery. Overloading keeps the mental model "one command makes/advances a canvas." Rejected the new verb.
- **Generating a sibling `.proposal.tsx`** vs. Edit-into-active. The user was explicit: "vložit do něj návrhy" — proposals belong *in the board they annotated*, so the brief and the result live together. A sibling file would re-split brief from result and orphan the annotation layer (named by the board's slug). Rejected the sibling.
- **Importing `svgToStrokes` for the reader** vs. a separate regex implementation. `svgToStrokes` lives in a React `.tsx` and needs a DOMParser — unusable headless. A second small implementation, pinned to the canonical serializer by the drift-guard test, is the same posture `sanitizeAnnotationSvg` already takes. Accepted, with the test as the safety rail.

## Consequences

- **Positive:** the brief board becomes a living brief — sketch intent on a blank surface, run `/design:new`, get matching artboards in place, keep annotating + re-ingesting. Verbatim discipline is preserved (CLAUDE.md): annotation text passes to `frontend-design` exactly, wrapped only in a `## User annotations (verbatim)` block with positional reading-hints, never paraphrased.
- **Back-compatible + low-risk:** `kind` is additive (absent ⇒ `"canvas"`); the normal `/design:new` path is byte-unaffected (mode resolution returns "normal" when no `--blank` and the active canvas isn't an annotated brief-board). The new bin + template ship via npm automatically (`plugins/design/dev-server` + `plugins/design/templates` are already in `package.json` `files`).
- **Reachability:** `/design:new` calls `maude design read-annotations` (DDR-062); the reachability test guards against a raw bin-path regression.
- **Scope honestly bounded (deferred):** v1 lays generated artboards in a single fresh row below the brief frame — spatially aligning each artboard under its source annotation cluster is deferred. Ingesting onto a *non-blank* existing canvas via `/design:edit` is a follow-up (the `--canvas-state` overlap-tagging path is built but unwired). No `/design:brief-board` verb. Annotations are never garbage-collected after ingest (they persist as the living brief).
- **Forward-compat seam:** the reader passes through unknown `data-tool` strokes (Phase 23 image/link chips) with their `href`/`url`/`title`, so dropping reference media on a brief board and ingesting it works the day Phase 23 lands — no reader change.

## Security review (Phase 22 — defender + adversarial pass)

Both a defender (OWASP-class) and an adversarial (trifecta-aware) review ran over the ingest path + the `POST /_api/canvas` browser-create endpoint (the UI add-on). The endpoint itself passed the defender audit (0 blockers): the single user value (`name`) is gated by one strict allowlist regex doing path + JSX + JSON-injection duty, `group` is allowlisted, and the route is main-origin-only (the untrusted canvas iframe origin 403s it — asserted in `canvas-origin-gate.test.ts`). Dispositions:

- **Ingest is an untrusted-content lane (the headline finding).** The annotation SVG is writable from the *segregated canvas origin* (and, in linked/hub mode, pushable by a peer — DDR-054). Phase 22 makes that previously-*inert* write (DDR-060 rated `/_api/annotations` "inert collab write") *live*: `read-annotations.mjs` feeds the text **verbatim** into the `/design:new` brief, which seeds `ux-research-agent` — an agent holding `WebFetch`/`WebSearch` + repo `Read`/`Bash` (the "lethal trifecta": private data + untrusted input + outbound channel in one loop). **Mitigation applied:** new.md §6b.2 now frames the annotation block as explicitly-delimited UNTRUSTED data with a do-not-execute/-fetch/-read instruction to the generation + research agents (the standard indirect-prompt-injection control), and clarifies that the "verbatim" contract is about transcription fidelity, not obedience. **Residual (tracked):** data-framing reduces but does not eliminate the risk; the architectural close is to run ingest-time research in an outbound-allowlisted (or no-repo-read) context. Until then, an annotated board ingested in **linked/hub mode** is a remote-reachable injection surface; solo mode requires local loopback write access. **This residual is the one open item for a follow-up decision** — it is a property of the ingest feature, not the create endpoint.
- **F2 (fixed) — group containment now asserts against the design root.** `createCanvas`'s containment backstop checked that the file resolved inside its *group* but not that the group resolved inside `designRoot`; a config with a traversing `newCanvasDir` / `canvasGroups[].path` (which is "allowlisted" because it came from config) could have escaped. `normalizeConfig` does not validate those paths. Fixed: `createCanvas` now rejects a group that resolves outside `designRoot` (regression test: `canvas-create-api.test.ts` "a config with a traversing newCanvasDir cannot escape"). Latent today (config isn't sync-scoped) — closed so a future config-sync can't re-open it.
- **NFC normalization (fixed, low).** `validateCanvasName` now `.normalize('NFC')`s before validating/writing, so a decomposed (NFD) name can't collide to the same on-disk path on APFS/HFS+ and bypass the 409 existence guard to silently overwrite a board.
- **CSRF (accepted posture, low).** The mutating POST has no `Origin`/`Sec-Fetch-Site` check — identical to every other dev-server write route (`/_api/export`, `/_api/annotations`). The `application/json` content-type forces a CORS preflight that a cross-origin browser POST can't satisfy (no CORS headers emitted); both listeners bind `127.0.0.1`. Impact ceiling is creating an inert blank board on your own machine. Consistent with the localhost-dev-tool threat model; a `Sec-Fetch-Site` guard on all write routes is a possible hardening, out of scope for this change.

## Validation

- `read-annotations.test.ts` — 15 round-trip assertions against the canonical `strokesToSvg` (text, sticky multi-line, pen/rect/ellipse/arrow/polygon bbox, empty → `[]`, entity decode, document order, `--canvas-state` overlap). Green.
- `maude design read-annotations` dispatch + full-chain non-empty round-trip verified; `design.test.mjs` green; reachability test green.
- `brief-board.tsx.template` substitutes + parses clean via `oxc-parser`; the full `--blank` step-3.5 mechanics (derive component name / slug / platform → substitute → parse-gate → stamp `kind:"brief-board"` with no `brief_sha` → set active) and the step-1.6 ingest detection + step-6b.2 verbatim-brief composition were simulated end-to-end against the real reader.
- Live render of an ingested board + cross-platform scenario (`canvas-brief-board`, web-desktop) covered in the Phase 22 validation pass.
