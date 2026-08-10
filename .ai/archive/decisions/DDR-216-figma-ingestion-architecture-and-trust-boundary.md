# DDR-216 — Figma ingestion is deterministic code end to end; the exposure moved from ingestion to consumption, and that is where the controls are

- **Date**: 2026-08-09
- **Status**: Accepted — after **two** design-stage review rounds
  (`security-auditor` + `ethical-hacker`, 2026-08-09). Round 1 found **two
  blockers, five highs and a set of false claims about existing code** in the
  first draft, forcing three structural changes: the annotation layer is a
  first-class sink (D1/D6), the mandatory SVG collapse is resolved as a
  **composition of two already-reviewed gates** rather than a widening of one
  (D11), and `figma` is **not** a media-generation provider (D2). Round 2
  confirmed all nine closed and found nine second-generation items, of which the
  sharpest are: zero-glyph (Unicode Tags) payloads bypassing the visibility rule
  entirely (D6a), visibility being a **composited** property so the rule was
  inverted from detect to **normalize** (D6b), and *gitignored ≠ not replicated* —
  `~/git/.stignore` excludes neither `.design/` nor `_history/`, so staging moved
  out of the synced tree (D5). Every closure is recorded in § Security review.
  This DDR gates every line of `feature-figma-import` Phases 1–5, the same
  pre-code discipline DDR-167 gated T10, DDR-172 gated T11 and DDR-174 gated T15.
- **Scope**: `repo:maude`, `dept:dev`
- **Area**: Figma import (REST client, three translators, PAT custody, route
  classification, generated-JSX + annotation-layer sanitization)
- **Relates to**: DDR-174 (the **contrast case** — its architecture exists because
  an LLM reads untrusted input; this feature must not copy it, but it must not
  claim immunity from the class either), DDR-167 (byte-ingestion posture; the SVG
  allowlist + SVGO + canary lane D11 composes with), DDR-172 (the token mapping
  contract Phase 4 feeds; the value-grammar and wrapper-hygiene precedent),
  DDR-085 + DDR-151 (the whiteboard read/write surface and its existing
  untrusted-content residual, which this feature materially widens),
  DDR-088 + DDR-054 (the two-allowlist canvas-origin convention and the
  untrusted-peer sync model), DDR-062, DDR-027 / DDR-181 / DDR-187 / DDR-188,
  DDR-115 (runtime-state taxonomy — `*.annotations.svg` is **versioned**)
- **Defers**: `.fig` / `.jam` local decoding to its own DDR with its own
  dependency review (plan Phase 6 / T13) — see § Deferred, explicitly.

## Context

Maude has exactly one Figma path today: `/design:import --reconstruct`, which
reads a **flattened PNG** with a vision model and re-authors an approximation
(DDR-174). Everything Figma actually knows — layer structure, auto-layout, text
content, exact colours, component boundaries, connector bindings — is discarded
the moment the frame is rasterized, and the result is explicitly labelled
experimental, lossy and non-deterministic.

`feature-figma-import` builds the real path: a Figma personal access token plus a
file URL, the actual document JSON over `GET /v1/files/:key`, and **three
deterministic translators** — FigJam board → the whiteboard `Stroke` model, design
frames → a `DCArtboard` canvas, paint/text/effect styles → W3C design-tokens JSON
handed to DDR-172's existing importer. A second door (`.fig`/`.jam` binary,
Phase 6) is deferred here but designed for: both doors converge on **one
normalized node tree**, so the translators are written once.

**Why this needs its own DDR rather than riding on DDR-174.** DDR-174 governs a
pipeline whose defining property is that an LLM perceives attacker-controlled
content *while holding tools*. Four rounds there converged on capability removal,
because there is no grammar for "the semantic content of an arbitrary UI mockup".

**That architecture does not transfer, and copying it in would close nothing.**
This feature's ingestion path contains no agent turn at all: a Figma document is
parsed by code, mapped by code, and written by code. A future maintainer reading
`import.md` must not cargo-cult DDR-174's orchestrator/agent split into a code
path that has no agent in it.

**But — and this is the correction Round 1 forced — removing the LLM from
ingestion does not remove this feature from DDR-174's threat class. It moves the
exposure downstream.** The first draft of this DDR asserted that an imported
canvas is "the same exposure every canvas in the repo already has". That is
false, and it was the root of both blockers. Every other canvas in this tree was
authored by the user or by an agent under the user's direction. **An imported one
is authored by a third party, arrives carrying a badge that says it is real design
work, is committed and peer-synced (DDR-054), and is subsequently read into the
context of agents that hold `Bash`** — `/design:edit`, `/design:board`,
`design-system-keeper`, the critic panel. The FigJam path is sharper still: sticky
text lands **verbatim** in `<slug>.annotations.svg`, which is **versioned**
(DDR-115) and which `maude design read-annotations` parses into JSON *for the
express purpose of putting it in a model's context*.

So this DDR closes two different families:

1. the ordinary code-level classes a parser and code-generator face — SSRF,
   credential handling, resource exhaustion, CSRF, and injection into JSX that is
   compiled and executed (D2–D6, D11);
2. the **semantic** class DDR-174 named, arriving through a different channel and
   at a different time — third-party content, delivered to a tool-holding agent
   after the fact (D1, D6's visibility rule, D7's framing). This one is bounded
   and named, not closed: escaping proves a string is not *code*; it proves
   nothing about the string being *instructions*.

## Decision

### D1 — No model reads Figma content during ingestion; every consumption sink is enumerated, and the semantic residual is named rather than argued away

**The invariant, stated precisely (Round-1 revision — the first draft's wording
overreached):** from the moment a Figma document enters this feature to the moment
an artifact lands on disk, **every step is deterministic code.** No subagent is
spawned. No node name, text content, style value or API response is placed into
any model's context by this feature's own ingestion code paths.

Greppable prohibitions, which are what a reviewer actually checks:

- spawning an agent (`Task`/`subagent_type`) from any Figma code path or from the
  `--figma` / `--from-figjam` sections of the plugin markdown;
- an orchestrating command reading a fetched document, an intermediate report, or
  a generated `.tsx`/`.svg` **content** into its own context to summarize,
  describe or branch on it. The per-import summary is produced **by the verb** and
  is a structured accounting of node ids and enum reason codes (D7), never prose
  an LLM composed after reading the document;
- interpolating any Figma-derived string into a shell argument. `import-figma.sh`
  forwards `"$@"` quoted and never `eval`s (DDR-172 Decision 8); `_import-figma.mjs`
  uses fixed `execFileSync` argv with the URL/path as a single element.

**The consumption sinks, enumerated — this is the list the first draft did not
have.** Each is either closed by a syntactic control (D6/D11) or named as a
semantic residual:

| Artifact | Reaches a model how | Status |
| --- | --- | --- |
| `<slug>.tsx` (imported canvas) | `/design:edit` reads the file; `design-system-keeper` + critics read it; `canvas-rects` surfaces rendered text | Syntactically closed (D6); **semantically open** — see residual 1 |
| `<slug>.annotations.svg` | **`maude design read-annotations` parses it into JSON expressly to put in a model's context**; versioned + peer-synced | Syntactically closed (D6 annotation row + `sanitizeAnnotationSvg`); **semantically open** — the sharpest instance, see residual 1 |
| `.meta.json` provenance | Read by the tree, by agents, peer-synced | **Closed by elimination** — identifiers only (D7) |
| `config.json` (Phase 4 new-DS) | Read by multiple agents, peer-synced | **Closed by elimination** — DDR-172 Decision 8's fixed-template rule applies unchanged (D6) |
| `system/**` token names + values | Rendered live in every canvas; read by agents | Grammar + name-charset bounded (D6) |
| `_history/_system/` import report | `_history/` is gitignored but skills do read it | Enum-only by construction (D7) |
| The verb's stdout/stderr | The verb is run **by an agent** — its output is model input | Code-owned by construction (D10) |

