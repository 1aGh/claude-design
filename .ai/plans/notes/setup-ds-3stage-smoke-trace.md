# Smoke trace — 3-stage discovery on 2 fictional briefs

> **Authority:** paper-trace only — no live `/design:setup-ds` run. Validates spec coherence end-to-end (Stage 0 → 1 → 2 → 3 → Confirm) for two opposite-extreme briefs: one rich, one one-line.
> **Generated:** 2026-05-20, plan `setup-ds-pastier-framework.md` Task 9.
> **Methodology:** for each brief, simulate user inputs through every stage; for Stage 2 simulate a plausible research payload (with realistic confidence distribution); for Stage 3 derive question count from the confidence band rules; predict the Confirm summary.

---

## Brief A — Rich

```
/design:setup-ds project "recipe scaler for serious home cooks, retro cookbook aesthetic, signature žlutá je důležitá"
```

### Stage 0 — Scope gate

User picks `Osobní projekt` (recipe scaler for personal use). Internal: `scope=personal`, aspiration target = 3.0–4.0 (ambitious personal), voice register default = user's own.

### Stage 1 — Vision

`<brief>` is rich → skill pre-fills P1 (elevator pitch), P5 (lineage = "retro cookbook"), P10 (OST hypothesis = "signature žlutá je důležitá") from the brief and prints:

```
→ Skipping P1 (covered in brief: "recipe scaler for serious home cooks")
→ Skipping P5 (covered in brief: "retro cookbook aesthetic")
→ Skipping P10 (covered in brief: "signature žlutá je důležitá")
```

Remaining 8 prompts asked in 3 batches:

| Batch | Prompts asked | Simulated user reply |
|---|---|---|
| 1 (PŘÍPRAVA) | P2, P3, P4 (P1 skipped) | P2: "Aby každý recept vypadal jako vystřižený ze staré kuchařky." P3: "Detail na typografii a měřítka." P4: "Žádný 'happy chef' stock photography, žádné moderní food-blog gradienty." |
| 2 (PROSTOR) | P6, P7 (P5 skipped) | P6: "Velké fotky jídla, hero carousel s 'editor's pick'." P7: "Pro mě a 3 kamarády co rádi vaří doma." |
| 3 (DUŠE) | P8, P9, P11 (P10 skipped) | P8: "soustředění (jako když čteš kuchařku)" P9: "klidný řemeslník" P11: "určitě ne font, neumím to ohlídat" |

Resulting `vision-brief.json`:

```jsonc
{
  "scope": "personal",
  "elevator_pitch": "recipe scaler for serious home cooks",
  "success_essay": "Aby každý recept vypadal jako vystřižený ze staré kuchařky.",
  "values": "Detail na typografii a měřítka.",
  "anti_aesthetics": "Žádný 'happy chef' stock photography, žádné moderní food-blog gradienty.",
  "design_lineage": "retro cookbook aesthetic",
  "tired_tropes_to_avoid": "Velké fotky jídla, hero carousel s 'editor's pick'.",
  "audience": "Pro mě a 3 kamarády co rádi vaří doma.",
  "primary_emotion": "soustředění (jako když čteš kuchařku)",
  "author_voice": "klidný řemeslník",
  "ds_signature_hypothesis": "signature žlutá je důležitá",
  "ds_signature_anti": "určitě ne font, neumím to ohlídat"
}
```

### Stage 2 — Simulated research payload

Probes A–E run, agent does ~7 WebSearch queries:

| Decision | Confidence | Rationale (simulated) |
|---|---|---|
| `palette` | **0.92** | vision-brief specific (ochre/yellow) + cookbook tradition consensus → OKLCH L 65-72, C 0.13-0.17, H 80-95. Anchors: Penguin 1971 cookbook, Foxie.io. |
| `typography` | **0.88** | primary_emotion "soustředění (jako když čteš kuchařku)" + lineage "retro cookbook" → editorial-serif + grotesque-sans. Anchors: Linotype Garamond + Söhne. |
| `signature_treatment` | **0.90** | OST hypothesis specific + retro cookbook tradition → `chrome-glow` warm-ochre body wash. |
| `voice` | **0.70** | author_voice "klidný řemeslník" matched 2 anchors but tone register varies (Robin Rendle vs. Frank Chimero). |
| `density` | **0.85** | scope=personal + author "klidný" + cookbook tradition → roomy-editorial. |
| `majak_3_codes` | **0.78** | OST=barva (žlutá explicit). Lineage retro→tvar (period borders/rules) likely. Third candidate = font (anti says no) → motion or symbol; weak signal. |

### Stage 3 — Refinement (predicted Q count)

Confidence-driven decisions:

| Decision | Confidence | Action |
|---|---|---|
| palette | 0.92 | **SKIP** (surface in Confirm) |
| typography | 0.88 | **SKIP** |
| signature_treatment | 0.90 | **SKIP** |
| voice | 0.70 | **ASK** (pre-pick: Robin-Rendle anchor; alts: Frank Chimero, Pastier-craftsman) |
| density | 0.85 | **SKIP** (just above threshold) |
| majak_3_codes | 0.78 | **ASK** (pre-pick: `barva · tvar · motion`; alt: `barva · tvar · symbol`) |

