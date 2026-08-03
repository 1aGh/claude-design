# Feature: Figma / FigJam import

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Bring **real Figma content** into Maude — not a screenshot of it. Two entry doors:

1. **One-click, token-backed (primary).** The user pastes a Figma personal access token once into Settings, then pastes a Figma file URL. Maude pulls the actual document JSON over the REST API and translates it deterministically into Maude artifacts.
2. **Local file (secondary, deferred).** A saved `.fig` / `.jam` binary is decoded offline — no token, no network, works on a file someone emailed you.

Both doors converge on **the same three translators**, because the thing that matters is not *where the node tree came from* but *what we turn it into*:

| Figma source | Maude target | Why this target |
|---|---|---|
| **FigJam board** (`STICKY`, `SHAPE_WITH_TEXT`, `CONNECTOR`, `SECTION`, `TEXT`, groups, images) | the **whiteboard annotation layer** (`annotations-model.ts` `Stroke` union) | Maude's whiteboard vocabulary is a close match for FigJam's primitives — **verified against a real board**, with one measured gap (connector endpoints, see § Verified findings). Highest fidelity, lowest risk, and the piece no competitor ships. |
| **Design frames** (`FRAME` / `COMPONENT` / `INSTANCE` subtrees) | a **`DCArtboard` canvas** (`.tsx` + `.meta.json`) | The "import my designs" ask. Figma node JSON carries `absoluteBoundingBox`, `layoutMode`, fills, strokes, effects and `style` — enough for a deterministic translation, no vision model. |
| **Paint / text / effect styles** (+ Variables where the plan allows) | **design-system tokens** via the existing `import-tokens` contract (DDR-172) | Reuses a shipped, security-reviewed mapping contract instead of inventing a second one. |

The load-bearing architectural choice: **the translation is 100 % deterministic code — no LLM anywhere in the ingestion path.** That is what makes this feature structurally safe in a way `/design:import --reconstruct` (DDR-174) could never be, and it is why this is a separate command mode, not an extension of that one.

## User Story

