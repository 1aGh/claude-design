# Feature: Figma / FigJam import

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> ## ⛔ STATUS — READ BEFORE EXECUTING ANY TASK (2026-08-11)
>
> **Do NOT run this plan from the top.** Phases 0–5 are SHIPPED and on `main`.
> Re-running them would rebuild working code.
>
> | Phase | Tasks | State |
> |---|---|---|
> | 0 Contract | T1 | ✅ shipped — [DDR-216](../archive/decisions/DDR-216-figma-ingestion-architecture-and-trust-boundary.md), 3 review rounds |
> | 1 REST spine | T2–T4 | ✅ shipped — `figma/url.ts`, `figma/client.ts`, privileged routes |
> | 2 FigJam → whiteboard | T5–T6 | ✅ shipped — `figma/to-strokes.ts`, `maude design import-figma` |
> | 3 Frames → canvas | T7–T9 | ⚠️ shipped **and superseded for `--pages`** — see § Governing principle. Still governs `--frames`. |
> | 4 Styles → tokens | T10 | ✅ shipped — `figma/to-tokens.ts` |
> | 5 One-click UI | T11–T12 | ✅ shipped |
> | 6 `.fig` decoder | T13–T15 | ⬜ not started, deliberately last |
> | **7 Codegen → HTML** | **T16–T21** | 🔜 **THE NEXT WORK — and T16 blocks the rest** |
>
> **Start at T16.** It is a *decision*, not code: does a remote code generator
> belong in the ingestion path, when DDR-216 D1 forbids it in as many words and
> that invariant is the premise Phase 3 was built on? Fork 0b states both sides.
> Nothing in T17–T21 should be written until it is answered.
>
> **What already works and must not be rebuilt:** the REST client and its SSRF
> chokepoints, PAT custody, resource caps, the charset grammars, the asset
> download + content-addressed write, the DDR-167 SVG sanitize lane, Figma
> comments → annotations, section/annotation classification, `absoluteRenderBounds`
> geometry, and the whole report/disposition machinery. Phase 7 consumes all of it.
>
> **Two dead ends are documented, not hidden** (§ Governing principle). Read
> them before proposing either again — both were shipped and both were measured
> broken on a live file.

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
  PAT + URL ───▶ │ figma/client.ts   (REST, Phase 1)   │──┐
                 └─────────────────────────────────────┘  │   normalized
                 ┌─────────────────────────────────────┐  ├──▶ Figma node tree
  .fig / .jam ─▶ │ figma/fig-decode.ts (binary, Ph. 6) │──┘    (one shape)
                 └─────────────────────────────────────┘                │
                                                                        ▼
        ┌───────────────────────┬───────────────────────┬───────────────────────┐
        │ to-strokes.ts         │ to-artboard.ts        │ to-tokens.ts          │
        │  → .annotations.svg   │  → .tsx + .meta.json  │  → W3C tokens JSON    │
        │    (Stroke model)     │    (DCArtboard)       │    → import-tokens    │
        └───────────────────────┴───────────────────────┴───────────────────────┘

  ── Phase 7, added 2026-08-11 — a THIRD door that skips the node tree ──

                 ┌─────────────────────────────────────┐
  Dev Mode  ───▶ │ get_design_context (Figma MCP)      │──▶ React + Tailwind
  codegen        └─────────────────────────────────────┘    + exported assets
                                                                        │
                                                                        ▼
                                    ┌───────────────────────────────────────┐
                                    │ figma/from-codegen.ts                 │
                                    │  Tailwind → inline styles / DS tokens │
                                    │  → .tsx + .meta.json (DCArtboard)     │
                                    └───────────────────────────────────────┘
