---
description: Vytvoř nový multi-artboard canvas projekt přes frontend-design — generic envelope adaptovaný podle .design/config.json. Default: po generování auto-spustí critic panel; --perfect [N] pro N iterací auto-fixu.
argument-hint: "<Name> \"<brief>\" [--component] [--mobile] [--perfect [N]] [--no-critic]"
---

# /design:new — scaffold nový canvas projekt

Vytvoří **nový multi-artboard canvas soubor** v `<designRoot>/<newCanvasDir>/<Name>.html` přes `frontend-design` plugin. Generic envelope se adaptuje podle `<repo>/.design/config.json` (rootClass, themeDefault, tokensCssRel, …).

**Canvas projekt = `DesignCanvas` + jedna nebo více `DCSection` + jeden nebo více `DCArtboard`** (Figma-style scrollable infinite canvas). Single-page wrapper je anti-pattern; nový screen patří jako další `DCArtboard` do existujícího canvasu (přes `/design "<add new artboard for X>"` ne přes `/design:new`).

**Sessions už neexistují.** Nová plocha = nový soubor v `<designRoot>/<newCanvasDir>/`. Žádný `.ai/design-sessions/` adresář, žádné `iterations/NNN.html`. Iterace je in-place edit s `_history/` snapshoty.

**Vstup `$ARGUMENTS`:** `<Name> "<brief>" [--component] [--mobile]`

- `<Name>` — Title-Case s mezerami (`Match Recap`, `Scout Radar`) pro full-screen canvas projekt.
  - PascalCase (`MatchRecap`) když je to komponenta s `--component`.
- `<brief>` — co má canvas dělat / vypadat. Tady popisuj **co všechno bude v canvasu** (kolik artboardů, jaké screens, jaký flow), ne single screen.
- `--component` — vytvoří `<designRoot>/<newComponentDir>/<PascalName>.jsx` místo top-level HTML. Komponenty se mountují uvnitř canvas artboardů.
- `--mobile` — naznačí mobile aesthetic v promptu (mobile chrome, single column). Default = desktop. Pokud název obsahuje "Mobile", auto-detect.

**Příklady:**
```
/design:new "Match Recap" "Post-game recap canvas — 3 artboardy: hero stat card, key moments timeline, share/embed view"
/design:new "Onboarding Desktop" "5-step onboarding flow — welcome, invite preview, identity, permissions, tour. Each as separate DCArtboard."
/design:new "Scout Radar Mobile" "Radar/sonar circular sweep finder — single full-screen canvas s 2 artboardy: scanning + result list" --mobile
/design:new MatchRecap "..." --component                   # komponenta v components/
```

## Postup

Vyvolej skill `design` se vstupem: `new $ARGUMENTS`.

### 1. Resolve config

Načti `.design/config.json`:

```bash
CFG=.design/config.json
NAME=$(jq -r '.name // "Project"' "$CFG")
DESIGN_ROOT=$(jq -r '.designRoot // ".design"' "$CFG")
ROOT_CLASS=$(jq -r '.rootClass // "app"' "$CFG")
THEME=$(jq -r '.themeDefault // "dark"' "$CFG")
TOKENS_REL=$(jq -r '.tokensCssRel // "system/colors_and_type.css"' "$CFG")
NEW_CANVAS_DIR=$(jq -r '.newCanvasDir // "ui/project"' "$CFG")
NEW_COMPONENT_DIR=$(jq -r '.newComponentDir // "ui/project/components"' "$CFG")
TEAM_DEFAULT=$(jq -r '.teamAccentDefault // empty' "$CFG")
```

### 2. Server lifecycle check (auto-start pokud chybí)

Stejné jako u `/design`.

### 3. Validate name + resolve target path

- Default canvas: `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.html`
- `--component`: `<DESIGN_ROOT>/<NEW_COMPONENT_DIR>/<PascalName>.jsx`
- Reject pokud target file existuje (suggest `<Name> v2`).

### 4. Resolve mobile/desktop

`--mobile` flag, nebo název obsahuje `Mobile` / `iOS` / `Android`.

### 5. Build envelope

Adaptuj generic envelope (viz `design/SKILL.md` "Generation envelope") s konkrétními config hodnotami:

```
You are generating a NEW canvas project for the {NAME} repo.

Read the project's design system before generating:
  {DESIGN_ROOT}/{TOKENS_REL}
  {DESIGN_ROOT}/system/README.md         # if present
  {DESIGN_ROOT}/ui/                      # existing canvases as reference

DO NOT pick fonts, colors, radii, or shadows. Use the CSS variables defined in the tokens file.
Use only fonts the tokens CSS already imports.

Reference existing canvases (read at least one for the wrapper pattern):
  {pick one similar canvas, e.g. <Name> Studio.html or <Name> Mobile.html}

Output: a single self-contained HTML file at {target_path}. The file MUST:
1. <link rel="stylesheet" href="…/{TOKENS_REL}"> (relative path resolved from target)
2. <body class="{ROOT_CLASS}" data-theme="{THEME}"{ data-team="{TEAM_DEFAULT}" if set}>
3. Use a multi-artboard canvas wrapper:
   - DesignCanvas + DCSection + at least 1 DCArtboard (these are window globals injected by the dev server — DO NOT bundle a local design-canvas.jsx)
   - Mount via Babel-standalone + react@18.3.1 + react-dom@18.3.1 UMD pattern
4. NO inline color/font/radius values — use CSS vars from the tokens file.
5. NO external fonts beyond what the tokens CSS already imports.
6. NO inline images / icons that aren't sourced from the project's assets folder.
7. DO NOT include `<script src="design-canvas.jsx">` or `<script src="tweaks-panel.jsx">` — the dev server auto-injects /_runtime/* into every served HTML. `DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, `TweaksPanel`, `useTweaks` are available as window globals after the babel pass.

User brief:
{brief}

Apply ONLY the brief. Plan the artboards based on the brief — typically 1–6 DCArtboards
in 1 DCSection, but follow what the brief asks for.
```

### 6. Generate

`Skill(skill: "frontend-design:frontend-design", args: <envelope>)`.

### 7. Validate output

- Link na tokens (relative path resolved správně z target file)
- `<body class="<ROOT_CLASS>" data-theme="…">`
- Obsahuje alespoň jeden `<DCArtboard` ref (canvas-multi-artboard pattern)
- Žádné hardcoded colors / fonts / radii

### 8. Write target file

Pokud validation fails, do not write. Re-prompt frontend-design jednou s konkrétním fix-list. Pokud znovu fail, stop.

### 9. Auto-critic + auto-fix loop (default — opt out with `--no-critic`)

**Same loop as `/design`** — see `skills/design/SKILL.md` "Auto-critic loop" for algorithm. After generating the new canvas:

- default → 2-iteration auto-critic + auto-fix
- `--perfect [N]` → N iterations (default 5)
- `--no-critic` → skip

Bootstrap a chat transcript: write `<DESIGN_ROOT>/_history/<slug>/chat.md` with the brief as iteration 0, then loop entries as iterations 1..N.

### 10. Bootstrap docs

For a new canvas:
1. Write `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json` from the brief (title, subtitle from one-line, brief, platform from --mobile flag, sections+artboards extracted from generated JSX).
2. Add a row to `<DESIGN_ROOT>/INDEX.md` for the new canvas.
3. If `<DESIGN_ROOT>/README.md` doesn't exist, generate it via `/design:docs --full` flow.
4. Update `<DESIGN_ROOT>/README.md` "Last updated" line.

### 11. Print

```
✓ Created: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.html
  Pattern: multi-artboard canvas (DesignCanvas + N artboards)
  Sidecar: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json

  Critic panel ({list}): blockers {X} · warnings {Y} · {verdict}
  {iteration log if --perfect}

  Docs: <designRoot>/INDEX.md added entry; <designRoot>/README.md updated.

  Klikni na něj v browser file tree (autorefresh přes ↻ tree v UI), stane se aktivním.
  Iteruj přes /design "<feedback>".
```

## Co `/design:new` NEDělá

- Nevytváří `.ai/design-sessions/` (koncept zrušen).
- Negeneruje "iteraci 001". Soubor je rovnou the canvas.
- Nepřepisuje existující soubor (ochrana proti omylem).
- Neotevírá soubor v browseru — user na něj klikne sám (auto-refresh tree přes `↻ tree` v UI).
- Neaktualizuje `_active.json` — stane se aktivním až user klikne v tree.
- **Negeneruje single-page HTML wrapper** — vždycky multi-artboard canvas.

## Failure modes

- **Target file already exists** → fail s návrhem alternative name.
- **`frontend-design` plugin nenainstalovaný** → fail s `/plugin install frontend-design@claude-plugins-official`.
- **Generated HTML porušuje validaci** (chybí tokens, hardcoded colors, single-page wrapper bez DCArtboard, …) → re-prompt jednou. Pokud zase rozbité, fail s detail.
- **Path obsahuje cestu mimo `<DESIGN_ROOT>`** → fail (security).
- **`.design/config.json` chybí** → varuj user "using defaults" a pokračuj s defaults z `dev-server/config.schema.json`.
