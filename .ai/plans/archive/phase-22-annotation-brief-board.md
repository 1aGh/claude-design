# Phase 22 — Annotation brief-board → `/design:new` ingest

> **Sequenced after [Phase 21](phase-21-annotation-vocabulary-figjam.md) (FigJam vocabulary).** Phase 21 ships sticky notes + standalone text — the two primitives a user reaches for to *write a brief on the canvas*. This phase makes those annotations machine-readable and lets `/design:new` turn them into generated artboards **in the same canvas**.
>
> Sibling: [Phase 23](phase-23-canvas-images-link-unfurl.md) (canvas images + link chips) — independent, planned together, can land in either order after Phase 21. The two compose: drop reference screenshots (Phase 23) onto a brief-board, annotate them (Phase 21), and ingest both here.
>
> **Decision record:** [DDR-085](../decisions/DDR-085-canvas-kind-and-design-new-ingest-mode.md) — canvas `kind` field + overloading `/design:new` with the ingest mode (Task 8).

## Description

Today a canvas is born from a text brief (`/design:new "<name>" "<brief>"`). There is no way to **start from a blank surface, sketch intent with sticky notes / text / arrows, and then ask Claude to read that sketch and propose designs into it**. The user wants a "brief board": a blank annotation-only canvas they fill with stickies ("hero needs a bigger CTA", "dark mode", "two columns here"), then run `/design:new` against — Claude reads the annotations and **inserts generated artboards into the same canvas, next to the notes**.

Two halves:

1. **Create** — `/design:new --blank "<name>"` writes an annotation-only canvas (one empty reference artboard + `kind: "brief-board"` in `.meta.json`), opens it active, and exits without generating/critiquing. The user annotates it with the Phase 5.1 / Phase 21 toolkit.
2. **Ingest** — running `/design:new` while a `brief-board` is active (or `--from-annotations` on any canvas) reads `<designRoot>/<slug>.annotations.svg`, extracts every sticky/text as **verbatim brief lines**, folds them into the generation brief, generates artboards, and **Edits them into the active canvas file** (not a new file). The annotation layer is untouched and stays on top.

The enabling fact (verified): annotation text is already persisted in a machine-readable form. A sticky's text and a standalone text node's content survive in `<designRoot>/<slug>.annotations.svg` as element text + `data-*` attributes, with world coordinates. A small zero-dep reader (`maude design read-annotations`) turns that SVG into structured JSON the command consumes.

## User Story

As a designer, I want to open a blank board, drop three sticky notes describing what each screen should do, then run `/design:new` and have Claude read my notes and lay out the matching artboards right there on the same board — so the board becomes a living brief that I sketch and Claude fills in, instead of me retyping my intent into a `"<brief>"` string.

## Problem

- **No blank surface.** `/design:new` always generates. There is no "just give me an empty annotated canvas" path. The user explicitly wants "otevřít nový canvas na který můžu dělat jen annotations".
- **Annotations are write-only today.** The user can draw stickies/text, they persist to `<slug>.annotations.svg`, but **nothing reads them back as instructions.** The text is sitting in a parseable SVG and no command ingests it.
- **No "fill the brief in place".** Even if Claude read the notes, `/design:new` writes a *new* file. The user wants proposals inserted *into the board they annotated* ("vložit do něj návrhy") so the brief and the result live together.

## Solution