```

Doing the **REST path first** is what makes the `.fig` path cheap later: by the time Phase 6 starts, a decoder only has to emit the same normalized node shape and it inherits all three translators for free.

**The third door does not share the node tree, and that is the point.** Phase 3's translator reads Figma's tree and reimplements its layout engine in CSS; Phase 7 asks Figma for the layout already resolved. The REST client stays — Phase 7 still needs it for page enumeration, comments, and the raster/annotation lanes — but for `--pages` the frame body comes from codegen.

**Shipping increment as of 2026-08-11: Phase 7.** Phases 0–5 shipped and are measured below; Phase 3's own output is the thing being replaced.

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

**Decided (§ Governing principle, user 2026-08-03): widen `isBindable`.** "Always editable" means a connector imported onto a text label stays a live, re-routable arrow, not a frozen line. The reasoning that made it the recommendation anyway — it improves the *native* whiteboard (today you cannot attach an arrow to a text label or a section, which is a plain product gap independent of import) and it is the difference between "the flagship mapping is 1:1" and "the flagship mapping loses the thing FigJam users care about". **Groups remain unbindable by construction** — Maude groups are a flat `groupIds[]` tag array, not addressable objects, so a group-targeted endpoint must fall back to the group's geometric bbox or degrade. Do not try to invent a group stroke for this.

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

### 📐 Phase 3 measured — a real design file (`Z2gcfNtlVWIWvucbPJLtKB` "data.Brno")

**Scale of one page** — and it is brutal:

| Metric | Value |
|---|---|
| Metadata dump for ONE page | **449 KB** — *exceeded the MCP tool's own token ceiling* |
| Nodes | **4 125** |
| Max nesting depth | **13** |
| Top-level children of the canvas | **73** (frames, but also loose text, loose vectors, stray `Group`s) |
| Largest frames | `design` 3799×14000 · `Html → Body` 1280×6054 · `V4 — Airy / light` 1440×4677 |

**Node-type mix** — `rounded-rectangle` 41 % · `text` 30 % · `frame` 21 % · `ellipse` 3.6 % · `vector` 1.7 % · `symbol` (component) 1.2 %. **92 % of a real file is rects, text and frames** — the three easiest things to translate. Only ~1.7 % needs rasterisation. That is the good news.

**The bad news is structure, not fidelity.** Figma's own first-party translator was run on the small `Mini styleguide` frame (990×648 — visually just 3 swatches, 2 font names, 2 logo cards, 10 icons). It produced **~250 lines of JSX and 22 separate image assets**. Specifically:

- **Mixed layout model, confirmed.** Auto-layout *does* translate cleanly (`content-stretch flex flex-col items-start`, `flex flex-wrap gap-[82px]`) — but the frame's own children are **absolutely positioned** (`absolute left-[293.59px] top-[48px]`). Real files are an **absolute shell with flex leaves**. Plan T7's "flex where auto-layout exists, absolute otherwise" is the right model.
- **A single logo exploded into ~14 separate vector `<img>` exports**, wrapped in seven levels of `contents` divs positioned with `left-[calc(50%-43.42px)] top-[46.94%]`.
- **Figma's own output reaches for contortions** — `containerType: "size"`, `h-[100cqh] w-[100cqw]`, `-rotate-180 -scale-x-100`, `inline-grid` with `grid-cols-[max-content]` — to reproduce ordinary flipped vectors.
- **Asset URLs expire in ~7 days**, confirming download-first is mandatory, not an optimisation.

### 🔴 The real Phase-3 risk: a blob, not a canvas

Visual fidelity is *achievable* — Figma's own output proves the data suffices. **The risk is that the result is not a Maude canvas.** Maude canvases exist to be **edited**, by hand and by `/design:edit`. A 13-deep tree of styleless `contents` wrappers positioned by `calc(50% − 43.42px)`, with one `<img>` per vector, is hostile to exactly that — it would be visually right and practically inert.

Three mitigations — **all now mandatory acceptance criteria, not options** (§ Governing principle):

1. **Flatten aggressively.** Figma `Group` nodes carrying no styling are pure noise — hoist their children and drop the wrapper. Precedent exists in this very repo: DDR-187's addendum hoists engine chrome wrappers rather than emitting synthetic group rows, for the same readability reason.
2. **Collapse vector clusters into ONE asset.** Export the *logo parent node* as a single SVG (`/v1/images?ids=<parent>&format=svg`) instead of its 14 leaves. Fewer assets, far below the `IMAGE_COST` ceiling, and it matches how a human thinks about a logo — one object, not fourteen. **This is the single highest-leverage decision in Phase 3.**
3. **Prefer flex wherever auto-layout exists** — measured as genuinely clean.

### 🎯 The architecture decision, re-confirmed by data

The MCP response is **structurally lossy in exactly the ways the translators need**: `color="CUSTOM"` carries no actual colour, image-filled shapes are identifiable only by a human-typed layer name (`"image 1"`, `"PXL_20210309_203454756 1"`), and no `fills` / `strokes` / `effects` appear at all. The REST API's `GET /v1/files/:key` returns all of it. **This is independent confirmation that REST is the correct door** — not merely the one that clears the rate-limit and allowlist hurdles.

---

---

## Governing principle — editability is the acceptance bar, fidelity is subordinate

> **SUPERSEDED for `--pages` — 2026-08-11. Two routes were tried against the
> live file and both failed; the third is measured in § Phase 7 below.**
>
> This principle was set from measurement of *fixtures*. Against a live 6-page
> product file (`2H6a9YUgPAu0AGdEiwP895`, 115 frames) it did not survive contact.
>
> **Route 1 — translate the node tree to JSX (Phase 3, shipped).** Five
> independent classes of visible defect: a canvas that would not parse
> (`background-image`, a kebab-case key in a JSX style *object*), frames stacked
> in DOM order (Figma frames are absolutely positioned; the emitter mapped them
> to `flex-col`), sections split from their contents, missing assets, white
> screens rendering black. Not five bugs — one: translating a Figma frame into
> CSS means reimplementing auto-layout, constraints, clipping, blend modes,
> vector networks and text auto-resize, and the bug surface grows with the
> fidelity of the source.
>
> **Route 2 — render each frame with `/v1/images` and reference it from `<img>`
> (2026-08-10).** Faithful by construction, and dead on arrival for real
> screens: Figma exports every raster fill as
> `<path fill=url(#a)>` → `<pattern>` → `<use xlink:href>` → `<image
> xlink:href="data:image/png…">`, and **Chromium does not paint that chain**.
> Verified with the only control that settles it — Figma's own untouched export,
> fetched from `/v1/images` and loaded directly, shows no image either. PNG
> instead of SVG saves the photos and turns all text into pixels. A flat image
> per artboard is also inert: the Inspector shows `img {width:100%;height:100%}`
> and there is nothing to select, edit, or lift from the design system.
>
> **Route 3 — Dev Mode codegen → HTML → canvas.** Measured 2026-08-11, § Phase 7.
> It does not have Route 2's failure class (an image is `<img src>` pointing at a
> separately exported asset) and it does not have Route 1's (Figma resolves its
> own layout). The editability bar below is *met*, not abandoned — but it is met
> by taking Figma's resolved DOM rather than by deriving one.
>
> The rest of this section still governs `--frames` and `--editable`.

**User decision, 2026-08-03:** *"chci určitě vždy editovatelný annotations i canvas artboards."* Both outputs — the whiteboard annotation layer AND the `DCArtboard` canvas — must land **editable**, always. This resolves the open question the measurement exposed (is an imported frame *a canvas you edit* or *a reference you build next to*?) in favour of the first, and it converts the three Phase-3 mitigations from recommendations into **acceptance criteria**.

### What "editable" means in Maude — testable, not a feeling

Maude already owns the editing surfaces, so the bar is concrete:

| Surface | What it needs from an imported canvas |
|---|---|
| **Selection ladder** (DDR-187: bare click = top-level, Cmd = deepest, dblclick drills one level) | meaningful objects at every level. Styleless `Group` wrappers poison the drill ladder — each dblclick descends into nothing. |
| **Spacing / resize / grid-track handles** (`use-spacing-handles`, `use-element-resize`, `use-grid-track-handles`) | **flex or grid**. A sea of absolute positioning offers no handles at all — the canvas becomes drag-only. |
| **Layers panel** (DDR-187 addendum) | readable names. 883 nodes called `Group 13900` is an unusable tree. |
| **`/design:edit`** (the agent reads the `.tsx`) | a file it can hold. ~250 lines for a *trivial* 990×648 frame extrapolates to five figures for a 1440×4677 page — agent-hostile. Flattening is a token-budget requirement, not only a readability one. |
| **Direct manipulation of a logo** | one object. 14 separate `<img>` leaves cannot be edited *as a logo*. |

### The acceptance gate — already built

**An imported canvas must pass `design-system-keeper` — specifically Pass A.10 (web-kind flow discipline) — on the same terms as a hand-authored one.** A.10 flags untagged `position: absolute` inside a `kind="web"` artboard precisely because it *"produces broken flex/handoff code"*. That is this feature's blob-detector, and it exists today. **If an import can't clear A.10, the import isn't finished** — do not ship it behind a "well, it's imported" exemption.

### The cost, named honestly

Editability and pixel-fidelity are in genuine tension, and this decision picks a side. Some Figma constructs have **no editable CSS equivalent**: text auto-resize modes, `constraints: SCALE`, blend modes, masks, boolean operations. Editability-first means each degrades to something **editable-but-different** rather than **faithful-but-inert** — so **an import will sometimes look less exactly like Figma than a flattened screenshot would.** That is the chosen trade, not a defect; the per-import summary must say which nodes took it.

### Consequences that are now decided, not open

1. **Widen `isBindable`** to include `text` (and `section`). Degrade-and-report is no longer sufficient for the annotation layer — "always editable" means a connector imported onto a text label stays a *live, re-routable* arrow. (Groups stay unbindable by construction; they fall back to the group bbox.)
2. **Flatten styleless `Group` wrappers** — mandatory, not advisory.
3. **Collapse vector clusters to one parent-node SVG export** — mandatory. It is simultaneously the editability fix, the `IMAGE_COST` rate-limit fix, and the file-size fix.
4. **Preserve auto-layout as flex wherever it exists** — this is what makes the handle surfaces work at all.

---

## Metadata

- **Type**: New Capability (multi-phase program)
- **Complexity**: High
- **App/Package**: `apps/studio` (server + client), `plugins/design`, `cli`, `apps/desktop` (Settings surface only)
- **Affected Systems**: HTTP route table + canvas-origin allowlists, BYOK key custody (`generation/keys.ts`), asset ingestion (`import-asset` / `fetch-asset`), annotation model, canvas creation + `canvasKinds` badge plumbing, design-system token import, `/design:import` + `/design:board`
- **Dependencies**: reuses `generation/keys.ts` (BYOK custody), `bin/_import-asset.mjs` (`--kind raster`), `bin/_fetch-asset.mjs` (URL ingestion), `bin/_import-tokens.mjs` (DDR-172 mapping contract), `annotations-model.ts` (canonical serializer/sanitizer), `annotate.mjs` (the write discipline), `api.ts` `canvasKinds` (the DDR-174 badge plumbing)
- **New runtime deps**: **none in Phases 0–5** (Figma REST is plain `fetch`). **Phase 6 targets zero as well** — the Kiwi decoder is written **in-house** (user decision 2026-08-03: don't depend on `fig-kiwi`/`@open-pencil/fig`, port from the documented reference instead), deflate is `zlib.inflateSync`, and zstd is `zlib.zstdDecompressSync` (built into Node since **23.8.0** — verify Bun's `node:zlib` exposes it, since the dev server is Bun-authoritative per DDR-009). `fzstd` is the single fallback dep if that verification fails, and gets the normal DDR + security review per this repo's standing rule (DDR-071 precedent).

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

### Test fixtures — built, and they ARE the contract

**[`.ai/plans/notes/figma-import-fixtures.md`](notes/figma-import-fixtures.md)** — two purpose-built Figma files authored 2026-08-03, in which **every node exists to exercise one named behaviour**. Node ids are stable and enumerated there, so T5/T7 tests assert against specific ids rather than against "a board".

| | File key | Covers |
|---|---|---|
| FigJam | `Em6NOwaOFTYV7NlQT4NK8l` | nested sections · the 4 sticky/geometry cases · 6 mappable + **2 deliberately unmappable** shape types · groups · rotation · **6 connectors incl. the `isBindable` widening case (→TEXT) and the must-degrade case (→GROUP)** · a hostile layer name |
| Design | `dGNzRC2kmrmGnOxaBa0RI7` | horizontal + vertical auto-layout vs. absolute fallback · **3 nested styleless group wrappers** (the flatten case) · **4 vector leaves forming one mark** (the collapse case) · component + 2 instances · gradient · drop shadow · type ramp · a JSX-hostile name incl. `{curly}` and `<script>` |

Both doors read the same two documents — which is what makes the Phase-6 **Tier-2 differential smoke** possible at all.

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

> ### ⚠️ Corrections from DDR-216 — read before any task below
>
> T1 shipped [DDR-216](../archive/decisions/DDR-216-figma-ingestion-architecture-and-trust-boundary.md)
> after **two** design-stage security rounds. Several statements in this plan were
> measured false against the codebase during those rounds. **Where this plan and
> DDR-216 disagree, DDR-216 wins.** The specific reversals:
>
> | This plan says | Actually |
> |---|---|
> | Widening `isBindable` is *"a small, self-contained change that needs no new geometry"* (§ Verified findings, § Governing principle 1) | **False.** `TextStroke` has no `w`/`h` — the bbox is synthesized from content. `bindCandidate`/`anchorPoint`/`recomputeBoundArrows` never pass the anchors map, so a naive widening mints **permanent zombie binds** on anchored text; unbounded text bboxes and topmost-first scanning make one node a board-wide bind magnet. Ships with DDR-216 **D9's four fixes**, in the stated order (fix 1 with-or-before fix 2), plus native regression coverage. |
> | `design-system-keeper` Pass A.10 is the editability gate (§ Governing principle, T7) | **It is not a gate.** Severity `warning`, never self-promoting; skipped entirely when no `kind="web"` artboard is declared — and the translator picks the kind; satisfied by the mere *existence* of a comment, which a generator emits mechanically. Use **D8's machine-checkable gates**; A.10 runs promoted-to-blocker for `imported-figma` only. |
> | Figma asset URLs *"expire in ~7 days"* (§ Phase 3 measured, T8) | **~30 days** per Figma's own support. Download-first is still mandatory (CSP + expiry), but don't tune anything to the wrong number. |
> | `--tokens`/frames land via `fetch-asset` and an SVG parent export (T7 mitigation 2, T8) | `_fetch-asset.mjs` **structurally refuses SVG** (`sniffImageExt`, `assetName`). Use **DDR-216 D11's composition** — `--raw-out` into out-of-tree staging, then `_import-asset.mjs`'s DDR-167 SVG lane, then atomic promotion. Never widen the shared sniff. PNG @2× is an acceptable fallback; the annotation layer takes PNG (`ASSET_IMAGE_HREF_RE` is **not** extended). |
> | Register `figma` in the provider registry so the key store works with no new custody code (T4) | `figma` fits no `Modality` and `ProviderEntry` needs a factory. `figma` is **not** in the media-generation registry; two dedicated routes call `keys.ts` directly (**D2**). The routes also need `isTrustedRequestHost` + `sameOriginWrite` + a `readJson` cap — allowlist exclusion alone leaves a live CSRF hole (**D3**). |
> | Sanitizing layer names/text before JSX is the content control (T7) | Necessary, not sufficient. Add **D6a** (zero-glyph character classes — Unicode Tags, zero-width, bidi) and **D6b** (normalize visibility rather than detect invisibility), and note D6b covers the **canvas path only** — the board path gets normalization plus a stroke-count ceiling and a quarantined staging canvas. |
> | Report artifacts / staging live under `_history/` because it is gitignored (T9, and D5's own first draft) | **Gitignored ≠ not replicated.** `~/git/.stignore` excludes neither `.design/` nor `_history/`. Asset staging goes **outside the synced tree**; verify exclusions against the sync list, not the git list. |

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
- **Gotcha**: prefer `getFileNodes` over `getFile` when a `node-id` is present — a whole enterprise file can be tens of MB and blows both memory and the response cap. **Measured, not extrapolated: a single page of a real Slant file is 449 KB / 4 125 nodes / depth 13 in the *metadata-only* projection — it exceeded the Figma MCP's own token ceiling on the first try.** The full REST payload (which additionally carries fills, strokes, effects and typeStyle per node) is materially larger. Whole-file import is not a viable default; frame-scoped is. Enforce a hard response-byte cap and a node-count cap; fail with a clear "file too large, import a specific frame instead" rather than OOMing. `getLocalVariables` is **plan-gated (Enterprise)** — a 403 there is a normal, expected outcome that must degrade to the styles path, never surface as an error.
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
- **Do (added after measurement)**: **flatten styleless `Group` wrappers** (hoist children, drop the node) and **collapse vector clusters to one parent-node SVG export** — see § Verified findings "a blob, not a canvas". Without these two, the output is visually correct and practically uneditable, which fails the point of a Maude canvas.
- **Gotcha**: **generated JSX is executed.** Layer names become identifiers and `data-dc-element` values — sanitize to a strict charset before interpolation, never pass through raw. **Measured: real layer names carry spaces, em-dashes, arrows and diacritics** (`V4 — Airy / light`, `Html → Body`, `Úprava 3d modelu…`, `Property 1=Cisty-a-zeleny-kraj 1`), so this is a live hazard on the very first real file, not a theoretical one. Text content is emitted as JSX **text children**, never as markup or `dangerouslySetInnerHTML`. Every numeric style value is validated against a grammar before it reaches the emitted string. Also: a `kind="web"` artboard should not be a sea of absolute positioning (`design-system-keeper` check A.10) — prefer flex wherever auto-layout gives it to us, and pick the artboard `kind` per DDR-181.
- **Validate**: `bun test apps/studio/figma/to-artboard.test.ts` (auto-layout → flex; absolute fallback; a flatten-styleless-wrapper case; a vector-cluster-collapse case; an injection-attempt layer-name table) + `maude design smoke` on the generated canvas + **the editability gate: `design-system-keeper` must pass Pass A.10 on the imported canvas with no untagged-absolute findings, on the same terms as a hand-authored one.** A deliberate overlay carries its one-line justification comment like any other canvas. **A canvas that cannot clear A.10 is not a finished import** — no "but it's imported" exemption.

**T8: ADD image + vector fill resolution**
- **Do**: collect nodes needing rasterization (image fills, `VECTOR`/boolean ops that CSS can't express) → **one batched** `GET /v1/images` call per format → download each returned URL → `fetch-asset` → reference the flat content-addressed `/assets/<sha8>` path.
- **Gotcha**: `IMAGE_COST = 200` ≈ **30 req/min** — batch ids into as few calls as the endpoint allows, never one call per node. **Measured: Figma's own translator emitted 22 asset exports for one 990×648 frame** (a logo alone became 14). Extrapolated to a 1440×4677 page that is hundreds of assets — which is precisely why T7's "collapse vector clusters to one parent SVG" is a rate-limit mitigation, not only a readability one. Figma's asset URLs also **expire in ~7 days**, so download-first is mandatory. The returned S3 URLs are **response-controlled**, so the download must go through `fetch-asset`'s gate with a host allowlist (`*.figma.com`, the Figma image S3 bucket) and a hard refusal for loopback/link-local/private ranges. And per memory `reference_canvas_images_download_first`, a hotlinked `<img>` is CSP-blocked in the canvas — download-first is mandatory, not an optimization.
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

### Phase 6 — Local `.fig` / `.jam` — **our own decoder** (user decision 2026-08-03)

**Decision: write the decoder ourselves, taking inspiration from the existing libraries rather than depending on them — and back it with a serious smoke suite.** Two verified facts make this the *lower*-risk option, not the braver one:

1. **Kiwi is a documented open format, not a reverse-engineered one.** [`evanw/kiwi`](https://github.com/evanw/kiwi) ships a spec, a `.sk` schema language, and a reference JS implementation (`js/schema.ts`, `js/binary.ts`, `js/kiwi.ts`) we can port from. Decisively: Kiwi advertises *"forwards compatibility — old versions can optionally read new data **if a copy of the new schema is bundled with the data**"*, which is **exactly** what a `.fig` does (chunk 1 *is* the schema). The format was designed for this read.
2. **The schema is embedded, so we never hardcode Figma's.** A Figma *schema* change cannot break us — only a *container-framing* change could, and that is a handful of bytes, not a data model. This is the single biggest argument against depending on `fig-kiwi` (v0.0.1, ~4 years stale): a stale library pins a stale schema; our decoder reads whatever the file brings.

**Dependency posture — plausibly zero new runtime deps.** Deflate is `zlib.inflateSync`, present everywhere. Zstd is `zlib.zstdDecompressSync`, built into Node since **23.8.0**; **verify Bun's `node:zlib` exposes it at implementation time** (the dev server is Bun-authoritative per DDR-009, and `dependencies.json` currently floors Node at 20). If it's absent, `fzstd` (small, pure-JS) is the single fallback dep and gets the normal review. The Kiwi decoder itself is ours, ~300–500 lines.

### ✅ Container format — MEASURED on real exports, 2026-08-03 (this corrects the plan's earlier description, which was wrong)

Both fixture files were exported and dissected end-to-end. **The whole pipeline is proven without a line of decoder written**: ZIP → `canvas.fig` → prelude/version → raw-deflate schema → zstd data → the exact strings authored into the fixtures (`AL Horizontal (-> flex row)`, `bar-short`, `accent-dot`, `"test" / <b> & 'x'`, every `shapeType`).

```
.fig / .jam   = ZIP archive           ← NOT a bare kiwi file; the earlier plan text was wrong
  ├── canvas.fig     the kiwi payload
  ├── thumbnail.png
  ├── meta.json      file name, background colour, render coordinates, exported_at
  └── images/        image assets, INSIDE the file

canvas.fig    = "fig-kiwi" | "fig-jam."   (8-byte ASCII prelude — the editor discriminator)
                u32 LE version            (observed: 106)
                u32 LE len + chunk[0]     SCHEMA — raw DEFLATE (no zlib header)
                u32 LE len + chunk[1]     DATA   — ZSTD (magic 28 B5 2F FD)
```

Five findings that change the implementation:

1. **Mixed compression — one codec per chunk, always both.** The schema is **raw deflate** (`windowBits: -15` / `inflateRaw`); a plain `zlib.inflateSync` **fails on it** because there is no zlib header. The data is **zstd**. The earlier "deflate *or* zstd" reading was wrong — you need both codecs, every time.
2. **The schema chunk is byte-identical across editor types** (`sha256:c22712ff…`, 28 766 B compressed → 71 777 B, in *both* the design and the FigJam export). One schema, one decoder; the prelude is the only editor discriminator.
3. **The decompressed schema is fully self-describing** — 3 468 readable identifiers, including `NodeType` with `DOCUMENT, CANVAS, GROUP, FRAME, BOOLEAN_OPERATION, VECTOR, STAR, LINE, ELLIPSE, RECTANGLE, REGULAR_POLYGON, ROUNDED_RECTANGLE, TEXT, SLICE, SYMBOL, INSTANCE, STICKY, SHAPE_WITH_TEXT, CONNECTOR, CODE_BLOCK, WIDGET, STAMP, MEDIA`, plus `WindingRule`, `Axis`, `NodePhase`. **Nothing is guessed.** This is the in-house-decoder thesis confirmed in the strongest possible way.
4. **Images ship INSIDE the archive** (`images/`). This is *strictly better than the REST door*: no 7-day URL expiry, no `IMAGE_COST` rate limit, no SSRF surface at all. The local door has a genuine advantage the plan hadn't credited.
5. **A schema hash is a better drift alarm than decode-failure.** Because chunk[0] is stable and shared, `sha256(schema chunk)` changing is an **early warning that fires before anything breaks** — strictly better than Tier 4's "a fresh export failed to decode". Add it to the Tier-4 alarm; keep decode-failure as the backstop.

`meta.json`'s `exported_at` timestamp makes the dated Tier-4 corpus self-labelling. Committed baseline: **`.ai/fixtures/figma/2026-08-03/`** (116 KB, outside the npm-published tree — `.ai` is not in `package.json` `files`).

**T13: RECORD the `.fig` decoding DDR** — own decision, own security round.
- **Do**: state the write-our-own rationale above (embedded schema = no pinned schema to rot); the **fail-loud posture** — an unrecognised prelude or an unknown container version **refuses**, and must never best-effort-decode into plausible-but-wrong geometry (silent wrongness is far worse than a clean error for a design importer); decompression-bomb caps (compressed:uncompressed ratio, absolute output bytes, node count, tree depth); and the smoke architecture below as a *requirement*, not a test plan.
- **Also check (one line, don't over-lawyer)**: Figma's ToS reverse-engineering clause. The honest framing is that this reads a file the user already owns, entirely locally, touching no Figma service — but confirm rather than assume.
- **Validate**: `security-auditor` + `ethical-hacker` over the binary-parser threat model. A parser on untrusted attacker-supplied bytes is the highest-risk code in this whole plan.

**T14: CREATE `figma/fig-decode.ts`** — **ZIP reader → `canvas.fig` → container reader → the two decompressors → Kiwi schema parser → Kiwi data decoder** → **the same normalized node tree `figma/client.ts` emits**, so Phases 2–4 apply unchanged. Build it in that order; each layer is independently testable, and layers 1–4 are already **proven against the committed fixtures** (§ Container format).
- **Gotcha**: the schema chunk is **raw deflate** — `inflateRawSync` / `windowBits: -15`. A plain `zlib.inflateSync` throws on it. The data chunk is zstd. Both, every file.
- **Also**: resolve image fills from the archive's own `images/` directory, not through `/v1/images` — no expiry, no rate limit, no SSRF. This path is *better* than the REST one and should not simply mirror it.

**T15: BUILD the smoke suite — the load-bearing deliverable of this phase**

> A binary decoder that doesn't crash is not a decoder that's *correct*. The suite below is what separates the two, and it is the reason this phase is worth doing at all.

**Tier 1 — container smoke** (fast, offline, every CI run): all three preludes recognised; garbage/truncated/empty rejected cleanly (no crash, no OOM); a **known** version decodes, an **unknown** version *refuses loudly*; both compression paths exercised; every bomb cap demonstrably trips.

**Tier 2 — differential smoke — the correctness oracle.** ⭐ **The same document, through both doors, must produce the same normalized tree.** Export `X.fig` *and* fetch `GET /v1/files/<X>` for the same file, then diff: node count, ids, types, geometry, text content. **This is only possible because REST was built first** — it retroactively justifies the phase ordering, and it is the only oracle that proves the decoder is *right* rather than merely *quiet*. Known-lossy fields are listed explicitly and asserted as lossy; nothing degrades silently.

**Tier 3 — translator smoke** (end-to-end): `.fig` → decoder → `to-strokes` / `to-artboard` → canvas must equal the REST-sourced import of the same document (or differ only by a documented delta) — **and clear the same `design-system-keeper` A.10 editability gate** the governing principle imposes on every import.

**Tier 4 — format-drift alarm** (the thing that catches Figma breaking us): a small committed corpus of `.fig`/`.jam` exports taken at *different dates* (**baseline landed: `.ai/fixtures/figma/2026-08-03/`**, version `106`, schema `sha256:c22712ff…`), plus a documented ritual of re-exporting the same source document periodically. **Two alarms, not one:** (a) **the schema hash** — chunk[0] is stable and shared across editor types, so a changed `sha256` is an *early warning that fires before anything breaks*; (b) a fresh export failing to decode, the backstop, which must name the observed container version so diagnosis is one line rather than an afternoon.

**Plus a fuzz corpus.** Cheap under `bun test`; mandatory for a parser fed untrusted bytes.

- **Gotcha**: fixtures must be **small, purpose-built, and ours** — not a real 449 KB working file. Binary fixtures are repo weight and real client files carry licensing/privacy baggage. Author a deliberately minimal board and a minimal frame that between them exercise every mapped node type.
- **Validate**: all four tiers green; Tier 2 is the gate — no `.fig` import ships without a passing differential run.

---

### Phase 7 — Dev Mode codegen → HTML → canvas (added 2026-08-11)

**This phase exists because Phases 3 and its render-first successor both failed on the live file.** See § Governing principle for the two autopsies. Everything below was measured, not assumed — the numbers are from `2H6a9YUgPAu0AGdEiwP895` on 2026-08-11.

#### What codegen actually returns — measured

`get_design_context` on `417:10793` (Onboarding-Step-1) returns React + Tailwind:

| Property | Measured |
|---|---|
| Semantics | a bullet list arrives as `<ul>/<li>`, not nine positioned divs |
| Layout | flex that matches Figma auto-layout — the thing Route 1 tried to derive |
| Tokens | CSS variables **with fallbacks** — `var(--black,#0f161e)`, `var(--black-10,rgba(15,22,30,0.1))` |
| Provenance | `data-node-id` on every element |
| Images | separate exported assets + plain `<img src>` — **not** the pattern chain that killed Route 2 |
| Extras | per-frame type scale, `data-content-annotations` (designer notes), component descriptions |
| Size | ~90 lines of flex per frame, against ~250 lines of absolute positioning from Route 1 |

Verified end-to-end on the exact frame Route 2 lost: Cover `6:907`'s logo came back as a 1028×1331 PNG and rendered.

#### Costs — measured, and each one is a task below

1. **Asset URLs are not content-addressed on Figma's side.** The same battery icon returned four different UUIDs across four calls. A naive import pays network cost per *occurrence*; our content-addressed write dedupes only on disk, after download.
2. **URLs expire.** Bytes must be fetched at import time. (Note the § Tasks correction table: the ~7-day figure the MCP prints disagrees with Figma's documented ~30 days. Download-first regardless; don't tune to either number.)
3. **The output is React + Tailwind and must be converted.** That is a new translator to write and own — from Tailwind this time instead of from the Figma tree.
4. **Fonts do not survive a copy.** Measured on this machine: Inter installed; **Nunito, SF Pro, Hanken Grotesk, General Sans absent** — and the DS declares `--font-body: 'Hanken Grotesk','Inter',…` while loading no webfont at all (no `@font-face`, no import). Copying the family name through lands on a serif fallback.

#### Unknown, and gating

- Behaviour across 272 nodes. Four parallel calls succeeded; that is a **weak signal** and is treated as one.
- How the converter grows on frames harder than a sign-in screen.

#### The open decision this phase forces

**Route 3 contradicts [DDR-216 D1](../archive/decisions/DDR-216-figma-ingestion-architecture-and-trust-boundary.md)** — *"the ingestion path is deterministic code end to end; no LLM ever reads Figma-sourced content in this feature"*. That invariant is the premise the whole in-house translator was built on. Codegen puts a **remote, opaque generator** in the path. The content was untrusted either way; what changes is that the **structure** is no longer produced by auditable local code, and the output is not reproducible from our source alone.

**T16 must settle this before T17 writes a line.** Do not smuggle it in as an implementation detail.

---

**T16: RECORD the codegen-route DDR** — supersedes DDR-216 D1 for `--pages`.
- **Do**: a new DDR stating (a) which route each verb takes and why, with both autopsies; (b) the trust posture for service-generated structure — what is still verified locally (charset grammars, caps, asset gate, sanitize lane) and what is now taken on faith; (c) whether a codegen import is marked differently from a deterministic one in `.meta.json` and in the UI badge; (d) the fallback when codegen is unavailable (no edit seat, MCP absent, headless/cron run — the ACP/cron case is real: interactively-authenticated MCP servers may not exist there).
- **Validate**: the DDR names the D1 conflict explicitly. A reader must not have to infer that an invariant was dropped.

**T17: CREATE `figma/from-codegen.ts`** — Tailwind → Maude.
- **Do**: parse the returned JSX, map Tailwind utilities to inline styles, hoist the common font family to the artboard root, wrap in `DCArtboard` at the frame's size, carry `data-node-id` through as `data-figma-node`. Reuse `sanitize.ts` for every string that lands in output — the codegen text is still third-party.
- **Gotcha**: the mapping is mechanical (`px-[20px] py-[12px]` → `padding: 12px 20px`) but the arbitrary-value syntax (`inset-[37.5%_18.75%_26.56%_18.75%]`, `drop-shadow-[4px_4px_30px_rgba(0,0,0,0.15)]`) is where it will get long. Bound it: an unmapped utility is **reported**, never silently dropped.
- **Validate**: unit tests per utility family; one full frame round-trips to a canvas that parses.

**T18: RESOLVE fonts against what the project can render — and report substitutions.**
- **Do**: map the Figma family onto a DS token when one matches, else onto the literal family with a system fallback. Detect availability rather than assuming it.
- **Every substitution emits a `font-substituted` disposition** naming the requested and the used family.
- **Why this is a task and not a detail**: a substituted font looks fine and **is not 1:1**. Silent visual drift is exactly the failure mode this import has already shipped three times (dropped loose content, stripped `href`, zero-height arrows) — each time reporting success. A fallback in a CSS declaration is not a report.
- **Validate**: importing a frame using an absent family produces the entry; a frame using only available families produces none.

**T19: DEDUPE asset fetches by node, not by URL.**
- **Do**: one download per distinct source node per import, cached across frames — the same icon must not cross the network 272 times because it got 272 UUIDs.
- **Validate**: a page whose frames share a status bar downloads its battery icon once.

**T20: MEASURE the full-file run before enabling it.**
- **Do**: instrument calls, wall-clock, and failures across one whole page, then the file. If sustained throughput does not support 272 nodes, ship codegen as **opt-in per page or per frame** rather than as the default for `--pages`.
- **Validate**: the decision is made on the measurement, not on the four-call sample.

**T21: RETIRE or SCOPE the superseded routes.**
- **Do**: decide per verb — `--pages` on codegen; `--frames` keeps the tree translator; the render-first SVG path either goes or becomes an explicit `--flat` for reference-only imports. Delete what nothing reaches; the repo already carries two translators for one job.
- **Validate**: `check-import-coherence.sh`; no unreferenced module left behind.

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

0. ~~Is an imported frame a canvas you edit, or a reference you build next to?~~ **Resolved 2026-08-03 — a canvas you edit, always.** See § Governing principle. Kept here so a later reader sees the fork existed and was decided, not overlooked. **Still the answer as of 2026-08-11, but the means changed:** editability is now obtained from Figma's resolved DOM (Phase 7), not derived from its node tree — after deriving it was tried, shipped, and measured broken.

0b. **Does a remote code generator belong in the ingestion path?** ⚠️ **OPEN — this is T16 and it blocks Phase 7.** DDR-216 D1 forbids it in as many words. The alternatives on the table are all worse for fidelity and all measured (§ Governing principle). Deciding "no" means accepting that whole-file import stays flat-image or stays broken; deciding "yes" means an import is no longer reproducible from our source alone. Do not let this get settled by whoever writes T17 first.
1. ~~Is `.fig` / `.jam` in scope, and do we vendor a decoder or write one?~~ **Resolved 2026-08-03 — in scope, and we write our own.** `fig-kiwi` on npm is `0.0.1`, ~4 years stale, and pins a stale schema; a `.fig` *carries its own schema*, so an in-house decoder reads whatever the file brings and cannot rot the same way. Kiwi itself is documented with a reference implementation. See Phase 6. **Now `.fig`/`.jam` samples ARE wanted** — small, purpose-built, ours (T15's fixture note). It is the only door that works with no Figma seat and no network, and the user asked for it by name. It is also a reverse-engineered format that Figma can silently break, plus a new dependency in a repo that reviews every dep individually. The plan's position: **build it, but last and behind its own DDR**, so the translators are already proven against the documented API before a fragile decoder is layered underneath. If the answer is "skip it", Phases 0–5 stand alone with nothing to unpick.
2. **A published Figma plugin (push-from-Figma).** Out of scope here; genuinely the highest-fidelity door and the one that needs no token. Worth its own plan if the REST path's fidelity turns out to disappoint in dogfooding.
3. **PAT vs OAuth.** This plan assumes a personal access token — one paste, no callback server, no app registration. OAuth would be nicer for a multi-user hub/cloud deployment and is the only sane option if this ever runs server-side for other people. Deferred deliberately; `keys.ts` custody is identical either way.

## Acceptance Criteria

- [ ] All tasks in the agreed phase set completed
- [ ] `/flow:utils-verify` passes after each task
- [ ] `/flow:validate` passes overall (static, tests, build)
- [ ] `security-auditor` + `ethical-hacker`: 0 findings at/above `security.severityFloor` — **both at DDR stage (T1) and post-implementation**
- [ ] New routes asserted `405` from the canvas origin
- [ ] `design-system-keeper` + critic panel + `a11y-auditor`: 0 blockers on the new UI
- [ ] **Editability gate (the governing principle):** every imported canvas clears `design-system-keeper` Pass A.10 with no untagged-absolute findings; the imported whiteboard's connectors are live and re-routable (not frozen); the Layers panel shows readable names, not `Group NNNN` × N; `/design:edit` can load and edit an imported canvas end-to-end
- [ ] Per-import summary names every node that took an editability-over-fidelity degradation
- [ ] **(Phase 7) Every font substitution is a reported `font-substituted` entry** naming requested and used family — a CSS fallback is not a report
- [ ] **(Phase 7) An unmapped Tailwind utility is reported, never silently dropped**
- [ ] **(Phase 7) One source node = one download per import**, regardless of how many frames reference it or how many URLs Figma minted for it
- [ ] **(Phase 7) Verified by rendered comparison, not by count agreement.** Every prior round of this feature reported success while losing content; screenshot the frame in Figma and in Maude and compare the pictures
- [ ] **(Phase 6) All four smoke tiers green — Tier 2 (differential `.fig` vs REST on the same document) is the gate.** No `.fig` import ships without a passing differential run; an unknown container version refuses loudly rather than decoding approximately
- [ ] `desktop-e2e` scenarios green against the built `.app`
- [ ] DDR recorded and ingested into kgai; What's-New entry appended via the `whats-new-entry` skill