**The residual is named in D1 rather than buried:** an imported artifact is
third-party free text delivered to a tool-holding agent. No escaping closes that.
What this DDR does about it is (a) refuse to emit content that is invisible to a
human reviewer (D6's visibility rule), (b) mark it as third-party rather than as
legitimate design work (D7), and (c) state it plainly here so the whiteboard trust
model's existing "untrusted content, never instructions" discipline is understood
to apply to imports too — at materially higher volume than the hostile-peer case
it was written for.

**Consequence for the docs**: `plugins/design/commands/import.md`'s `--figma`
section states the DDR-174 contrast at the top *and* carries the untrusted-content
banner, so neither half is lost.

### D2 — PAT custody reuses `keys.ts`'s store unchanged and adds two gated routes; `figma` is deliberately NOT a media-generation provider

**Round-1 correction (HIGH).** The first draft claimed `figma` would be
"registered as an ordinary provider … with zero new custody code". That is false
against the real registry: `ProviderDescriptor` (`generation/types.ts`) requires
`kind` and `modalities: readonly Modality[]` where `Modality = 'image' | 'video'
| 'audio' | 'transcription'` — Figma is none of those — and `ProviderEntry`
(`generation/registry.ts`) requires a `factory: AdapterFactory` plus a model list.
Satisfying that shape means either a stub adapter, which `createAdapter('figma', …)`
would happily instantiate the moment anything POSTs `provider:"figma"` to the
existing generate-jobs route, or a registry type change. Both are new code, and
the stub is a live sink on an existing route. It would also create **two write
paths for one secret** (`/_api/generate/keys` *and* `/_api/figma/connect`), which
is how one of them ends up ungated.

**Decision:** `figma` is **not** in the media-generation registry — it generates
no media. What is reused is the **key store itself**, which needs no edit at all:
`PROVIDER_ID_RE` in `generation/keys.ts` already admits the id `figma`. The two
dedicated routes (D3) call `setProviderKey` / `isConfigured` / `deleteProviderKey`
directly.

Binding rules, all inherited from the store rather than invented:

- **`~/.config/maude/keys.json` at mode 0600**, outside the served `.design/`
  tree, with an explicit post-write `chmod` (`writeFileSync`'s mode is
  umask-masked).
- **Resolved at request time, never cached.** `getProviderKey('figma')` is called
  inside the request that needs it; never a module-level variable, never memoized,
  never written to a report artifact.
- **Never echoed.** The connect route returns `{ configured: true }`; the status
  route returns presence only. No route, CLI flag or error path returns the value.
- **Never logged, never in an error message.** Client errors are built from
  code-owned strings and the request *path* — never headers, never a raw response
  body (D10). A standing test asserts the token appears in no thrown error and no
  log line.
- **Scope**: users are instructed to mint a token with **`file_content:read`**.
  The blanket `files:read` scope is deprecated in favour of granular scopes; the
  UI and docs name the granular one only.

**Unverified and therefore not claimed:** whether the Tauri keychain bridge
allowlists provider ids natively is unestablished — no provider-keyed keychain
handling was found in `apps/desktop/src-tauri/src/`. Phase 5 uses the file store;
any keychain claim must be verified against the native side before it is made,
and a native change is a rebuild + re-sign, not "zero new code".

### D3 — The Figma routes are privileged-origin only — in NEITHER canvas allowlist, AND loopback + same-origin gated

`POST /_api/figma/connect`, `GET /_api/figma/status` and `POST /_api/figma/probe`
are added to **neither** `CANVAS_SAFE_API` (`http.ts`) **nor** the
`startCanvasServer` `routes` map (`server.ts`). A canvas-reachable Figma route is
simultaneously a **token-exfiltration** primitive and an **SSRF** primitive, and
canvases execute as real, unsandboxed JS on a separate origin (DDR-054), so "a
canvas would never do that" is not a control.

**Round-1 correction (HIGH): allowlist exclusion proves the wrong property on its
own.** The canvas origin is not the only attacker. Every other credential-bearing
route in `http.ts` applies two further gates that the first draft never named —
and the very route D2 cites as its template, `/_api/generate/keys`, applies both:

- **`isTrustedRequestHost(req)`** — the loopback-Host / DNS-rebinding guard;
- **`sameOriginWrite(req)`** — the Fetch-Metadata CSRF guard, which exists in this
  codebase *because an earlier ethical-hacker finding required it*;
- **`readJson(req, <cap>)`** — a byte-capped body read.

Without them, any page the user visits while the dev server is up can POST
`http://127.0.0.1:<port>/_api/figma/probe` as a CORS-simple request: the response
is opaque, but **the side effect lands** — the server spends the user's PAT on an
attacker-chosen file key and burns the rate-limit budget, loopable. `connect` is
worse: it **plants an attacker's PAT**, so the next import silently authenticates
as the attacker.

**All three routes therefore carry `isTrustedRequestHost`, plus the CSRF guard
appropriate to their method**, stated here as named requirements rather than
assumed house style. **`probe` counts as a write for gating purposes** — stated
explicitly, because it reads nothing locally and a reviewer could reasonably gate
it as a read, which would undo this closure for the one route that spends the PAT
on an attacker-chosen key.

**Implementation finding (2026-08-09, T4 — the two guards are not
interchangeable, and the GET needs the other one).** This codebase has two CSRF
helpers with different discriminators, and the first revision named only one:
`sameOriginWrite` keys on **`Origin`**, which a browser stamps unspoofably on
every cross-origin POST/DELETE; `sameOriginRead` keys on **`Sec-Fetch-Site`**,
and exists precisely because browsers do **not** reliably stamp `Origin` on a
simple cross-origin GET. So `sameOriginWrite` alone leaves `GET
/_api/figma/status` open to a `no-cors` GET from any page the user visits —
which leaks whether they have Figma connected. Small, but it is a cross-site
state leak on a credential-presence probe, and it is the same shape as the
finding `sameOriginRead` was added for in the first place.

**Binding:** `connect` (POST/DELETE) and `probe` (POST) carry `sameOriginWrite`
+ a `readJson` byte cap; `status` (GET) carries `sameOriginRead`. Asserted in
`test/figma-routes.test.ts` — a cross-origin write is 403, and a `Sec-Fetch-Site:
cross-site` read is 403. Writing that test is what surfaced the gap.

**Two standing assertions, both in the task that adds the routes** (CLAUDE.md's
rule, extended): `GET → 405` from the canvas origin in
`test/canvas-origin-gate.test.ts`, **and cross-site → 403** (`Sec-Fetch-Site:
cross-site`) in `figma-routes.test.ts`. The first alone is the wrong proof.

**A FOURTH route, added at implementation (T11, 2026-08-10): `POST
/_api/figma/import`.** This decision originally named three, and a UI that can
only store a credential is not a feature — the panel needs to *run* an import.
The route carries the identical triple gate and for the identical reasons: it
spends the PAT, it reaches the network, and it writes the design root.

Three properties keep it from widening the surface it sits on:

- **The body is validated into a fixed `{ mode, url, dryRun }` shape.** A caller
  supplies no slug, no path, no output location — the same "the producer never
  picks its own target" discipline DDR-174 applies to its authoring agent. A
  `slug`/`into` field in the body is simply never read.
- **It calls the CLI helper, not a second implementation.** One code path means
  the panel and `maude design import-figma` cannot drift apart in what they
  sanitize, cap or report — the drift that would otherwise show up first in
  whichever surface is tested less.
- **It returns the SAME enum-coded summary the verb prints.** That is what makes
  it safe to hand to a client at all (D7/D10): node ids and fixed reason codes,
  never node text.

**And it is `FORBIDDEN_ROUTE_PREFIXES`-covered like the other three** — the
prefix is `/_api/figma`, so a cell prunes all four together. Adding a route to
this family after that entry exists is safe by construction; adding the family
without it was the post-implementation review's first blocker.

Any future in-canvas Figma affordance re-derives this decision from scratch.

### D4 — The SSRF model: two chokepoints, one hardcoded base, one existing gate — narrowed at the gate, not at the caller

**Chokepoint 1 — the API base URL is code-owned, never input-derived.**
`figma/url.ts` extracts only a **file key** (`^[A-Za-z0-9]{10,64}$`) and an
optional **node id**, normalized `123-456` → `123:456` and validated
(`^[0-9]+:[0-9]+$`). **The host is never taken from the input.** Every request URL
is composed from a hardcoded `https://api.figma.com/v1` constant plus the
validated segments, each `encodeURIComponent`-ed. The parser is a *rejection*
surface: userinfo-in-host, IDN homographs, `..` / `%2e%2e`, over-length, a
non-`figma.com` host, a `data:`/`file:` scheme, a key containing `/`/`@`/`#`, and
a full absolute URL passed as the key are all hard rejects with a fixed error,
tested as a table. **Round 1 attacked this specifically and could not break it** —
recorded so it is not re-litigated.

**Chokepoint 2 — `/v1/images` returns response-controlled URLs; they go through
`_fetch-asset.mjs`'s existing gate.** Those S3 URLs are treated as fully
untrusted, exactly like a research-harvested moodboard image. The gate's
properties were verified line-by-line in Round 1 and are accurate as relied on
here: https-only, `--max-redirs 0`, fixed non-interpolated argv with the URL last
after `--`, `--noproxy '*'`, size + time caps, a resolved-IP classifier over
**every** A/AAAA record that refuses if **any** is internal (loopback,
link-local incl. IMDS, RFC-1918, CGNAT, multicast, reserved; v4 and v6 including
IPv4-mapped and NAT64 embeds), **DNS pinning via `--resolve`** against a rebinding
TOCTOU, a magic-byte sniff that trusts neither the URL nor `Content-Type`, and a
content-addressed flat write with a charset assertion and realpath containment.

Two additions, both narrowing, and — **Round-1 correction (MEDIUM)** — both
placed **at the gate, not at the caller**:

- **A host allowlist implemented as a repeatable `--allow-host <suffix>` flag on
  `_fetch-asset.mjs` itself.** The first draft left placement unstated, which
  meant it would necessarily live caller-side — outside what that file's own
  header calls *"the ONE reviewable place that does the fetch safely"* — and would
  be silently dropped by any later call site or refactor. Absent flag = today's
  unrestricted behaviour, so the existing moodboard callers are untouched; the
  Figma lane always passes it, asserted by a test.
- **Matching is exact-or-dotted-suffix, never `endsWith`.** `host === 'figma.com'
  || host.endsWith('.figma.com')` — a bare `endsWith('figma.com')` admits
  `evil-figma.com`, and `endsWith('.amazonaws.com')` admits every S3 bucket on
  earth. The Figma render bucket is matched **exactly**, from a frozen array.
- **Port 443 is pinned for this lane — and that is NEW logic, not an existing
  property.** `parseHttpsTarget` derives the port from the URL and accepts
  1–65535 today. Named here so it is implemented rather than assumed (Round-2
  finding: an unimplemented pin stated as a property is how prose becomes a
  believed control).

**The allowlist narrows the gate; it never replaces it, and it is a *reach*
control, not a *content* control.** An allowlisted hostname resolving to
`127.0.0.1` is still refused (verified). And the Figma render bucket is a
**shared** object store that any Figma account can write into — so trusted-host
status buys much less than it appears to. **The byte-level sniff is what actually
protects the tree**, which is precisely why D11 resolves the SVG question by
composition rather than by relaxing that sniff.

**Asset URLs expire.** Figma's own support documents a lifetime on the order of
**30 days**, not the ~7 days the plan assumed — corrected here so nobody
"optimizes" download-first against the wrong number. Download-first is mandatory
regardless: a hotlinked `<img>` is CSP-blocked in the canvas iframe (`img-src
'self' data: blob:`), and a shipped canvas that fetches a third-party URL at
render time is its own problem. A generated canvas references `/assets/<sha8>.<ext>`
and never a figma.com URL.

**No second read path.** This feature implements no downloader, no redirect
follower and no image sniffing of its own. If the gate refuses a URL, the node is
reported skipped and the import continues — a refusal is never routed around.

### D5 — Caps: hard refusals before translation, explicitly-reported bounded degradations during it, and a cumulative byte ceiling

A Figma file is attacker-shaped input even when it is the user's own: a real
first-party page measured **449 KB / 4 125 nodes / depth 13** in the
*metadata-only* projection, and the full REST payload is materially larger.
Whole-file import is not a viable default; frame-scoped is.

**Round-1 correction (MEDIUM):** the first draft claimed *every* cap is a hard
refusal and "never a truncated best-effort translation" — then mandated truncation
twice in the next decision and continue-on-failure in the previous one. The two
classes are now separated, and **both are reported**:

**Hard refusals — checked before translation, nothing written:**

| Cap | Value | Why |
| --- | --- | --- |
| Response bytes (any single REST call) | **8 MB** | Bounded read; past this is a "select a frame" case |
| Node count (normalized tree) | **20 000** | ~5× the measured real page |
| Tree depth | **64** | 5× the measured 13; also bounds every recursive walk |

**Bounded degradations — permitted, but each emits a reason code into D7's
summary, so "never silently dropped" stays true:**

| Bound | Value | Reason code |
| --- | --- | --- |
| Attribute value length | 64 chars | `truncated-attr` |
| Text node length | per-node capacity (sticky/shape/text) | `truncated-text` |
| A refused asset download | — | `asset-skipped` |
| Total assets per import | **200** | `asset-cap-reached` |
| Generated JSX bytes per artboard | **512 KB** | `jsx-cap-reached` |

**Cumulative bytes, and a write model that leaves no residue.** Round 1 built a
document that is under every per-item cap and still writes ~2 GB into a
**versioned, Syncthing-replicated** `assets/` tree: 200 top-level VECTOR nodes,
each its own parent (which defeats parent-collapse by construction), each
rendering to just under the downloader's 10 MB default.

**Round-2 correction — "gitignored" is not "not replicated", and this DDR leaned
on a git-taxonomy decision to claim a containment property it does not provide.**
The first revision staged under `_history/_system/` and justified it as
"gitignored runtime state … so a failure leaves nothing versioned behind". But
the threat D5 itself states twice is *Syncthing-replicated* and *cross-machine* —
and `~/git/.stignore` (verified in full: `node_modules`, `dist`, `build`,
`.turbo`, `.expo`, `ios`/`android`/`web-build`, OS/IDE files, `coverage`,
`.playwright-mcp`, `.cache`, `.next`, `/productivity-stack`) contains **no
`_history`, no `.design/`, no `.tmp-*` entry at all.** Syncthing is a filesystem
watcher: it replicates the *create*, not the commit. Staging under `_history/`
moves the bytes from one replicated directory to another and closes only the git
half of a threat defined by its Syncthing half. Worse, under D11 those staged
bytes are **unsanitized attacker SVG**, replicating to peers before the sanitizer
ever runs.

Four closures:

- a **total asset-bytes cap per import** (default **64 MB**), plus a Figma-lane
  `--max-bytes` far below the 10 MB default (a UI vector export is kilobytes);
- **staging happens OUTSIDE the synced tree entirely** — a `mkdtemp` directory
  under `os.tmpdir()` / `~/.cache/maude/`, never anywhere under the design root.
  Nothing in this decision's rationale requires it to be in-tree, and out-of-tree
  closes git, Syncthing and the peer-visibility window in one move. **The
  exclusion is verified against the sync list, not the git list** — that
  substitution is exactly what produced this error;
- the staging directory is **per-run, named by run id, and removed on EVERY exit
  path** — success, cap trip, parse failure, `SIGINT`. A `finally` alone is not
  sufficient (it does not run on `SIGKILL`/OOM), so the staging root itself
  carries a ceiling and a stale-directory sweep on next run;
- **promotion is atomic, not N renames.** A crash mid-promote must not leave a
  partial asset set in the versioned tree while the report says the import
  failed: promote by a single directory rename, or make it manifest-driven and
  resumable.

**The repo-level `assets/` ceiling is NEW code, and it governs one lane.**
Round 2 correctly flagged the first revision's claim that it would be "wired to
the existing `asset-sweep` machinery" as **a false claim about existing code** —
verified: `apps/studio/bin/asset-sweep.sh` is a *pre-scaffold grep* over a target
repo for existing logo/mark/wordmark sources, feeding `/design:setup-ds` so
placeholders aren't authored over real marks. It has no concept of storage
accounting, byte totals or GC. There is nothing to wire to; the ceiling is new
code, stated as such. It also governs the **in-repo** asset lane only: when
`s3Assets` is on (DDR-192 §1), `cli/lib/gitignore-block.mjs` gitignores
`<root>/assets/` and media lives in the bucket, replicating via the hub — so in
that configuration a directory-size check measures the wrong thing and the cap
that matters is the per-import total above.

**Batching and rate limits.** `IMAGE_COST = 200` ⇒ ~30 req/min, 6 000/day —
the tight endpoint; `FILE_COST = 50` ⇒ ~120 req/min, 24 000/day. Image ids are
batched **≤ 100 per call**, never one call per node. `Retry-After` is honoured
with **bounded** backoff (max 3 retries, 30 s cap per call, never an unbounded
sleep loop); exceeding it surfaces "Figma rate-limited this import, try again in a
minute", not a silent partial result. Limits are per-user and Figma re-tiers them
periodically — this is a design assumption checked against the changelog at
implementation time, not a guarantee.

**`GET /v1/files/:key/variables/local` is plan-gated (Enterprise). A 403 there is
a normal, expected outcome** that degrades to the styles path and is reported as
"using your styles", never as a failure.

**Prototype-pollution-safe walks** (`__proto__` / `constructor` / `prototype`
skipped at every recursion level, `Object.create(null)` for any map built from
response keys) and **no unbounded recursion** (depth cap checked before descent)
apply to every traversal, per DDR-172 Decision 3.

### D6 — The sanitization contract, by sink — including the annotation layer, and including a visibility rule

This is where this feature's real novelty sits: **the generated JSX is executed**,
and **the generated annotation SVG is deliberately fed to an agent**.

Figma layer names and text are attacker-controlled in the strongest practical
sense: a TEXT node's layer name *defaults to its own content*. Measured production
names carry spaces, em-dashes, arrows and diacritics (`V4 — Airy / light`,
`Html → Body`); the fixtures deliberately include `Příliš žluťoučký — "test" / <b> & 'x'`
and `Karta — "uvozovky" / <script> & {curly} → šipka`.

| Sink | Rule |
| --- | --- |
| **JSX identifier / component name** | Never derived from a Figma string. Names are code-generated from the **node id** (`Node_2_17`), which is `^[0-9]+:[0-9]+$`. Airtight — there is no Figma string in the identifier space at all. |
| **`data-dc-element` / any attribute value** | Allowlist charset `[A-Za-z0-9 _-]`, collapsed, truncated to 64; empty after sanitization ⇒ node-id fallback. Never the raw name. |
| **JSX text content** | Emitted as a **text child** inside a `{'…'}` string expression through a JS string-literal escaper covering `\`, `'`, `"`, `<`, `>`, `{`, `}`, newlines **and U+2028 / U+2029**. **Never** an attribute, never markup, never `dangerouslySetInnerHTML`. *(Round 1 attacked this and could not break it, conditional on those two caveats — both are now written into the rule.)* |
| **Annotation SVG (`<text>` content, `data-label`, every `data-*`)** | *(Round-1 blocker — this row did not exist.)* Escaped via the model's own `esc()` / attribute escaper, and the emitted file passes **`sanitizeAnnotationSvg()`** (element allowlist + attribute denylist) before write — cited by name because it exists and the first draft never mentioned it. **Note explicitly: this is an XML-safety gate, not a semantic one** — it makes the text inert as *markup*, not as *instructions* (D1's residual). |
| **CSS value (colour, dimension, shadow, font)** | Per-family grammar, reusing DDR-172 Decision 4 verbatim: printable-ASCII-only pre-filter, no `m`/`s` regex flags, shape **and** magnitude bounds, no unbounded free-text capture, literal space not `\s`. A failing value is dropped and reported, never "cleaned up". |
| **Design-token NAME (Phase 4)** | A Figma paint/text/effect style's *name* becomes a token name and then a live CSS custom-property name in versioned, peer-synced `system/**`. Charset-bounded (`^[a-z0-9-]{1,64}$` after normalization) before it reaches any output. A style **description** is free text and is **never carried through** — DDR-172 Decision 8's fixed-template rule applies unchanged. |
| **`/v1/me` display name (Settings "Connected as …")** | Upstream-controlled. Length- and charset-bounded, rendered through React (never `dangerouslySetInnerHTML`), and **never persisted** into `config.json` or any versioned file. |
| **Slug / filename** | Code-computed from the node id plus a user-supplied name, `^[a-z0-9-]{1,64}$`. Never from a Figma string. |
| **Import specifier** | Fixed vocabulary only (`@maude/canvas-lib`). A Figma document cannot introduce an import. |
| **Imported vector asset** | Referenced only — `<img src="/assets/…">` / `<image href="assets/…">`. **Never inlined into JSX.** See D11. |
| **`.meta.json` provenance** | `fileKey`, `nodeId`, `importedAt` only (D7). |