| Concern | Approach |
| ------- | -------- |
| Blank board creation | `--blank` flag on `/design:new`. Writes `<designRoot>/<newCanvasDir>/<Name>.tsx` from a new `brief-board.tsx.template` (one empty `DCArtboard` framed "Brief — annotate me", faint hint text). Stamps `.meta.json` with `kind: "brief-board"`. Skips UX-research / envelope / generate / critic steps entirely — cheap, instant, no model cost. Sets active. |
| Read annotations | New zero-dep reader `plugins/design/dev-server/bin/read-annotations.mjs`, reachable as `maude design read-annotations "<rel-path>"`. Parses the canvas's `<slug>.annotations.svg` (regex over the fixed `strokesToSvg` vocabulary — text content, sticky `data-text`, `x`/`y`/`w`/`h`, `data-tool`, `stroke`/`fill` color) → JSON `[{ tool, id, x, y, w, h, text, color }]`. Optional `--canvas-state <path>` tags each annotation with the artboard it overlaps (forward-compat for ingesting onto a non-blank canvas). |
| Ingest detection | `/design:new` pre-flight: if the **active** canvas's `.meta.json` has `kind: "brief-board"` AND its `.annotations.svg` is non-empty → **ingest mode**. Escape hatches: `--from-annotations` forces ingest on any active canvas; `--fresh` forces normal new-file behavior even on a brief-board. |
| Compose brief verbatim | Per CLAUDE.md ("pass the user's input verbatim, do not paraphrase"), the reader's `text` strings become a `## User annotations (verbatim)` block in the generation brief — each line is the sticky/text content exactly, prefixed with a positional hint (`[top-left cluster]`, `[near artboard "X"]` when canvas-state present). The user's optional `$ARGUMENTS` brief is appended as additional context. |
| Insert into active canvas | Ingest generates artboards via the normal `frontend-design` path (step 6), then **Edits the generated `<DCSection>`/`<DCArtboard>` JSX into the existing brief-board `.tsx`** inside `<DesignCanvas>` — appended below the brief frame, offset so generated artboards don't sit under the annotation clusters. No new file. The `.annotations.svg` sibling is never touched, so notes stay floating on top. |
| Idempotent re-ingest | Keep `kind: "brief-board"` after ingest (the board stays a board you can keep annotating + re-run). Stamp `annotations_sha` on `.meta.json`; a re-run with byte-identical annotations short-circuits (mirrors the existing `brief_sha` short-circuit at new.md step 3.6). |
| Canvas `kind` field | New additive `.meta.json` field `kind?: "canvas" \| "brief-board"` (default `"canvas"`). Today there is **no** canvas-kind concept (verified) — this is the first. Consumers: new.md ingest detection. Optional file-tree badge deferred. |