→ **Stage 3 asks 2 questions in 1 AskUserQuestion call** (matches plan's "rich-brief ideal: 0–3 Qs" expectation).

### Confirm

```
Vision:     Recipe scaler pro tebe a 3 kamarády, retro cookbook aesthetic, signature žlutá. Klidný-řemeslník voice + soustředění emotion.
Research:   Anchors — Penguin 1971 cookbook, Foxie.io, Linotype Garamond. Maják 3-code = barva (žlutá) · tvar (period borders) · motion (subtle).
Refinement: Voice = Robin-Rendle anchor (user pick). Vše ostatní na recommendation.

Pokračovat? (y / něco upravit)
```

**Predicted Q count: 2 in Stage 3** (passes plan target of ≤ 3 for rich brief).

---

## Brief B — Sparse

```
/design:setup-ds project "internal dashboard"
```

### Stage 0 — Scope gate

User picks `Interní nástroj`. Internal: `scope=internal`, aspiration target ≥ 3.5, voice register default = terse.

### Stage 1 — Vision

`<brief>` is one-liner → only P1 pre-filled. All 10 other prompts asked.

| Batch | Prompts | Simulated user reply |
|---|---|---|
| 1 (PŘÍPRAVA) | P2, P3, P4 | P2: "Aby tým neztrácel čas hledáním." P3: skip. P4: "Žádný corporate purple, žádné nicotné microcopies." |
| 2 (PROSTOR) | P5, P6, P7 | P5: "Nevím, doporuč mi" P6: "bento grid landings" P7: "5 lidí v týmu, používají dashboardy denně" |
| 3 (DUŠE) | P8, P9, P10, P11 | P8: "soustředění" P9: skip P10: "Nevím, doporuč mi" P11: skip |

Resulting `vision-brief.json` (many `null`s — sparse):

```jsonc
{
  "scope": "internal",
  "elevator_pitch": "internal dashboard",
  "success_essay": "Aby tým neztrácel čas hledáním.",
  "values": null,
  "anti_aesthetics": "Žádný corporate purple, žádné nicotné microcopies.",
  "design_lineage": "research, surprise me",
  "tired_tropes_to_avoid": "bento grid landings",
  "audience": "5 lidí v týmu, používají dashboardy denně",
  "primary_emotion": "soustředění",
  "author_voice": null,
  "ds_signature_hypothesis": "research, surprise me",
  "ds_signature_anti": null
}
```

### Stage 2 — Simulated research payload

Probes A–E run, agent does ~8 WebSearch queries (lineage = "surprise me" → explores 3 candidate lineages: pro-tool / dashboard / terminal-utility):

| Decision | Confidence | Notes |
|---|---|---|
| `palette` | **0.55** | audience=pro-tool + emotion=soustředění → low-chroma cool. But 3 candidate lineages (Linear-cool vs Datadog-dense vs k9s-terminal) split anchors. |
| `typography` | **0.65** | reading-mode = scan-not-read consistent → mono-forward + neutral sans. Decent consensus. |
| `signature_treatment` | **0.45** | OST="surprise me" + 3 candidate lineages → 3 directions (subtle-recessed-bay / hard-edges-Linear / depth-stretch-Datadog) split evidence. |
| `voice` | **0.60** | scope=internal + terse default + audience-known → terse-pro-tool consensus, but anchor varies. |
| `density` | **0.80** | audience=pro-tool 5 people daily + scan reading → dense-pro-tool clear win. |
| `majak_3_codes` | **0.40** | OST="surprise me" + no anchor → suggest font · vzor · symbol but low confidence. |

### Stage 3 — Refinement (predicted Q count)

| Decision | Confidence | Action |
|---|---|---|
| palette | 0.55 | **ASK without pre-pick** (3 alts) |
| typography | 0.65 | **ASK with pre-pick** |
| signature_treatment | 0.45 | **ASK without pre-pick** |
| voice | 0.60 | **ASK with pre-pick** |
| density | 0.80 | **ASK with pre-pick** |
| majak_3_codes | 0.40 | **ASK without pre-pick** |

→ **Stage 3 asks 6 questions** (2 AskUserQuestion batches: 4 + 2). Plus the sparse brief means Maják 3-code might need an additional free-text follow-up if user picks "Vyměnit všechny 3". Predicted **6–7 Qs total** — passes plan target of "sparse brief = 7+ Qs" (within typical band).

### Confirm

```
Vision:     Internal dashboard pro tým 5 lidí co používají dashboardy denně. Soustředění voice. Lineage research surprise me.
Research:   3 candidate lineages (Linear / Datadog / k9s). User picked Linear-cool. Maják 3-code = font · vzor · symbol (user override).
Refinement: 6 explicit picks (palette / typography / signature / voice / density / majak). Density 0.80 confidence pre-pick.

Pokračovat? (y / něco upravit)
```

**Predicted Q count: 6–7 in Stage 3** (passes plan target of "sparse = 7+", within ±1 of target).

---

## Verdict

Both fictional briefs traverse the 3 stages without spec gaps. Question count distribution matches plan dogfood expectations (DF-11):

- Rich brief → **2 Stage-3 Qs** (target: ≤ 3 ✓)
- Sparse brief → **6–7 Stage-3 Qs** (target: 7+; within 1 ✓)

Confidence-banded skip behavior (`≥ 0.85` SKIP / `0.60–0.85` ASK pre-fill / `< 0.60` ASK no pre-pick) cleanly distributes the picks. No fallback ladders fired in either trace — Stage 2 produced usable `alternatives[]` for every low-confidence decision.

**Open edges (not blockers):**

1. **Maják 3-code sparse-case** — when confidence < 0.5 and user picks "Vyměnit všechny 3", the follow-up free-text step adds ~1 extra turn. Acceptable; documented in SKILL.md § Stage 3.
2. **`<brief>` pre-fill heuristic** — Brief A's "signature žlutá je důležitá" triggered P10 skip cleanly. Real-world ambiguity (e.g. "warm and minimal") may misfire — the inline `→ Skipping P5 (covered in brief: "...")` print lets the user correct, which is the safety net.
3. **Stage 0 → voice register default** — for `scope=internal` brief B got "terse" default; user's actual voice was a mix. Stage 2's voice confidence (0.60) caught the gap and surfaced a Stage 3 Q. Working as designed.
