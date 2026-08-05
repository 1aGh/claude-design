#!/usr/bin/env python3
"""Convert this repo's .ai/archive/decisions/DDR-*.md into a kgai batch-ingest payload.

Each DDR becomes one immutable kgai DECISION whose mutations:
  - shape an `area` element (the DDR's primary tag)   → few, stable elements
  - upsert a `decision` element (DDR-NNN)             → so `kg context --about DDR-045` resolves
  - link decision -> area (ABOUT) and area -> topic tags (TOUCHES)
  - add SUPERSEDES links when the DDR body mentions "Supersedes: DDR-NNN"

This mirrors kgai's intended shape ("few stable domain elements shaped by many
decisions") rather than turning every DDR into its own island node.

Usage:
    python3 ddr2kgai.py [--ddr-dir PATH] [--out PATH] [--version-suffix N]

--version-suffix appends " [vN]" to every title so a re-ingest produces *new*
decision events (used by bench.py to grow the log for the scaling curve).
"""
import argparse, glob, json, os, re, sys

def field(text, label):
    # Matches both "**Date:** ..." and list form "- **Date:** ..."
    m = re.search(r'^\s*(?:[-*]\s*)?\*\*%s:\*\*\s*(.+)$' % re.escape(label), text, re.M)
    return m.group(1).strip() if m else ""

def first_para(text, header):
    m = re.search(r'^##+\s*%s\s*$(.+?)(^##\s|\Z)' % re.escape(header), text, re.M | re.S)
    if not m:
        return ""
    para = re.split(r'\n\s*\n', m.group(1).strip())[0].strip()
    return re.sub(r'\s+', ' ', para)[:400]

def norm_date(d):
    m = re.search(r'(\d{4}-\d{2}-\d{2})', d)
    return m.group(1) if m else ""

def cross_refs(text, self_num):
    """Scan a DDR body for references to OTHER DDRs and classify each link by the
    words surrounding the mention. Returns {target_num_3digit: link_kind}, keeping the
    strongest kind per target (SUPERSEDES > OVERRIDES > REFERENCES)."""
    rank = {"REFERENCES": 0, "OVERRIDES": 1, "SUPERSEDES": 2}
    out = {}
    for m in re.finditer(r'DDR-(\d+)', text):
        tgt = m.group(1).zfill(3)
        if tgt == self_num:
            continue
        ctx = text[max(0, m.start() - 60):m.end() + 60].lower()
        if "supersede" in ctx:
            k = "SUPERSEDES"
        elif any(w in ctx for w in ("override", "reverse", "revisit", "replaces", "retire", "deprecat")):
            k = "OVERRIDES"
        else:
            k = "REFERENCES"
        if tgt not in out or rank[k] > rank[out[tgt]]:
            out[tgt] = k
    return out

def build(ddr_dir, suffix):
    files = sorted(glob.glob(os.path.join(ddr_dir, "DDR-*.md")))
    decisions = []
    stats = {"files": 0, "with_date": 0, "with_tags": 0, "crossrefs": 0, "tags": set()}
    for f in files:
        t = open(f, encoding="utf-8").read()
        stats["files"] += 1
        num = (re.search(r'DDR-(\d+)', os.path.basename(f)) or [None, "000"])[1]
        title = (re.search(r'^#\s*DDR-\d+:\s*(.+)$', t, re.M) or [None, os.path.basename(f)])[1].strip()
        date = norm_date(field(t, "Date")) or norm_date(field(t, "Status"))
        tags_raw = field(t, "Tags")
        tags = [re.sub(r'[^a-z0-9\- ]', '', x.strip().lower()).strip().replace(' ', '-')
                for x in re.split(r'[,/]', tags_raw) if x.strip() and x.strip() not in ('—', '-')][:6]
        rationale = first_para(t, "Decision") or first_para(t, "Context")
        refs = cross_refs(t, num)
        if date: stats["with_date"] += 1
        if tags: stats["with_tags"] += 1; stats["tags"].update(tags)
        stats["crossrefs"] += len(refs)

        primary = tags[0] if tags else "general"
        muts = [
            {"op": "upsert_element", "kind": "area", "name": primary, "props": {"last_ddr": "DDR-" + num}},
            {"op": "upsert_element", "kind": "decision", "name": "DDR-" + num, "props": {"title": title[:120]}},
            {"op": "add_link", "from": "decision:DDR-" + num, "to": "area:" + primary, "link": "ABOUT"},
        ]
        for tg in tags[1:]:
            muts.append({"op": "upsert_element", "kind": "topic", "name": tg})
            muts.append({"op": "add_link", "from": "area:" + primary, "to": "topic:" + tg, "link": "TOUCHES"})
        for tgt, kind in refs.items():
            # ensure the target decision element exists even if its own DDR file is absent
            muts.append({"op": "upsert_element", "kind": "decision", "name": "DDR-" + tgt})
            muts.append({"op": "add_link", "from": "decision:DDR-" + num,
                         "to": "decision:DDR-" + tgt, "link": kind})

        d = {"title": title + (f" [v{suffix}]" if suffix is not None else ""),
             "author": "flow-plugin", "mutations": muts}
        if date: d["date"] = date
        if rationale: d["rationale"] = rationale
        decisions.append(d)
    stats["tags"] = len(stats["tags"])
    return {"decisions": decisions}, stats

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_ddr = os.path.normpath(os.path.join(here, "..", "..", ".ai", "archive", "decisions"))
    ap = argparse.ArgumentParser()
    ap.add_argument("--ddr-dir", default=default_ddr)
    ap.add_argument("--out", default=os.path.join(here, "ddr-batch.json"))
    ap.add_argument("--version-suffix", type=int, default=None)
    a = ap.parse_args()
    payload, stats = build(a.ddr_dir, a.version_suffix)
    json.dump(payload, open(a.out, "w"), ensure_ascii=False)
    total_muts = sum(len(d["mutations"]) for d in payload["decisions"])
    print(f"wrote {a.out}  ({os.path.getsize(a.out)} B)")
    print(f"decisions={len(payload['decisions'])}  mutations={total_muts}  stats={json.dumps(stats)}")

if __name__ == "__main__":
    main()
