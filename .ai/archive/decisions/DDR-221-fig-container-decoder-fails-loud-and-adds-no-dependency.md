# DDR-221 — The `.fig` decoder is ours, dependency-free, and refuses rather than approximates; the differential against REST is the only thing that makes it trustworthy

- **Date**: 2026-08-12
- **Status**: Accepted — pending the design-stage `security-auditor` + `ethical-hacker`
  round mandated by `feature-figma-import` T13. **Every measurement in this
  document was taken before it was written**, against the committed fixtures
  (`.ai/fixtures/figma/2026-08-03/`) on Bun 1.3.3 — including the two that decide
  the dependency posture (§ D2) and the one that decides where bomb caps live
  (§ D4). Nothing here is extrapolated from the format's documentation.
- **Scope**: `repo:maude`, `dept:dev`
- **Area**: Figma import — the local `.fig`/`.jam` door (container framing,
  decompression, the Kiwi decoder, its threat model, and the correctness oracle)
- **Extends**: [DDR-216](DDR-216-figma-ingestion-architecture-and-trust-boundary.md)
  — the second door onto the same normalized tree. Its governing invariant (the
  ingestion path is deterministic code end to end; **no LLM ever reads
  Figma-sourced content**) applies here unchanged and unweakened. D5's caps are
  inherited, not restated.