**Two content rules, not one — and their scope is stated honestly.** A syntactic
contract proves a string is not code; it says nothing about a string being
*instructions*. The lethal-trifecta shape (third-party content + private data on
the same machine + a tool-holding session) is closed only to the extent that a
human reviewing the import can actually *see* what an agent will later read. Two
independent mechanisms, because Round 2 broke a single one twice.

**D6a — the character-class rule (Round-2 finding; machine-checkable, complete).**
The escaper covers characters that could terminate a literal. It does **not**
touch characters that have **no glyph at all** — so a TEXT node reading `Nadpis`
followed by a payload encoded in the Unicode **Tags block (U+E0000–U+E007F)** — a
full ASCII alphabet that renders as literally nothing in every browser, every
screenshot and every human review, and which models routinely reconstruct as
plain text — passes `opacity: 1`, `fontSize: 16`, high contrast, non-zero area,
`visible: true`, the escaper, and `sanitizeAnnotationSvg`. Every clause of the
visibility rule below passes it. So does zero-width (U+200B–200D, U+FEFF,
U+00AD, variation selectors) and the Trojan-Source bidi technique (U+202A–202E /
U+2066–2069, CVE-2021-42574), which makes the rendered order a human reviews
differ from the source order in the `.tsx`.

Therefore, inside both writers: **NFC-normalize, then reject** C0/C1 controls,
U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+00AD, U+FEFF, variation selectors
and the entire Tags block — in JSX text, annotation `<text>` content, sticky
text, and token names. Reason code `hidden-chars-dropped`. Unlike D6b this is a
closed, enumerable character-class check with no compositing dependency, so it is
genuinely complete for what it covers.

