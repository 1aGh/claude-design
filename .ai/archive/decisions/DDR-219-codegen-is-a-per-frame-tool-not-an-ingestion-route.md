# DDR-219 — Figma codegen is a per-frame tool reached over loopback by the dev-server, never by a model; DDR-216 D1 is amended for one row, not two

- **Date**: 2026-08-11
- **Status**: **Accepted — channel VERIFIED on a live server (2026-08-11).** The
  first draft was written from documentation alone, with nothing listening on
  `127.0.0.1:3845`; that gap is now closed. All six probe questions came back
  green against the same live file on which Routes 1 and 2 were measured broken
  (`2H6a9YUgPAu0AGdEiwP895`): an anonymous non-catalog client is accepted, the
  endpoint exposes **six read-only tools and no write surface**, output is at
  **parity with the remote measurements** (91 lines, flex 36 : absolute 2,
  `var()` with fallbacks, no `xlink:href` chain), 15 calls tripped no limit, an
  absent node id fails loudly, and output is **byte-identical call-to-call with
  content-addressed assets**. Two of the decision's own stated risks were
  measured *better* than argued; one new hazard was found (§ Probe findings 1).
  See § Blocking verification for the table.
- **Status (trust model)**: Accepted — after a design-stage `security-auditor` + `ethical-hacker`
  round (2026-08-11) that returned **30 blockers and 3 exploit chains against the
  first draft** and inverted its central choice. The first draft routed codegen
  through the **remote** MCP, reachable only by the session agent; the review
  established that this (a) closes the DDR-130 trifecta **inside a single turn**,
  (b) rests on a "boundary" that is a self-reported OAuth `client_name` with a
  public bypass, and (c) necessarily co-tenants the operation with Figma's own
  **write** tools. The channel moved to the **local** Dev Mode server called
  directly by `apps/studio`, which removes the model from the path entirely.
  Every closure is recorded in § Security review.
- **Scope**: `repo:maude`, `dept:dev`
- **Area**: Figma import (route assignment per verb, the codegen channel + trust
  posture, the Tailwind/JSX parser contract, provenance for service-generated
  structure)
- **Amends**: [DDR-216](DDR-216-figma-ingestion-architecture-and-trust-boundary.md)
  **D1**, narrowly and explicitly — see D3. D12 (render-first default for
  `--pages`) is **kept and promoted**, not superseded.
- **Blocked on**: two DDR-216 controls that were asserted and never built — see
  **D11**. Nothing in Phase 7 ships before they do.
- **Relates to**: DDR-174 (the contrast case), DDR-167 (the byte lane every asset
  still traverses), DDR-172 (value grammars; why they are *not* widened here),
  DDR-185 (`curl-local`, whose loopback rule is an **allow** rule for this
  endpoint — see D2), DDR-177 (the converter is a runtime-spawned helper),
  DDR-054/DDR-085 (the untrusted-peer boundary this feature widens)

## Context

`feature-figma-import` Phases 0–5 shipped. Two routes to an editable design page
were built and both measured broken on the live 6-page product file
`2H6a9YUgPAu0AGdEiwP895` (115 frames):

**Route 1 — tree → JSX** (Phase 3). Five classes of visible defect, autopsied in
DDR-216 D12. One cause: translating a Figma frame into CSS means reimplementing
auto-layout, constraints, clipping, blend modes, vector networks and text
auto-resize, and the bug surface grows with the fidelity of the source.

**Route 2 — render-first** (DDR-216 D12, today's `--pages` default). Faithful and
cheap — `Phase 1` 283 KB → 47 KB — and inert: an artboard is one image.

**Route 3 — Dev Mode codegen.** Returns a bullet list as `<ul>/<li>`, flex
matching Figma's auto-layout, CSS variables with fallbacks, `data-node-id`
provenance, images as separate exports behind plain `<img src>`, ~90 lines per
frame against Route 1's ~250. Neither Route 1's failure class (Figma resolves its
own layout) nor Route 2's (an `<img>` at an exported asset, not the
`<pattern>`/`<use>`/`xlink:href` chain Chromium refuses to paint).

Route 3 is better output. This DDR decides **what it can be a route *for*, and
down which wire**.

### The constraints that decide it

