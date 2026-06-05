---
name: design:draw
category: daily
description: Nakresli production-grade SVG (logo / ikona / ilustrace / diagram / spot) přes deterministický geometry engine — žádné LLM-guessed path data. Naplánuj → vygeneruj N kandidátů → vyrenderuj přes draw-proof ladder (16/24/48/256 × light/dark/flatten) → pairwise-rank → keep-best → rubric critique → iteruj (cap 3–4). Output buď jako asset .svg, nebo inline do aktivního canvasu. Default: po draw-agentovi spustí draw-critic. Opt out přes --no-critic.
argument-hint: "\"<brief>\" [--type icon|logo|illustration|diagram|spot] [--grid 0|1|4|8] [--asset [<path>] | --inline [--into <canvas>]] [--perfect [N]] [--no-critic]"
---

# /design:draw — nakresli verifikovaný SVG mark

Generuje **produkční vektorovou grafiku** přes geometry engine (`apps/studio/draw/`) a **vizuálně ji ověří** — renderuje, screenshotuje, pairwise-rankuje, kritizuje proti 30-check rubrice a iteruje do konvergence. Žádné free-hand `<path d>` souřadnice: LLM určuje *záměr*, engine počítá *souřadnice* (to eliminuje LLM-SVG failure módy — integer quantization, coordinate drift, occlusion, color degradation).

Project-specific hodnoty (designRoot, rootClass, tokens, accent, colorSpace) přicházejí z `<repo>/.design/config.json`.

## Flags

| Flag | Default | Co dělá |
|---|---|---|
| `"<brief>"` | — | **Required.** Popis marku, verbatim (nepřepisovat, neaugmentovat značkami). |
| `--type <t>` | auto | `icon` \| `logo` \| `illustration` \| `diagram` \| `spot`. Auto-detekce z briefu když chybí. |
| `--grid <n>` | per-type | Snap base: `1` (pixel — ikony/loga), `4`/`8` (spacing scale — diagramy), `0` (off — ilustrace/spot). |
| `--asset [<path>]` | viz níže | Output jako standalone `.svg`. Bez `<path>` → `<designRoot>/assets/<slug>.svg`. |
| `--inline` | — | Output jako JSX vložené do canvasu. |
| `--into <canvas>` | aktivní | (s `--inline`) cílový `.tsx` canvas; default = `_active.json`. |
| `--perfect [N]` | 3 | Max iterací draw-agenta (`max_rounds`). Cap 4. |
| `--no-critic` | — | Přeskoč závěrečný nezávislý `draw-critic` pass. |

**Default output mode:** `--asset` (standalone soubor). `--inline` zvol, když mark patří přímo do otevřeného canvasu (logo do headeru, ikona do tlačítka).

## Flow

### 0. Pre-flight

```bash
REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
maude design bootstrap-check --root "$REPO"   # 0 = DS present; 10/11 = needs /design:setup-ds
eval "$(maude design prep --shell-export --shape edit --root "$REPO")"   # config + active-canvas + server probe
PORT=$(maude design server-up --root "$REPO") # ensure dev server (needed for draw-proof)
```

Když `bootstrap-check` vrátí 10/11 (žádný design system) → **stop**, vypiš `Spusť nejdřív /design:setup-ds <name>` a skonči. Mark se kreslí v kontextu DS (tokeny, accent, colorSpace).

### 1. Resolve type / grid / mode / viewBox

- `--type` daný → použij; jinak detekuj z briefu (jediný glyph → `icon`; brand name / wordmark → `logo`; scéna/postava → `illustration`; nodes+šipky → `diagram`; dekorativní vzor/pozadí → `spot`).
- `--grid` daný → použij; jinak default per type (`icon`/`logo` → 1, `diagram` → 8, `illustration`/`spot` → 0).
- viewBox: `icon` → `0 0 24 24`, `logo` → `0 0 64 64`, jinak zvol podle kompozice.
- Output mode: `--inline` → resolve cílový canvas (`--into` nebo `_active.json` z prep); jinak `--asset` (path z flagu nebo `<designRoot>/assets/<slug>.svg`).
- Slug: `maude design slug "<brief-or-name>"`.