**D6b — visibility: normalize, don't detect (Round-2 correction of the first
revision's rule).** The first revision stated *"nodes that are not visible are not
emitted"* as an invariant and then implemented it as four per-node property
checks. Round 2 broke that four ways, all of which pass every clause: **z-order
occlusion** by an opaque later sibling (the ΔE clause compares fill to the
*parent background*, not to the occluder); **ancestor clip** (`clipsContent` on a
frame the text sits outside — the node's *own* area is non-zero); **compounded
opacity** (Figma multiplies down the tree, so `opacity: 1` inside a `0.02` group
reads as 1.0 per-node); and **blend mode** (white text `MULTIPLY` over white — the
clause compares the *declared* fill, not the composited result). A denylist also
loses on its own terms: `opacity: 0.06` clears any sane threshold and
`fontSize: 4.5` clears the floor.

The fix is to stop trying to prove invisibility. **The translator authors these
nodes, so it can guarantee visibility instead:** clamp imported `fontSize` to a
floor, force imported text colour to a minimum contrast against its own resolved
fill, and clamp imported geometry into the artboard's occupied bounds. Hidden
text becomes *visible* text — strictly better than dropping it, and fully
machine-checkable with no compositing model. `visible: false` nodes are still
skipped outright, and the four detection clauses remain as a reported
best-effort (`hidden-text-normalized` / `hidden-text-dropped`), **named as a
denylist, not as an invariant.**

The backstop for what normalization cannot reach is a **rendered** check, not a
property check: the pipeline already renders headlessly for `canvas-rects`, so
D8's gate list asserts that every text node in the emitted `.tsx` has non-zero
*rendered, unoccluded* area. A rule stated as four node properties gets
implemented as four `if`s and misses all four rows above.

**Scope, stated because the first revision claimed it where it does not apply.**
D6b is written in **Figma-design** vocabulary and covers the **canvas path only**.
It does not map onto the Stroke model at all: verified — `StrokeBase` carries
`id`, `groupIds`, `author`, `authorName`, `authorId`, `rotation` and **no
`opacity`**; there is no clipping and no parent background to ΔE against; and
`read-annotations`' output shape (`{tool, id, x, y, w, h, text, color}`) carries
**no `fontSize`**, so a consuming skill cannot see the size even in principle.
For the board path the equivalent is **normalization** (clamp `fontSize`, force
minimum contrast of sticky/text colour against its own fill, clamp world
coordinates into the board's occupied bounds — the measured real board already
spans x −3 244…+11 037, so a stroke parked far outside looks like ordinary
geometry), plus D7's extension of `read-annotations`' output with `fontSize` and
the provenance flag.

**And on a board, the payload does not need to hide at all** (Round-2 finding).
A 300-sticky workshop board is imported wholesale and no human reads all 300; a
fully visible sticky is completely effective. That is not closable by a content
rule, so the board path gets a **non-content** control instead: a per-import
**stroke-count ceiling** above which the import requires explicit confirmation,
and board imports land in a **quarantined staging canvas the user promotes** —
composing with the existing `_untrusted/` mirror pattern (DDR-054,
`cli/lib/gitignore-block.mjs`) rather than inventing a new one. Residual 1 owns
what remains.

**Two structural properties make the syntactic half checkable:**

1. **Emission goes through single writers** — one for JSX, one for the annotation
   SVG. No translator concatenates a Figma-derived string into output itself. A
   standing grep test, pinned to a **directory glob** (not a file list, so a
   translator added later cannot escape it), bans raw template-interpolation of a
   node's `name`/`characters` field in either writer's tree.
2. **The canvas-origin split is the backstop, not the control** (DDR-054 +
   DDR-088). Generated JSX executes on the segregated origin where privileged
   routes structurally do not exist — including, per D3, this feature's own.

### D7 — Provenance is identifiers only, framed as third-party content, and it covers the board as well as the canvas

Every imported canvas carries `kind: "imported-figma"` plus
`source: { fileKey, nodeId, importedAt }` in `.meta.json`, threaded through the
existing `canvasKinds` plumbing (a one-line addition to `NOTABLE_KINDS` in
`api.ts`) to a file-tree badge.

**Only identifiers, never names or text.** `.meta.json` and `config.json` are
versioned, peer-synced (DDR-054) *and* read into multiple agents' context —
DDR-172 Decision 8 traced exactly this and eliminated the free-text sink rather
than bounding it. Same elimination: a Figma file name, page name, frame title or
node text **never** reaches provenance metadata. A file key is
`^[A-Za-z0-9]{10,64}$`, a node id `^[0-9]+:[0-9]+$`, the timestamp is
server-generated — three constrained values, no free text, no residual to name.

**Round-1 corrections, both about what the badge *means* and where it *is*:**

- **The badge must read as third-party content, not as legitimacy.** "Imported
  from Figma" with a clean provenance stamp reads to a human as *real design work*
  and to `design-system-keeper` and the critics as *an ordinary canvas* — which
  increases trust in the most attacker-influenced artifact in the tree. Badge copy
  and the artboard chrome say **imported — third-party content**, and
  `/design:edit`'s pre-flight on an `imported-figma` canvas prints the same
  untrusted-content banner the whiteboard trust model already requires.
- **The FigJam output needs provenance too.** It is a `.annotations.svg` with no
  `.meta.json` and no `kind`, so under the first draft the artifact carrying the
  *most* untrusted free text carried *no* marker — the inverse of the risk
  ordering. Imported strokes are stamped with a provenance attribute (checked
  against the sanitizer's element/attribute allowlist first; **not** `author:"ai"`,
  which the trust model explicitly says is not a trust signal), and
  `read-annotations` surfaces it in its JSON so a consuming skill can distinguish
  "the user drew this" from "a third party's Figma file did". **`read-annotations`'
  output also gains `fontSize`** — today's shape (`{tool, id, x, y, w, h, text,
  color}`) omits it, so a consuming skill is handed text with no way to know it
  renders at 1 px (D6b). Verified that a `data-*` provenance marker survives
  `sanitizeAnnotationSvg`: Rule 3's denylist strips only `on*` / `style` /
  `*href`, and Rule 2's element allowlist passes the element intact.

The **per-import summary** is a structured report (`{ nodeId, type, disposition,
reason }[]`) printed by the verb and written under `<designRoot>/_history/_system/`
(gitignored runtime state), matching `import-tokens`'s convention. Reasons come
from a **fixed enum** — including every code named in D5 and D6. Node *text* is
never quoted into the report.

### D8 — Editability is the acceptance bar — enforced by machine-checkable gates, because the gate the first draft named is not one

The governing user decision is that both outputs land **editable, always**. That
is security-adjacent as well as product: the mitigations it mandates are the same
ones that bound output size and asset count.

Mandatory:

1. **Flatten styleless `Group` wrappers** — hoist children, drop the node.
2. **Collapse a vector cluster to ONE parent-node export** (D11) — simultaneously
   the editability fix, the `IMAGE_COST` fix, and the file-size fix.
3. **Prefer flex wherever auto-layout exists**; absolute positioning (DDR-188
   vocabulary) is the fallback, not the default.
4. **Readable, code-derived names** in the layers panel — never `Group 13900` × N.

**Ordering, resolved at implementation (T7, 2026-08-09): COLLAPSE WINS OVER
FLATTEN.** Mitigations 1 and 2 interact, and the DDR did not say which runs
first. A logo's wrapper **is** styleless — that is the entire complaint about it
— but it is **also** the node the collapse exports as one asset. Flattening
first dissolves the anchor, so the four vector leaves each become their own
export: exactly the fourteen-`<img>` outcome mitigation 2 exists to prevent,
produced by mitigation 1. So `flattenWrappers` skips any node that
`isVectorCluster` accepts. Caught by the fixture case (`2:2`…`2:5`), not by
review — which is why it is written down here rather than left as a code detail.

**A font family is never carried into an imported artifact** (both
`style-map.ts` and `to-tokens.ts`). Two reasons that point the same way: a Figma
family name is free text from the document, and DDR-172's font grammar exists
precisely because a family value reaches a live stylesheet; and editability-first
means an imported frame should look like it belongs to the project, so it
inherits the DS's own type stack. Size, weight, line-height and letter-spacing
travel; the family does not.

**`--frames` selects TOP-LEVEL frames only, never a deep walk.** Whole-file
import is not a viable default (D5), and a nested frame is part of its parent's
composition rather than a canvas of its own. An explicit `node-id` overrides
this and imports exactly that subtree.

**Round-1 correction (HIGH): `design-system-keeper` Pass A.10 is not a gate as it
stands, and the first draft called it a release gate twice.** Verified against
`plugins/design/agents/design-system-keeper.md`: A.10 is **severity: warning**
that "never self-promotes to blocker on its own"; it **skips entirely** when the
candidate declares no `kind="web"` artboard — and *the translator chooses the
kind*; and its justification check is satisfied by *the existence* of a comment at
the right position, deliberately not by its wording — which a code generator
satisfies by emitting `{/* imported: absolute per Figma layout */}` above every
absolutely-positioned node, mechanically, forever.

**Therefore the acceptance bar is enforced by gates a translator can actually
fail and CI can actually check:**

- generated JSX **≤ 512 KB** per artboard (D5) — machine-checkable, needs no
  derivation;
- **≥ 1 asset per logical mark, not per vector leaf** — pinned to fixture nodes
  `2:2 / 2:3 / 2:4 / 2:5` (four VECTOR leaves forming one 90×72 mark);
- **PLANNED, NOT BUILT — every text node in the emitted `.tsx` has non-zero
  rendered, unoccluded area**, via the headless render the pipeline already does
  for `canvas-rects`. Normalization (D6b) now covers the two composited cases the
  post-implementation review demonstrated — resolved ancestor background and
  compounded opacity — but z-order occlusion by an opaque sibling is unreachable
  without a real render. Listed here as the remaining gap, not as a shipped gate;
- **a grep test banning a blanket generator-emitted justification comment**, so
  the A.10 escape hatch cannot be automated;
- A.10 itself is run with **findings promoted to blocker for `imported-figma`
  canvases**, which the orchestrating verb sets explicitly rather than hoping for.

**Two further gates ship as warn-with-recorded-baseline, not as blockers, until
they are measured** (Round-2 finding — neither is derivable from the fixtures the
DDR calls "the contract", and a release gate that fires on a *correct* import
gets exempted, which is precisely how A.10 became advisory):

- **post-flatten wrapper depth** — the measured 13 is *pre-flatten* Figma depth;
  the fixtures' flatten cases (`2:8 → 2:7 → 2:6`, `2:11 → 2:10 → 2:9`) assert only
  that flattening is depth-agnostic. A threshold of 8 is a guess.
- **share of absolutely-positioned leaves under a frame declaring auto-layout** —
  the plan's own measurement is that real files are *an absolute shell with flex
  leaves*, and Figma's first-party output positions a frame's own children
  absolutely. Any shell containing one flex leaf satisfies the precondition, at
  which point a real page's ratio is unmeasured and plausibly far above 20 %.

Both are run against the two measured fixture files first; the measured value is
recorded beside the threshold the way D5's caps are (*"~5× the measured real
page"*), and only then are they promoted to blocker. Asserting "promoted to
blocker" before it is true would repeat the process error § Security review
already owns once.

**The cost, named honestly.** Some Figma constructs have no editable CSS
equivalent — text auto-resize modes, `constraints: SCALE`, blend modes, masks,
boolean operations. Editability-first means each degrades to
**editable-but-different** rather than **faithful-but-inert**, so an import will
sometimes look less exactly like Figma than a flattened screenshot would. That is
the chosen trade, and D7's summary must say which nodes took it.

### D9 — `isBindable` widens to `text` and `section` — with four native-path fixes, because the first draft's premise was factually wrong

`isBindable()` admits `rect · ellipse · polygon · sticky · image`. FigJam binds
connectors to anything. On the only real board measured, **2/2 connectors had at
least one endpoint Maude could not bind** — one to TEXT, one to a group. "Always
editable" means an imported connector on a text label stays a live, re-routable
arrow, not a frozen line, and widening also fixes a plain **native** product gap.

**Round-1 correction (MEDIUM-HIGH): the first draft's justification — "both carry
`x/y/w/h`, so this needs no new geometry" — is false, and the widening breaks
three things on the native path.** Verified against `annotations-model.ts` and
`annotations-bindings.ts`:

- **`TextStroke` has no `w` and no `h`, and its `x`/`y` are optional.**
  `strokeBBox` *synthesizes* the box from content:
  `w = max(8, longest * fontSize * 0.55)`, `h = lines * fontSize * TEXT_LINE_HEIGHT`.
  So the anchor is **content-derived** — editing the text moves the bound arrow —
  and `0.55` is a fixed em-advance guess that is not the rendered advance, so the
  arrow visibly detaches on proportional, CJK, emoji or diacritic-heavy text.
  Which is exactly the text an import carries.
- **Anchored text mints permanent zombie binds.** `bindCandidate`, `anchorPoint`
  and `recomputeBoundArrows` all call `strokeBBox(s)` **without** the anchors map.
  For a `TextStroke` with `anchorId` set — the double-click-a-shape label, the
  most common text on a Maude board and precisely the FigJam "label on a shape"
  case — that returns `null`. Today `isBindable` is false so the bind is stripped
  and the endpoint freezes honestly. After a naive widening, `isBindable` returns
  **true**, the bind is *not* stripped, `anchorPoint` returns `null`, and
  `applyEnd` does `if (!pt) return;` — the arrow keeps a bind it can never honour,
  frozen at stale coordinates, across save/load. Strictly worse than today, with a
  lie attached.
- **Unbounded text bboxes become board-wide bind magnets.** 5 000 chars on one
  line at `fontSize 14` synthesizes a ~38 500 px-wide invisible strip.
  `bindCandidate` walks **topmost-first with no area or distance preference**, so
  one imported text node steals every endpoint the user drags.
- **Sections swallow binds.** `strokeHitTest` for a section deliberately returns
  false for the interior (*"a section is grabbed by its BORDER or its label chip;
  the interior stays click-through"*), but `bindCandidate` tests the raw bbox plus
  threshold. Nothing pins sections to the bottom of the stroke array, and the
  natural gesture is to draw a section *around* existing notes — which puts it
  later, i.e. topmost. Every arrow drawn between two stickies inside a section
  would then bind to the section.

**The widening ships with all four fixes, and they are part of this decision, not
follow-ups:**

1. Thread the anchors map through `bindCandidate` / `anchorPoint` /
   `recomputeBoundArrows`, **or** restrict the widening to standalone text
   (`anchorId == null`) and say so in the code.
   **Resolved at implementation (T5, 2026-08-09): restrict to standalone text.**
   The two options are not equal in either cost or meaning. Threading the
   anchors map changes four call sites in a module the whole native whiteboard
   depends on, to enable a binding that is *semantically redundant*: anchored
   text is a label living INSIDE a host shape, and that host shape is already
   bindable — so "bind to the label" and "bind to the shape" describe the same
   attachment, and the shape is the one that survives the label being edited.
   Restricting is therefore the smaller change AND the more correct one. The
   exclusion is enforced in `isBindable` itself (not at the call sites), so it
   cannot be bypassed by a future caller that happens to hold an anchors map.
   Paired with fix 2, an anchored-text bind that somehow reaches the model is
   stripped rather than kept — the two together mean there is no state in which
   an unresolvable bind persists.
2. Make `applyEnd` **strip** a bind whose `anchorPoint` is `null` instead of
   returning silently. **Round-2 correction: calling this "a pre-existing bug"
   overstates it** — it is inert today, because every currently-bindable tool
   returns a bbox unconditionally. It goes live only *after* the widening, which
   makes its sequencing load-bearing: **fix 1 must land with or before fix 2.**
   Fix 2 without fix 1 silently *deletes* every anchored-text bind on the next
   recompute — binds evaporate on load rather than freezing, which is a third
   failure mode, not a fix.
3. Cap the bind bbox (or exclude text above an area threshold) **and** cap
   imported `TextStroke.text` length explicitly — T5's truncation currently covers
   sticky/shape capacity only.
4. **Gate on `strokeHitTest` and keep z-order topmost-first, with
   distance-to-bbox as the tiebreak** — *not* smallest-area. The first revision
   said "prefer the smallest containing bbox", and Round 2 showed that creates a
   worse regression than the one it fixes: `bindCandidate`'s containment test is
   the bbox **inflated by `threshold`**, so "smallest containing" is ill-defined —
   an 8×8 dot 14 px *away* from the pointer satisfies containment with the
   smallest area and beats the large rect the pointer is genuinely inside. It also
   inverts the visual invariant, letting a shape hidden *behind* an opaque one win
   a bind the user cannot see happening — the same "invisible thing wins"
   pathology the rest of this DDR is fighting. `strokeHitTest` is already in the
   tree and already excludes a section's interior (quoted above), so gating on it
   closes the section case without touching overlap semantics on any existing
   board. The first revision's own second clause replaces its first.

**Groups remain unbindable by construction.** Maude groups are a flat `groupIds[]`
tag array, not addressable objects; a group-targeted endpoint falls back to the
group's geometric bbox and is reported as degraded. **Do not invent a group stroke
for this.** A **degenerate self-connector** (start id == end id, observed on the
real board) is reported and skipped, never emitted as a zero-length bound arrow.

**This is a change to the native whiteboard**, so it needs native regression
coverage — drag a connector onto a text label, onto an anchored label, inside a
section — not only import-path tests.

### D10 — The verb's entire stdout and stderr is code-owned, because it is model input

`maude design import-figma` is run **by an agent** (residual 3), so everything the
process prints lands in a model's context. D1 forbids the orchestrator from
*reading* the document; that is insufficient if the verb *prints* it.

**Round-1 finding:** the first draft required "a clear error naming the observed
host" — an upstream-controlled string — and the existing downloader is worse
today: a failed `execFileSync` embeds the whole argv (i.e. the entire
response-controlled URL) into its message, and an invalid-URL path echoes 120
characters of it back.

**Rule:** the verb's stdout and stderr consist of code-owned strings, enum reason
codes, node ids and numbers. An upstream value never appears verbatim; an
upstream host is emitted only as a charset-validated `[a-z0-9.-]{1,253}` token,
and nothing else from a response body or a header is printed at all. The standing
"the token never appears in a log line" test is extended to **"no
upstream-controlled string appears in verb output"**.

### D11 — Imported vector assets: compose two already-reviewed gates; reference, never inline

**Round-1 blocker: D8's mandatory SVG collapse had no legal path through D4.**
`_fetch-asset.mjs` structurally cannot carry an SVG — `sniffImageExt` returns
png/jpg/gif/webp only and throws `'not a png/jpg/gif/webp image (SVG/HTML/script
rejected)'`; `assetName` asserts `^[a-z0-9]{8}\.(png|jpg|gif|webp)$` so it cannot
even *name* one; and on the Phase-2 side `ASSET_IMAGE_HREF_RE` is raster-only. So
the first draft mandated an operation its own SSRF decision forbade, and the
two-line fix an implementer would reach for — adding `svg` to `sniffImageExt` —
silently widens a **shared** helper whose other caller is the DDR-147 moodboard
lane, where every URL is research-harvested and there is no host allowlist at all.
That would re-open, for a lane this feature never touches, exactly the class
DDR-167 built its allowlist + SVGO gate to close.

