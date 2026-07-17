#!/usr/bin/env python3
"""Big-scale cross-check of kgai vs the numbers published at kgai.dev/#scale.

Generates N synthetic decisions spread across ~E elements (matching the published
~20-decisions-per-element ratio), ingests in chunks, and measures rebuild (the COPY
bulk-loader path, which only engages above 1000 events), lookup, history, search, and
storage at checkpoints. `as-of` is measured once at the top size (it's an O(n) replay).

Same env contract as bench.py — use run.sh, or:
    KG=... KGLIB=... KGAI_STORE=/tmp/kgai-big  python3 bigbench.py

Env knobs: MAX (top decision count, default 20000), ELEMENTS (default 1000),
CHUNK (ingest batch, default 2000), SKIP_ASOF=1 to skip the 10-minute time-travel probe.
"""
import json, os, statistics, subprocess, sys, time

KG, KGLIB, STORE = os.environ.get("KG"), os.environ.get("KGLIB"), os.environ.get("KGAI_STORE")
if not (KG and KGLIB and STORE):
    sys.exit("set KG, KGLIB, KGAI_STORE (see run.sh)")
MAX = int(os.environ.get("MAX", "20000"))
E = int(os.environ.get("ELEMENTS", "1000"))
CHUNK = int(os.environ.get("CHUNK", "2000"))
TOPICS = 60
CHECKPOINTS = [c for c in (1200, 5000, 10000, 20000, 50000, 100000) if c <= MAX] or [MAX]

env = dict(os.environ)
env["DYLD_LIBRARY_PATH"] = KGLIB + ":" + env.get("DYLD_LIBRARY_PATH", "")
env["LD_LIBRARY_PATH"] = KGLIB + ":" + env.get("LD_LIBRARY_PATH", "")
env["KGAI_STORE"] = STORE

def run(args, stdin=None):
    t = time.perf_counter()
    p = subprocess.run([KG] + args, input=stdin, capture_output=True, env=env)
    return (time.perf_counter() - t) * 1000, p.returncode, p.stdout, p.stderr
def med(args, n=5):
    return statistics.median([run(args)[0] for _ in range(n)])
def du_kb(p):
    return int(subprocess.run(["du", "-sk", p], capture_output=True, text=True).stdout.split()[0]) if os.path.exists(p) else 0

def gen_batch(start, count):
    ds = []
    for i in range(start, start + count):
        fe = i % E
        t1, t2 = i % TOPICS, (i * 7) % TOPICS
        ds.append({
            "title": f"decision {i}: tune feature {fe}",
            "author": f"user{i % 30}",
            "date": f"2026-{1 + (i % 12):02d}-{1 + (i % 27):02d}",
            "rationale": f"Synthetic decision {i} shaping feature {fe} for scale benchmark.",
            "mutations": [
                {"op": "upsert_element", "kind": "feature", "name": f"feature-{fe}", "props": {"last_decision": str(i)}},
                {"op": "upsert_element", "kind": "topic", "name": f"topic-{t1}"},
                {"op": "add_link", "from": f"feature:feature-{fe}", "to": f"topic:topic-{t1}", "link": "TOUCHES"},
                {"op": "add_link", "from": f"feature:feature-{fe}", "to": f"topic:topic-{t2}", "link": "TOUCHES"},
            ],
        })
    return json.dumps({"decisions": ds}).encode()

print(f"== kgai big-scale cross-check (vs kgai.dev/#scale) — up to {MAX} decisions, ~{E} elements ==", flush=True)
subprocess.run(["rm", "-rf", STORE])
run(["init", "--actor", "user0"])
print("COPY bulk loader engages >1000 events (default threshold)\n", flush=True)
print(f"{'decisions':>9} | {'ingest chunk':>12} | {'log MB':>6} | {'kuzu MB':>7} | {'rebuild(bulk)':>13} | {'lookup':>7} | {'history':>7} | {'search':>7}", flush=True)
print("-" * 96, flush=True)

total, ck = 0, 0
while total < MAX:
    n = min(CHUNK, MAX - total)
    ding, rc, out, err = run(["ingest"], stdin=gen_batch(total, n))
    if rc != 0:
        print("INGEST ERROR:", err.decode()[:300], flush=True); break
    total += n
    if ck < len(CHECKPOINTS) and total >= CHECKPOINTS[ck]:
        logmb = du_kb(os.path.join(STORE, "log")) / 1024
        kuzumb = du_kb(os.path.join(STORE, "graph.kuzu")) / 1024
        reb = med(["rebuild"], 2)
        look = med(["context", "--about", "feature-42"], 5)
        hist = med(["history", "feature:feature-42"], 3)
        srch = med(["search", "scale benchmark"], 3)
        print(f"{total:>9} | {ding:>10.0f}ms | {logmb:>6.1f} | {kuzumb:>7.1f} | {reb:>11.0f}ms | {look:>5.0f}ms | {hist:>5.0f}ms | {srch:>5.0f}ms", flush=True)
        ck += 1

if os.environ.get("SKIP_ASOF") != "1":
    asof = med(["as-of", "2026-06-01"], 1)
    print(f"\nas-of at {total} decisions: {asof:.0f} ms  (O(n) replay — the one op the #scale table omits)", flush=True)
print("\nPublished (kgai.dev/#scale, Linux x86_64): 20k → rebuild ~1.5s, lookup ~60ms, history ~90ms, sync <0.5s", flush=True)
subprocess.run(["rm", "-rf", STORE])