| # | Fact | Source |
| --- | --- | --- |
| 1 | **No REST codegen exists.** Confirmed against the REST reference and the changelog through 2026-07-23. MCP is the only sanctioned channel; there is no second wire to build. | [rest-api](https://developers.figma.com/docs/rest-api/), [changelog](https://developers.figma.com/docs/rest-api/changelog/) |
| 2 | **The remote MCP** (`https://mcp.figma.com/mcp`) is spoken **by the agent, not by our code** — MCP is a client protocol of the agent host. Any response therefore transits a model's context by construction. | protocol shape |
| 3 | **The remote catalog "allowlist" is not a boundary.** It is enforced on the self-reported `client_name` at dynamic client registration, and a public bypass exists (`rexdotsh/figma-mcp-oauth-bypass`). | review finding, verified |
| 4 | **The local Dev Mode server** at `http://127.0.0.1:3845/mcp` takes plain loopback HTTP with **no credential** and **no catalog gate** — so `apps/studio` can speak to it directly. Needs the Figma desktop app running, Dev Mode enabled, and a **Dev or Full seat on a paid plan**. Figma "strongly recommends" the remote one; its metering is **undocumented**. | [local-server-installation](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/) |
| 5 | **Rate limit, remote, dogfood account** (`tier: pro`, Full seat): 200 tool calls/day, 10/min, additive. 115 frames = 57 % of a day. **Local metering is undocumented — assume it is metered.** | [rate-limits-access](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/) |
| 6 | **Asset expiry is two numbers.** `/v1/images` node exports: **30 days**. `/v1/files/:key/images` image *fills*: **no more than 14 days**. The plan's "~7 days" appears in neither doc. | [file-endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) |
| 7 | **Developer Terms §4.f**: *"Figma Integrations must allow data to flow both directions. Figma may disallow any Figma Integrations from using Figma APIs if they block write-back tool calls."* | [developer-terms](https://www.figma.com/legal/developer-terms/) |

## Blocking verification — four questions that can still kill D2

Everything below is decided *conditionally*. The local channel was chosen from
documentation; none of it has been exercised. In kill-fastest-first order:

| # | Question | Why it kills | Status (probed 2026-08-11) |
| --- | --- | --- | --- |
| 1 | **Does the local server accept a plain, non-catalog HTTP client?** | The remote server allowlists on a self-reported `client_name`. Whether the local one enforces *any* client-identity or `Origin` check was **undocumented in both directions**. If it does, D2's channel does not exist and fork 0b reopens. | ✅ **GREEN.** An anonymous `initialize` with `clientInfo.name: "maude-probe"` is accepted; `serverInfo.name: "Figma Dev Mode MCP Server"`. Streamable-HTTP transport, SSE-framed replies, `mcp-session-id` header. **The channel exists.** |
| 2 | **Is a codegen tool exposed?** | — | ✅ **GREEN, and better than assumed.** `get_design_context` is present, and the local server exposes **6 tools, ALL read-only** — `get_design_context`, `get_variable_defs`, `get_screenshot`, `get_motion_context`, `get_metadata`, `get_figjam`. **No `use_figma`, `create_new_file`, `add_code_connect_map` or `upload_assets`.** See D2 addendum. |
| 3 | **Does local output carry the properties the route was chosen for** — semantic tags, flex, `var()` with fallbacks, `data-node-id`? | Every one was measured through the **remote** server, and Figma documents the remote as having the broadest feature set. If absent, this is Route 1 with extra steps. | ✅ **GREEN — parity with remote, on the same frame (`417:10793`).** 8 841 B / **91 lines** (remote measured ~90); `data-node-id` ×26; `<p>`/`<ul>`/`<li>`; **`flex` 36 vs `absolute` 2**; `var(--black,#0f161e)` and `var(--black-10,rgba(15,22,30,0.1))` — the exact values the plan cited; 3 × `<img>`; **no `xlink:href`/`<pattern>`** (Route 2's killer absent); no `<script>`/`<iframe>`/`on*`. |
| 4 | **Is the local server metered?** | Undocumented (fact 5). D10's ceiling is set from *remote* numbers. | ✅ **GREEN at probe depth.** 15 sequential calls in 5.16 s (~344 ms each), no limit. The remote's 10/min would have tripped at call 11. Shallow probe — a *daily* cap is not excluded. |
| 5 | **Does a node id absent from the open document fail loudly?** (added after finding 1) | The wrong-document hazard. | ✅ **GREEN.** `999999:999999` and `1:2` both return *"No node could be found for the provided nodeId: … Make sure the Figma desktop app is open and the document containing the node is the active tab."* Narrows finding 1 — does not close it. |
| 6 | **Is output stable call-to-call?** (added) | D3's faith item 2 and residual 1. | ✅ **GREEN, and it refutes a documented cost.** Two calls returned **byte-identical** output, and asset SHAs were **identical** (`7f7af444…`, `b2a9f536…`). See finding 4. |

Probe instrument: `scratchpad/probe-local-mcp.mjs` (a measurement tool,
deliberately not product code). Prerequisites it cannot satisfy itself: Figma
desktop running → Dev Mode → *Enable desktop MCP server* (done), **plus** the
Q3 unblock below.

### Probe findings — three that change this DDR

**1. `get_design_context` takes NO file key — it reads the currently open
document.** Its only addressing parameter is `nodeId`
(`pattern: ^\d+[:-]\d+$`); the other six are `clientLanguages`,
`clientFrameworks`, `forceCode`, `dirForAssetWrites`, `artifactType`, `taskType`.
**Figma node ids are not unique across files.** So `--explode` on a canvas whose
`source.fileKey` is file A, while the desktop app happens to have file B open,
would return **file B's node of the same id** and stamp it as file A's — this
feature's signature failure mode (report success, deliver something else) in a
new costume, and neither D7's provenance nor D8's write model catches it.
**D8 gains a precondition: the open document must be proven to match
`source.fileKey` before any output is trusted, and the operation refuses when it
cannot be proven.** How to read the open file's key over this transport is
**unsolved** — `get_metadata` with no `nodeId` returns the page list and no file
identity. If it turns out to be unknowable, `--explode` must at minimum require
explicit user confirmation of which document is open, and say so in the report.

**Narrowed by Q5, not closed.** A node id **absent** from the open document
fails loudly: *"No node could be found for the provided nodeId … Make sure …
the document containing the node is the active tab."* So the hazard requires an
actual **id collision** between the stored `source.fileKey`'s document and the
open one. That is not exotic — low-numbered ids (`0:1`, `1:2`, `6:906`) recur in
essentially every Figma file, and the probe's own page list starts at `0:1`. A
cheap, real mitigation that does not need file identity: **cross-check the
returned node's name and geometry against the `.meta.json` frame record before
writing**, and refuse on mismatch. Cheaper than it sounds — `to-render.ts`
already stores per-frame `{ id, nodeId, type }`, and widening that record to
carry name + size is a one-line change made *now*, while the render route is
being touched anyway, rather than a migration later.

**2. The server writes assets to a caller-supplied absolute path, gated by
Figma's own allowed-directories allowlist.** `dirForAssetWrites` is *"the
directory to write image, vector and video assets to … as an absolute path"*, and
a `mktemp -d` target was refused with *"The user must add this directory to their
allowed directories list in Figma Dev Mode settings (MCP panel > Allowed
directories)."* Two consequences:

- **D8's `mkdtemp`-per-run staging is incompatible with an allowlist** — a fresh
  random directory is never on it. Staging must be a **stable** path
  (`~/.cache/maude/figma-staging/`) that the user permits once, and it is still
  outside the synced tree, which is what D8 actually cares about.
- **D6 is vindicated for a second, unanticipated reason.** Because we discard
  codegen's assets and re-fetch by node id through the existing `/v1/images`
  lane, we can decline `dirForAssetWrites` entirely and **never let a third-party
  server write a file on this machine**. That is strictly better containment than
  the allowlist. It requires the server's *Image settings* to be on the
  localhost-link mode rather than write-to-disk; in write-to-disk mode the call
  hard-fails without a permitted path, which is what currently blocks Q3.

**4. The local channel is DETERMINISTIC and its assets are CONTENT-ADDRESSED —
this refutes a documented cost and softens the decision's headline residual.**
Two calls for `417:10793` returned **byte-identical** output, and the asset URLs
are content-addressed SHA-1 paths (`/assets/7f7af4444a0c…svg`) that were
**identical across calls**.

- **It refutes plan cost #1** — *"the same battery icon returned four different
  UUIDs across four calls"*, which is why T19 existed. That was measured on the
  **remote** server. Locally, dedupe is a property of the URL, so D6's
  refetch-by-node-id keeps its containment rationale but loses its
  *dedupe* rationale — the URLs would have deduped fine on their own.
- **It corrects D3's faith item 2 and residual 1.** "The same frame is not
  guaranteed to yield the same output twice, and already measurably does not"
  was true of the remote channel and is **false of this one**, at least within a
  session against an unchanged document. Stated precisely, because the probe does
  not establish stability across Figma versions or document edits: **deterministic
  within a session, not proven reproducible across time.** The D3 scorecard's
  surviving break — *structure produced by a remote generator* — stands
  regardless; what shrinks is how badly that break bites in practice.

**3. `forceCode` exists because the server silently returns metadata instead of
code when the output is too large** (*"whether code should always be returned,
instead of returning just metadata if the output size is too large"*). That is a
silent-degradation path: a large frame yields something that is not code, and a
converter that does not check would emit a confidently wrong artboard. **The
client asserts the response is code and refuses otherwise** — it does not paper
over it by setting `forceCode` unconditionally, because the size ceiling is
telling us something real about D5's caps.

**If Q1 or Q2 comes back red**, the honest options are the two this DDR rejected —
the remote/agent route with capability-shaped trifecta controls, or dropping
codegen and fixing Route 1 — and they get re-decided on the measurement rather
than on this document.

## Spike — one real screen converted and rendered (2026-08-11)

`425:2939` "Chapter/generated" (375×812, StudyFi onboarding file) was pulled,
converted by a throwaway mapper, rendered and screenshotted **next to Figma's own
`get_screenshot` of the same node**. This is the acceptance criterion *"verified
by rendered comparison, not count agreement"*, run before writing T17 rather
than after.

**Measured surface — this sizes T17.** 1 276 class tokens · **129 distinct** ·
83 arbitrary-value · **64 families**. A first pass of ~130 lines mapped
**83 %**; the 22-utility tail was entirely mundane (`text-black`, `flex-[1_0_0]`,
`gap-px`, `self-stretch`, `-translate-x-1/2`, `grid-cols-[max-content]`,
`col-1`…). Adding it reached **129/129, zero unmapped, in ~155 lines.**
**T17's Tailwind mapper is a bounded, small thing** — the plan's fear that
"the arbitrary-value syntax is where it will get long" is real but finite.

**Rendered comparison.** Content and structure came through essentially whole:
the card list (Card sets / Rococo Plasterwork / Baroque Sculptures / Summaries /
Tests / First semester) in order, icons, borders, radii, spacing, the filter
chips, the breadcrumb, the tab pair, the status bar, and even the source's own
red redline rectangle. Every visible defect traced to the spike's **extraction**
step, not to the Tailwind mapping.

### The finding that changes T17's shape

**A real screen's codegen response is a TypeScript MODULE, not an element.**
`425:2939` returns 15 asset constants, a `type IconsProps = {…}`, a helper
`function Icons({ className, property1 = "account" }: IconsProps)`, and only then
`export default function ChapterGenerated()`. **Figma emits component variants as
parameterized React components**, invoked as `<Icons property1="notifications" />`.

The spike's regex-strip-to-HTML approach could not survive that — the type
declaration rendered as visible body text, which is exactly the class of defect
D5's "named parser, never regex" rule exists to prevent, demonstrated on the
first real screen.

**So T17 does NOT flatten to HTML — it keeps the module as React.** Maude canvases
*are* React (`canvas-lib.tsx`), so a helper component in the emitted `.tsx` is
natively renderable **and strictly more editable** than the inlined markup that
flattening would produce: one `Icons` component beats fourteen duplicated icon
subtrees, which is DDR-216 D8 mitigation 2's argument arriving from a new
direction. Consequences:

- The converter rewrites `className` → style within a **parsed module**, preserving
  `type`/`function`/`const` declarations and the default export.
- Emitted identifiers still come from `identifierFromNodeId` (D4), so helper names
  derived from layer names are regenerated, not preserved.
- D5's element/attribute allowlists apply to the JSX **inside** each component.
- The 512 KB per-artboard cap (D5) is measured against the module: this screen is
  **32 KB of code + 1.6 KB of prose tail**, comfortably inside it.

### The response is code PLUS prose, and the prose is imperative

Every response ends with an instruction block addressed to a model — verbatim
*"SUPER CRITICAL: The generated React+Tailwind code MUST be converted…"*,
*"1. Analyze the target codebase to identify…"*, *"IMPORTANT: After you call this
tool, you MUST call get_screenshot…"*, *"DO NOT install any Tailwind as a
dependency unless the user instructs you to do so."* — 1 648 B on this frame.

This is **Figma itself** issuing directives into the response, not an attacker. On
the remote/agent channel those land in a model's context as instructions and are
followed. On D2's channel they are bytes a parser discards. **It is a live,
first-party demonstration of why the channel decision matters**, and it adds a
requirement: the converter **truncates at the code/prose boundary** and never
carries the tail into an artifact, or Figma's instructions would be written into
a canvas that agents later read.

`data-name` also carries raw layer names verbatim (`"231320F7-8B2B-43C7-B5A0-…_4_5005_c 1"`,
`"Icon"`, `"profile 1"`, `"Group"`), and the generated identifier
`Component231320F78B2B43C7B5A04A6Ff8B6244C45005C` is derived from one — so D4's
discard-and-regenerate rule and the `attrValue()` routing are load-bearing, not
theoretical.

## Decision

### D1 — Route assignment, per verb

| Verb / operation | Route | Reachable from |
| --- | --- | --- |
| `--pages` (default) | **Render-first** (DDR-216 D12) | desktop UI · CLI · headless · agent |
| `--pages --editable`, `--frames` | Tree translator (Phase 3), top-level frames only | same |
| `--board`, `--tokens` | `to-strokes` / `to-tokens` | same |
| **`--explode <artboard-id>`** — "make this artboard editable" (new) | **Codegen**, one frame, one call, via the **local** MCP | **the dev-server**, on explicit user invocation — panel · CLI · headless |

**Codegen is not an importer.** It is a follow-up operation on an artboard a
deterministic import already placed. DDR-216 D12 built the anchor without naming
it: `.meta.json` keeps `figma.frames[]` *"so a single artboard can be exploded
into JSX on demand, rather than mistranslating 115 of them up front"* — and
`to-render.ts:296` already writes it with the comment *"the seam `--explode <id>`
reads"*. This decision is the on-demand half arriving.

**Granularity stays per-frame even though the local server removes the catalog
constraint**, because fact 5 leaves local metering undocumented. Revisit on
measurement, not on hope.

**`figma.frames[]` is written by `to-render.ts` only.** `to-artboard.ts` (`:495`,
`:686`) writes no `figma` block, so `--explode` is reachable on render-route
canvases and not on `--editable`/`--frames` ones. That is acceptable — those
already *are* JSX — but it must be stated rather than discovered.

### D2 — The channel: the local server, called by the dev-server. The remote server is banned, and reachability is a control rather than an assumption

`apps/studio` speaks JSON-RPC to `http://127.0.0.1:3845/mcp` directly.
**No model is in the path.** The response is fetched, parsed, converted and
written by code; the agent that invoked the verb sees only the verb's code-owned
stdout, which D10 already governs.

**The first draft's premise was that codegen is *agent-only* because
`apps/studio` cannot reach the remote server. That is an availability fact
dressed as a control** — facts 3 and 4 dismantle it from both ends. So the
reachability rule is inverted and made enforceable:

- **`mcp.figma.com` must appear in no runtime code path**, ever — the plan's own
  § Out of scope already said so and Phase 7's first draft reversed it silently.
- **`:3845` may be reached from exactly one module**, the codegen client, and
  from nowhere else.
- Both are held by a **standing grep test** in the shape of the shipped
  `cli/lib/plugin-cli-reachability.test.mjs`: no `mcp.figma.com` literal anywhere
  under `apps/studio/**`, `cli/**`, `plugins/*/hooks/**`; no `3845` literal
  outside the designated module.
- **No canvas-reachable codegen route may exist** — the operation is
  privileged-origin only, in NEITHER `CANVAS_SAFE_API` nor the
  `startCanvasServer` `routes` map, with the `GET → 405` assertion in
  `test/canvas-origin-gate.test.ts` per the standing rule.

**DDR-185's `curl-local` is an *allow* rule for this endpoint, and that is now
on the record.** Its inclusion criterion is "every resolved address is strictly
loopback"; `127.0.0.1:3845` satisfies it. `_curl-local.mjs:46–49` already names
the hazard in its own header (*"a call CAN reach another
unauthenticated-by-convention loopback service"*) — so this is a known accepted
property, not an unnoticed gap. It is restated here because DDR-219 must not
lean on unreachability that `curl-local` grants away. **No new denial is added**
(narrowing `curl-local` to exclude a port would defeat its purpose, which its
header also explains); the control is D2's grep test, not the egress helper.

**New threat this channel introduces, named rather than inherited:** the local
server is unauthenticated, so **any local process can squat port 3845** and feed
the dev-server arbitrary JSX. Loopback-only means this requires local code
execution, which is largely game-over independently — but the consequence is
specific: our converter would ingest attacker-authored markup believing it came
from Figma. Mitigations are the same ones D5 imposes on the parser, plus: the
client asserts the MCP `initialize` handshake and the expected tool name before
sending a document request, and a failed assertion **refuses** rather than
falling through.

**What the local channel buys, precisely:** it removes the trifecta from the
turn. The remote route put a third-party-influenced response **inline in the
session agent's context** — in this repo, an agent running under
`defaultMode: "bypassPermissions"` (`.claude/settings.json:16`), with
`~/.config/maude/keys.json` **outside** the deny-list (which covers `.env*`,
`**/secrets/**`, `*.pem`, `*.key` — `.claude/settings.json:7–15`), alongside
co-connected write-capable MCPs. The review composed that into a self-propagating
chain: a payload in a shared Figma library component reaches every downstream
consumer's codegen. **None of its steps required a bug in Maude's code**, which
is why prose ("treat it as untrusted") could not close it and a channel change
could.

**§4.f (fact 7) is also answered by the channel, not by argument.** The first
draft called this a read-only integration; that was false at *session* level,
because a session running remote codegen necessarily holds `use_figma`,
`create_node`, `add_code_connect_map` and `upload_assets`. With the dev-server as
the client, our code calls **read tools only**, and the write surface is not in
the loop at all.

**Addendum, measured 2026-08-11 — this is stronger than argued.** The local
server exposes **six tools and every one is read-only**: `get_design_context`,
`get_variable_defs`, `get_screenshot`, `get_motion_context`, `get_metadata`,
`get_figjam`. The write surface is not merely unused on this channel — **it does
not exist on this endpoint.** Chain 1's persistence step (payload written back
into a shared library component, propagating to every downstream consumer) is
therefore closed by the endpoint's own tool set, not only by our discipline.
Conversely, §4.f's write-back mandate becomes *more* pointed, not less: an
integration built entirely on this endpoint is structurally one-directional. See
residual 8.

### D3 — The invariant that is being amended, scored so no reader has to infer it

> **DDR-216 D1 said:** *"from the moment a Figma document enters this feature to
> the moment an artifact lands on disk, **every step is deterministic code.** No
> subagent is spawned. No node name, text content, style value or API response is
> placed into any model's context by this feature's own ingestion code paths."*

Scored against `--explode`, on D2's channel:

| D1 prohibition | Bulk import | `--explode` (local MCP) | First draft (remote MCP) |
| --- | --- | --- | --- |
| No agent spawned from a Figma code path | holds | **holds** | holds |
| No fetched content enters a model's context | holds | **holds** — the dev-server is the MCP client | **BROKEN** |
| No Figma-derived string in a shell argument | holds | **holds** | holds |
| Structure produced by auditable local code | holds | **BROKEN** — Figma's generator produced it | **BROKEN** |

**One row of four breaks, for one operation.** The channel decision is what took
it from two to one. The remaining break is irreducible: there is no REST codegen
(fact 1), so structure-from-Figma is the whole point of the route. A codegen
artboard is **not reproducible from our sources** — we cannot regenerate it from
the node tree, and its structure is Figma's to change.

**Measured correction (probe finding 4):** the first draft added *"and the same
frame is not guaranteed to yield the same output — one icon returned four
distinct UUIDs across four calls."* That was the **remote** channel. On this one,
two calls returned **byte-identical** output with **identical content-addressed
asset SHAs**. So the break is *"not reproducible from **our** sources"*, not
*"not reproducible at all"* — deterministic within a session against an unchanged
document, unproven across Figma versions. Narrower than argued, and still a break.

A future reader grepping DDR-216 for *"deterministic code end to end"* finds it
stated absolutely there and qualified here. That is the intended reading.

### D4 — What is verified locally — corrected, because the first draft inherited controls by name that do not apply

The review's highest-value output was five false claims about shipped code. They
are corrected here rather than quietly dropped.

| First draft claimed | Actually |
| --- | --- |
| *"`sanitize.ts` in full … on every byte of codegen output"* | **Not a thing that can be done.** Every export is a **field-level string function**; `jsxStringLiteral` (`sanitize.ts:208`) escapes `<`/`>`/`{`/`}`, so running it over a JSX document destroys the markup. The real claim is *"every string the parser extracts as a text node or attribute value"* — which makes **the parser's leaf enumeration the control** (D5), not `sanitize.ts`. |
| *"the value grammar" is unchanged* | **`VAR_RE = /^var\(--[a-z0-9-]{1,64}\)$/` (`style-map.ts:53`) rejects a `var()` with a fallback** — i.e. every `var(--black,#0f161e)` this route exists to preserve. There is also no grammar for `transform`, `filter`, multi-value `inset`, or `font-family`, and `mapNodeStyle` takes a *Figma node*, not a string, so it is not reusable here at all. |
| codegen URLs *"get no shortcut"* through the asset gate | **The gate refuses them outright** — `assets.ts` has no URL entry point (`resolveAssets` resolves URLs itself from node ids), `FIGMA_ASSET_HOSTS` is a frozen two-host array (`assets.ts:48`), and `_fetch-asset.mjs` is https-only + port-pinned + loopback-refusing. There was **no legal path**, which is the structural twin of DDR-216 Round-1 Blocker 2. |
| A.10 *"runs promoted to blocker for `imported-figma`"* — listed under *"still enforced, unchanged"* | **It does not exist.** `grep -rn "imported-figma" plugins/` returns **zero matches**, so DDR-216 D8's promotion **and** D7's `/design:edit` pre-flight banner are both unimplemented. See **D11**. |
| The `Disposition` enum is a closed set | **Already drifted in `main`.** `assets.ts:291` emits `'asset-degraded'`, absent from the union (`sanitize.ts:45–63`). It survives because there is no `typecheck` gate. See **D9**. |

**Genuinely enforced, verified:** `cleanText` (`:162`), `attrValue` (`:178`),
`identifierFromNodeId` (`:193`), `jsxStringLiteral` (`:208`), D6a's zero-glyph
category rule (`ZERO_GLYPH_RE`, `:114` — a `\p{Cf}\p{Cc}\p{Co}\p{Cn}` category
filter plus a blank-letter list, **stronger** than the first draft implied), D5's
caps, D7 provenance, and the asset lane for node-id-driven requests.

**Two inherited controls degrade and must not be claimed whole:**

- **D6a transfers cleanly** — a pure category-based string filter — *conditional
  on* the parser routing every text node and attribute through `cleanText`.
- **D6b does not transfer unchanged.** It works because *"the translator authors
  these nodes, so it can guarantee visibility"*: `ensureContrast` needs a
  resolved background hex, `ensureFontSize` a per-node numeric size. A codegen
  artboard's colour arrives as `var(--x,#hex)` or a utility class and its
  background is resolved by the **cascade**, so there is no `bgHex` to pass. It
  degrades to "clamp what we can parse", the invisible-text class is **partially
  re-opened** for this route, and DDR-216 D8's rendered/unoccluded-area
  gate — still *"PLANNED, NOT BUILT"* — becomes materially more load-bearing.

**Taken on faith, named:** that the returned DOM corresponds to the frame (we do
not diff it against the node tree); that the generator is not itself a vector.

**Identifier space is a binding requirement, not an inherited property.** DDR-216
D6 calls it *"airtight — there is no Figma string in the identifier space at
all"*, which holds only because every identifier comes from
`identifierFromNodeId`. Codegen returns React source carrying **its own**
component names, derived from layer names. `from-codegen.ts` **discards every
identifier in the response and regenerates from `data-node-id`.** Stated as a
rule because an implementer preserving the returned name would otherwise be
compliant with this DDR and would break D6's strongest row.

### D5 — The parser contract, bounded the way DDR-216 bounded `.fig`

A parser over third-party JSX + Tailwind arbitrary-value syntax is a lower-severity
member of the class DDR-216 called *"the highest-risk code in the whole
program"*. The first draft said nothing about it. It gets the same treatment:

1. **Named parser + dependency review.** Hand-rolled vs. a library is a decision,
   not an implementation detail — this repo reviews every dependency individually
   (DDR-071 precedent). Note `oxc-parser` already sits in `apps/studio`'s
   devDependencies as native NAPI bindings; feeding third-party source to a
   native parser is a different risk class from a JS one, **and** it drags
   per-platform staging (D12).
2. **Pre-parse caps.** D5's existing caps are all *output*-side (512 KB emitted
   JSX per artboard); DDR-216's 8 MB is enforced in `client.ts` and the MCP
   response never traverses it. The response gets its own **input** byte cap, plus
   node-count and depth caps on the parsed tree.
3. **Element and attribute allowlists, never denylists.** Elements:
   `div/span/p/ul/ol/li/img/h1..h6` and nothing else. Attributes: `style`,
   `className` (consumed, not emitted), `src`, `alt`, `data-figma-node` and
   nothing else. A denylist has to remember `<script>`, `<style>`, `<iframe>`,
   `<foreignObject>`, `on*`, `href`, `dangerouslySetInnerHTML` — allowlists do not.
4. **A parse error refuses the frame.** Never a partial artboard.
5. **Prototype-pollution rule restated** — `__proto__`/`constructor`/`prototype`
   skipped, `Object.create(null)` for any map built from parsed keys.
6. **ReDoS discipline** on arbitrary-value extraction, per DDR-172 Decision 4:
   ASCII pre-filter first, no `m`/`s` flags, bounded quantifiers. Tailwind's
   bracket syntax is unbounded free-text capture wearing a utility name.
7. **A lane-local value grammar.** `style-map.ts`'s `VAR_RE` and the shared
   predicates are **NOT modified** — widening a grammar shared with the tree
   translator and DDR-172's token importer is verbatim the root pattern DDR-216
   Round 2 named twice. The codegen lane composes the existing predicates into
   its own module, and decides there whether a fallback-bearing `var()` is
   admitted (it is: that fidelity is the route's reason to exist) — locally, not
   by mutating a shared constant.
8. **The writer-discipline test is keyed on the sink, not on field names.**
   DDR-216 D6's grep test bans interpolating a node's `name`/`characters`;
   `from-codegen.ts` is a **third writer** whose untrusted fields are JSX text
   nodes, `className` strings and `data-*` attributes — none of which are called
   `name` or `characters`, so a field-name-keyed test structurally cannot cover
   it. The test asserts what may appear in *emitted output*, so it survives a
   third writer.

**Bracket-payload egress is already blocked, and that is why this is not worse
than it is.** The canvas CSP (`http.ts:232–248`) is `default-src 'none'`,
`connect-src 'self' https://staticimgly.com`, `img-src 'self' data: blob:`,
`object-src 'none'`, `form-action 'none'` — so a `bg-[url(https://attacker/…)]`
injected via an arbitrary value is blocked as egress. First-order consequence is
spoofing and rendering abuse, not beaconing. This bounds the blast radius; it
does not make the grammar sound.

### D6 — Assets: discard the codegen URLs, re-fetch by node id

Codegen carries `data-node-id` on every element. So the converter **throws away
every asset URL in the response** and re-requests by node id through the existing
`/v1/images` lane — same frozen host allowlist, same byte sniff, same DDR-167 SVG
lane, same `renderKey` dedupe (`assets.ts:183`), same budget, **no new URL
surface and no widened allowlist**. This is simultaneously the fix for D4's
"no legal path" and the dedupe plan T19 asked for.

It also sidesteps the local server's `localhost` asset links entirely, which
would otherwise be an http-scheme, loopback-addressed download — refused three
ways by `_fetch-asset.mjs` and correctly so.

### D7 — Provenance lands in the artifact the consumer reads, not only in a tree chip

The first draft put `route` in `.meta.json` and leaned on the `canvasKinds` badge.
Both are insufficient, verified:

- **`canvasKinds` is per-canvas-file, not per-artboard** (`api.ts:5362`;
  badge at `client/app.jsx:2145`, `:2299`), so a canvas mixing render and codegen
  artboards is **byte-identical in the tree** to a fully deterministic one.
- **The consumer that matters never sees a chip.** `design-system-keeper`, the
  critic panel and `/design:edit` read the **file**.

So:

1. `figma.frames[]` carries `route: "render" | "jsx" | "codegen"`, **plus
   `responseSha256` and `endpoint: "local"` and the tool name.** That does not
   make the artboard reproducible; it makes *"did these two artboards come from
   the same generator state"* answerable, which is the minimum an incident needs.
2. **A distinct code-owned header banner in the emitted `.tsx`** for a codegen
   artboard — `to-render.ts` already emits a third-party banner; this one
   additionally says the structure was generated remotely and is not reproducible.
3. A per-artboard visible marker, since the file-level chip cannot express mixed
   provenance.

**The Phase-6 differential-smoke oracle is unavailable for this route, forever** —
there is no second door (fact 1). DDR-216 designed that oracle for its
highest-risk component precisely because *"the same document through both doors
must produce the same tree [is] the only oracle that proves a decoder is right
rather than merely quiet."* Codegen has no such oracle. Stated plainly so nobody
looks for one.

### D8 — The write model

`--explode` mutates an already-reviewed, versioned, peer-synced artifact in place.
DDR-216 D3 established *"the producer never picks its own target"*.

- **The target artboard comes from the user's invocation**, and is validated to be
  an existing entry in that canvas's `figma.frames[]`, in a canvas already
  carrying `kind: "imported-figma"`, realpath-contained under `<designRoot>`. The
  verb **refuses to create a new file** and refuses any path outside the design
  root.
- **Exactly one artboard is written.**
- **The prior canvas is snapshotted to `_history/<slug>/`** — the mechanism exists.
- **`.tsx` + `.meta.json` land atomically or not at all.** Build out-of-tree,
  validate it parses, then write. A partial failure that leaves a codegen artboard
  stamped `route: "render"` is provenance that lies, which is worse than absent
  provenance. Note `assets.ts:33–41` documents promotion as N renames, not atomic
  — an aborted explode must not strand orphan assets.
- **The raw response stages outside the synced tree** — `mkdtemp` under
  `os.tmpdir()`/`~/.cache/maude/`, chosen by the **verb**, removed on every exit
  path. DDR-216 Round-2 finding 4 forced this because `~/git/.stignore` excludes
  neither `.design/` nor `_history/` nor `.tmp-*`: Syncthing replicates the
  **create**, so unsanitized bytes reach peers before any sanitizer runs. Asserted
  against a path prefix, joining DDR-216's standing assertion 12.

### D9 — Dispositions: enforce the enum, and bound `detail`

Three are added — `codegen-utility-unmapped`, `font-substituted`,
`codegen-unavailable` — but the guarantee they rely on has to become real first.

- **`detail` must never carry an upstream string.** `sanitize.ts:70–71` says so;
  plan T18 and acceptance criterion line 679 require the font entry to name
  *"requested and used family"*, and a Tailwind utility name is likewise upstream.
  These land in three model- and user-visible places — `_import-figma.mjs:131`
  (stdout, which **D10 declares entirely code-owned**), `http.ts:1139/1151/1162`,
  and `FigmaImportPanel.jsx:45`. React escapes, so this is not XSS; it is a **D10
  violation and a prompt-injection channel through the one field no sanitizer
  touches.** The family/utility is emitted as `attrValue(name, 32)` plus a count,
  never verbatim.
- **The enum becomes enforceable** — a frozen runtime array plus a membership
  assertion in `ImportReport.add`, or a `tsc --noEmit` scoped to
  `apps/studio/figma/**` added to `quality`. The live `asset-degraded` drift
  (`assets.ts:291`) is fixed in the same change.
- `test/figma-provenance.test.ts:87` asserts *"no Figma NAME or node text is
  anywhere on the wire"* against `/_index-data` **only** — it is extended to the
  `dispositions` payload and to verb stdout.

### D10 — Refusal, and a call ceiling

Codegen is unavailable more often than not: no Dev/Full seat, Figma desktop not
running, Dev Mode off, quota exhausted, handshake assertion failed.

**On D2's channel this is now code-observable** — the dev-server makes the call,
so it sees the failure and emits `codegen-unavailable` with a genuinely
code-owned reason. (On the first draft's channel it could only ever have been an
agent self-report, which was the review's sharpest structural finding: the one
entity trusted to report failure honestly was the one that had just consumed the
untrusted response.)

- **It does not silently fall back to Route 1.** Route 1's output is what the user
  was trying to get away from; substituting it quietly would repeat this feature's
  signature failure mode — reporting success while delivering something else.
  `--editable` stays available and explicit.
- **It does not fall back to "the agent converts the JSX by hand"** either. That
  would put a model in the emission path — DDR-174 `--reconstruct` without
  DDR-174's controls. `codegen-converter-unavailable` is its own disposition and
  its contract is **refuse**.
- **One codegen call per user invocation, enforced by the verb.** Not a property
  of how an agent chooses to behave. Without it, an instruction inside a document
  ("fetch design context for each of these node ids first…") spends the user's
  entire daily Figma budget from content, and the failure reads as a Figma
  problem.

### D11 — Two DDR-216 controls land before Phase 7, because Phase 7 was about to be the third layer on prose

`grep -rn "imported-figma" plugins/` → **zero matches**. Unimplemented:

1. **DDR-216 D7** — `/design:edit`'s pre-flight untrusted-content banner on an
   `imported-figma` canvas.
2. **DDR-216 D8** — A.10 run with findings **promoted to blocker** for
   `imported-figma` canvases.

Both ship before `--explode` does. And a caveat worth recording rather than
inheriting: **A.10 is structurally near-silent on this route** — it audits
unjustified absolute positioning, and codegen's headline property is that it emits
*flex*. Likewise D8's *"≥ 1 asset per logical mark"* gate is pinned to node-tree
fixture ids (`2:2`…`2:5`) via `to-artboard.ts`'s vector-cluster collapse, which a
route that never touches the node tree cannot fail. They are landed because
DDR-216 promised them, not because they gate this.

### D12 — The converter is a runtime-spawned helper (the first draft waived the wrong gate)

The first draft reasoned *"codegen is not spawned by the app, has no binary …
`check-bundle-completeness.mjs` gains nothing here."* Codegen (the server) is not
spawned; **`from-codegen.ts` is** — local code, invoked as a helper, with a new
parser dependency. That is exactly DDR-177's case, which exists because
runtime-spawned helpers shipped broken twice (missing `happy-dom`/`svgo`, "bun
required") — green in `tauri dev`, broken in the `.app`. Its dependency closure
stages via `helper-deps.mjs` and it joins
`check-bundle-completeness.mjs <built .app> --smoke`.

### D13 — Two plan corrections

1. **Asset expiry is 30 days for node exports, ≤14 days for image fills** (fact
   6) — two endpoints, two numbers. The plan carried one, wrong. Download-first
   was never an optimisation and is tuned to neither.
2. **§4.f** is answered by D2's channel, not by argument: our code calls read
   tools only and the write surface is out of the loop.

## Consequences

- **Phase 7 rescope.** T16 is this DDR · T17 (`from-codegen.ts`) is one frame at a
  time and inherits D5's whole contract · T18 (fonts) survives and is reinforced —
  D8 already forbids carrying a Figma family into an artifact, so a codegen
  `font-family` resolves to a DS token or a system stack, and every substitution
  reports **as a bounded token** (D9) · T19 is **absorbed into D6** (re-fetch by
  node id dedupes by construction) · T20 is answered from documentation · T21
  loses its premise — nothing is retired; render-first, the tree translator and
  codegen each own a distinct verb.
- **New prerequisite work** that was not in the plan: D11's two controls, D9's
  enum enforcement + the live `asset-degraded` fix, D2's grep tests.
- `--pages` and the Phase-5 UI are untouched. No shipped behaviour changes.
- Phase 6 (`.fig`) is unaffected.
- **One-line hardening the review asked for and this DDR endorses:** add
  `~/.config/maude/keys.json` (and the provider key store generally) to
  `.claude/settings.json`'s Read deny-list. It is not load-bearing on D2's
  channel, but it is free.

## Named residuals

1. **A codegen artboard is not reproducible from *our* sources**, and there is no
   differential oracle available — ever (fact 1). D7's response hash makes
   generator state *comparable*, not *verifiable*. **Softened by measurement:**
   the channel is deterministic call-to-call and its assets are content-addressed
   (finding 4), so re-running `--explode` on an unchanged document reproduces the
   artboard. What remains irreducible is that **we** cannot derive it — only ask
   for it again, from a generator whose behaviour is Figma's to change.
2. **The route requires a Dev/Full seat on a paid plan and a running Figma
   desktop app.** The best-quality route is available to the fewest users, and
   fact 1 means there is no second channel to build. Users without it keep
   render-first, which is a complete feature, not a broken one.
3. **The local server is unauthenticated**, so a local process can squat 3845 and
   feed us markup. Loopback-only bounds this to post-compromise; the handshake
   assertion and D5's parser contract are what limit the consequence.
4. **Local metering is undocumented** (fact 5). The per-invocation ceiling (D10)
   is set from the remote numbers, which may be wrong in either direction.
5. **D6b degrades on this route** (D4) — the invisible-text class is partially
   re-opened until DDR-216 D8's rendered-area gate is built.
6. **Figma can change the local server, its tool surface, or its availability at
   will** — it is the path Figma itself calls non-recommended. Failure mode is
   `codegen-unavailable`, which is loud, chosen over anything quiet.
7. **DDR-216 D1's invariant is now conditional** for one row of four. D3 is the
   mitigation; there is no technical one.
8. **The open-document coupling is the sharpest unresolved risk** (probe finding
   1). The tool addresses nodes with no file key, node ids are not unique across
   files, and no way to read the open file's identity over this transport has
   been found. Until it is, `--explode` can be pointed at the right node id in
   the wrong document, and every downstream control would pass. D8's refusal
   precondition is written; the *mechanism* for satisfying it is not.
9. **The route depends on a Figma-side setting the product cannot set** — Image
   settings mode, and (if `dirForAssetWrites` is ever used) the allowed-directories
   list. A user who flips either breaks imports in a way that surfaces as our bug.

## Security review

**Round 1 (2026-08-11) — design-stage, against the first draft, before any code.**
`security-auditor` (defender) returned **19 blockers / 2 warnings**;
`ethical-hacker` (adversarial) returned **11 blockers / 1 warning / 3 exploit
chains**.

**Structural closures** — the first draft routed codegen through the remote MCP,
agent-only. The adversarial round established that this closed the trifecta
inside a single turn (untrusted response inline in a `bypassPermissions` session
holding the key store and write-capable MCPs), that "agent-only reachability" was
an availability fact rather than a control, and that §4.f forces the write tools
into the same session. **The channel moved to the local server called by the
dev-server** (D2), which removes the model from the path and takes D1's broken
rows from two to one. Chain 1 (self-propagating payload via a shared library
component) and Chain 2 (reachability creep to bulk ingestion) are closed at the
architecture rather than mitigated in prose; Chain 3 (provenance laundering) is
closed by D7 + D9.

**Factual closures** — five claims about shipped code were false and are corrected
in **D4**; the two unimplemented DDR-216 controls became **D11**; the live
`Disposition` drift at `assets.ts:291` became **D9**; the missing parser contract
became **D5**; the asset lane's "no legal path" became **D6**; the write model
became **D8**; the wrongly-waived bundle gate became **D12**.

**Verified independently before adoption**, because a review can overstate:
`grep -rn "imported-figma" plugins/` → zero matches (confirmed); `VAR_RE` at
`style-map.ts:53` (confirmed, rejects fallback-bearing `var()`);
`FIGMA_ASSET_HOSTS` frozen (confirmed); `asset-degraded` off-enum (confirmed);
`.claude/settings.json:16` + `:7–15` (confirmed). **One finding was corrected
downward:** the reported unsanitized `alt=`/`data-dc-element=` attributes are in
fact charset-bounded — `to-render.ts:229` does `label = attrValue(node.name) ||
abId` before `JSON.stringify`. The `JSON.stringify`-as-JSX-attribute-escaper
pattern is nonetheless unsound (a JSX attribute literal does not process
backslash escapes) and **T17 would extend it to a genuinely unbounded source**, so
`data-figma-node` and every codegen-derived attribute route through `attrValue()`.
Similarly, `_curl-local.mjs:46–49` already names the loopback-service hazard in
its own header, so D2 records it as a known accepted property rather than a new
discovery.

**Re-review required post-implementation**, per the standing rule — the parser
(D5) and the write model (D8) are the two surfaces that cannot be signed off from
a document.