**Decision — compose, don't widen:**

1. **Download** through `_fetch-asset.mjs`'s IP gate / DNS pin / redirect ban /
   caps / host allowlist (D4) into a **staging file outside the design root**
   (D5), via a new **`--raw-out <abs-path>`** mode. Round-2 correction: the first
   revision called this flag `--allow-svg` and said "download into a temp file",
   which is not a mode that exists — `fetchAsset()` has exactly one flow (curl →
   read → sniff → `assetName` → contained write into `assets/`) and no `--out`.
   Left as written, an implementer resolves it the two-line way — adding `svg` to
   `sniffImageExt` — which is the single thing D11 exists to prevent.
   **`--raw-out` still sniffs.** It must not mean "skip the type gate": that would
   turn the one reviewable downloader into an unsniffed one (HTML, JS, polyglots,
   zips all land on disk) for the next caller who copies it. It sniffs against an
   *extended accept set* — `sniffImageExt`'s four raster types **plus** the SVG
   text sniff, reusing `svgPreParseReject`'s own `/^\s*(<\?xml|<svg|<!--)/i` — and
   `sniffImageExt` itself is left untouched, which is what keeps step 5's test
   literally true. It performs **no** `assetName` naming and **no** `assets/`
   write; output goes only to the caller-supplied path.
2. **Sanitize** with `_import-asset.mjs`'s existing DDR-167 SVG lane —
   `svgPreParseReject` → happy-dom element allowlist walk → re-serialize → the
   **SVGO validity gate** — before naming or writing anything. **Pin this lane's
   size cap far below DDR-167's `SVG_MAX_BYTES = 5 MB`**: that budget was sized
   for local files the user chose, and D11 newly points the lane at *remote,
   response-controlled* bytes. The trust-level change is recorded rather than
   inherited silently.
