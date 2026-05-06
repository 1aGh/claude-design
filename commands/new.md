---
description: Vytvoř nový canvas soubor v .ai/design/ui/project/<Name>.html (nebo komponent v components/) přes frontend-design s Dugmate envelope
argument-hint: "<Name> \"<brief>\" [--component] [--mobile]"
---

# /design:new — scaffold nový canvas

Vytvoří **nový HTML soubor** v `.ai/design/ui/project/` přes `frontend-design` plugin s Dugmate aesthetic envelope. Soubor okamžitě sedí vedle Dugmate Studio / Mobile / Calendar v file tree → klikneš na něj → stane se aktivním canvasem → iteruješ přes `/design "<feedback>"`.

**Sessions už neexistují.** Nová plocha = nový soubor v `.ai/design/ui/project/`. Žádný `.ai/design-sessions/` adresář, žádné `iterations/NNN.html`. Iterace je in-place edit s `_history/` snapshoty (jako u všeho ostatního).

**Vstup `$ARGUMENTS`:** `<Name> "<brief>" [--component] [--mobile]`

- `<Name>` — Title-Case s mezerami (`Match Recap`, `Scout Radar`) pro full-screen canvas.
  - PascalCase (`MatchRecap`) když je to komponenta s `--component`.
- `<brief>` — co má canvas dělat / vypadat.
- `--component` — vytvoří `.ai/design/ui/project/components/<PascalName>.jsx` místo top-level HTML. Komponenty se mountují v jiných canvasech.
- `--mobile` — naznačí mobile aesthetic v promptu (iOS frame, single column). Default = desktop. Pokud je název obsahuje "Mobile", auto-detect.

**Příklady:**
```
/design:new "Match Recap" "Post-game recap card — score, stats, key moments timeline, share button"
/design:new "Scout Radar Mobile" "Radar/sonar circular sweep finder for prospect discovery on phone" --mobile
/design:new MatchRecap "..." --component                   # komponenta v components/
/design:new "Live Overlay v3" "Frosted-glass HUD over video — lower-third with score + clock"
```

## Postup

Vyvolej skill `design` se vstupem: `new $ARGUMENTS`.

Skill:
1. **Server lifecycle check** (auto-start pokud chybí).
2. **Validate name** podle pravidel výše. Reject pokud target file existuje (suggest `<Name> v2`).
3. **Resolve target path:**
   - Default: `.ai/design/ui/project/<Name>.html`
   - `--component`: `.ai/design/ui/project/components/<PascalName>.jsx`
4. **Resolve mobile/desktop** z `--mobile` nebo z názvu (`Mobile` v názvu → mobile).
5. **Build envelope** (viz "Generation envelope" v `design/SKILL.md`) s:
   - Brief
   - target_path
   - matched_component (optional — vyhledat podobnou existující komponentu jako reference)
   - surface kind (mobile / desktop)
6. `Skill(skill: "frontend-design:frontend-design", args: <envelope>)`.
7. **Validate output:**
   - Link na tokens (`../../system/project/colors_and_type.css` z `.ai/design/ui/project/`)
   - `<body class="dugmate" data-theme="dark">`
   - Žádné hardcoded colors / fonts / radii
8. **Write target file.** Pokud validation fails, do not write. Re-prompt frontend-design jednou. Pokud znovu fail, stop.
9. **Print:** path k novému souboru + návrh: "klikni na něj v browser file tree (autorefresh přes ↻ tree v UI), stane se aktivním canvasem".

## Co `/design:new` NEDělá

- Nevytváří `.ai/design-sessions/` (koncept zrušen).
- Negeneruje "iteraci 001". Soubor je rovnou the canvas.
- Nepřepisuje existující soubor (ochrana proti omylem).
- Neotevírá soubor v browseru — user na něj klikne sám (auto-refresh tree přes `↻ tree` v UI).
- Neaktualizuje `_active.json` — stane se aktivním až user klikne v tree.

## Failure modes

- **Target file already exists** → fail s návrhem alternative name.
- **`frontend-design` plugin nenainstalovaný** → fail s `/plugin install frontend-design@claude-plugins-official`.
- **Generated HTML porušuje validaci** (chybí tokens, hardcoded colors, …) → re-prompt jednou. Pokud zase rozbité, fail s detail.
- **Path obsahuje cestu mimo `.ai/design/ui/project/`** → fail (security).

## Ekvivalent ručního vytvoření

`/design:new` je v podstatě:

```bash
# 1. Copy template
cp .ai/design/ui/project/Calendar\ Screen.html .ai/design/ui/project/Match\ Recap.html
# 2. Edit ručně
# 3. Klikni v browseru
```

…ale s frontend-design ti to vygeneruje obsah podle briefu, ne template-copy. Pro úplně manuální vytvoření klidně použij `cp` a iteruj přes `/design`.
