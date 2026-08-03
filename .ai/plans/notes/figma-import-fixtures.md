# Figma import — test fixtures

Purpose-built Figma files for `feature-figma-import`. **Every node exists to exercise one named behaviour** — this file is the contract a test asserts against, not a description of some pretty boards.

Authored 2026-08-03 via the Figma MCP into the **Slant** plan (`team::877934482416663198`). Slant rather than Personal for a practical reason: Personal is `starter` tier = **6 MCP calls/month**, which would make the files unmaintainable.

| | File key | URL |
|---|---|---|
| FigJam | `Em6NOwaOFTYV7NlQT4NK8l` | https://www.figma.com/board/Em6NOwaOFTYV7NlQT4NK8l |
| Design | `dGNzRC2kmrmGnOxaBa0RI7` | https://www.figma.com/design/dGNzRC2kmrmGnOxaBa0RI7 |

Both doors read the same documents, which is what makes the **Tier-2 differential smoke** (Phase 6 / T15) possible: decode `.fig` and fetch `GET /v1/files/<key>`, then assert the normalized trees match.

---

## FigJam fixture — `Em6NOwaOFTYV7NlQT4NK8l`

### Sections + stickies

| Node id | What it is | Asserts |
|---|---|---|
| `1:2` | section `Sekce vnější` | `SECTION` → `SectionStroke` |
| `1:3` | section `Sekce vnitřní (nested)`, **child of `1:2`** | **Nested sections.** `SectionStroke` is FLAT (no parent field) — nesting must survive as *geometric containment*, not hierarchy |
| `1:8` `1:12` `1:16` | stickies, palette yellow / green / blue, **240×240** | Named colour enum → `StickyStroke.color` |
| `1:20` | sticky, `isWideWidth`, **416×240** | Non-default geometry must survive. **Do not normalise to Maude's `STICKY_DEFAULT_W` (200)** — that collapses every layout |

### Shapes — one per `shapeType`

| Node id | `shapeType` | Expected mapping |
|---|---|---|
| `2:17` | `SQUARE` | → `RectStroke`. **Also carries the hostile layer name** (below) |
| `2:21` | `ELLIPSE` | → `EllipseStroke` |
| `2:24` | `ROUNDED_RECTANGLE` | → `RectStroke` + `cornerRadius` |
| `2:28` | `DIAMOND` | → `PolygonStroke` `'diamond'` |
| `2:32` | `TRIANGLE_UP` | → `PolygonStroke` `'triangle'` |
| `2:36` | `TRIANGLE_DOWN` | → `PolygonStroke` `'triangle-down'` |
| `2:40` | `PARALLELOGRAM_RIGHT` | ⚠️ **No Maude equivalent** — must be skipped *and reported*, never silently dropped |
| `2:44` | `ENG_DATABASE` | ⚠️ **No Maude equivalent** — same |

**Hostile layer name** on `2:17`: `Příliš žluťoučký — "test" / <b> & 'x'`
Diacritics, an em-dash, double *and* single quotes, angle brackets, an ampersand. Layer names become JSX identifiers and `data-dc-element` values — this string must never reach generated code unsanitized. (Measured on the real `data.Brno` file: production layer names genuinely look like `V4 — Airy / light` and `Html → Body`, so this is not a contrived case.)

### Other nodes

| Node id | What | Asserts |
|---|---|---|
| `2:50` | standalone TEXT | → `TextStroke`; **and is connector target C2** |
| `2:62` | GROUP (members `2:54`, `2:58`) | FigJam group → Maude's flat `groupIds[]` tag array; **and is connector target C3** |
| `2:63` | shape, `rotation = 15°` | `StrokeBase.rotation` round-trip |

### Connectors — the flagship cases

| Node id | Endpoints | Caps / line | Asserts |
|---|---|---|---|
| `2:67` | `2:17` → `2:21` (shape→shape) | `NONE`/`ARROW_LINES`, ELBOWED | **Happy path** — both ends bindable today |
| `2:71` | `2:28` → **`2:50` (TEXT)** | `NONE`/`ARROW_LINES` | 🔴 **The `isBindable` widening case.** `isBindable()` (`annotations-bindings.ts:24`) admits only rect/ellipse/polygon/sticky/image. Per the plan's governing principle this must become a **live, re-routable** arrow — not a frozen line |
| `2:75` | `2:24` → **`2:62` (GROUP)** | `NONE`/`ARROW_EQUILATERAL` | 🔴 **The must-degrade case.** Maude groups are tags, not addressable objects → fall back to the group bbox. **Do not invent a group stroke** |
| `2:79` | `1:8` (sticky, inside the nested section) → `2:17` | `NONE`/`ARROW_LINES` | Binding across a section boundary + sticky-as-host |
| `2:83` | `2:32` → `2:36` | `NONE`/`NONE`, **STRAIGHT** | Cap vocabulary: no arrowheads at all |
| `2:87` | `2:44` → `2:63` | `ARROW_LINES` both, **CURVED** | Two-way caps + curved line type |