3. **Promote** into `assets/` through that lane's content-addressed,
   realpath-contained write, as part of D5's atomic promote step — not as a
   direct write at download time. (The first revision said "write through that
   lane", which contradicted D5's staging model; D5 wins.)
4. **Fail closed on partial failure.** Steps 1 and 2 are two processes in two
   runtimes — `_fetch-asset.mjs` runs under node, `_import-asset.mjs` must run
   under **bun** because it imports the `.ts` SVGO engine directly. DDR-177
   documents that runtime-spawned helpers have shipped broken inside the packaged
   `.app` more than once (missing `happy-dom`/`svgo`, "bun required"). If step 2
   is unavailable, the run **deletes the staged bytes and reports
   `asset-skipped`** — never "we already have the bytes", which is the natural and
   wrong recovery. The SVG lane joins
   `apps/desktop/scripts/check-bundle-completeness.mjs --smoke`.
5. **Reference, never inline.** An imported vector is `<img src="/assets/…">` or
   `<image href="assets/…">`. It is **never** inlined into JSX — inline SVG in a
   canvas executes on the canvas origin with full element space (`<style>`,
   `<foreignObject>`, `on*`, `xlink:href`), and Figma's SVG export carries node
   names into `id=`/`data-name=`, so it is not code-owned output. If inlining is
   ever wanted, it re-derives this decision and inherits DDR-167's allowlist plus
   a React-specific ban on `on*`, `dangerouslySetInnerHTML`, `<style>` and
   `<foreignObject>`. *(Round 2 re-attacked this and it held: under `<img src>` /
   `<image href>`, SVG script and `<foreignObject>` do not execute.)*
6. **A standing test asserts `sniffImageExt` still returns `null` for `<svg` /
   `<?xml`**, so the tempting widening fails CI.
7. **`ASSET_IMAGE_HREF_RE` is NOT extended.** The first revision said it could be
   extended to `.svg` "deliberately, as part of this decision". Round 2 showed
   that deliberateness changes the intent, not the blast radius: that regex is the
   *only* thing that lets an `<image href>` survive `sanitizeAnnotationSvg`'s
   blanket href strip, it validates the href **shape** and never the **bytes**,
   and `sanitizeAnnotationSvg` runs on every annotation SVG **including one that
   arrived from a peer** (DDR-085 / DDR-054) — while DDR-167's byte-level lane
   runs on *import*, not on *sync*. Extending it would let a hostile peer sync a
   board plus an `assets/x.svg` that passed no byte gate on the receiving machine
   — in a lane this feature never touches, which is verbatim D11's own reason for
   refusing to widen `sniffImageExt`. **The annotation layer takes PNG @2×**; a
   board thumbnail has no SVG requirement.

**PNG @2× is an acceptable fallback for the canvas path too** if the SVG lane
proves awkward — editability's actual requirement is *one asset instead of
fourteen*, which PNG satisfies. What is **not** acceptable is relaxing the
raster-only sniff on the shared downloader.

**Fix the existing staging collision on the way past.** `fetchAsset()` currently
writes its temp to `<assetsDir>/.tmp-<sha12(url)>` — inside the versioned,
replicated tree, deterministic per URL, with `rmSync` in a `finally`. Two
concurrent imports of the same URL collide and each can delete the other's
in-flight download. D5's out-of-tree per-run staging directory retires this.

## Consequences

- **No new npm dependency in Phases 0–5.** Figma REST is plain `fetch`. Phase 6
  gets its own DDR and dependency review regardless.
- **Three new privileged routes**, each carrying `isTrustedRequestHost` +
  `sameOriginWrite` (writes) + a `readJson` cap, each with **two** standing
  assertions (canvas-origin 405, cross-site 403).
- **`generation/keys.ts` is unchanged and `figma` is NOT added to the
  media-generation registry.** The routes call the store directly.
- **`_fetch-asset.mjs` takes exactly four changes, enumerated so none arrives
  undeclared** (the first revision declared two and implied two more): (1)
  `--allow-host <suffix>`, repeatable, absent = today's behaviour; (2)
  `--raw-out <abs-path>` — sniff against the extended accept set, no naming, no
  `assets/` write; (3) the port-443 pin for the Figma lane, which is new logic
  (D4); (4) staging out of `assets/` into the caller-supplied path, which retires
  the deterministic `.tmp-<sha12(url)>` collision. This is a shared,
  security-reviewed helper and every one of the four is reviewed as such.
- **`annotations-bindings.ts` changes are a native-whiteboard change**, not an
  import-only one: the widening plus the four D9 fixes, with native regression
  coverage. The `applyEnd` null-anchor strip is a **pre-existing bug** this DDR
  requires fixing on the way past.
- **Phase 4 produces input for DDR-172's importer and nothing else** — no second
  mapping contract. Token *names* are charset-bounded here; style *descriptions*
  are never carried.
- **Standing tests, not prose:** (1) the URL-parser rejection table; (2) "the
  token never appears in a thrown error or log line", extended to "no
  upstream-controlled string appears in verb output"; (3) canvas-origin 405 +
  cross-site 403; (4) a directory-globbed grep test banning raw interpolation of
  `name`/`characters` in **both** writer trees; (5) a grep test asserting no Figma
  code path spawns an agent; (6) `sniffImageExt` still rejects SVG; (7) the
  `--allow-host` assertion on the Figma lane; (8) the D8 machine-checkable
  editability gates; (9) a blanket-justification-comment ban; (10) **the D6a
  character-class rule, asserted per class** (Tags block, zero-width, bidi, C0/C1)
  against both writers; (11) **D6b's normalization**, asserted as an output
  property — emitted text is above the `fontSize` floor and the contrast floor,
  and emitted geometry is inside the artboard's bounds; (12) the staging directory
  resolves **outside the design root**, asserted against a path prefix rather than
  trusted by construction.
- **The measured fixtures are the contract.** `.ai/plans/notes/figma-import-fixtures.md`
  enumerates stable node ids; tests assert against ids, not "a board".
- The Figma **MCP server** must not appear in any runtime code path (200
  calls/day, client allowlisting, borrowed per-user OAuth). Research instrument
  only.

## Threat model summary

| Threat | Closed by |
| --- | --- |
| Indirect prompt injection reaching a model *during ingestion* (the DDR-174 class) | **Structurally absent** — no LLM reads Figma content in the ingestion path; no agent spawned; the summary is code-generated enum data (D1) |
| Third-party content reaching a tool-holding agent *after* ingestion, via the imported `.tsx` or `.annotations.svg` (versioned, peer-synced, and in the SVG's case parsed expressly for a model's context) | **Bounded and named, not closed** — sinks enumerated (D1), syntactically sanitized (D6), invisible content refused (D6 visibility rule), framed as third-party rather than legitimate (D7). Escaping proves the string is not code; it proves nothing about instructions — residual 1 |
| An invisible TEXT node (opacity 0.01 / fontSize 1 / fill ≈ background) carrying instructions past every pixel-based check into `/design:edit`'s context, next to `keys.json` on the same machine (the lethal trifecta) | **Normalization, not detection** — imported `fontSize`, contrast and geometry are clamped so hidden text becomes *visible* text; `visible:false` skipped; the four detection clauses remain as a reported best-effort, named as a denylist (D6b) |
| A payload encoded in **zero-glyph characters** — the Unicode Tags block (U+E0000–E007F), zero-width, or Trojan-Source bidi — passing `opacity:1` / `fontSize:16` / high contrast / the escaper / `sanitizeAnnotationSvg` and rendering as literally nothing | **D6a's character-class rule** — NFC-normalize then reject C0/C1, U+200B–200F, U+202A–202E, U+2066–2069, U+00AD, U+FEFF, variation selectors and the whole Tags block, in both writers. A closed, enumerable check with no compositing dependency |
| Human-invisibility achieved by **compositing** rather than by a node property — occlusion by an opaque later sibling, ancestor `clipsContent`, opacity compounded down the tree, blend mode over a matching background | Normalization (D6b) plus a **rendered** backstop in D8's gate list — every text node in the emitted `.tsx` must have non-zero rendered, *unoccluded* area, via the headless render the pipeline already runs for `canvas-rects`. A four-property rule gets implemented as four `if`s and misses all four |
| A **fully visible** instruction sticky in a 300-sticky workshop board no human reads end to end — where hiding is unnecessary and no content rule helps | **Not closable by a content rule.** A non-content control instead: a per-import stroke-count ceiling requiring explicit confirmation, and board imports landing in a quarantined staging canvas the user promotes, composing with the existing `_untrusted/` mirror pattern (D6b). Residual 1 owns the remainder |
| A maintainer cargo-culting DDR-174's agent split into a path with no agent | Stated as an explicit non-requirement here and in `import.md`, plus a grep test asserting no Figma path spawns an agent (D1) |
| **CSRF from any website** while the dev server runs — planting an attacker PAT via `connect`, or spending the user's PAT via `probe`, as a CORS-simple request with an opaque response but a real side effect | `isTrustedRequestHost` + `sameOriginWrite` + `readJson` cap on all three routes, with a **cross-site → 403** standing assertion; allowlist exclusion alone proves the wrong property (D3) |
| PAT exfiltration through a canvas-origin request | The routes are in **neither** allowlist; `GET → 405` asserted (D3) |
| A stub media-generation adapter for `figma` becoming a live sink on the existing generate-jobs route, and two write paths for one secret | `figma` is **not** in the media-generation registry; two dedicated routes call the key store directly (D2) |
| PAT leaking via an echo, a log line, an error, a report, or verb stdout read by an agent | Write route returns `{configured:true}`; status is presence-only; errors are code-owned; **the verb's entire stdout/stderr is code-owned** (D2, D10) |
| SSRF via a pasted URL steering host/scheme/port/path | Host never from input — charset-validated key + hardcoded base + per-segment encoding; rejection table tested. **Attacked in Round 1, held** (D4) |
| SSRF via response-controlled `/v1/images` URLs (internal ranges, IMDS, DNS rebinding) | The existing resolved-IP gate with DNS pinning, verified property-by-property; **narrowed at the gate** by `--allow-host` with exact-or-dotted-suffix matching and port 443 — never `endsWith`, never caller-side (D4) |
| An SVG reaching `assets/` by relaxing the shared downloader's raster-only sniff, re-opening DDR-167's class for the unrelated moodboard lane | **Compose, don't widen** — `--raw-out` sniffs against an extended accept set and writes only to a caller path, leaving `sniffImageExt` untouched; then DDR-167's allowlist + SVGO gate, with the lane's size cap pinned below DDR-167's 5 MB because the bytes are now remote and response-controlled (D11) |
| A hostile **peer** syncing a board plus an `assets/x.svg` that passed no byte-level gate on the receiving machine — because `ASSET_IMAGE_HREF_RE` validates href *shape*, `sanitizeAnnotationSvg` runs on peer-synced boards, and DDR-167's byte lane runs on import, not on sync | **`ASSET_IMAGE_HREF_RE` is not extended.** The annotation layer takes PNG @2×; a board thumbnail has no SVG requirement. Deliberateness would have changed the intent, not the blast radius (D11) |
| Attacker-influenced SVG markup inlined into executed JSX (full element space: `<style>`, `<foreignObject>`, `on*`) | Imported vectors are **referenced, never inlined**; a D6 sink row plus D11 (D11) |
| CSS injection via a Figma paint/effect/type value into a live-rendered canvas | DDR-172 Decision 4 grammars reused verbatim (ASCII pre-filter, no `m`/`s`, shape + magnitude bounds, no free-text capture) (D6) |
| JSX/script injection via layer names or text (`<script>`, `{curly}`, quotes — real, and in the fixtures) | Identifiers from **node ids only**; attributes allowlist-charset-sanitized; text as an escaped JSX string child incl. **U+2028/U+2029**; single writers guarded by a directory-globbed grep test. **Attacked in Round 1, held** (D6) |
| Prompt injection into agents that read `config.json` / `.meta.json` / token names / a style description (peer-synced, DDR-054) | **Eliminated** — provenance is three constrained identifiers; token names charset-bounded; style descriptions never carried; DDR-172 Decision 8's fixed-template rule applies (D6, D7) |
| A provenance badge that *increases* trust in the most attacker-influenced artifact | Badge copy and artboard chrome read **third-party content**; `/design:edit` pre-flight prints the untrusted-content banner; the FigJam board gets provenance too, surfaced through `read-annotations` (D7) |
| Memory/CPU exhaustion on an adversarially-shaped document | Pre-translation hard refusals (bytes / node count / depth); in-translation bounds are **reported degradations** with reason codes, not silent truncations (D5) |
| A document under every per-item cap that still writes ~2 GB into a versioned, Syncthing-replicated `assets/` — cumulative and cross-machine | Total asset-bytes cap, a tight Figma-lane `--max-bytes`, **per-run staging OUTSIDE the synced tree** with atomic promotion, plus a new repo-level `assets/` ceiling (D5) |
| Staged bytes — including **unsanitized attacker SVG** between D11's two gates — replicating to peers before any sanitizer runs, because "gitignored" was mistaken for "not replicated" (`~/git/.stignore` excludes neither `.design/` nor `_history/` nor `.tmp-*`) | Staging is `mkdtemp` under `os.tmpdir()`/`~/.cache/maude/`, **verified against the sync list rather than the git list**; per-run directory removed on every exit path incl. `SIGINT`, with a ceiling and a stale-directory sweep (D5) |
| D11's two steps running in two runtimes, with the bun-side sanitizer missing in the packaged `.app` (DDR-177's documented failure mode) — and the natural recovery being "we already have the bytes" | **Fail closed** — staged bytes deleted, `asset-skipped` reported; the SVG lane joins `check-bundle-completeness.mjs --smoke` (D11) |
| A partial asset set left in the versioned tree by a crash mid-promote, while the report says the import failed | Promotion is a single directory rename, or manifest-driven and resumable — never N renames (D5) |
| Stack overflow / prototype pollution walking untrusted response objects | Depth cap checked before descent; `__proto__`/`constructor`/`prototype` skipped; `Object.create(null)` maps (D5) |
| Unbounded retry/sleep on a 429 | `Retry-After` with bounded backoff (3 retries, 30 s cap), then a clear message (D5) |
| An Enterprise-gated endpoint surfacing as a failure to a Pro user | A 403 on `variables/local` degrades to the styles path with "using your styles" (D5) |
| Shell-argument injection through a Figma-derived value | `"$@"`-quoted wrapper, no `eval`, fixed `execFileSync` argv. **Attacked in Round 1, held** (D1) |
| An expiring hotlinked asset URL in a shipped canvas (breakage + CSP block + a live third-party fetch) | Download-first mandatory; canvases reference `/assets/<sha8>.<ext>` only. Lifetime corrected to ~30 days (D4) |
| An import that is visually right but practically inert | Flatten / collapse / flex enforced by **machine-checkable gates** — A.10 alone is a warning that a generator trivially satisfies (D8) |
| A connector silently degrading to a frozen line — or, after a naive widening, to a **permanent zombie bind that never recomputes** | `isBindable` widened **with four native fixes**: anchors threaded (or standalone-only), `applyEnd` strips null-anchor binds, bind-bbox and text length capped, smallest-area preference over topmost (D9) |
| One imported text node or one section becoming a board-wide bind magnet on the **native** whiteboard | Same four fixes, with native regression coverage — this is a whiteboard change, not an import-only one (D9) |
| The section fix itself regressing binding — "smallest containing bbox" is ill-defined over a threshold-inflated region (an 8×8 dot 14 px *away* wins over the rect the pointer is inside) and inverts the visual invariant so a shape hidden behind an opaque one wins an unseen bind | Gate on **`strokeHitTest`**, keep z-order topmost-first, distance-to-bbox as tiebreak — the mechanism is already in the tree and already excludes a section's interior (D9 fix 4, corrected) |
| Fix 2 landing without fix 1 — anchored-text binds silently **deleted** on the next recompute instead of frozen | Explicit sequencing: fix 1 lands with or before fix 2; the strip is inert today, so "pre-existing bug" is corrected to "goes live with the widening" (D9) |
| Reverse-engineered-format fragility; a binary parser on untrusted bytes | **Deferred** to Phase 6 behind its own DDR and security round (§ Deferred) |

## Deferred, explicitly

**`.fig` / `.jam` local decoding is not decided here.** It introduces a binary
parser fed untrusted attacker-supplied bytes — the highest-risk code in the whole
program — plus decompression-bomb caps, a fail-loud-on-unknown-version posture,
and a possible fallback dependency (`fzstd`, only if Bun's `node:zlib` turns out
not to expose `zstdDecompressSync`). It gets its own DDR (plan T13), its own
`security-auditor` + `ethical-hacker` round, and its own dependency review per
this repo's standing per-dependency rule (DDR-071 precedent).

The seam that makes this deferral cheap is D1's normalized node tree: a decoder
only has to emit the same shape and it inherits all three translators. Building
the REST door first is also what makes Phase 6's **Tier-2 differential smoke**
possible — the same document through both doors must produce the same tree, the
only oracle that proves a decoder is *right* rather than merely *quiet*.

## Named residuals

1. **Semantic injection through imported content is bounded, not closed — and it
   is least bounded on the board path.** An imported canvas and an imported board
   are third-party free text that tool-holding agents read. D6a makes zero-glyph
   payloads impossible; D6b normalizes the canvas path so hidden text becomes
   visible text; D7 labels the result as third-party. **None of that makes an
   instruction stop reading like an instruction**, and on a board it does not have
   to hide at all: a 300-sticky workshop board is imported wholesale, no human
   reads all 300, and a fully visible sticky is completely effective. The
   stroke-count ceiling and the quarantined staging canvas (D6b) bound *how much*
   arrives unreviewed and *where it lands*; they do not bound what it says. This
   widens DDR-085's existing whiteboard residual from "a hostile peer plants a
   sticky" to "several hundred third-party strings arrive at once and sync
   onward", and that widening is the honest cost of the feature.
2. **An agent can import a file key it chose** (`maude design import-figma` is
   CLI-reachable from an ACP session), spending the user's PAT — the structural
   residual DDR-167 Decision 5 and DDR-172 Decision 8 already name. Composed with
   residual 1, this is the one chain worth stating outright: content an agent
   already reads today can name a file key, and the import lands third-party
   content in exactly the directory agents read. No new technical gate is added
   here; D6's visibility rule and D7's framing are what bound its usefulness.