**Out of scope (deferred):** auto-positioning generated artboards to spatially align with annotation clusters (v1 lays them in a fresh row below the brief frame); ingesting onto a *non-blank* existing canvas via `/design:edit` (the `--canvas-state` overlap-tagging path is built but the `/design:edit` wiring is a follow-up); a dedicated `/design:brief-board` verb (we overload `/design:new --blank`, matching the user's "přes třeba design:new"); deleting/garbage-collecting annotations after ingest (they persist as the living brief).

## Metadata

- **Type**: New Capability (annotation-driven generation)
- **Complexity**: Medium — mostly slash-command (markdown) + one new bin + one template + tests. No dev-server schema change, no new server route, no security surface.
- **App/Package**: `plugins/design` (command + bin + template) and `cli/` (one dispatch verb).
- **Depends on**: Phase 21 (sticky + standalone text vocabulary — the brief-writing primitives). Phase 5.1 (annotation persistence to `<slug>.annotations.svg`). Both prerequisites.
- **Parallel with**: Phase 23 (independent; no shared files except a forward-compat note in the reader).
- **Affected files**:
  - `plugins/design/commands/new.md` — add `--blank` flag (creation) + ingest-mode detection & flow + insert-into-active behavior. The bulk of the work.
  - `plugins/design/templates/brief-board.tsx.template` — **NEW** minimal annotation-only canvas envelope.
  - `plugins/design/dev-server/bin/read-annotations.mjs` — **NEW** zero-dep SVG → JSON annotation reader.
  - `plugins/design/dev-server/bin/read-annotations.sh` — **NEW** thin wrapper (`exec node "$(dirname)/read-annotations.mjs" "$@"`) so `maude design read-annotations` dispatches per DDR-062.
  - `cli/commands/design.mjs` — register the `read-annotations` verb in the `maude design <verb>` dispatch table.
  - `plugins/design/dev-server/test/read-annotations.test.ts` — **NEW** fixture round-trip (parse `strokesToSvg(...)` output, assert extracted text/coords; guard drift).
  - `cli/lib/plugin-cli-reachability.test.mjs` — assert new.md reaches the reader via `maude design read-annotations`, never a raw bin path (existing test extends to the new verb automatically; confirm).
  - `plugins/design/commands/help.md` + `plugins/design/CATEGORIES.md` — document `--blank` / ingest mode.

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `plugins/design/commands/new.md` — the orchestrator being extended. Key anchors: **step 0** pre-flight bootstrap detection (~line 62), **step 1** `prep.sh` config + `_active.json` resolution (~line 78), **step 3** name + target-path resolution (~line 151), **step 3.6** `brief_sha` short-circuit (~line 159 — mirror this for `annotations_sha`), **step 4** opt-out scope (~line 193), **step 5** envelope build (~line 288), **step 6** generate preferred+fallback (~line 412), **step 11** `.meta.json` stamp (where `kind` + `annotations_sha` get written).
- `plugins/design/dev-server/api.ts:657-699` — annotation persistence. `annotationsPath(file)` → `<designRoot>/<fileSlug>.annotations.svg` (line 666-668); `loadAnnotations` (670). This is the file the reader parses. `fileSlug()` (252) is the slug rule — the reader must compute the same slug, OR (cleaner) take the already-resolved slug from `slug.sh`.
- `plugins/design/dev-server/annotations-layer.tsx:53-100` — the `Stroke` union (`PenStroke`/`RectStroke`/`EllipseStroke`/`ArrowStroke`/`TextStroke`; + `StickyStroke` after Phase 21). The reader's regex vocabulary must match what these serialize to.
- `plugins/design/dev-server/annotations-layer.tsx:136-196` — `esc()` + `strokeToSvgEl` + `strokesToSvg`. **The serialization contract.** Text node: `<text data-id data-tool="text" data-anchor-id data-font-size fill text-anchor="middle">TEXT</text>` (line 168-172). The reader extracts the element text content + `data-tool` + `fill` + position. Sticky (Phase 21) carries its text in a `foreignObject`/`data-text` — read whichever Phase 21 lands on.
- `plugins/design/dev-server/annotations-layer.tsx:222-294` — `svgToStrokes` (the canonical in-browser parser). The new `read-annotations.mjs` is a **headless, zero-dep cousin** of this. Mirror its defensive defaults; do NOT import it (it lives in a React `.tsx`).
- `plugins/design/dev-server/bin/slug.sh` — the canonical `<rel-path>` → slug recipe. `read-annotations` resolves `<designRoot>/$(slug.sh <path>).annotations.svg`. Reuse, don't reinvent.
- `plugins/design/templates/canvas.tsx.template` — the existing envelope template (header comment block + `DesignCanvas`/`DCSection`/`DCArtboard` skeleton). `brief-board.tsx.template` is a stripped sibling.
- `plugins/design/dev-server/canvas-lib.tsx:262-299` — `ArtboardRect` / `WorldContextValue.byId()` / artboards-in-render-order. World-coord model; relevant for `--canvas-state` overlap tagging.
- `cli/commands/design.mjs:110-120` — how `maude design <verb>` already shells to bin helpers (the `server-up` call at ~116 is the pattern); add `read-annotations` alongside.

### Files to Create

- `plugins/design/templates/brief-board.tsx.template` — minimal annotation-only canvas.
- `plugins/design/dev-server/bin/read-annotations.mjs` + `.sh` wrapper — headless annotation reader.
- `plugins/design/dev-server/test/read-annotations.test.ts` — reader fixtures.

### Documentation

- DOMParser is **not** available headless in plain Node; the reader uses targeted regex over the fixed annotation vocabulary (same posture as `sanitizeAnnotationSvg` in api.ts, which is also regex-based by design). <https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text>

### Patterns to Follow

- **Verbatim brief discipline** (CLAUDE.md "Design plugin"): the user's annotation text is passed to `frontend-design` **exactly**, never paraphrased or augmented with vibe references. The reader returns raw strings; the command wraps them in a `## User annotations (verbatim)` block and nothing more.
- **Short-circuit mirror** (new.md step 3.6): the `brief_sha` identical-brief guard is the template for `annotations_sha` identical-annotations guard. Same `find … -name '*.meta.json'` + `jq` shape.
- **DDR-062 reachability**: the command calls `maude design read-annotations`, never `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/read-annotations.sh"`. `cli/lib/plugin-cli-reachability.test.mjs` enforces this.
- **Bin ships via npm** (CLAUDE.md "published npm surface"): `plugins/design/dev-server` is already in `package.json` `files`, so the new bin ships automatically. No `files` edit needed.

---

## Tasks

Execute in dependency order. Dev-server tests run via `cd plugins/design/dev-server && bun test`.

### Task 1: CREATE `read-annotations.mjs` + `.sh` wrapper (the reader)

- **Do**:
  - `read-annotations.mjs` (zero-dep, Node-runnable): args `<rel-path-relative-to-designRoot>` `[--root <repo>]` `[--canvas-state <path>]` `[--json]` (default JSON).
  - Resolve designRoot (mirror server.mjs order: `--root` → `$CLAUDE_PROJECT_DIR` → `cwd`), compute the slug with the **same** rule as `slug.sh`, read `<designRoot>/<slug>.annotations.svg`. Missing file → emit `[]` (exit 0, not error — a board with no notes is valid).
  - Parse with regex matched to `strokesToSvg`: for each `<text …>…</text>` capture text + `data-tool` + `fill` + `x`/`y`; for each sticky group capture its text (per Phase 21's chosen storage) + `x`/`y`/`w`/`h` + color; emit `{ tool, id, x, y, w, h, text, color }`. Strokes without text (pen/rect/ellipse/arrow) emit with `text: null` (they convey position/grouping, not words).
  - `--canvas-state`: when given, read the canvas-state JSON for artboard rects and tag each annotation with `artboard: <id|null>` by bbox overlap.
  - **Forward-compat (Phase 23)**: emit `image`/`link` strokes too (pass through `href`/`url`/`title`) so a later ingest picks up dropped reference media without a reader change.
- **Do (`.sh` wrapper)**: `exec node "$(dirname "$0")/read-annotations.mjs" "$@"` (match the existing bin header style from `slug.sh`).
- **Pattern**: `sanitizeAnnotationSvg` (api.ts:221) for regex-over-known-vocabulary discipline; `svgToStrokes` (annotations-layer.tsx:222) for defensive defaults.
- **Gotcha**: HTML-entity-decode the captured text (`esc()` writes `&amp;`/`&lt;`/`&gt;`/`&quot;` — reverse them) so the brief reads as the user typed it.
- **Validate**: `bun test test/read-annotations.test.ts`.

### Task 2: TEST the reader against the canonical serializer (drift guard)

- **Do**: In `read-annotations.test.ts`, build strokes → run them through the **canonical** `strokesToSvg` (import from `annotations-layer.tsx`) → write to a temp file → run the reader → assert extracted `{ tool, text, x, y, color }` matches the inputs. Cover: standalone text, sticky (multi-line), a pen/rect with `text:null`, an empty SVG (`[]`), an entity-laden string (`A & B < C`), and a `--canvas-state` overlap case.
- **Gotcha**: this test is the contract that keeps the headless reader in sync with the browser serializer — if Phase 21/23 change the SVG shape, this test fails loud.
- **Validate**: `bun test test/read-annotations.test.ts`.

### Task 3: REGISTER the `read-annotations` verb in `maude design`

- **Do**: Add `read-annotations` to the `maude design <verb>` dispatch in `cli/commands/design.mjs`, resolving `dev-server/bin/read-annotations.sh` from maude's package root and setting `CLAUDE_PLUGIN_ROOT` (mirror how `server-up`/`screenshot` dispatch). stdout/exit-code pass through for `$(…)` capture.
- **Validate**: `node cli/bin/maude.mjs design read-annotations --help` runs; from a target repo with a `.design/` containing an annotated canvas, `maude design read-annotations "ui/Foo.tsx"` emits JSON.

### Task 4: CREATE `brief-board.tsx.template`

- **Do**: A stripped `canvas.tsx.template`: same `@canvas`/`@ds`/`@platform` header block (so docs tooling still parses it) with `@kind brief-board`, importing `DesignCanvas`/`DCSection`/`DCArtboard` from `@maude/canvas-lib`, rendering **one** empty `DCArtboard` (`id="brief"`, label `"Brief — annotate me"`, 1280×800) containing faint centered hint text ("Drop sticky notes, text & arrows here, then run /design:new"). No tokens dependency beyond the envelope; no DS-specific classes.
- **Gotcha**: the world needs ≥1 artboard so fit-to-screen has bounds; an empty `<DesignCanvas/>` renders a void with nothing to zoom to.
- **Validate**: rendering the template (drop it into a scratch `.design/ui/` + open) shows one empty framed artboard with the hint; annotation tools work on it.

### Task 5: ADD `--blank` creation path to `new.md`

- **Do**: Parse `--blank` from `$ARGUMENTS`. When present: resolve name + target path (step 3) as normal, then **short-circuit** — write the canvas from `brief-board.tsx.template`, stamp `.meta.json` with `kind: "brief-board"`, `brief: "<name>"`, `designSystem`, `platform`; **skip** steps 4.5 (UX research), 5 (envelope), 6 (generate), 9 (screenshots), 10 (critic). Set active (the standard "click it in the file tree / it's now the active canvas" close-out). Print a next-step hint: *"Blank brief-board created. Annotate it (sticky `N`, text `T`), then run `/design:new` again to have Claude read your notes."*
- **Gotcha**: `--blank` is mutually exclusive with a generation brief — if both `--blank` and a `"<brief>"` are passed, the brief becomes the board's seed hint text (not a generation input). Document this.
- **Validate**: `/design:new --blank "Checkout brief"` produces `<dir>/Checkout brief.tsx` (brief-board) + `.meta.json` `kind:"brief-board"`, no model generation cost, board opens active.

### Task 6: ADD ingest-mode detection + flow to `new.md`

- **Do**:
  - **Detect** (step 0/1): after resolving the active canvas, read its `.meta.json`. If `kind == "brief-board"` AND `<slug>.annotations.svg` exists and is non-empty → set `INGEST=1`. `--from-annotations` forces `INGEST=1` on any active canvas; `--fresh` forces `INGEST=0`.
  - **Short-circuit** (mirror step 3.6): compute `annotations_sha` of the SVG; if it matches the canvas's stamped `annotations_sha`, the board was already ingested with these exact notes — print the existing artboards + exit (Auto-Mode default = re-run, like step 3.6's `(b)`).
  - **Compose brief**: `BRIEF_JSON=$(maude design read-annotations "<active-rel>" --canvas-state <state-path>)`. Build a `## User annotations (verbatim)` block: one line per stroke with `text != null`, each prefixed with a positional hint. Append any `$ARGUMENTS` brief as `## Additional brief`.
  - **Generate**: run step 6 (`frontend-design`) with this composed brief.
  - **Insert into active**: instead of writing a new file, **Edit** the active brief-board `.tsx` — insert the generated `<DCSection>`/`<DCArtboard>` JSX inside `<DesignCanvas>`, after the existing brief frame, with world-coord offsets that clear the annotation clusters (place in a new row below the lowest annotation `y`). Re-stamp `.meta.json` `annotations_sha` + `last_ingest`.
- **Pattern**: step 6 generation is reused as-is; only the *destination* changes (Edit-into-active vs Write-new). The critic loop (step 10) still runs on the inserted artboards.
- **Gotcha**: the dev-server file-watcher hard-reloads the canvas iframe on `.tsx` change — the annotation layer (`.annotations.svg`, separate file) is preserved across the reload, so the notes stay floating over the freshly inserted artboards. Verify this in the smoke step.
- **Gotcha**: `frontend-design` returns a full-canvas file by default; the ingest path must extract only the artboard subtree to splice in (or prompt it to emit just `<DCSection>` children). Specify the splice contract in the prompt.
- **Validate**: manual — create blank board, add 2 stickies, run `/design:new`, observe generated artboards appear below the notes in the same canvas; notes still floating.

### Task 7: DOC + help sweep

- **Do**: Document `--blank` + ingest mode in `plugins/design/commands/help.md` and `plugins/design/CATEGORIES.md` (new.md's argument-hint frontmatter gains `[--blank] [--from-annotations] [--fresh]`). Add a "Phase 22 follow-up" note nowhere needed — but if the ingest splice contract proves non-obvious, write a DDR (see below).
- **Validate**: `/design:help` lists the new flags.

### Task 8: DDR — canvas `kind` + `/design:new` ingest mode

- **Do**: Record a DDR for two coupled decisions: (1) introducing a canvas `kind` field in `.meta.json` (first kind concept; default `"canvas"`, additive, back-compatible), and (2) **overloading `/design:new` with an ingest mode** (detected via `kind` + non-empty annotations) that Edits into the active canvas rather than writing a new file — vs. the alternatives considered (a dedicated `/design:brief-board` verb; generating a sibling `.proposal.tsx`). Note the user chose "into the same canvas". Cross-link Phase 21 (vocabulary) + Phase 23 (the reader's forward-compat for media strokes).
- **Validate**: DDR file created + linked from this plan + STATE.md History.

---

## Validation

1. **Types**: `cd plugins/design/dev-server && bun run tsc --noEmit` (reader is `.mjs`, but the test imports `strokesToSvg` — keep types clean).
2. **Tests**: `cd plugins/design/dev-server && bun test --bail` — reader fixtures green, no regressions.
3. **CLI**: `node cli/bin/maude.mjs design read-annotations --help`; round-trip against a real annotated canvas.
4. **Reachability**: `node --test cli/lib/plugin-cli-reachability.test.mjs` — new.md uses `maude design read-annotations`, no raw bin path.
5. **Smoke (DDR-021)**: `/design:smoke` after the template + (if any) dev-server touch.
6. **Cross-platform scenario**: new `.ai/scenarios/canvas-brief-board/spec.md` — create blank board → annotate → `/design:new` ingest → artboards inserted in same canvas, notes preserved. Web-desktop only (annotation tooling is mouse+keyboard; ios/android skip with justification).
7. **Manual**: `--blank` costs zero model tokens (no generation); `--fresh` on a brief-board produces a new file; identical re-ingest short-circuits.

---

## Scenario Coverage

**New scenario** (`.ai/scenarios/canvas-brief-board/spec.md`):

- `/design:new --blank "Onboarding brief"` → empty framed board opens active.
- Pick Sticky (N) → drop "Step 1: email + password" → drop "Step 2: verify code" → pick Text (T) → "primary blue, rounded buttons".
- Run `/design:new` (no args) → ingest fires → 2+ artboards generated and inserted below the notes in the **same** canvas → stickies/text still floating on top.
- Reload iframe → both the inserted artboards (`.tsx`) and the annotations (`.annotations.svg`) persist.
- Re-run `/design:new` with notes unchanged → short-circuit message, no duplicate artboards.

Web-desktop only required; native mobile/tablet skipped (justified).

---

## Acceptance Criteria

- [ ] All 8 tasks complete.
- [ ] `maude design read-annotations` emits structured JSON from a canvas's `.annotations.svg`; missing file → `[]`; reader test green against canonical `strokesToSvg`.
- [ ] `/design:new --blank "<name>"` creates a `kind:"brief-board"` canvas with zero model cost, opens active.
- [ ] `/design:new` on an annotated brief-board ingests notes verbatim and **inserts** generated artboards into the **same** canvas; `.annotations.svg` untouched.
- [ ] `--from-annotations` / `--fresh` escape hatches work; identical-annotations re-ingest short-circuits.
- [ ] `bun test --bail` green; `bun run tsc --noEmit` clean.
- [ ] Reachability test passes (no raw bin path in new.md).
- [ ] `/design:smoke` passes; scenario `canvas-brief-board` 0 blockers web-desktop.
- [ ] DDR (canvas `kind` + ingest mode) written + cross-linked.
- [ ] `help.md` + `CATEGORIES.md` document the new flags.
- [ ] No regression in normal `/design:new` generation (the default, non-blank, non-ingest path is byte-unaffected).

---

## Retro

- **The plan's "no security surface" line was wrong — twice.** The adversarial review found the ingest path is a real untrusted-content → LLM-prompt lane (annotation text writable from the segregated canvas origin / hub-pushable, fed verbatim to `ux-research-agent` which holds WebFetch + repo Read = the trifecta). Lesson for `/flow:plan`: **any "read user content into a generation/agent prompt" step is a model-input trust boundary** — name it in the threat model, never assert "no security surface" for a feature that ingests content. Mitigated here with data-framing (new.md §6b.2) + a tracked architectural residual in DDR-085.
- **A mid-flight user request grew a second feature with its own security surface.** "Can't I create a canvas directly in the UI?" → a new `POST /_api/canvas` write endpoint. Handled as a proper extension (own helpers + 33 tests + defender+attacker pass + DDR section) rather than a quick bolt-on. The defender passed it 0-blockers; the attacker found F2 (group containment asserted against the group, not designRoot) — fixed. Lesson: a "just add a button" ask that crosses a write/trust boundary deserves the full gate, not the quick path.
- **The committed-bundle footgun bit repeatedly.** `dist/client.bundle.js` + `styles.css` are committed **minified**, but `bun run build.ts` (dev mode) emits unminified, and server-booting tests/live-checks self-heal-rebuild + clobber `dist`. The durable rule: **rebuild the minified bundles as the very last step before staging**, and `git checkout` the runtime/comment-mount churn (never commit a dev-mode or test-boot bundle). Cost a few revert/rebuild cycles before internalizing.
- **Single-source-via-text-import worked cleanly.** `import tpl from '../templates/brief-board.tsx.template' with { type: 'text' }` resolves at dev runtime AND embeds into the `bun --compile` binary — one template file feeds both `/design:new --blank` (sed) and the server endpoint, DDR-045-safe, no drift. Good pattern to reuse for any "ship a fixed text asset into the binary" need.
- **Two slug implementations drifted.** The headless reader + `api.ts` use `/\s+/→_` (collapse runs); `slug.sh` uses `tr ' ' '_'` (per-space). They agree on single-space names, diverge on doubles — caught in code review, mitigated by collapsing internal spaces in `validateCanvasName`. Lesson: a "compute the same slug two ways" smell is worth a shared source; flag it earlier.
- **Live agent-browser verification substituted well for the formal 5-platform scenario.** The brief-board render + the create-from-UI happy/error paths were proven with real screenshots in a scratch repo — right-sized for a dev-tool annotation flow that has no native mobile/tablet surface (consistent with prior plugin-change History rows marking the 5-platform scenario N/A).
- **Deferred (intentional):** the `.ai/scenarios/canvas-brief-board/spec.md` formal scenario (live verification done instead); the F1 architectural close (outbound-allowlisted ingest research context) — tracked in DDR-085; and the **receiver-side share-consent / untrusted-inbox** idea the user raised (a peer accepts/rejects incoming shared canvases before they materialize) — scoped as a future **Phase 26** (touches DDR-054/060 trust model; needs its own plan + DDR).
