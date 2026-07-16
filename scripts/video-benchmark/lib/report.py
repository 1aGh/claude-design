#!/usr/bin/env python3
"""report.py <run_dir> — assemble REPORT.md from per-contestant metrics + outputs."""
import json, sys, glob, os, re

run = sys.argv[1]
meta = {}
mp = os.path.join(run, "inputs", "meta.json")
if os.path.exists(mp):
    meta = json.load(open(mp))

metrics = []
for f in sorted(glob.glob(os.path.join(run, "*.metrics.json"))):
    try:
        metrics.append(json.load(open(f)))
    except Exception:
        pass

def extract_tldr(md_path):
    """Pull the `TLDR:` 2-3 sentence summary a contestant led with."""
    if not os.path.exists(md_path):
        return "_(no output)_"
    txt = open(md_path).read()
    # find a line containing TLDR: (case-insensitive), take from there to blank line
    lines = txt.splitlines()
    for i, ln in enumerate(lines):
        m = None
        low = ln.strip().lower()
        if low.startswith("tldr:") or low.startswith("**tldr:**") or low.startswith("tl;dr:"):
            # gather this line + following non-empty lines until a blank or a heading
            out = [ln.split(":", 1)[1].strip() if ":" in ln else ln.strip()]
            for nxt in lines[i+1:]:
                if not nxt.strip() or nxt.lstrip().startswith(("#", "1)", "2)", "**1", "###", "SHOTS", "**SHOT")):
                    break
                out.append(nxt.strip())
            s = " ".join(x for x in out if x).strip()
            return s if s else "_(empty TLDR)_"
    return "_(model did not emit a TLDR line — see full output below)_"

def extract_tokens(md_path):
    """Return (input_tokens, output_tokens, note) for a contestant's output."""
    if not os.path.exists(md_path):
        return (None, None, "")
    txt = open(md_path).read()
    # Sonnet-style explicit TOKENS line — parse each field independently (order-agnostic)
    if "TOKENS " in txt and "total_in=" in txt:
        def field(name):
            m = re.search(rf"{name}=([0-9.eE+-]+|None)", txt)
            return m.group(1) if m else None
        ti = field("total_in"); outp = field("output"); cost = field("cost_usd")
        note = ""
        if cost not in (None, "None"):
            note = f"≈ ${float(cost):.4f} real cost"
        fm = re.search(r"Chosen (\d+) smart frames", txt) or re.search(r"Inputs: (\d+) keyframes", txt)
        frames = f"{fm.group(1)} frames" if fm else ""
        note = "; ".join(x for x in [frames, note, "incl. Claude Code system prompt (cached)"] if x)
        return (int(ti) if ti else None, int(outp) if outp else None, note)
    # MLX-style: sum every "Prompt: N tokens" + "Generation: N tokens" (across passes)
    pin = sum(int(x) for x in re.findall(r"Prompt:\s+(\d+)\s+tokens", txt))
    pout = sum(int(x) for x in re.findall(r"Generation:\s+(\d+)\s+tokens", txt))
    passes = len(re.findall(r"Prompt:\s+\d+\s+tokens", txt))
    note = f"{passes} pass(es)" if passes > 1 else ""
    return (pin or None, pout or None, note)

print(f"# Video-analysis benchmark — `{os.path.basename(run)}`\n")
print("## Clip")
print(f"- **File:** `{meta.get('video','?')}`")
print(f"- **Duration:** {meta.get('duration_sec','?')} s · **Resolution:** {meta.get('resolution','?')} · "
      f"**Audio:** {meta.get('has_audio','?')}")
print(f"- **Keyframes prepped:** {meta.get('frame_count','?')} (1 fps) · **Whisper:** `{os.path.basename(meta.get('whisper_model',''))}`\n")

print("## TL;DR — what each model concluded\n")
print("_The 2–3 sentence summary each model led with (full analysis further down)._\n")
for m in metrics:
    tldr = extract_tldr(os.path.join(run, m["label"] + ".out.md"))
    print(f"- **{m['label']}** — {tldr}")
print()

print("## Metrics\n")
print("| Contestant | Wall (s) | Peak RSS (GB) | MLX GPU peak (GB) | CPU total (s) | Avg CPU % | Peak CPU % | Gen tok/s | Exit |")
print("|---|--:|--:|--:|--:|--:|--:|--:|--:|")
def g(m,k,d="—"):
    v=m.get(k); return d if v is None else v
for m in metrics:
    print(f"| {m['label']} | {g(m,'wall_sec')} | {g(m,'max_rss_gb')} | {g(m,'mlx_peak_gpu_gb')} | "
          f"{g(m,'cpu_total_sec')} | {g(m,'sample_avg_cpu_pct')} | {g(m,'sample_peak_cpu_pct')} | "
          f"{g(m,'gen_tokens_per_sec')} | {m['exit_code']} |")

print("\n> **Reading the numbers:** MLX contestants offload to the GPU (Metal) — a "
      "modest CPU% with a long wall-clock is expected. *Peak RSS* is the process "
      "resident size; *MLX GPU peak* (unified memory) is the model's own accurate "
      "report and is the number that matters for 'will it fit'. GPU utilization "
      "itself is not captured (needs sudo powermetrics). Wall-clock includes "
      "loading weights from disk each invocation (no persistent server) — the real "
      "per-clip CLI cost. Own-pipeline's local cost is tiny by design: the heavy "
      "compute is remote (Sonnet).\n")

print("## Token usage\n")
print("| Contestant | Input tokens | Output tokens | Note |")
print("|---|--:|--:|---|")
for m in metrics:
    ti, to, note = extract_tokens(os.path.join(run, m["label"] + ".out.md"))
    print(f"| {m['label']} | {ti if ti is not None else '—'} | {to if to is not None else '—'} | {note} |")
print("\n> **Not apples-to-apples.** MLX models count vision tokens (video frames / "
      "images) + a tiny system prompt; Gemma's total is summed across its two passes "
      "(video + audio). Own-sonnet runs through the `claude` CLI, so its input carries "
      "the **full Claude Code system prompt + tool schemas** (~50k cached tokens) on "
      "top of the frames — inflated vs the locals, but the `cost` is the real-money "
      "signal. Image tokens dominate everywhere: more frames / higher resolution = "
      "more input tokens.\n")

print("## Qualitative outputs\n")
print("_Read these yourself — the harness does not judge quality._\n")
for m in metrics:
    out = os.path.join(run, m["label"] + ".out.md")
    print(f"\n---\n\n### {m['label']}\n")
    if os.path.exists(out):
        print(open(out).read().rstrip())
    else:
        print("_(no output)_")

# whisper transcript for reference
tp = os.path.join(run, "inputs", "transcript.txt")
if os.path.exists(tp):
    print("\n---\n\n### Reference — whisper transcript (own-pipeline audio input)\n")
    print("```")
    print(open(tp).read().rstrip())
    print("```")