3. **The image host allowlist will drift.** Figma can move its render bucket; the
   failure mode is a refused download naming the observed host — loud and
   one-line-fixable, deliberately preferred over a wildcard. Note it is a *reach*
   control only: the render bucket is shared, so the byte-level sniff (D11) is what
   actually protects the tree.
4. **A user's own Figma document can be hostile** — nothing prevents importing a
   file someone else authored. Which is why D5's caps and D6's grammars apply to
   every import, with no "it's my own file" fast path.
5. **Rate limits are per-user and Figma re-tiers them periodically.** D5's budget
   is a design assumption checked against the changelog at implementation time.
6. **Editability-first means some imports look less like Figma than a screenshot
   would** (D8). A quality boundary, reported per node, not a closed problem.

## Security review

**Round 1 (2026-08-09) — design-stage, against the first draft, before any code.**
`security-auditor` (defender) + `ethical-hacker` (adversarial) both reviewed the
DDR text and the codebase it makes claims about. Every load-bearing claim about
existing code was independently re-verified against the source before revising.

**Convergent findings (both reviewers, independently):**

1. **(BLOCKER) The annotation layer is an unlisted sink.** `*.annotations.svg` is
   **versioned** (DDR-115), commits and peer-syncs (DDR-054), and
   `read-annotations` parses it into JSON *expressly* to hand to an agent — while
   T5 puts FigJam sticky/section/TEXT content in verbatim. The draft's D6 table was
   JSX-only and never named `sanitizeAnnotationSvg` (which is in any case an
   XML-safety allowlist, not a semantic one). The draft's justifying sentence —
   "the same exposure every canvas in the repo already has" — was false: every
   other canvas is user-authored. → **Closed** by a D6 annotation row, a rewritten
   D1 with all seven consumption sinks enumerated, D7's provenance-on-the-board
   requirement, and residual 1 stating the semantic gap honestly.
2. **(BLOCKER) D8's mandatory SVG collapse had no legal path through D4.**
   `_fetch-asset.mjs` structurally refuses SVG at three points (`sniffImageExt`,
   `assetName`, and `ASSET_IMAGE_HREF_RE` downstream), while D4 forbade a second
   read path — so the DDR mandated an operation it forbade, and the cheap fix
   would widen a *shared* helper for the unrelated, allowlist-free moodboard lane.
   → **Closed** by D11: compose `_fetch-asset.mjs`'s network gate with
   `_import-asset.mjs`'s DDR-167 SVG lane behind an explicit `--allow-svg` opt-in,
   reference-never-inline, plus a standing test that `sniffImageExt` still rejects
   SVG. PNG @2× named as an acceptable fallback.
3. **(MEDIUM-HIGH) D9's premise was factually wrong and the widening breaks the
   native path.** `TextStroke` has no `w`/`h` (the bbox is synthesized from
   content with a fixed `0.55` em guess); `bindCandidate`/`anchorPoint`/
   `recomputeBoundArrows` never pass the anchors map, so anchored text would mint
   **permanent zombie binds** that `applyEnd` silently declines to strip;
   `bindCandidate` is topmost-first with no area preference, so an unbounded text
   bbox or a section drawn around its contents becomes a board-wide bind magnet.
   → **Closed** by correcting the claim and making all four fixes part of D9.
4. **(MEDIUM) D5's caps contradicted themselves and left a cumulative sink.** The
   draft claimed "never a truncated best-effort translation" and then mandated
   truncation twice; two caps are only knowable mid-emission, so a "refusal" could
   leave 150 attacker-supplied files already written into a **versioned** tree; and
   200 assets × the 10 MB default is ~2 GB replicated to every peer, with
   content-addressing defeated by re-noising. → **Closed** by splitting refusals
   from reported degradations, adding a total-bytes cap and a tight lane
   `--max-bytes`, and staging under `_history/` with promotion only on completion.
5. **(MEDIUM) The host allowlist had no stated home.** Caller-side placement puts
   it outside the one reviewable chokepoint and it is dropped by any later call
   site; `endsWith` matching admits `evil-figma.com` and every S3 bucket. →
   **Closed** by `--allow-host` at the gate with exact-or-dotted-suffix matching
   and a pinned port.

**Defender-only findings:**

6. **(HIGH) No CSRF / DNS-rebind guard on the new routes.** Every other
   credential-bearing route in `http.ts` — including `/_api/generate/keys`, the
   template D2 cites — applies `isTrustedRequestHost` + `sameOriginWrite` +
   `readJson`; the draft named none. Concrete PoC: a CORS-simple POST from any
   website plants an attacker PAT or spends the user's. → **Closed** in D3, with a
   cross-site → 403 standing assertion added alongside the 405 one.
7. **(HIGH) "Zero new custody code" was false.** `figma` does not fit
   `ProviderDescriptor` (`modalities` is `image|video|audio|transcription`) and
   `ProviderEntry` needs a factory — so registration means a stub adapter (a live
   sink on the generate-jobs route) or a type change, plus two write paths for one
   secret. → **Closed** in D2: `figma` is not a media-generation provider; the
   store is reused unchanged (`PROVIDER_ID_RE` already admits the id) and two
   dedicated routes call it directly. The keychain claim is withdrawn as unverified.
8. **(HIGH) `design-system-keeper` Pass A.10 is not a gate.** Verified: severity
   **warning**, never self-promoting; **skipped entirely** when no `kind="web"`
   artboard is declared — and the translator picks the kind; and satisfied by the
   mere *existence* of a comment, which a generator emits mechanically. The draft
   called it a release gate twice. → **Closed** in D8 by replacing it with
   machine-checkable gates, promoting A.10 to blocker for imported canvases, and
   banning a blanket generator-emitted justification comment.

**Adversary-only findings:**

9. **(HIGH) Invisible-text trifecta.** A TEXT node at `opacity 0.01` / `fontSize 1`
   / fill ≈ background is emitted as valid, sanitizer-clean, **invisible** content
   that passes every screenshot, smoke and critic check and is read verbatim by
   `/design:edit` and `canvas-rects` — in a session that holds `Bash` on a machine
   where `keys.json` sits at 0600 and readable by the user's own agent. D6's
   grammars prove the string is not code and say nothing about it being
   instructions. → **Closed** as far as it can be, by D6's **visibility rule**
   (refuse what a human reviewer cannot see) plus D7's third-party framing;
   residual 1 names what is left.
10. **(MEDIUM) The verb's stdout/stderr is a model-input channel** and D4 required
    printing an upstream-controlled host; the existing downloader already echoes
    the full argv on a curl failure. → **Closed** by D10.
11. **(LOW-MED) Three missing sinks** — Phase-4 token *names* (versioned, live CSS,
    agent-read) and style *descriptions*; the `/v1/me` display name in Settings;
    the report artifact. → **Closed** by three D6 rows plus D7's enum-only rule.
12. **(LOW) Provenance as legitimacy laundering** — the badge makes the most
    attacker-influenced artifact read as real design work. → **Closed** in D7.
13. **(MEDIUM) A cap-compliant amplification shape** — 200 top-level VECTOR nodes,
    each its own parent, defeating parent-collapse by construction. → Same closure
    as finding 4.

**Attacked and held — recorded so it is not re-litigated:** D4 chokepoint 1
(userinfo-in-host, IDN homographs, `..`, `%2e%2e`, path/absolute-URL smuggling in
the key or node id — all die on the charset check before composition);
`_fetch-asset.mjs`'s IP gate and D4's ordering claim (rebinding TOCTOU closed by
the pin, redirect-to-internal closed, decimal/octal/hex literals rejected,
`::ffff:127.0.0.1` and NAT64 embeds classified, zone identifiers stripped — an
allowlisted host resolving to loopback **is** refused); shell-argument injection
through the helper chain; `sanitizeAnnotationSvg` as an *XML* gate (no
FigJam-sourced string becomes markup — the annotation risk is purely semantic);
and D6's JSX text rule (both hostile fixture names are inert), conditional on the
two caveats now written into the rule — never emit text as an attribute, and
escape U+2028/U+2029. D6's "one writer + grep test" was judged genuinely
enforceable on the same footing as this repo's shipped
`plugin-cli-reachability.test.mjs`, given the directory-glob pinning now stated.

**Round 2 (2026-08-09) — confirmation pass (defender) + re-attack (adversary)
against the Round-1 revision.** Both reviewers confirmed **all nine Round-1
findings genuinely closed, none merely re-worded**, verifying each against the
revised text and against source: the two blockers produced structural changes,
and the three false claims about existing code were corrected against the
codebase rather than softened (the defender specifically credited withdrawing the
unverifiable keychain claim rather than quietly keeping it). Both then found
second-generation instances of the same two root patterns Round 1 established —
*a shared gate widened for an unrelated lane*, and *a control whose scope stops
short of the artifact it was written for*. Every one is a specification tightening
inside a Round-1 closure; none re-opens one.

1. **(HIGH) Zero-glyph characters bypass the visibility rule entirely.** The
   escaper covers characters that terminate a literal; nothing covered characters
   with no glyph. A payload in the Unicode **Tags block (U+E0000–E007F)** — plus
   zero-width and Trojan-Source bidi (CVE-2021-42574) — passes `opacity: 1`,
   `fontSize: 16`, high contrast, non-zero area, `visible: true`, the escaper and
   `sanitizeAnnotationSvg`, renders as nothing, and is reconstructed as text by a
   model. → **Closed** by D6a's character-class rule.
2. **(HIGH) Human-invisibility is a composited property; the rule checked node
   properties.** Four shapes pass every clause: z-order occlusion by an opaque
   later sibling, ancestor `clipsContent`, opacity compounded down the tree, and
   blend mode over a matching background — and on its own terms `opacity: 0.06`
   and `fontSize: 4.5` clear the thresholds. → **Closed** by inverting the
   approach: **normalize rather than detect** (the translator authors these nodes,
   so it can guarantee visibility), plus a **rendered, unoccluded-area** gate in
   D8's list; the detection clauses stay as a reported best-effort explicitly
   named a denylist.
3. **(HIGH) The visibility rule was claimed on the sink where it does not
   apply.** It is written in Figma-design vocabulary and does not map onto the
   Stroke model at all — verified: `StrokeBase` has no `opacity`, there is no
   parent background to ΔE against, and `read-annotations`' output carries no
   `fontSize`. And on a board the payload need not hide. → **Closed** by scoping
   D6b to the canvas path, adding board-side **normalization**, extending
   `read-annotations`' output, and adding the non-content controls (stroke-count
   ceiling, quarantined staging canvas); residual 1 rewritten to say the board
   path is least bounded.
4. **(MEDIUM-HIGH) D5's staging and D11's write contradicted, and "gitignored" ≠
   "not replicated".** Verified: `~/git/.stignore` excludes neither `.design/` nor
   `_history/` nor `.tmp-*`, so the staging directory replicates to peers
   regardless of git — carrying unsanitized SVG under D11. Verified separately
   that `fetchAsset()` already writes its temp *inside* `assets/` at a
   URL-deterministic path, so concurrent imports of one URL delete each other's
   download. → **Closed** by staging outside the synced tree, verified against the
   sync list; per-run directory removed on every exit path; atomic promotion;
   D11 step 3 reconciled to promote rather than write.