- **Relates to**: [DDR-219](DDR-219-codegen-is-a-per-frame-tool-not-an-ingestion-route.md)
  (the third door — and the reason this one is *not* urgent, see § What this
  changes about the feature's shape), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md)
  (why `node:zlib` availability had to be measured on Bun and not assumed from
  Node's changelog), [DDR-177](DDR-177-desktop-self-contained-runtime-and-bundle-completeness-gate.md)
  (why "zero new deps" here means zero *including* deps this repo already has),
  [DDR-167](DDR-167-svg-ingestion-sanitize-allowlist-and-execution-canary.md)
  (the byte lane archive images still traverse)

## Context

Phases 0–5 shipped the REST door. Phase 7 shipped `--explode`, a per-frame
codegen tool over the local Dev Mode MCP. Phase 6 is the third and last door:
read a `.fig` / `.jam` the user exported, entirely locally.

It is the only door that works with **no Figma seat, no network, and no token**.
The user asked for it by name. It is also the only door whose input is a file of
attacker-controllable bytes fed to a parser we wrote — which makes it the
highest-risk code in the whole program, and the reason it was deliberately
sequenced last.

The plan's § Container format section already measured the framing on
2026-08-03. This DDR re-measured all of it on 2026-08-12 before deciding
anything, and adds the two numbers that were left open:

```
.fig / .jam   = ZIP archive
  ├── canvas.fig     the kiwi payload
  ├── thumbnail.png
  ├── meta.json      file name, background colour, render coords, exported_at
  └── images/        image assets, INSIDE the file

canvas.fig    = "fig-kiwi" | "fig-jam."   8-byte ASCII prelude (editor discriminator)
                u32 LE version            observed: 106
                u32 LE len + chunk[0]     SCHEMA — raw DEFLATE (no zlib header)
                u32 LE len + chunk[1]     DATA   — ZSTD (magic 28 B5 2F FD)
```

| Measured 2026-08-12 | `design.fig` | `figjam.jam` |
|---|---|---|
| archive | 49 858 B, 4 entries | 64 574 B, 4 entries |
| `canvas.fig` | 42 038 B | 54 486 B |
| prelude / version | `fig-kiwi` / 106 | `fig-jam.` / 106 |
| chunks / trailing bytes | 2 / **0** | 2 / **0** |
| schema chunk | 28 766 B → 71 777 B (**2.5×**) | *byte-identical* |
| schema sha256 | `c22712ff…` compressed, `cf4e3698…` plain | *identical* |
| data chunk | 13 252 B → 31 866 B (**2.4×**) | 25 700 B → 67 207 B (**2.6×**) |

Two things in that table do real work below. **The schema chunk is byte-identical
across editor types** — one schema, one decoder, and a stable hash to alarm on.
And **a legitimate file compresses about 2.5×**, which is what makes a ratio cap
a meaningful control rather than a number picked out of the air.

## Decision

### D1 — We write the decoder; we do not depend on one

`fig-kiwi` on npm is `0.0.1` and ~4 years stale. `@open-pencil/fig` is
similar-vintage. Both **pin a schema**. A `.fig` *carries its own schema* — chunk
[0] is the complete `.sk` definition set for the exact file in your hands — so an
in-house decoder reads whatever the file brings and cannot rot the way a pinned
one does.

This is not bravery, it is the lower-risk option, and the fixtures prove why:
the decompressed schema contains **3 468 readable identifiers**, including a
`NodeType` enum whose members are already the union in `figma/types.ts`. Nothing
about Figma's data model is guessed. Only the **container framing** is
reverse-engineered, and that is 20 bytes of prelude + length prefixes.

Kiwi itself is a documented open format with a reference implementation
(`evanw/kiwi`), and it advertises the exact property this file relies on:
*forwards compatibility, if a copy of the schema is bundled with the data.* The
format was designed for this read.

### D2 — Zero new runtime dependencies, and that includes ones we already have

**Measured on Bun 1.3.3** (the runtime that actually executes this — DDR-009):

```
node:zlib → inflateRawSync      ✓ present
node:zlib → zstdDecompressSync  ✓ present
```

Both codecs are built in. `fzstd`, named in the plan as the single fallback dep,
**is not needed** and is hereby dropped from the plan's dependency posture.

The less obvious half: **`jszip` does not count as free.** It is already a
reviewed dependency of `apps/studio` and it can read archives — but it lives in
`apps/studio/package.json`, not the root, and the npm channel stages helper deps
from the root (DDR-177). Reaching for it would make `--fig` desktop-app-only on
npm, which is exactly the residual `--explode` carries today for `oxc-parser`.
Two doors gated on the same avoidable cause is a pattern, not an accident.

So the ZIP layer is **ours too** — `figma/fig-zip.ts`, a narrow reader over
`node:zlib` that understands precisely the archive Figma writes and **refuses
everything else** (see D3). No zip64, no encryption, no multi-disk, no
streaming central-directory recovery. (**Corrected at implementation:** data
descriptors ARE allowed — Figma's exporter sets that flag, and this draft's
"no data descriptors" would have refused every real file. Harmless because
sizes and CRC come from the central directory.) We need three entries by
exact name from a single known producer; a general ZIP implementation is surface
we would own forever for no gain.

Net: the local door is **dependency-free end to end** and works identically on
the npm CLI and in the packaged app.

### D3 — Fail loud. An unrecognised byte refuses the file; nothing is best-effort

For a design importer, **silent wrongness is far worse than a clean error.** A
decoder that half-reads a file it does not understand produces plausible,
subtly-wrong geometry, and the user discovers it three canvases later. This
feature has already been burned once by a green result that had looked at
nothing (§ the `-maxdepth 1` smoke gate); the decoder must not add a second way
to be confidently wrong.

Refuse, with the observed value named in the message so diagnosis is one line:

| Condition | Posture |
|---|---|
| prelude ∉ {`fig-kiwi`, `fig-jam.`} | refuse — name the observed 8 bytes |
| container version ∉ known set | ~~refuse~~ → **report** (amended, see A9) |
| chunk count ≠ 2, or trailing bytes ≠ 0 | refuse |
| schema chunk not raw-deflate | refuse |
| data chunk missing the zstd magic | refuse |
| any cap in D4 tripped | refuse |
| Kiwi type index out of range, unterminated string, malformed varint | refuse |
| a node type in the file that `FigmaNodeType` lacks | **carry it, report it, skip it** — this is data, not framing |

The last row is the boundary of the rule and worth stating explicitly: **framing
errors refuse the file; vocabulary gaps degrade and report.** The existing
disposition machinery (DDR-216 D9) already covers the second case, and an
unmappable node is a case Phase 2 handles today.

An unknown *version* refusing is the one that will annoy someone the first time
Figma ships 107. That is the intended trade. The refusal message tells them the
version, the Tier-4 alarm (D8) is designed to see it coming, and the REST door is
right there.

### D4 — The bomb caps are enforced by the decompressor, not checked afterwards

A post-hoc size check on a decompression bomb is not a control — the allocation
already happened. **Measured on Bun 1.3.3:** `node:zlib`'s `maxOutputLength`
option is honoured by both codecs, throwing `ERR_BUFFER_TOO_LARGE` instead of
producing the buffer:

```
zstdDecompressSync(bomb, { maxOutputLength: 65536 })  → ERR_BUFFER_TOO_LARGE
inflateRawSync(bomb,     { maxOutputLength: 65536 })  → ERR_BUFFER_TOO_LARGE
```

(The probe bomb was 4 MiB of zeros → 147 B of zstd, a **28 533×** ratio, against
the 2.4–2.6× a real file achieves.)

Every cap below is a hard refusal with an actionable message. Measured baselines
are in the fixture table above; each cap states its headroom so a future reader
can tell a deliberate margin from a superstition.

**ZIP layer**

| Cap | Value | Basis |
|---|---|---|
| archive bytes | 256 MiB | the user picked this file; generous on purpose |
| entries | 4 096 | `images/` can be large; 4 observed |
| entry name | rejected if absolute, contains `..`, a backslash, a NUL, or a drive letter | zip-slip — **and see D6, entry names never become paths anyway** |
| per-entry declared uncompressed | checked **before** inflating | the central directory tells us the claim; we refuse the claim, then verify the delivery |
| per-entry ratio | 200:1 | ~80× the measured 2.5× |

**Container layer**

| Cap | Value | Basis |
|---|---|---|
| `canvas.fig` bytes | 64 MiB | ~1 500× the measured 42 KB |
| chunks | 8 | 2 observed |
| schema, decompressed | 8 MiB | ~117× the measured 71 777 B |
| data, decompressed | 64 MiB | ~1 000× the measured 67 207 B |

**Kiwi layer**

| Cap | Value | Basis |
|---|---|---|
| definitions | 8 192 | schema carries ~3 468 identifiers total |
| fields per definition | 4 096 | |
| identifier length | 256 B | |
| decode depth | `MAX_TREE_DEPTH` (64) | inherited from DDR-216 D5, not re-invented |
| node count | `MAX_NODE_COUNT` (20 000) | inherited |
| varint width | 5 bytes (32-bit) / 10 (64-bit) | refuse a longer run rather than shift past the width |
| array length | ≤ remaining input bytes **and** an absolute ceiling | a length prefix is a claim about a buffer we already hold; it can never exceed it |
| total decoded values | one global budget | nested small arrays multiply; per-array caps alone do not bound the product |

The last two rows are the ones a naive port of the reference implementation gets
wrong. `evanw/kiwi`'s JS reference reads a `varuint` length and allocates; it is
written for data you produced yourself.

### D5 — The decoder's output is the existing normalized tree, so it inherits every existing control

`figma/fig-decode.ts` emits **exactly** what `figma/client.ts` emits — the
`figma/types.ts` shape, whose header already anticipates this
(*"a future `fig-decode.ts` (Phase 6) only has to produce the same shape and it
inherits `to-strokes` / `to-artboard` / `to-tokens` for free"*).

This is the security claim, not just an architecture convenience. Every string
in a `.fig` is attacker-controlled — `name` in particular, since a TEXT node's
layer name *defaults to its own content*. By landing on the same tree:

- sanitization stays at the emission sinks where the target grammar is known
  (DDR-216 D6), and **no new sanitizer is written for this door**;
- the zero-glyph / bidi / visibility-normalization classes (D6a, D6b) apply
  unchanged;
- the disposition vocabulary and per-import summary work as-is;
- the **provenance stamp** distinguishes the door: `source.channel: 'fig-local'`
  alongside the existing `fileKey`/`nodeId`, so a later reader can tell which
  door produced a canvas without guessing. The file's *name* is still never
  recorded (DDR-216 D7).

A new sanitizer for this door would be the predictable way to reintroduce a bug
Phase 2 already fixed.

### D6 — Archive images resolve locally, and an entry name is never a path

The archive carries its own `images/`. This path is **strictly better than the
REST one on three axes at once**: no URL expiry, no `IMAGE_COST` rate limit, and
**no SSRF surface at all** — there is no outbound request in the entire local
door.

The rule that keeps it that way: an archive entry name is a **lookup key, never
a filesystem path.** Bytes go through `_import-asset.mjs`'s content-addressed
write exactly as today, so the on-disk name is a hash we computed. Zip-slip is
refused at the ZIP layer (D4) as defence in depth, but the reason it cannot bite
is that the attacker's string never reaches `path.join`.

SVG entries take the DDR-167 lane (allowlist sanitize + execution canary) like
every other ingested SVG. The shared sniff in `_fetch-asset.mjs` is **not**
widened — the same rule DDR-216's correction table already set for D11.

### D7 — Tier 2 is the ship gate, and it is the reason the phase ordering was right

**No `.fig` import ships without a passing differential run.** The same document
through both doors must normalize to the same tree — node count, ids, types,
geometry, text. Known-lossy fields are enumerated and asserted *as* lossy;
nothing may degrade silently into the "expected difference" bucket.

The fixtures exist for this: `Em6NOwaOFTYV7NlQT4NK8l` (FigJam) and
`dGNzRC2kmrmGnOxaBa0RI7` (design) are the *same documents* the committed exports
came from, so both doors can read them.

This is the only oracle that proves the decoder is **right** rather than merely
**quiet**, and it exists only because REST was built first. The plan claimed that
ordering was deliberate; this is where the claim is cashed.

Tiers 1 (container smoke, offline, every CI run), 3 (translator end-to-end,
including the A.10 editability gate), 4 (drift alarm) and the fuzz corpus stand
as the plan specifies. A parser fed untrusted bytes gets a fuzz corpus; it is
cheap under `bun test` and non-negotiable.

### D8 — The schema hash is the alarm; decode failure is only the backstop

Chunk[0] is stable and shared across editor types (`c22712ff…`, measured
identical in both fixtures). A **changed schema sha256 is an early warning that
fires before anything breaks** — Figma can ship a new schema for months before it
emits a node we mishandle.

Two alarms, in this order:

1. **schema hash drift** — noticed on the next export, nothing broken yet;
2. **decode failure on a fresh export** — the backstop, and it must name the
   observed container version in the message.

The dated fixture corpus makes itself self-labelling via `meta.json`'s
`exported_at`. The ritual is: re-export the same two source documents
periodically, drop them in `.ai/fixtures/figma/<date>/`, run Tier 4.

### D9 — Legal posture, stated once and not over-lawyered

This reads a file the user already exported and owns, entirely on their machine,
touching no Figma service, using a **documented open format** (Kiwi) whose schema
the file itself supplies. No Figma code is decompiled, no protection is
circumvented, no service is accessed. That is the honest framing, and it is
recorded here so the question is answered once rather than re-litigated in a
future review.

## What this changes about the feature's shape

Worth saying plainly, because it is the strongest argument *against* doing this
phase and the plan does not make it: **`--explode` (DDR-219) already delivers
editable canvases from the live file, and it landed after Phase 6 was planned.**
Phase 6 is no longer "the way imports become good." It is a **door**, justified
by the three things it alone does — works with no Figma seat, no network, and no
token, and carries its images inside the file.

Consequences:

- Phase 6 is **not** a prerequisite for anything else, and it is not on the
  critical path of any open Phase-7 residual (the A.10 exemption, `oxc-parser`
  in root deps, the unmeasured local daily cap). Those are independent.
- The decoder must reach the same normalized tree, so a `.fig`-sourced page gets
  the same route assignment (`render` by default, `--explode` per frame) — except
  that **`--explode` is unavailable for a `.fig`**, because Dev Mode codegen
  needs the document open in the Figma desktop app. A file you decoded offline
  has no such session. Stated here so it is a known property, not a bug report.
- If the effort runs long, stopping after Tier 1 + Tier 2 with the decoder behind
  a flag is a legitimate outcome. Shipping it without Tier 2 is not.

## Alternatives rejected

**Depend on `fig-kiwi` / `@open-pencil/fig`.** Pins a schema the file already
carries; `0.0.1` and ~4 years stale; a new dependency in a repo that reviews each
one individually. Rejected on the pinned-schema argument alone — the staleness is
just corroboration.

**Use `jszip` for the ZIP layer.** Mature and already reviewed, but rooted in
`apps/studio`, which would make `--fig` desktop-only on npm for the same reason
`--explode` is (D2). A narrow reader over `node:zlib` costs ~150 lines and keeps
the door dependency-free on both channels.

**Shell out to `unzip`.** A subprocess on untrusted input, absent on Windows, and
absent from the packaged app's stripped PATH (DDR-177). It is fine for a
throwaway probe and disqualified for shipped code.

**Best-effort decode on an unknown container version.** Rejected — see D3. This
is the single decision most likely to be reversed by someone who has just been
annoyed by a refusal, so the reasoning is in the record: a design importer that
guesses produces wrong geometry that looks right.

**Skip the differential and rely on Tier 1 + fuzz.** Those prove the decoder does
not crash. Nothing in them proves it is *correct*. Rejected as the exact
"green and vacuous" failure the migration already found once.

## Residuals — named, not resolved

1. **The known-version set is `{106}`, n=2, one export date.** Every `.fig` we
   have was written by the same client on the same day. A second dated corpus is
   the first thing Tier 4 should produce.
2. **Zstd frame parameters are untested beyond what Figma emits.** `maxOutputLength`
   bounds the output; a hostile frame with an enormous window size is bounded by
   the codec's own allocation policy, which we do not control. Native-codec
   behaviour on adversarial frames is an assumption inherited from `node:zlib`.
3. **The Kiwi decoder is new code on untrusted bytes.** In bounds-checked JS the
   failure mode is a throw, not memory corruption — but "throws on 3 % of inputs"
   is still a DoS on the importing process, and only the fuzz corpus will tell us
   the real rate.
4. **Tier 2 needs network and a live Figma token**, so it cannot run in CI as a
   plain unit test. It has to be a recorded-fixture differential (capture the REST
   response once, commit the normalized tree) plus a documented manual live run.
   The recorded form catches decoder regressions; only the live run catches
   *Figma* changing. Both are needed and they are not the same test.
5. **No cap protects against a pathological-but-legal document** — 20 000 nodes
   of deeply nested groups is within every cap and still slow. The REST door has
   the same property.

---

## Addendum — measured after drafting, before T14 (2026-08-12)

The whole pipeline was then built as a throwaway probe and run against both
fixtures: ZIP → container → `inflateRaw` → `zstd` → Kiwi schema → Kiwi data →
tree rebuild. **Byte-exact on both** (31 866/31 866 and 67 207/67 207 consumed,
zero trailing), every documented fixture node id and hostile layer name
resolving, geometry matching the fixture manifest. Six things came out of it that
amend the decisions above.

### A1 — Cap headroom is now measured, not estimated

| D4 cap | Set to | Observed | Real headroom |
|---|---|---|---|
| definitions | 8 192 | **627** (206 ENUM / 30 STRUCT / 391 MESSAGE) | 13× |
| fields per definition | 4 096 | **602** | 6.8× |
| identifier length | 256 B | **38** | 6.7× |

### A2 — Self-reference is NORMAL; "reject cyclic schemas" would refuse every real file

Three definitions in the **legitimate** schema reference themselves: `Message`,
`NodeChange`, `MessageType`. The obvious hostile-schema control is therefore
wrong. **The only usable bound is the decode-time depth cap** already in D4.
Zero fields carried an out-of-range type index, so the range check stays a safe
refusal. Recorded explicitly because "refuse recursive type graphs" is exactly
what a reviewer will ask for.

### A3 — A `.fig` is not a tree, and D5/T14 both imply it is

The root is a `Message` of `type: NODE_CHANGES` carrying a **flat
`nodeChanges[]`** plus `blobs[]` (72 / 111). Distinct guids equal the change
count on both fixtures, so it is a snapshot rather than a multi-revision log.
But hierarchy is **not nesting** — it comes from `parentIndex: { guid, position }`
with a fractional-index `position`, and geometry is a parent-relative
`transform: Matrix` + `size: Vector`, not REST's absolute `absoluteBoundingBox`.

So T14 owes two pieces of real work its one arrow hides: **rebuild the tree** and
**compose the absolute bbox down the parent chain**. Both land squarely on D7's
differential — they are precisely where the two doors can disagree.

### A4 — 🔴 The float encoding is the silent-wrongness trap, and it fired on the first attempt

Kiwi does not store a float as four plain LE bytes. It rotates the exponent into
the low 8 bits so zero and denormals collapse to a **single `0` byte**.

The first probe got the *framing* right (1 byte when the lead byte is 0, else 4)
and the *math* wrong. The stream stayed perfectly in sync: every string, enum and
guid correct, byte accounting exact to the byte, no throw, no truncation — and
**every coordinate and dimension in the file decoded as 0.** A structurally
perfect, geometrically empty document.

This is D3's thesis reproducing itself by accident, and it has a direct
consequence for D7: **Tier 1 cannot be the gate.** A container smoke asserting
"decodes without error and consumes all bytes" passes this bug cleanly. Tier 1
must additionally assert a **known non-zero dimension** from the fixtures, and
Tier 2 remains the real oracle.

After the fix, geometry matches the manifest exactly — stickies 240×240, the wide
sticky **416×240**, sections 1200×900 with the nested one 560×700 at (60,140).

### A5 — D5 is understated: use the existing normalizer, don't parallel it

`figma/types.ts` already ships the seam deliberately — `origin: 'rest' | 'fig'`
on `NormalizedDocument`, `FigmaCapError`, and `isPollutingKey` documented as
*"used by … the `.fig` door later"*.

So the decoder must **not** construct a `NormalizedDocument`. It emits a
**REST-shaped raw object** and calls the existing
`normalizeDocument(raw, { origin: 'fig' })`. Then the node/depth caps, the
prototype-pollution guard and the untrusted-string discipline are not "the same
controls" — they are **the same code**, with no second implementation that can
drift. This supersedes D5's invented `source.channel: 'fig-local'`: `origin`
already exists and is already documented as being there for the Tier-2 diff.

### A6 — Two coverage gaps D6 and D7 depend on

- **`images/` is empty (0 bytes) in both fixtures.** The path D6 calls "strictly
  better than REST on three axes at once" has **no test input at all**. A third
  purpose-built fixture carrying a raster fill and a vector export is a
  prerequisite for claiming D6 verified.
- **`meta.json` carries `file_name`** (`"Maude import fixture — Design"`).
  DDR-216 D7 forbids recording the Figma file *name* anywhere an agent later
  reads. The REST door never had it to hand; the local door has it sitting in a
  file it must open anyway for `exported_at` (which Tier 4 needs). The decoder
  reads `exported_at` and **drops `file_name` on the floor** — an explicit
  negative control, and a test.

### A9 — The version gate is REMOVED; a real file refuted it (2026-08-12)

A genuine third-party export (12 MB, images inside) is container version
**101** — *lower* than the fixtures' 106 despite being made nine days later —
carries a **different** embedded schema (`7ae1921b` vs `c22712ff`), and decodes
perfectly under the same code. Framing byte-identical.

So D3's allowlist was **refusing valid files while predicting nothing**. It was
written from the assumption that the version tracks framing compatibility; n=3
says it does not even monotonically increase. This is the same class of error as
the data-descriptor refusal: a rule derived from documentation rather than from
files.

The allowlist is dropped. The version is reported, with a
`containerVersionKnown` flag as a soft drift signal alongside the schema hash
(D8). **Structure still gates**, and it is far stronger than an integer: the
prelude, exactly two chunks with zero trailing bytes, a raw-deflate schema that
parses and consumes every byte, the zstd magic, strict root resolution (A8/F2),
and a data chunk that decodes with nothing left over.

Note this *strengthens* D1 rather than weakening D3's spirit: the file carries
its own schema, so a schema change is a non-event — which is precisely what this
file demonstrated.

### A10 — D6 is now real, and it was hiding a defect in the REST door too

The same file closed the coverage gap A6 named. Measured: a paint's 20-byte
`image.hash`, hex-encoded, **is** the `images/<name>` archive entry. The local
door now resolves image fills straight from the archive through the same
content-addressed promote as every other asset — no network, no expiry, no rate
limit, no SSRF surface, exactly as D6 claimed.

Getting there exposed a defect **shared with the REST door**: `to-artboard` only
ever queued VECTOR clusters, so an IMAGE fill fell through to the generic leaf
path and emitted an **empty positioned div**. An 11.7 MB photo vanished while
the import reported success. Fixed for both doors.

What genuinely cannot work offline is a vector cluster — Figma renders those
server-side. That gets `asset-unavailable-offline`, deliberately distinct from
`asset-skipped`: "nothing could be attempted" and "we tried and it failed" are
different facts, and conflating outcomes is how this feature repeatedly reported
success while losing content.

### A8 — Five controls the security pass added; all bind T14

Design-stage pass, 2026-08-12
([`fig-decoder-ddr221-design-stage.md`](../logs/security-reviews/fig-decoder-ddr221-design-stage.md)).
**It was a self-review — the independent `security-auditor` + `ethical-hacker`
round T13 mandates did not complete, and remains outstanding.** Five findings,
all rooted in the property the rest of this DDR under-weights: **the attacker
supplies the schema, not just the data.**

| | Finding | Control that must exist in T14 |
|---|---|---|
| **F1** HIGH | Enum member names are schema-chosen, so `node.type` is attacker-controlled — and A7 routes unknown types straight into a *report* | Every schema-sourced identifier reaching a report, log or refusal message goes through `attrValue(name, 32)` + a count (DDR-216 D9's rule). Applies to D3's "name the observed value" messages too. |
| **F2** HIGH | Root type is resolved by *name*; a hostile schema can omit, duplicate or reshape `Message`, and decoding against the wrong root yields a structurally valid, semantically wrong tree | Strict root resolution: exactly one `Message`, kind MESSAGE, with a `nodeChanges` array of `NodeChange`. Else refuse. |
| **F3** MED | Decoded objects are keyed by schema field names. `o["__proto__"] = v` does **not** pollute `Object.prototype`, but it *does* set that node's prototype to attacker data, yielding phantom inherited `type`/`name`/`characters`. `isPollutingKey` runs in `normalizeDocument` — **after** these objects exist | Build every decoded object with `Object.create(null)`. (Phase-7 F6, same class, recurring.) |
| **F4** MED | Tree rebuild from `parentIndex` is a **second** recursion; D4's depth cap bounds only Kiwi decoding. A→B→A stack-overflows | Cycle detection in the rebuild, single-root assertion, explicit refusal for orphans and duplicate guids. |
| **F5** MED | If the REST-shaped mapping copies decoded keys generically, the schema chooses which REST field each value lands in (`absoluteBoundingBox`, `characters`, `children`) | Map from a **hardcoded** list of expected `NodeChange` field names. Never iterate decoded keys. |

A post-implementation code-level pass added two more, both fixed and tested:
**F7** — a PRESENT-but-non-finite transform component silently fell back to the
identity, placing a node plausibly with no error signal (the A4 trap reached
deliberately); absent still defaults, non-finite now refuses. **F8** — pruning
internal-only nodes before parentage was resolved orphaned their children and
refused legitimate files; both fixtures' internal canvas is childless, which is
why it looked safe. Subtrees are pruned during the walk instead.

Residual 3 above ("new code on untrusted bytes") is **reclassified** — F1–F5 are
its concrete instances, each fixable now rather than lived with.

What the pass found clean: D4's cap ordering and codec-level enforcement, D2's
dependency reasoning, the no-network claim, and D6's zip-slip argument.

### A7 — Vocabulary gaps are the main path, not the exception

The file's own `NodeType` enum has **65 members** against `FigmaNodeType`'s 26 —
`SLIDE`, `WEBPAGE`, `JSX`, `REACT_FIBER`, `TABLE_CELL`, `WASHI_TAPE`, `CODE_*`,
`VARIABLE*` and more. D3's "vocabulary gaps degrade and report" will fire on
ordinary files, so the reporting is a primary surface, not an edge case.