### 2. Spawn `draw-agent`

```
Agent(
  description: "draw <type>: <short brief>",
  subagent_type: "design:draw-agent",
  prompt: <<EOF
brief:         "<verbatim user brief>"
type:          "<resolved type>"
grid:          <resolved grid>
output_mode:   "asset" | "inline"
output_path:   "<abs .svg path>"          # asset mode
into_canvas:   "<abs .tsx path>"          # inline mode
selected:      <selected element JSON or null>   # inline, from prep/_active.json
slug:          "<slug>"
config:        <contents of .design/config.json>
designRoot:    "<abs designRoot>"
opt_out_scope: "<palette|aesthetic|full or empty>"
max_rounds:    <N from --perfect, default 3, cap 4>
candidates_n:  2
EOF
)
```

Agent vlastní celý verify loop (plan → N kandidátů → draw-proof ladder → pairwise-rank → keep-best → rubric critique → iterace). **Přečti si verdict** (poslední fenced `json` blok v jeho výstupu).

### 3. Vyhodnoť verdict

- `passed: true` (a `hard_pass: true`) → pokračuj na krok 4.
- `passed: false` → mark má HARD gap nebo nevyřešený STRONG. Pokud `--perfect [N]` dovoluje další kolo a agent neřekl "cap reached", **re-spawn** s `max_rounds` zbývajícím a poznámkou ať cílí na `rubric.strong_failed` + failed HARD checks. Cap 4 kol celkem.
- Po vyčerpání kol s `passed:false` → vypiš gaps, **neoznačuj za hotové**; navrhni manuální zásah (typicky logo, kde flatten/16px selhává).

### 4. Independent critic (default — skip s `--no-critic`)

```
Agent(
  description: "draw-critic on <slug>",
  subagent_type: "design:draw-critic",
  prompt: <<EOF
mark_path:     "<output_path (.svg) or the canvas it was inlined into>"
type:          "<type>"
proof_dir:     "<proof_dir from draw-agent verdict>"
designRoot:    "<abs designRoot>"
opt_out_scope: "<scope or empty>"
EOF
)
```

`draw-critic` je **nezávislý soudce** (čte stejný `_draw-design-rules.md`, ale neviděl draw-agentův self-assessment). Když jeho verdict nesouhlasí (najde HARD fail co agent prohlásil za pass) → surface to a navrhni jedno opravné kolo přes `draw-agent`.

### 5. Report + docs refresh

- Vypiš output report (níže).
- `/design:setup-docs` refresh (auto, jako po `/design:edit`/`/design:new`) — aby `<designRoot>/README.md` + `INDEX.md` zachytily nový asset.

## Output report

```
🎨 /design:draw — <type> · <slug>

Output:        <asset path | inlined into <canvas>>
Mode:          asset | inline
Iterations:    <iterations_run> (kept best: round <kept_best_round>)
HARD floor:    WCAG <✓|✗> · 4/8pt grid <✓|✗> · 16px legible <✓|✗> · flatten <✓|✗>
Verdict:       <passed | needs-work> (draw-agent) · <agree | disagree> (draw-critic)
Proof ladder:  <proof_dir>  (light / dark / flatten · 16/24/48/256)
STRONG gaps:   <list or "none">
```

## Notes

- Všechny dev-tooling verby jdou přes `maude design <verb>` (DDR-062) — nikdy raw bin path.
- `_draw/` (build skripty + proof canvasy) i `_history/_draw-proof/` jsou gitignored — regenerovatelné.
- Mark dědí theme barvu přes `currentColor` (engine default) — proto funguje dark-mode i single-color flatten zadarmo.
- Pro inline edit feedback typu "přidej logo do headeru" tě sem auto-routuje `/design:edit` (viz edit.md), takže `/design:draw` většinou voláš ručně jen na standalone asset.