5. **(MEDIUM) `--allow-svg` was not a mode that exists, and removing the sniff
   would be worse than the disease.** `fetchAsset()` has one flow and no `--out`,
   so the flag was either a sniff widening (which step 5's own test forbids) or an
   undeclared bypass of sniff + naming + write. → **Closed** by `--raw-out`, which
   *still sniffs* against an extended accept set, leaves `sniffImageExt`
   untouched, and writes only to the caller path. Fail-closed partial-failure
   handling and a sub-5 MB cap added for the now-remote bytes.
6. **(MEDIUM, new false claim — introduced by the Round-1 revision itself)**
   "wired to the existing `asset-sweep` machinery". Verified: `asset-sweep.sh` is
   a pre-scaffold grep for existing logo/mark sources feeding `/design:setup-ds`,
   with no storage accounting of any kind. → **Closed** by naming the ceiling as
   new code and stating which lane it governs (`s3Assets` moves the sink).
7. **(MEDIUM) D9 fix 4 created a new native regression.** "Smallest containing
   bbox" is ill-defined over a threshold-inflated region and inverts the visual
   invariant. → **Closed** by replacing it with `strokeHitTest` + topmost +
   distance tiebreak. Also corrected: the `applyEnd` strip is inert today, so
   "pre-existing bug" was an overstatement, and fix 2 without fix 1 *deletes*
   anchored-text binds — sequencing now explicit.
8. **(MEDIUM) Two of D8's five gates are not derivable from the fixtures**
   (post-flatten depth; the absolute-leaf share, where the plan's own measurement
   is that real files are an absolute shell with flex leaves). A gate that fires
   on a correct import gets exempted — the exact mechanism by which A.10 became
   advisory. → **Closed** by shipping those two as warn-with-recorded-baseline
   until measured, with the measured value recorded beside the threshold.
9. **(LOW-MEDIUM)** The port-443 pin was stated as a property when
   `parseHttpsTarget` accepts any port, and `probe`'s gating classification was
   ambiguous. → **Closed** in D4 (named as new logic) and D3 (`probe` is a write).

**Attacked in Round 2 and held:** D2's factual base (`PROVIDER_ID_RE` admits
`figma`; `keys.ts` does both `{mode:0o600}` and an explicit `chmodSync`); D3's
template claim (`/_api/generate/keys` really applies `isTrustedRequestHost` →
`sameOriginWrite` → `readJson(req, 16*1024)`, in that order); D7's one-line
`NOTABLE_KINDS` addition; D9's `strokeHitTest` quote (verbatim, including the
click-through rationale); D10's premise (`curlDownload`'s catch embeds the full
argv; `parseHttpsTarget` echoes 120 chars of the URL); D6's JSX text rule
re-attacked with U+2028/29, `</script>` inside the literal, and
brace/backtick/CRLF combinations — nothing escapes `{'…'}`; D11's
reference-never-inline (SVG script and `<foreignObject>` do not execute under
`<img src>`/`<image href>`); and D7's `data-*` provenance marker surviving
`sanitizeAnnotationSvg`. D4 chokepoint 1 and the IP gate were not re-attacked —
Round 1's result stands and this DDR records it correctly.

**Status.** The first draft shipped `Accepted` with a pre-written "0 findings"
claim; the defender flagged that as a process error and it was — and Round 2 found
this revision repeating a softer form of it twice (a false `asset-sweep` claim,
and two gates asserted as blockers before being measured), both now corrected.
Two review rounds, all Round-1 findings closed structurally and all Round-2
findings closed by specification, matches the DDR-167 / DDR-172 precedent of a
two-round design-stage review before any code lands.

**Post-implementation round (2026-08-10) — `ethical-hacker` over the SHIPPED
code** (plan § Validation step 5). 8 blockers, 4 warnings. The design was sound;
what the review found was almost entirely **implementation not matching the
design**, which is exactly what a post-code pass is for. The largest single
category was, for the third round running, **a comment or a threat-table row
claiming a property the code did not have.**

Fixed:

1. **(HIGH) The four routes were served by a cloud CELL.** `/_api/figma` was not
   in `FORBIDDEN_ROUTE_PREFIXES`, so `pruneForWorkspace` kept all four and
   `isTrustedRequestHost` vouches for any request carrying `x-maude-role` in
   workspace mode — i.e. any editor-role member could plant a PAT on Maude's
   compute and drive credentialed egress from the fleet. Verbatim the class
   `/_api/generate` is forbidden for. Hiding the Settings tab is a UI decision,
   not a gate. → prefix added; the `workspace-containment` pin extended.
2. **(HIGH) `--raw-out` was an arbitrary-file-write primitive** on the one helper
   whose job is to be the safe downloader: `resolve()` + `renameSync()` with no
   containment, and a type gate a leading `<!--` satisfies. Composed with
   ACP's default-allowed `Bash(maude:*)`, remote bytes could overwrite
   `CLAUDE.md`. → the mode now REQUIRES a caller-declared `--raw-root`, refuses
   an existing target, and no longer accepts a bare comment prologue.
3. **(HIGH) D6b measured contrast against a hardcoded `#ffffff`.** Black text on
   a black frame clears a white reference at 21:1 — the exact invisibility class
   D6b exists to close, reopened by the wrong reference frame. Compounded
   opacity had the same shape (four nested legal `0.15` frames render at
   0.0005). → contrast resolves the real ancestor background; opacity is tracked
   as a product down the tree.
4. **(HIGH) Every asset cap was per-FRAME, not per-import.** The constants were
   right, tested and named in this DDR — and were function-locals of a helper
   `importFrames` calls in a loop, so 60 frames reconstructed the multi-GB
   Syncthing shape D5 claims to close. → one `AssetBudget` threaded across the
   run, counting STAGED bytes rather than promoted ones.
5. **(HIGH) The board's non-content controls did not exist** — D6b/D7 assert a
   stroke ceiling, a quarantine, stroke provenance and `read-annotations`
   surfacing it. → ceiling + provenance + `fontSize`/author in
   `read-annotations` shipped. **The quarantined `_untrusted/` landing is
   DEFERRED and named below.**
6. **(MEDIUM) `MAX_JSX_BYTES` was a log line**, not a cap — it reported and then
   wrote the file anyway. → it refuses.
7. **(MEDIUM) `MAX_TEXT_BIND_AREA` was an area product**, satisfiable by exactly
   the wide-and-short strip it was meant to stop (4 000 chars at the font-size
   floor = 168 960 px², under a 640×480 product). → per-axis caps.
8. **(MEDIUM) `style-map`'s headline invariant was inert** — `importFrames`
   passed no tokens, so every import hardcoded hex with a "no near token" marker
   on every declaration, and the whole ΔE path was exercised only by unit tests
   that supplied tokens by hand. → the verb reads the active DS's tokens.
   Related: a tokenized colour could skip the contrast floor precisely for the
   values that match the background; the guard is corrected.
9. **(MEDIUM-LOW) D6a's list was called "genuinely complete" and was not** — it
   missed U+3164 HANGUL FILLER, which is category **Lo**, a LETTER, which is
   exactly why format/whitespace filters keep it. Two such characters are a
   binary alphabet. → replaced the range denylist with a **category** rule
   (`Cf`/`Cc`/`Co`/`Cn`) plus an explicit blank-glyph list.
10. **(LOW) Six lookup maps were prototype-bearing literals** indexed by
    document-controlled strings, so `shapeType: "constructor"` yields a
    *function* where a string is typed. D5 mandates `Object.create(null)`; now
    applied.
11. **(LOW) Three false comments** — "no network" six lines after a fetch,
    "removed on EVERY exit path" over a bare `finally`, and `assets.ts` claiming
    a single end-of-run promote that does not happen. All reconciled to what the
    code does.

**Named, NOT fixed — the honest residue of this round:**

- **Assets promote per-asset, not once at the end** (F6). A failure on frame 7
  of 60 leaves earlier assets in the versioned tree while the report says the
  import failed. D5 asked for a single directory rename; this is N renames.
  Content-addressing makes the residue untidy (orphan assets) rather than wrong
  (no incorrect content), which is why it is recorded as a limitation in
  `assets.ts` rather than fixed under time pressure.
- **The quarantined `_untrusted/` landing for board imports** is not built. The
  stroke ceiling and provenance stamp ship; the "user promotes it out of
  quarantine" step does not. D6b's threat-table row is correspondingly narrowed.
- **The rendered, unoccluded-area gate** (D8) is still not built. Normalization
  now covers the two composited cases the review demonstrated (background,
  opacity), but z-order occlusion by an opaque sibling remains unreachable
  without a real render. **The D8 gate list says "asserted" where it should say
  "planned" — treat that row as aspirational until the gate exists.**
- **No concurrency guard or deadline on `/_api/figma/import`.** A large import
  holds the request for the duration, and each SVG costs a browser canary.

**Status stays Accepted**, on the basis of three review rounds (two design, one
post-code) with every blocker either closed or explicitly named above.

---

## D12 — Render-first is the default for design pages (2026-08-10, amendment)

**Superseded:** D1's premise that a design page's value is its *translated JSX*.
The trust boundary, the SSRF chokepoints, the character grammars and the caps
are unchanged — this amends WHAT is emitted, not what is trusted.

### What the first real file showed

The JSX path was exercised against a live 6-page product file
(`2H6a9YUgPAu0AGdEiwP895`, 115 frames). It produced five independent classes of
visible defect:

| Symptom | Cause |
| --- | --- |
| A whole canvas failed to parse | `background-image` — a kebab-case key emitted into a JSX style **object** |
| Frames stacked in DOM order | Figma frames are absolutely positioned; the emitter mapped them to `flex-col` |
| Sections split from their contents | anything not a top-level frame went to annotations, so a SECTION became an annotation while its child frames became artboards |
| Missing images and fonts | a bespoke asset pipeline with its own caps and its own failure modes |
| White screens rendered black | the frame's own fill was computed for contrast and then discarded |

These are not five bugs. They are one: **translating a Figma frame into CSS
means reimplementing Figma's layout engine** — auto-layout, constraints,
clipping, blend modes, vector networks, text auto-resize — and every gap in that
mapping is a defect on someone's real work. The bug surface is unbounded and
grows with the fidelity of the source document.

### Decision

`--pages` renders **frame-first** by default: each frame is fetched from
`/v1/images` as SVG with `svg_outline_text=false` and referenced from
`<img src>`. `--editable` opts back into the JSX translation.

Measured on the same file: `Phase 1` 283 KB → 47 KB, `User Flow Wireframe Kit`
489 KB → 17 KB, and every canvas parses.

**Why this is not a downgrade in containment — it is an upgrade.** An SVG inside
an `<img>` cannot execute script and cannot fetch a subresource. The previous
path inlined third-party vector markup into the canvas's own document. The bytes
still traverse the DDR-167 sanitize + canary lane on the way to disk; the `<img>`
is a second layer, not a replacement for the first.

**Accepted cost:** a rendered artboard is not editable JSX. `.meta.json` keeps
every frame's node id (`figma.frames[]`) so a single artboard can be exploded
into JSX on demand, rather than mistranslating 115 of them up front.

### D12a — Comments are part of the import

Figma review comments live on `/v1/files/:key/comments` and appear **nowhere in
the document tree**, so every tree-walking version of this importer brought
across exactly zero of them. The same live file carries **133**. They import as
sticky annotations pinned at their target node's position plus the comment's
offset; threads fold into one card; resolved threads arrive on grey paper rather
than being dropped, because a resolved comment is the record of a decision.

### D12b — Sections are containers, not leaves

A SECTION is descended: its frames become artboards and the section itself
becomes a labeled region on the annotation layer. The annotation layer takes
FigJam-native furniture (`STICKY`, `CONNECTOR`, `SHAPE_WITH_TEXT`, `STAMP`,
`WIDGET`, `TABLE`), loose positioned content, and comments — nothing else.

A page with **no** frames renders whole (Figma renders a `CANVAS` node), because
the first cut of this rule emitted zero artboards for such a page and the canvas
opened blank — the same silent-loss failure in a new costume.
