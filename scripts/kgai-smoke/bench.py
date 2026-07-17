#!/usr/bin/env python3
"""kgai performance smoke test against this repo's DDR corpus.

Measures the operations that matter for an org-wide shared decision graph:
  [1] batch import of all DDRs        (the "pour an existing repo in" scenario)
  [2] store size on disk              (event log vs. graph.kuzu)
  [3] rebuild time as the log grows   (runs after every `kg sync` — the scaling risk)
  [4] read latencies (context/search/history) — do they degrade with scale?
  [5] as-of time-travel latency       (known cliff)
  [6] single-decision ingest latency

Requires a built `kg` binary. Point at it + its lib dir + an isolated store via env:
    KG=/path/to/kg  KGLIB=/path/to/dir-with-libkuzu  KGAI_STORE=/tmp/kgai-smoke-store
`run.sh` sets these up for you (builds kg from source into the scratch home if needed).

Env knobs:
    KG            path to the kg binary            (required)
    KGLIB         dir containing libkuzu.{dylib,so} (required; added to DY/LD_LIBRARY_PATH)
    KGAI_STORE    isolated store dir               (required; wiped each run)
    STEPS         scaling-curve steps (default 5, each = +one full DDR batch)
"""
import json, os, statistics, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
KG = os.environ.get("KG")
KGLIB = os.environ.get("KGLIB")
STORE = os.environ.get("KGAI_STORE")
STEPS = int(os.environ.get("STEPS", "5"))

if not (KG and KGLIB and STORE):
    sys.exit("set KG, KGLIB, KGAI_STORE (see run.sh)")

env = dict(os.environ)
env["DYLD_LIBRARY_PATH"] = KGLIB + ":" + env.get("DYLD_LIBRARY_PATH", "")
env["LD_LIBRARY_PATH"] = KGLIB + ":" + env.get("LD_LIBRARY_PATH", "")
env["KGAI_STORE"] = STORE

def run(args, stdin=None):
    t = time.perf_counter()
    p = subprocess.run([KG] + args, input=stdin, capture_output=True, env=env)
    return (time.perf_counter() - t) * 1000, p.returncode, p.stdout
def med(args, n=5):
    return statistics.median([run(args)[0] for _ in range(n)])
def du_kb(p):
    if not os.path.exists(p): return 0
    return int(subprocess.run(["du", "-sk", p], capture_output=True, text=True).stdout.split()[0])
def gen_batch(suffix):
    out = os.path.join(HERE, f"ddr-batch-v{suffix}.json")
    subprocess.run([sys.executable, os.path.join(HERE, "ddr2kgai.py"),
                    "--out", out, "--version-suffix", str(suffix)], check=True, capture_output=True)
    return out

print("== kgai smoke test ==")
print(f"kg={KG}\nstore={STORE}\n")
subprocess.run(["rm", "-rf", STORE])
subprocess.run([KG, "init", "--actor", "flow-plugin"], capture_output=True, env=env)

print(f"process floor (kg version, no DB open): {med(['version'], 7):.0f} ms\n")
print(f"{'decisions':>9} | {'log KB':>7} | {'kuzu MB':>7} | {'ingest+batch':>12} | {'rebuild':>8} | {'context':>8} | {'search':>7}")
print("-" * 78)

total = 0
for step in range(STEPS):
    batch = gen_batch(step)
    payload = open(batch, "rb").read()
    ding, rc, out = run(["ingest"], stdin=payload)
    n = len(json.loads(out).get("decisions", [])) if rc == 0 else 0
    total += n
    logkb = du_kb(os.path.join(STORE, "log"))
    kuzumb = du_kb(os.path.join(STORE, "graph.kuzu")) / 1024
    reb = med(["rebuild"], 3)
    ctx = med(["context", "--about", "dev-server"], 5)
    srch = med(["search", "bun compile"], 5)
    print(f"{total:>9} | {logkb:>7} | {kuzumb:>7.1f} | {ding:>12.0f} | {reb:>8.0f} | {ctx:>8.1f} | {srch:>7.1f}")
    os.remove(batch)

# expensive one-offs, only at the final (largest) size
single = statistics.median([
    run(["ingest"], stdin=json.dumps({"decision": {"title": f"probe {i}", "author": "smoke",
        "mutations": [{"op": "upsert_element", "kind": "probe", "name": f"probe-{i}"}]}}).encode())[0]
    for i in range(5)])
asof = med(["as-of", "2026-06-01"], 2)
print(f"\nsingle-decision ingest (n=5, median): {single:.0f} ms")
print(f"as-of 2026-06-01 at {total} decisions:  {asof:.0f} ms")
print("\nNote: the scaling curve re-ingests the same DDRs with distinct titles, which")
print("deepens per-element history (worst-case for rebuild). Real decisions spread")
print("across more elements would show a gentler rebuild slope.")
