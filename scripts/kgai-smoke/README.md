# kgai smoke test

A re-runnable performance harness for [kgai](https://github.com/kgaidev/kgai) — the
event-sourced decision knowledge graph we're evaluating as a cross-repo, org-wide
shared-memory layer for the flow/design plugins. It imports this repo's real DDR corpus
(`.ai/decisions/DDR-*.md`) into a throwaway kgai store and measures the operations that
decide whether kgai scales to a whole-company graph.

## Run it

```sh
scripts/kgai-smoke/run.sh
```

Needs `go` (≥1.22) + a C compiler. `run.sh` clones kgai, builds `kg` from source into an
isolated `.smoke-home/` (gitignored — **not** `~/.kgai`), imports the DDRs into a temp
store, prints the numbers, and cleans up. Nothing touches your working tree, your global
kgai home, or the Claude Code plugin install.

- `KGAI_REF=v0.1.5 scripts/kgai-smoke/run.sh` — pin a specific kgai release/commit
- `STEPS=8 scripts/kgai-smoke/run.sh` — longer scaling curve

Files: `ddr2kgai.py` (DDR → kgai batch payload), `bench.py` (the measurement harness),
`run.sh` (build + run wrapper).

## Baseline results — 2026-07-15, kgai @ main (v0.1.x), 175 DDRs, M-series mac

**Import an existing repo (the headline scenario): fast.**

| Operation | Result |
| --- | --- |
| Batch import 175 DDR (1523 mutations) | **1.7 s** |
| Single-decision ingest | ~74 ms (per-call Kuzu-open floor ~40 ms) |
| Event log on disk | ~2.6 KB / decision (175 DDR = 456 KB) |
| graph.kuzu | ~22 MB fixed floor, grows slowly |

**Scaling curve (re-ingesting the corpus to grow the log):**

| decisions | rebuild | context (read) | search | as-of |
| ---: | ---: | ---: | ---: | ---: |
| 175 | 1.3 s | 44 ms | 45 ms | 10 s |
| 350 | 2.6 s | 46 ms | 48 ms | — |
| 525 | 4.2 s | 51 ms | 49 ms | — |
| 700 | 8.4 s | 54 ms | 54 ms | — |
| 875 | **13.5 s** | 56 ms | 56 ms | **61 s** |

### Reading the numbers

- ✅ **Reads don't degrade.** `context`/`search`/`history` stay ~44–56 ms even at 875
  decisions — the Kuzu projection queries are O(small live graph). This is the everyday
  agent path, and it scales.
- ✅ **Storage is negligible.** Event log ~2.6 KB/decision; Kuzu has a fixed floor. Years
  of company-wide decisions fit in tens of MB of log.
- ⚠️ **`as-of` (time-travel) is a cliff.** 10 s at 175 → 61 s at 875, and much worse at
  scale (see below). Least-used op, but effectively unusable at scale.

> **The `rebuild` numbers above (175→1.3 s … 875→13.5 s) are a measurement artifact — do
> NOT read them as a scaling curve.** kgai's COPY bulk loader only engages above
> `bulkThreshold()` = 1000 events (`src/internal/engine/engine.go`). This whole curve ran
> *below* the threshold, i.e. on the slow per-event MERGE path. The real rebuild path is
> measured in the big-scale cross-check below and is roughly linear.

## Big-scale cross-check vs [kgai.dev/#scale](https://kgai.dev/#scale) — 2026-07-16

20,000 synthetic decisions across 1,060 elements (bulk-loader path engaged), M-series mac.
Harness: `bigbench.py` (spread decisions across ~1000 elements, ingest in 2k
chunks, measure at checkpoints).

| decisions | rebuild (bulk) | lookup (`context`) | history | search | log |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2,000 | 332 ms | 65 ms | 44 ms | 56 ms | 3 MB |
| 6,000 | 432 ms | 104 ms | 45 ms | 83 ms | 9 MB |
| 10,000 | 545 ms | 131 ms | 47 ms | 109 ms | 14 MB |
| 20,000 | **842 ms** | 220 ms | 51 ms | 181 ms | 28 MB |

**Published (Linux x86_64):** 20k → rebuild ~1.5 s, lookup ~60 ms, history ~90 ms, sync <0.5 s.

- ✅ **`rebuild` reproduces — actually beats — the published number.** 842 ms measured vs
  ~1.5 s published at 20k, roughly linear (332→842 ms over 2k→20k). The COPY bulk-loader
  perf work is real; the published table is credible and conservative.
- ✅ **`history` is genuinely flat** (44→51 ms) and faster than the ~90 ms published.
- ⚠️ **`lookup` drifts up** (65→220 ms) rather than staying flat at ~60 ms as the page's
  per-op figure implies — still sub-second, within ~2–4× of published (machine/methodology
  differences), but not the "flat" the headline suggests.
- ✅ **`search` matches** the honest linear-scan disclosure (181 ms @20k → ~1.4 s @100k;
  the page says an index is "planned").
- 🔴 **`as-of` is an undisclosed cliff: 737 s (12 min) at 20k.** The `#scale` table omits
  time-travel entirely. Fine for the rare audit query; do not put it on a hot path.

**Verdict:** the published `#scale` numbers are reproducible and honest for the ops they
list (rebuild/sync/history/lookup). Two caveats the page underplays: full-context `lookup`
drifts up with element-history depth, and `as-of` is O(n)-replay slow. Re-run
`bigbench.py` after any as-of/lookup optimization lands.

> **Update 2026-07-19 — kgai v0.1.9:** the `as-of` cliff above is **fixed** upstream
> (bulk loader; re-measured @180: ~10 s → **908 ms**), macOS prebuilt `kg`+libkuzu now
> ship as release assets, and sync is 29× faster. Project scoping is still not a native
> `--scope` query filter (a `kgai://org/project` cloud broker is the emerging isolation
> path). This harness IS the **upstream-sync gate** (plan Task 0): pin + re-baseline with
> `KGAI_REF=<tag> scripts/kgai-smoke/run.sh` before targeting a new kgai release, so the
> integration always builds against a verified, pinned infrastructure — never a floating one.