- As a **designer with an existing Figma library**, I want to **paste a Figma file URL and get my frames as real, editable Maude canvases**, so that adopting Maude doesn't mean redrawing everything.
- As a **team that runs its workshops in FigJam**, I want to **pull a board into Maude's whiteboard**, so that the brief, the retro, and the design live in one place.
- As a **designer whose brand lives in Figma styles**, I want **my paint/text/effect styles to become my Maude design system**, so that the first canvas I make is already on-brand.
- As a **user without API access to a file** (it was emailed to me, or it's an archived `.fig`), I want to **drop the file in and get the same result**, so that the import doesn't depend on a Figma seat.

## Problem

- **There is no real Figma path today.** `/design:import` has exactly one mode — `--reconstruct <image>` — which reads a **flattened PNG export** with a vision model and *re-authors* an approximation. It is explicitly labeled experimental, lossy, and non-deterministic (DDR-174). Everything Figma actually knows — layer structure, auto-layout, text content, exact colors, component boundaries, connector bindings — is discarded the moment the frame is rasterized.
- **The prior plan deliberately deferred this.** `feature-onboarding-and-design-system-migration.md` § Out of scope: *"Live Figma REST/plugin API bridge — P4 uses exported PNG/PDF, not a `.fig`/API client (a real API bridge would be its own plan)."* This plan **is** that plan.
- **The DS-import story stops at files the user has to produce by hand.** `import-tokens` (DDR-172) accepts W3C design-tokens / Style-Dictionary JSON / raw CSS custom properties. A designer whose tokens live as Figma *styles* has no export path that lands in those formats without a third-party plugin.
- **FigJam is a total blank.** Maude has a genuinely good whiteboard (`/design:board`, skill `whiteboard`, DDR-151) with stickies, shapes, bound connectors, sections and templates — and no way to get an existing board into it.

## Solution

Build a **Figma ingestion spine** whose network/decoding layer is swappable and whose translation layer is shared.

```
                 ┌─────────────────────────────────────┐
  PAT + URL ───▶ │ figma-client.ts   (REST, Phase 1)   │──┐
                 └─────────────────────────────────────┘  │   normalized
                 ┌─────────────────────────────────────┐  ├──▶ Figma node tree
  .fig / .jam ─▶ │ fig-decode.ts     (binary, Phase 6) │──┘    (one shape)
                 └─────────────────────────────────────┘                │
                                                                        ▼
        ┌───────────────────────┬───────────────────────┬───────────────────────┐
        │ figjam-to-strokes.ts  │ figma-to-artboard.ts  │ figma-to-tokens.ts    │
        │  → .annotations.svg   │  → .tsx + .meta.json  │  → W3C tokens JSON    │
        │    (Stroke model)     │    (DCArtboard)       │    → import-tokens    │
        └───────────────────────┴───────────────────────┴───────────────────────┘
```

Doing the **REST path first** is what makes the `.fig` path cheap later: by the time Phase 6 starts, a decoder only has to emit the same normalized node shape and it inherits all three translators for free. Building `.fig` first would mean building a translator against an undocumented, reverse-engineered format and then re-validating all of it against the documented one.

**Recommended scope for the first shipping increment: Phases 0–5 (REST API, all three translators, one-click UI).** Phase 6 (`.fig`/`.jam`) ships behind its own DDR because it introduces a reverse-engineered-format dependency with a real supply-chain and robustness cost — see § Open forks.

---

## Verified findings — real board, real model (2026-08-02)

Measured against a real FigJam board (`L868R9bJT2cED1dHhSsiwO` "Analýza", a persona / competitor-analysis / SWOT / moodboard workshop board) read through the official Figma MCP, cross-checked against `annotations-model.ts` + `annotations-bindings.ts` on disk. **These supersede any optimistic reading of the mapping tables above.**

### 🔴 The one real gap — connector endpoints

`isBindable()` (`annotations-bindings.ts:24`) admits exactly **`rect` · `ellipse` · `polygon` · `sticky` · `image`**. FigJam binds connectors to *anything*, including groups and text. On the sample board, **both connectors have at least one endpoint Maude cannot bind**:

| Connector | Start | End | Verdict |
|---|---|---|---|
| `301:170` | `457:608` — a **group** (`Group 13935`) | `457:608` — same group (degenerate self-connector) | neither end bindable |
| `473:353` | `405:756` — image-filled rect ✅ | `473:342` — a **TEXT** node ("Archetyp") | end not bindable |

That is 2/2 connectors degraded on the only real board measured. Two things make this survivable rather than fatal:

1. **The degradation is already implemented and honest.** `recomputeBoundArrows` strips an unbindable host and *"the arrow survives unbound"* with the endpoint frozen in place — geometry is preserved, only live re-routing is lost.
2. **Widening `isBindable` to include `text` (and possibly `section`) is a small, self-contained change** that needs no new geometry: both carry `x/y/w/h`, and `anchorPoint`/`bindCandidate` operate purely on `strokeBBox` + `strokeRotation`, which already handle them.

**Decision required in T1's DDR:** accept degradation-with-reporting, or widen `isBindable`. Widening is recommended — it improves the *native* whiteboard (today you cannot attach an arrow to a text label or a section, which is a plain product gap independent of import) and it is the difference between "the flagship mapping is 1:1" and "the flagship mapping loses the thing FigJam users care about". **Groups remain unbindable by construction** — Maude groups are a flat `groupIds[]` tag array, not addressable objects, so a group-targeted endpoint must fall back to the group's geometric bbox or degrade. Do not try to invent a group stroke for this.

### ✅ Confirmed — mappings that hold

- **Connector bindings are real node ids.** `connectorStart="457:608"` / `connectorEnd="473:342"` — exactly the shape `ArrowBind.hostId` wants. The T5 premise is sound; only the *host type* is constrained.
- **Arrowhead caps are an enum** — `connectorStartCap` / `connectorEndCap` observed as `NONE` and `ARROW_LINES`. Maps onto `canvas-arrowheads.ts`.
- **Groups map cleanly.** FigJam `<frame name="Group 13900">` → Maude's flat `groupIds[]` (deepest → shallowest, the Excalidraw tag model, `annotations-groups.ts`). No structural work needed.
- **Shape vocabulary observed** — `SQUARE` → `RectStroke`, `ELLIPSE` → `EllipseStroke`, `ROUNDED_RECTANGLE` → `RectStroke` + `cornerRadius`. All three land natively. FigJam's fuller set (diamond, triangles → `PolygonShape`; parallelogram / `ENG_*` → **no Maude equivalent**) needs the skip-and-report path.
- **Sticky colours are a named enum** — `STICKY_GRAY`, `STICKY_GRAY_UI3`, and `CUSTOM`. `StickyStroke.color` is a free-form string, so named values map directly.

### ⚠️ Constraints found

- **Nested sections are real.** `section 301:179` ("Více o [Jmeno]") contains **12 child sections**. `SectionStroke` is **flat** — no parent field. Survivable, because Maude sections work by *geometric containment* (dragging carries every stroke whose centre is inside), so nesting is implicit in the geometry. Drag semantics differ slightly from FigJam; name it, don't fight it.
- **Coordinates confirm the origin-translation gotcha is real, not theoretical.** The board spans x ≈ −3 244 … +11 037 and y ≈ −6 272 … +23 488 — roughly 14 000 × 30 000 world units. An untranslated import lands tens of thousands of px off-screen.
- **Sticky sizes differ.** FigJam default is **240×240**; Maude's `STICKY_DEFAULT_W` is **200**. Resized stickies also occur (815×470 observed). **Preserve absolute geometry** — do not normalise to Maude's default, or every layout collapses.
- **Text content doubles as the layer name.** MCP returns text in the `name` attribute (`name="Lorem ipsum dolor sit amet…"`); in Figma a TEXT node's layer name defaults to its content. This is attacker-controlled string data that Phase 3 would otherwise interpolate into JSX identifiers — **the sanitization requirement in T7 is load-bearing, not boilerplate**.

### 🎯 The architecture decision, re-confirmed by data

The MCP response is **structurally lossy in exactly the ways the translators need**: `color="CUSTOM"` carries no actual colour, image-filled shapes are identifiable only by a human-typed layer name (`"image 1"`, `"PXL_20210309_203454756 1"`), and no `fills` / `strokes` / `effects` appear at all. The REST API's `GET /v1/files/:key` returns all of it. **This is independent confirmation that REST is the correct door** — not merely the one that clears the rate-limit and allowlist hurdles.

---

## Metadata

- **Type**: New Capability (multi-phase program)
- **Complexity**: High
- **App/Package**: `apps/studio` (server + client), `plugins/design`, `cli`, `apps/desktop` (Settings surface only)
- **Affected Systems**: HTTP route table + canvas-origin allowlists, BYOK key custody (`generation/keys.ts`), asset ingestion (`import-asset` / `fetch-asset`), annotation model, canvas creation + `canvasKinds` badge plumbing, design-system token import, `/design:import` + `/design:board`
- **Dependencies**: reuses `generation/keys.ts` (BYOK custody), `bin/_import-asset.mjs` (`--kind raster`), `bin/_fetch-asset.mjs` (URL ingestion), `bin/_import-tokens.mjs` (DDR-172 mapping contract), `annotations-model.ts` (canonical serializer/sanitizer), `annotate.mjs` (the write discipline), `api.ts` `canvasKinds` (the DDR-174 badge plumbing)
- **New runtime deps**: **none in Phases 0–5** (Figma REST is plain `fetch`). Phase 6 needs a kiwi/zstd decode stack (`kiwi-schema` + `fzstd` + `pako`, or `@open-pencil/fig` / `fig-kiwi`) — each gets its own DDR + security review before adding, per this repo's standing rule (DDR-071 precedent).

## Out of scope (explicit)

- **Figma's official MCP server as the product's ingestion door.** Verified against the live server on the target Pro account (2026-08-02) and **ruled out on three independent grounds**, any one of which is disqualifying: (a) **200 tool calls/day · 15/min** for a Pro + Full seat — a research budget, not a production ingest path; one large file would exhaust it; (b) **client allowlisting** — only applications listed in the [Figma MCP Catalog](https://www.figma.com/mcp-catalog/) may connect, and the Maude dev-server will not be one; (c) **per-user OAuth session** — the server needs its own credential, not one borrowed from whichever editor the user happens to run. The MCP *is* useful as a **research instrument** during Phases 0–4 (validating the mapping tables against real documents before writing translator code) and that is the only role it has here. It must not appear in any runtime code path.
- **A published Figma plugin** that pushes the current selection from inside Figma to a local Maude endpoint. Highest fidelity for "what I'm looking at right now", no token, no file-size ceiling — but it is a separate distribution track (Figma Community review, its own versioning, its own update cadence). Named in § Open forks; not planned here.
- **Write-back to Figma.** One-directional only. Round-tripping is a different product.
- **Sketch / Adobe XD / Penpot.** The normalized-node-tree seam makes them possible later; none is planned.
- **Replacing `--reconstruct`.** It stays as the honest fallback for "all I have is a picture".

---

## Context References

### Must-Read Files

> During `/flow:execute`, read the group for the phase you're on **in parallel in one message**.

**Ingestion precedent + security posture (read before Phase 0):**
- `.ai/archive/decisions/DDR-167-local-file-svg-pdf-ingestion-security-posture.md` — the "threat model → mitigation → named residual" structure every ingestion DDR in this repo follows.
- `.ai/archive/decisions/DDR-172-token-file-import-mapping-contract.md` — the token mapping contract Phase 4 must feed rather than duplicate; also the wrapper-hygiene rules for a new `bin/*.sh`.
- `.ai/archive/decisions/DDR-174-vision-reconstruction-trust-boundary-and-experimental-posture.md` — Why: the contrast case. Its whole architecture exists because an *LLM* read untrusted input. Phase 1–5 must never reintroduce that; state the difference explicitly in the new DDR.
- `apps/studio/bin/_import-asset.mjs` — magic-byte sniff, containment write, pre-resolution-leaf symlink check. The gate every binary/raster byte must pass.
- `apps/studio/bin/_fetch-asset.mjs` — Why: Phase 3 downloads Figma-rendered images from S3 URLs; this is the existing URL-fetch gate and the SSRF chokepoint.
- `apps/studio/bin/_import-tokens.mjs` + `bin/import-tokens.sh` — the shape a new `import-figma.sh` mirrors (bun shim, quoted `"$@"`, numbered exit codes).

**API spine (Phase 1):**
- `apps/studio/generation/keys.ts` — `getProviderKey` / `setProviderKey` / `isConfigured`, the 0600 file + Tauri keychain bridge. The Figma PAT store, verbatim, no new custody mechanism.
- `apps/studio/generation/types.ts` (:18–54) — the provider descriptor shape (`auth`, `keychainService`); how a credential is injected at call time and never cached.
- `apps/studio/http.ts` (:3430 `/_api/generate/providers`, :3447 `/_api/generate/keys`) — the privileged, never-echoes-the-key route pattern the Figma routes copy.
- `apps/studio/server.ts` — the `startCanvasServer` `routes` map. Why: **the Figma routes must be in NEITHER allowlist** (see § Gotchas).
- `apps/studio/test/canvas-origin-gate.test.ts` — where the `GET → 405` assertion for the new routes goes.

**FigJam → whiteboard (Phase 2):**
- `apps/studio/annotations-model.ts` — `Stroke` union (:321), `StickyStroke` (:213), `RectStroke`/`EllipseStroke`/`PolygonStroke` (:115/:129/:148), `ArrowStroke` + `ArrowBind` (:161/:56), `SectionStroke` (:310), `TextStroke` (:182), `ImageStroke` (:245), `STICKY_PALETTE` (:511), `STICKY_DEFAULT_W` (:542). **The target vocabulary.**
- `apps/studio/bin/annotate.mjs` + `annotate.sh` — Why: the discipline is "import the canonical TS model so you can never emit a shape the canvas wouldn't". The Figma translator obeys the same rule.
- `plugins/design/skills/whiteboard/SKILL.md` — the read/write contract and the trust model for peer-authored board content.

**Frames → canvas (Phase 3):**
- `apps/studio/canvas-lib.tsx` — `DCArtboard` props (`width`/`height` are size-authoritative per DDR-027).
- `apps/studio/canvas-meta.schema.json` (:73 `layout.artboards[]`, :140) — positions only; sizes come from JSX.
- `.ai/archive/decisions/DDR-188-convert-children-to-absolute-position.md` — the absolute-positioning vocabulary a non-auto-layout Figma frame maps onto.
- `.ai/archive/decisions/DDR-181-artboard-kind-model-and-overlay-layer-contract.md` — picking the right artboard `kind` for an imported frame.
- `apps/studio/api.ts` `buildIndexData()` `canvasKinds` — the badge plumbing to reuse for an `imported-figma` stamp.

**One-click UI (Phase 5):**
- `apps/studio/client/panels/BrandUploadPanel.jsx` — the closest existing "upload external material" panel; the shape to mirror.
- `apps/studio/client/panels/SettingsPanel.jsx` — where the provider-key card lives.
- `apps/studio/client/panels/SetupChecklist.jsx` — the onboarding surface an "Import from Figma" entry should appear in.

### Files to Create

**Phase 1**
- `apps/studio/figma/client.ts` — REST client: hardcoded `https://api.figma.com/v1` base, PAT injection, typed responses, rate-limit backoff.
- `apps/studio/figma/url.ts` — parse `figma.com/{design,board,file,proto}/<key>/<slug>?node-id=…` → `{ key, nodeId?, kind }`.
- `apps/studio/figma/types.ts` — the **normalized node tree** both doors emit (the Phase-6 seam).
- `apps/studio/figma/client.test.ts`, `figma/url.test.ts`

**Phase 2**
- `apps/studio/figma/to-strokes.ts` — FigJam nodes → `Stroke[]` via `annotations-model.ts`.
- `apps/studio/figma/to-strokes.test.ts`
- `apps/studio/bin/_import-figma.mjs` + `bin/import-figma.sh` — the `maude design import-figma` verb.

**Phase 3**
- `apps/studio/figma/to-artboard.ts` — frames → `DCArtboard` JSX + `.meta.json`.
- `apps/studio/figma/style-map.ts` — Figma paint/effect/typeStyle → CSS, with nearest-token matching against the active DS.
- `apps/studio/figma/to-artboard.test.ts`, `figma/style-map.test.ts`

**Phase 4**
- `apps/studio/figma/to-tokens.ts` — styles (+ Variables when reachable) → W3C design-tokens JSON.
- `apps/studio/figma/to-tokens.test.ts`

**Phase 5**
- `apps/studio/client/panels/FigmaImportPanel.jsx`
- `apps/studio/test/figma-routes.test.ts`

**Phase 6 (deferred)**
- `apps/studio/figma/fig-decode.ts` + tests — container prelude → kiwi schema chunk → data chunk → normalized node tree.

**Docs / decisions**
- `.ai/archive/decisions/DDR-2NN-figma-ingestion-architecture-and-trust-boundary.md`
- `plugins/design/commands/import.md` — new `--figma` mode section.

### Documentation

- [Figma REST API — Authentication](https://developers.figma.com/docs/rest-api/authentication/) — Why: `X-Figma-Token` header for PATs vs `Authorization: Bearer` for OAuth; scope model.
- [Figma REST API — Personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/) — Why: **`file_content:read` is the scope to ask for.** The blanket `files:read` scope is deprecated in favour of granular scopes; do not instruct users to grant it.
- [Figma REST API — Rate limits](https://developers.figma.com/docs/rest-api/rate-limits) — Why: costs, not raw counts. `FILE_COST = 50` → ~120 req/min · 24 000/day per user; `IMAGE_COST = 200` → ~**30 req/min** · 6 000/day. The images endpoint is the tight one — batch ids, never loop one-per-node. Limits were re-tiered 2025-11-17 and vary by seat type and resource plan.
- [Figma REST API — Components and styles](https://developers.figma.com/docs/rest-api/component-types/) — Why: the Phase-4 style payload shape.
- [Figma REST API — Changelog](https://developers.figma.com/docs/rest-api/changelog/) — Why: check before implementing; the API moves.
- [`fig-kiwi` (npm)](https://www.npmjs.com/package/fig-kiwi) / [`figma-parser`](https://github.com/sunyui/figma-parser) / [OpenPencil kiwi codec](https://deepwiki.com/open-pencil/open-pencil/2.3-file-format-and-kiwi-codec) — Why: Phase-6 prior art. Container = 8-byte ASCII prelude (`fig-kiwi` design / `fig-jam.` FigJam / `fig-deck`), LE u32 version, then a compressed **schema** chunk followed by a compressed **data** chunk (deflate via pako, or zstd — magic `28 B5 2F FD` — via fzstd). Undocumented and unstable by construction.

### Patterns to Follow

**Credential custody — copy this exactly, invent nothing** (`generation/keys.ts`):

```ts
// Resolve at REQUEST time, never cache, never log, never return to the canvas realm.
const token = await getProviderKey('figma');
if (!token) return json({ error: 'not_configured' }, 400);
```

The write route mirrors `/_api/generate/keys`: it accepts a key and returns `{ configured: true }` — **never** the value back.

**Wrapper hygiene for a new `bin/*.sh`** (`import-tokens.sh`) — bun-guard, `exec bun run …_import-figma.mjs "$@"`, numbered exit codes, `--help` from the header comment. All args forwarded quoted; never `eval`.

**Emitting annotations** (`annotate.mjs`) — import `annotations-model.ts` directly under bun so the serializer/sanitizer is the same one the canvas uses. Do not hand-write SVG.

---

## Design Decisions

> Server + CLI first; the only genuinely new UI is Phase 5.

### Components reused

| Component | Source | Notes |
|---|---|---|
| Provider-key card | `client/panels/SettingsPanel.jsx` | Add a `figma` provider row; the existing `/_api/generate/keys` write pattern applies unchanged. |
| Upload/ingest panel | `client/panels/BrandUploadPanel.jsx` | The structural prior for `FigmaImportPanel` — paste-a-thing → preview → confirm → result. |
| Readiness row | `client/panels/ReadinessList.jsx` | "Figma connected ✓" as a checklist row. |
| Experimental/kind badge | `api.ts` `canvasKinds` → `Sidebar`/`Tree`/`CanvasRow` | Reuse for an `imported-figma` provenance badge; **thread it into `cfg` state in `loadTree()`** — the DDR-174 pass shipped this prop-threaded-but-never-stored once already. |

### Tokens

Imported frames must not hardcode hex. `style-map.ts` resolves every Figma paint to the **nearest** active-DS token (OKLCH ΔE against the DS palette, reusing `draw/palette.ts`'s colorspace helpers as `import-tokens` does), emits `var(--token)` on a match inside a configurable threshold, and falls back to a literal **with a `/* figma: no near token */` marker comment** so the drift is auditable rather than silent. Threshold and fallback behaviour are per-import flags, not hidden constants.

### Custom components needed

| Component | Reason | Extends |
|---|---|---|
| `FigmaImportPanel.jsx` | No existing panel does "paste URL → browse pages/frames → multi-select → import" | `BrandUploadPanel` structure |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Phase 0 — Contract

**T1: RECORD the Figma ingestion DDR**
- **Do**: `.ai/archive/decisions/DDR-2NN-figma-ingestion-architecture-and-trust-boundary.md`. Must state: (a) the two-door / one-normalized-tree / three-translator architecture and why REST lands first; (b) **the governing invariant — the ingestion path is deterministic code end to end; no LLM ever reads Figma-sourced content in this feature**, and an explicit contrast with DDR-174 explaining why that DDR's orchestrator/agent split is *not* needed here and must not be copy-pasted in; (c) PAT custody = `generation/keys.ts`, unchanged, plus "the Figma routes are privileged-origin only, in neither canvas allowlist"; (d) the SSRF model for `/v1/images` S3 URLs; (e) the sanitization contract for layer names and text before they reach generated JSX; (f) resource caps (node count, tree depth, response bytes, image batch size) and the rate-limit budget; (g) the deferral of `.fig` decoding to its own DDR with its own dep review; (h) named residuals.
- **Gotcha**: **check for a DDR-number race before claiming a number** — this is a Syncthing tree with concurrent sessions (memory `project_ddr_numbering_races_on_shared_main`). Scan `.ai/archive/decisions/` *and* the uncommitted `decisions/README.md` diff, and re-check immediately before the closing commit. Highest committed today is DDR-208.
- **Validate**: `security-auditor` + `ethical-hacker` fan-out over the DDR text, design-stage, **before any Phase-1 code** — the same pre-code gating discipline DDR-167/DDR-172/DDR-174 all used. 0 findings at/above `security.severityFloor`.

### Phase 1 — REST spine

**T2: CREATE `figma/url.ts`**
- **Do**: parse the four public URL shapes (`/design/`, `/board/`, `/file/`, `/proto/`) → `{ fileKey, nodeId?, surface: 'design' | 'board' }`. Accept a bare file key too. `node-id` arrives URL-encoded as `123-456`; the API wants `123:456` — normalize.
- **Gotcha**: **the host is never taken from the input.** Extract the key with a strict `^[A-Za-z0-9]{10,64}$` charset check and build every request URL from a hardcoded constant base. Reject anything else — this is the SSRF chokepoint, not a convenience parser.
- **Validate**: `bun test apps/studio/figma/url.test.ts` — table-driven over all four shapes, bare keys, and a rejection table (userinfo-in-host `https://api.figma.com@evil.tld/…`, IDN homographs, `..` in the key, over-length).

**T3: CREATE `figma/client.ts`**
- **Do**: `getFile(key, opts)`, `getFileNodes(key, ids[])`, `getImages(key, ids[], format)`, `getStyles(key)`, `getLocalVariables(key)`. `X-Figma-Token` header from `getProviderKey('figma')`, injected at call time. Typed 403/404/429 handling; honour `Retry-After` on 429 with bounded backoff.
- **Gotcha**: prefer `getFileNodes` over `getFile` when a `node-id` is present — a whole enterprise file can be tens of MB and blows both memory and the response cap. Enforce a hard response-byte cap and a node-count cap; fail with a clear "file too large, import a specific frame instead" rather than OOMing. `getLocalVariables` is **plan-gated (Enterprise)** — a 403 there is a normal, expected outcome that must degrade to the styles path, never surface as an error.
- **Validate**: `bun test apps/studio/figma/client.test.ts` with a stubbed `fetch` — asserts the base URL is never influenced by input, the token never appears in any thrown error or log line, 429 backoff is bounded, and caps trip.

**T4: ADD the `figma` provider + privileged routes**
- **Do**: register `figma` in the provider registry (`auth: 'api-key'`, `keychainService: 'com.maude.app.figma'`) so the existing key store, Settings card and keychain bridge work with no new custody code. Add `POST /_api/figma/connect` (write-only, returns `{ configured: true }`), `GET /_api/figma/status` (presence only), `POST /_api/figma/probe` (validate the token against `GET /v1/me`).
- **Gotcha**: **these routes go in NEITHER `CANVAS_SAFE_API` (http.ts) NOR the `startCanvasServer` `routes` map (server.ts).** A canvas-reachable Figma route is simultaneously a token-exfiltration primitive and an SSRF primitive. Add the `GET → 405` assertion to `test/canvas-origin-gate.test.ts` in this same task, per CLAUDE.md's standing rule.
- **Validate**: `bun test apps/studio/test/canvas-origin-gate.test.ts` + a new `figma-routes.test.ts` asserting the key is never echoed on any response path.

### Phase 2 — FigJam → whiteboard (the flagship)

**T5: CREATE `figma/to-strokes.ts`**
- **Do**: map the FigJam vocabulary onto `Stroke`s using `annotations-model.ts`'s own constructors/serializer:
  `STICKY` → `StickyStroke` (nearest `STICKY_PALETTE` colour; text → the sticky's text field);
  `SHAPE_WITH_TEXT` → `RectStroke` / `EllipseStroke` / `PolygonStroke` per `shapeType`, with the label as bound text;
  `CONNECTOR` → `ArrowStroke`, **preserving endpoint bindings as `ArrowBind`** so the arrow stays attached after import — this is the detail that makes the result feel native rather than a flattened picture. **Bounded by `isBindable()` — see § Verified findings; resolve the widen-vs-degrade decision in T1 before writing this mapping, it changes the code.** A group-targeted endpoint degrades to the group's geometric bbox; a degenerate self-connector (start id == end id, observed on the real board) must not emit a zero-length bound arrow;
  `SECTION` → `SectionStroke` (**flat** — nesting is carried by geometry, not by a parent field); FigJam `<frame>` groups → the flat `groupIds[]` tag array; `TEXT` → `TextStroke`; image fills → `ImageStroke` via `import-asset`/`fetch-asset`.
  Unmappable node types (`WIDGET`, embeds, stamps, `TABLE`, and the shape kinds with no `PolygonShape` equivalent — parallelogram, `ENG_*`) are **skipped and reported in a per-import summary**, never silently dropped.
- **Pattern**: `annotate.mjs` — import the canonical TS model under bun; never hand-write SVG.
- **Gotcha**: FigJam coordinates are absolute-canvas; Maude strokes are WORLD coords. Translate by the board's bounding-box origin — **measured on a real board: x ≈ −3 244…+11 037, y ≈ −6 272…+23 488**, so an untranslated import lands tens of thousands of px off-screen. Preserve absolute sticky geometry (FigJam default 240×240 vs Maude's `STICKY_DEFAULT_W` 200) — normalising collapses every layout. Text is attacker-controlled — it goes through the model's existing sanitizer, and long text is truncated to the sticky/shape capacity rather than overflowing.
- **Validate**: `bun test apps/studio/figma/to-strokes.test.ts` — fixture board JSON → expected `Stroke[]`; a connector-binding round-trip case; **an unbindable-endpoint case (text / group host) and a degenerate self-connector case, both drawn from the real `Analýza` board**; a nested-section case; an unmappable-node reporting case; a hostile-text case (script tags, huge strings, control chars).

**T6: CREATE the `maude design import-figma` verb**
- **Do**: `bin/_import-figma.mjs` + `bin/import-figma.sh`, registered in `cli/commands/design.mjs` (DDR-062 — plugin markdown never calls a raw bin path). Modes: `--board <url>` (Phase 2), `--frames <url>` (Phase 3), `--tokens <url>` (Phase 4). `--dry-run` prints the translation summary without writing.
- **Gotcha**: add the new bin to `package.json` `files` — helpers ship via npm, not the marketplace — and confirm `check-tarball-shape.sh` stays green. Per DDR-177, verify `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` covers the new verb before any release.
- **Validate**: `node cli/bin/maude.mjs design import-figma --help`; live `--board --dry-run` against a real FigJam file.

### Phase 3 — Frames → canvas

**T7: CREATE `figma/to-artboard.ts` + `figma/style-map.ts`**
- **Do**: one selected `FRAME`/`COMPONENT` → one `DCArtboard` (JSX `width`/`height` size-authoritative per DDR-027; position into `layout.artboards[]` per the meta schema). `layoutMode: HORIZONTAL|VERTICAL` → flex with the corresponding `itemSpacing`/padding/alignment; everything else → absolute positioning from `absoluteBoundingBox` (the DDR-188 vocabulary). `style-map.ts` translates fills/strokes/effects/`typeStyle` → CSS with nearest-token resolution.
- **Gotcha**: **generated JSX is executed.** Layer names become identifiers and `data-dc-element` values — sanitize to a strict charset before interpolation, never pass through raw. Text content is emitted as JSX **text children**, never as markup or `dangerouslySetInnerHTML`. Every numeric style value is validated against a grammar before it reaches the emitted string. Also: a `kind="web"` artboard should not be a sea of absolute positioning (`design-system-keeper` check A.10) — prefer flex wherever auto-layout gives it to us, and pick the artboard `kind` per DDR-181.
- **Validate**: `bun test apps/studio/figma/to-artboard.test.ts` (auto-layout → flex; absolute fallback; an injection-attempt layer-name table) + `maude design smoke` on the generated canvas.

**T8: ADD image + vector fill resolution**
- **Do**: collect nodes needing rasterization (image fills, `VECTOR`/boolean ops that CSS can't express) → **one batched** `GET /v1/images` call per format → download each returned URL → `fetch-asset` → reference the flat content-addressed `/assets/<sha8>` path.
- **Gotcha**: `IMAGE_COST = 200` ≈ **30 req/min** — batch ids into as few calls as the endpoint allows, never one call per node. The returned S3 URLs are **response-controlled**, so the download must go through `fetch-asset`'s gate with a host allowlist (`*.figma.com`, the Figma image S3 bucket) and a hard refusal for loopback/link-local/private ranges. And per memory `reference_canvas_images_download_first`, a hotlinked `<img>` is CSP-blocked in the canvas — download-first is mandatory, not an optimization.
- **Validate**: `bun test` on the batching + allowlist logic; live import of a frame containing a photo and a vector icon, screenshotted.

**T9: STAMP provenance + surface it**
- **Do**: `.meta.json` gets `kind: "imported-figma"` plus a `source: { fileKey, nodeId, importedAt }` block. Thread `imported-figma` through the existing `canvasKinds` plumbing to a file-tree badge.
- **Gotcha**: record the file key and node id — **never** the Figma file *name* or any node text — in anything an agent later reads as context. Same reasoning as `--reconstruct` recording only the source basename.
- **Validate**: live `/_index-data` check that the badge actually renders in the tree (this exact prop-threading silently no-opped once before).

### Phase 4 — Styles → design-system tokens

**T10: CREATE `figma/to-tokens.ts`**
- **Do**: paint styles → color tokens, text styles → the type scale, effect styles → shadow tokens; emit **W3C design-tokens JSON** and hand it to the existing `_import-tokens.mjs` pipeline. Try `GET /v1/files/:key/variables/local` first (richer: modes → themes); on 403 fall back to styles silently.
- **Gotcha**: **the Variables API is Enterprise-plan-gated.** A Pro-plan user hitting 403 is the *common* case, not an error state — the UI must say "using your styles" rather than "failed". **Verified 2026-08-02:** the primary dogfood account (`michal@slant.cz`, Slant s.r.o.) is **`tier: pro`, Full seat** — so the styles fallback is *the* path this feature will actually be exercised on, and the Variables branch is the one that will go untested locally. Build and test the styles path first; treat the Variables branch as the speculative one. Do **not** invent a second mapping contract; DDR-172 owns naming, collision and theme semantics, and this task's only job is to produce valid input for it.
- **Validate**: `bun test apps/studio/figma/to-tokens.test.ts`; end-to-end `import-figma --tokens <url>` → `import-tokens` → a scaffolded `system/<ds>/` that passes `design-system-completeness-critic`.

### Phase 5 — One-click UI

**T11: CREATE `FigmaImportPanel.jsx` + the Settings card**
- **Do**: Settings gets a Figma row (paste PAT → probe → "Connected as <name> ✓") with a link to Figma's token page naming the **`file_content:read`** scope. The panel: paste URL → server fetches the file's page/frame list → checkbox tree → import → per-node result summary (imported / skipped-with-reason).
- **Gotcha**: no inline `style=` — `style-src 'self'` silently drops it (memory `reference_csp_style_src_drops_inline_styles`). Add `data-testid`s in the same change (`figma-import-panel`, `figma-connect-input`, `figma-frame-row-<id>`) for the desktop e2e. Rebuild the committed bundle **release-minified** afterwards (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit `dist/client.bundle.js` + `dist/styles.css`.
- **Validate**: `design-system-keeper` + critic panel + `a11y-auditor` on the new panel; `desktop-e2e` scenario driving connect → paste → import.

**T12: ADD the plugin command surfaces**
- **Do**: `plugins/design/commands/import.md` gains a `--figma <url>` mode (frames + tokens); `plugins/design/commands/board.md` gains `--from-figjam <url>`. Both go through `maude design import-figma` (DDR-062).
- **Gotcha**: `import.md`'s existing text is dominated by DDR-174's orchestrator discipline for `--reconstruct`. State plainly at the top of the new section that **`--figma` is deterministic and shares none of that architecture**, so a future reader doesn't cargo-cult the agent split into a code path that has no agent in it. `cli/lib/plugin-cli-reachability.test.mjs` bans raw bin paths in plugin markdown.
- **Validate**: `bun test cli/lib/plugin-cli-reachability.test.mjs`; `/design:help` renders both.

### Phase 6 — Local `.fig` / `.jam` (deferred, gated)

**T13: RECORD the `.fig` decoding DDR** — its own decision, own dep review, own security round.
- **Do**: justify the dep stack (`kiwi-schema` + `fzstd` + `pako`, or a bundled parser), state the format-instability risk and the version-detection/fail-loud posture, and specify decompression-bomb caps (compressed:uncompressed ratio, absolute output bytes, node count, tree depth).
- **Gotcha**: this is a **reverse-engineered, undocumented, vendor-can-break-it-any-time** format. The honest framing is "best-effort, fails loud on an unrecognized prelude/version" — not a supported guarantee.

**T14: CREATE `figma/fig-decode.ts`**
- **Do**: 8-byte prelude (`fig-kiwi` / `fig-jam.` / `fig-deck`) → LE u32 version → decompress the schema chunk → decompress the data chunk → decode → **emit the same normalized node tree as `figma/client.ts`**, so Phases 2–4 apply unchanged.
- **Validate**: fixture `.fig` + `.jam` round-trip to the same translator output the API path produces for the same document; a malformed/bomb-input rejection table.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Tests**: `pnpm test && pnpm test:dev-server`
4. **Build**: committed studio bundle rebuilt release-minified whenever client surfaces change; `bash scripts/check-tarball-shape.sh` green with the new bin.
5. **Security (MANDATORY)**: `security-auditor` + `ethical-hacker` over — token custody and non-echo; the canvas-origin gate on every new route; SSRF on both the request-construction path and the `/v1/images` S3 download path; sanitization of layer names / text before they reach generated JSX; resource caps on file, node count and (Phase 6) decompression. 0 findings at/above `security.severityFloor`.
6. **Smoke**: `maude design smoke` — imported canvases render styled, no blank iframes.
7. **Design-system guard + critics**: `design-system-keeper` + the panel on imported canvases and the new UI.
8. **A11y**: `a11y-auditor` on `FigmaImportPanel` + the Settings card.
9. **Native E2E**: `desktop-e2e` scenario — connect → paste URL → select frames → import → canvas opens.
10. **Manual**: a real Pro-plan account (Variables 403 → styles fallback), a real FigJam board with bound connectors and a section, and a deliberately huge file (cap trips with the "import a specific frame" message).

---

## Scenario Coverage

| Scenario | Covers | Status |
|---|---|---|
| `figma-connect` | Settings → paste PAT → probe → connected | 🆕 new |
| `figma-import-frames` | paste URL → select frame → canvas exists + renders | 🆕 new |
| `figjam-import-board` | paste board URL → whiteboard has stickies + bound connectors | 🆕 new |

---

## Open forks (decide before Phase 6 starts — not blocking Phases 0–5)

1. **Is `.fig` / `.jam` in scope at all?** It is the only door that works with no Figma seat and no network, and the user asked for it by name. It is also a reverse-engineered format that Figma can silently break, plus a new dependency in a repo that reviews every dep individually. The plan's position: **build it, but last and behind its own DDR**, so the translators are already proven against the documented API before a fragile decoder is layered underneath. If the answer is "skip it", Phases 0–5 stand alone with nothing to unpick.
2. **A published Figma plugin (push-from-Figma).** Out of scope here; genuinely the highest-fidelity door and the one that needs no token. Worth its own plan if the REST path's fidelity turns out to disappoint in dogfooding.
3. **PAT vs OAuth.** This plan assumes a personal access token — one paste, no callback server, no app registration. OAuth would be nicer for a multi-user hub/cloud deployment and is the only sane option if this ever runs server-side for other people. Deferred deliberately; `keys.ts` custody is identical either way.

## Acceptance Criteria

- [ ] All tasks in the agreed phase set completed
- [ ] `/flow:utils-verify` passes after each task
- [ ] `/flow:validate` passes overall (static, tests, build)
- [ ] `security-auditor` + `ethical-hacker`: 0 findings at/above `security.severityFloor` — **both at DDR stage (T1) and post-implementation**
- [ ] New routes asserted `405` from the canvas origin
- [ ] `design-system-keeper` + critic panel + `a11y-auditor`: 0 blockers on the new UI
- [ ] `desktop-e2e` scenarios green against the built `.app`
- [ ] DDR recorded and ingested into kgai; What's-New entry appended via the `whats-new-entry` skill