**Observed while authoring:** explicit `RIGHT`/`LEFT` magnets on `2:83` were **normalised by FigJam to `CENTER`**. Don't assume a requested magnet survives — read back what the file actually stores.

### Known gap

**No image node.** `upload_assets` is the only supported image path in FigJam and needs a byte POST. Cheapest fix: **drag any image onto the board by hand** before exporting — that covers `ImageStroke`. Not worth burning MCP calls on.

---

## Design fixture — `dGNzRC2kmrmGnOxaBa0RI7`

### Layout models — the three the translator must tell apart

| Node id | What | Asserts |
|---|---|---|
| `1:2` | `AL Horizontal (-> flex row)` — auto-layout, `itemSpacing 16`, padding 20/24 | Auto-layout → **flex**. Measured as translating cleanly; this is what makes `use-spacing-handles` / `use-grid-track-handles` work on an import |
| `1:9` | `AL Vertical (-> flex column)` — auto-layout, `counterAxisAlignItems: CENTER` | Vertical flex + cross-axis alignment |
| `1:15` | `Absolutely positioned children (-> fallback)` — 3 rects at explicit x/y | The absolute fallback. **Must clear `design-system-keeper` Pass A.10** or carry a justification comment — this is the blob-detector |

### 🔴 The two cases Phase 3 hinges on

| Node id | What | Asserts |
|---|---|---|
| `2:8` → `2:7` → `2:6` | **Three nested styleless GROUP wrappers** (`Mark wrapper` → `Group` → `Group`) | **Flatten.** Reproduces the real `data.Brno` logo, which sat under seven such wrappers. Styleless groups carry no styling and must be hoisted away — they poison the DDR-187 selection drill ladder (each dblclick descends into nothing) |
| `2:2` `2:3` `2:4` `2:5` | **Four VECTOR leaves forming ONE logical mark** (90×72 total) | **Collapse.** The real logo exploded into ~14 separate `<img>` exports. The translator must export the **parent** as one SVG (`/v1/images?ids=<parent>&format=svg`), not four leaves. Simultaneously the editability fix, the `IMAGE_COST` (30 req/min) fix, and the file-size fix |
| `2:11` → `2:10` → `2:9` | Shallower case: 2 styleless groups over a plain rect | Flattening must be depth-agnostic |

### Fidelity-vs-editability cases

| Node id | What | Asserts |
|---|---|---|
| `2:12` | COMPONENT `Button/Primary` | Component semantics have **no runtime equivalent** — degrades to a subtree |
| `2:14` `2:16` | Two INSTANCEs of `2:12` | Instance → plain subtree; the DDR-187 component-instance layer rows are a *display* concern, not a structural one |
| `2:18` | Linear gradient fill | `GRADIENT_LINEAR` → CSS gradient |
| `2:19` | Frame with `DROP_SHADOW` (y+4, radius 16, 25 % black) | Effect → `box-shadow` |
| `2:20` `2:21` `2:22` | Type ramp — 32/Bold/40, 20/Regular/28, 14/Regular/20 | `typeStyle` + explicit `lineHeight` in PIXELS |
| `2:23` | Frame named `Karta — "uvozovky" / <script> & {curly} → šipka` | Sanitizer, design-side. Note `{curly}` — JSX-significant — and a literal `<script>` |

---

## Exporting the `.fig` / `.jam` files (Phase 6 fixtures)

In Figma: **File → Save local copy** (design → `.fig`, FigJam → `.jam`).

**Export each file twice, with a gap between exports**, and keep both. Two exports of the same unchanged document are the seed corpus for the **Tier-4 format-drift alarm** — the mechanism that catches Figma changing the container framing. A later re-export that fails to decode *is* the alarm, and must fail loud with the observed container version rather than best-effort-decoding into plausible-but-wrong geometry.

Commit them small and ours — never a real client file (repo weight + licensing/privacy).
