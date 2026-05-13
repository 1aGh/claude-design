---
name: design:handoff
category: daily
description: Migrate aktivní canvas (`_active.json`) do production kódu (target z `.design/config.json` handoffTargets)
argument-hint: "[--target <label>] [--force]"
---

# /design:handoff — production migration

Konvertuje aktivní canvas do production kódu repa. Cíle (target paths + platform) jsou v `.design/config.json` v poli `handoffTargets[]` — typicky `apps/web` a/nebo `apps/mobile`, ale jakákoliv konvence repa.

Tokens se mapují na repo's design tokens package (pokud existuje v `packages/design-tokens` nebo equivalent — orchestrator hledá podle `tokensCssRel` a sourcuje na nejbližší cestu).

**Vstup `$ARGUMENTS`:** `[--target <label>] [--force]`

- `--target <label>` — kam migrovat (label musí matchovat jednomu z `handoffTargets[].label` v configu). Default = inferováno z názvu active souboru (`Mobile`/`iOS` v názvu → mobile target, `Studio`/`Desktop` → web target).
- `--force` — shipni i s otevřenými blockers v latest critique (NEDOPORUČENO).

**Příklad:**
```
/design:handoff                    # auto-detect target
/design:handoff --target web
/design:handoff --target mobile
/design:handoff --force            # bypass blockers
```

## Pre-requisites (orchestrator si je ohlídá)

Než handoff poběží, skill ověří:
1. **Server běží + `_active.json` má active canvas** (auto-start serveru pokud chybí).
2. **`handoffTargets` v configu není prázdný** — pokud ano, fail "No handoff targets configured in `.design/config.json`."
3. **Latest critique pro tenhle canvas má `blockers == 0`** — pokud ne, fail s návrhem `/design:edit "Address: <top blocker>"` first.
   - Override: `--force` (pouze když user explicitně řekne "ship despite blockers").
4. **Target path z configu existuje v repu** — fail pokud ne.

## Postup

Vyvolej skill `design` se vstupem: `handoff $ARGUMENTS`.

Skill:

### 1. Resolve config + target

```bash
CFG=.design/config.json
DESIGN_ROOT=$(jq -r '.designRoot' "$CFG")
TARGETS=$(jq -c '.handoffTargets // []' "$CFG")
[ "$TARGETS" = "[]" ] && echo "No handoff targets configured in .design/config.json" && exit 1
```

Pokud `--target <label>` byl předán, najdi v `handoffTargets` entry s `label == <label>`. Jinak inferuj z názvu active canvasu (regex match `Mobile|iOS|Android` → platform `mobile`; `Studio|Desktop` → platform `web`; jinak ask user).

### 2. Pre-flight (viz výše)

### 3. Načte aktivní canvas

Cesta z `_active.json`. Read full content.

### 4. Extrakce

- **Token usage** — grep všechny `var(--*)` reference → `<DESIGN_ROOT>/_history/<slug>/handoff/tokens-used.json`:
  ```json
  { "tokens": ["--bg-1", "--accent", "--radius-lg"], "new": ["--accent-2"] }
  ```
- **Layout structure** — semantic regions (header, main, aside, sections).
- **Interaction hints** — buttons (variant, label, action), inputs (type, placeholder, validation), focus order.

### 5. Convert

Adaptace závisí na `target.platform`:

| Platform | Output convention | Notes |
|---|---|---|
| `web` | `<target.path>/app/<route>/page.tsx` (Next.js) nebo `<target.path>/src/<route>.tsx` — orchestrator detekuje podle existující struktury | React + Tailwind převedení tokenů na CSS vars / theme |
| `mobile` | `<target.path>/app/<route>.tsx` (Expo Router) nebo equivalent | React Native + NativeWind; native primitives |
| `desktop` | Závisí na frameworku (Electron / Tauri) — orchestrator se zeptá pokud nejasné | |
| `other` | Orchestrator fail-fast: "Unknown platform — please specify in target config" | |

Když repo má `packages/<feature-package>` strukturu (monorepo), shared komponenty patří tam, page-level patří do `<target.path>`.

### 6. Token sync

Pokud `tokens-used.json.new` je neprázdné, přidej nové tokeny do repo's design tokens package. Cesta: orchestrator hledá `packages/design-tokens/src/tokens.css` (default Turborepo convention) nebo equivalent. Pokud nenalezne, fail s návrhem manuálně.

### 7. Handoff report

Zapiš `<DESIGN_ROOT>/_history/<slug>/handoff/<NNN>-handoff-report.md` (gitignored — pokud chceš track, copy ho do `.ai/decisions/`):

- Active canvas migrated
- Target (label, path, platform)
- Files created / modified (relativní paths)
- Tokens referenced + new tokens added
- Open critique items carried over (pokud `--force` byl použit)
- Next steps (run `/flow:utils-verify`, manual smoke test)

### 8. Návrh navazujících commands

- `/flow:utils-verify` — smoke + a11y na nové cestě (pokud existuje verify skill v repu)
- `/flow:review-code` — pre-commit self-review (pokud existuje)
- `/scenario new <slug>` — pokud surface ještě nemá cross-platform scenario

## What handoff DOES NOT do

- **Necommituje** — handoff jen napíše soubory, commit dělá user.
- **Nespouští testy** — to je verify job.
- **Nemění backend/API** — handoff je čistě UI vrstva.
- **Negeneruje routes** — pokud route neexistuje, fail s návrhem ji založit ručně. Nechceme magii v routingu.

## Failure modes

- **Latest critique má blockers a `--force` nebyl předán** → fail s top blocker quote.
- **Target dir neexistuje** → fail.
- **`handoffTargets` v configu prázdný** → fail s návrhem doplnit config.
- **HTML použil token, který není v project tokens CSS** → fail (regression v iteraci, oprav přes `/design:edit`).
- **Frameworkové dependencies chybí v target adresáři** → fail s install command.

Po úspěšném handoff vidíš v terminálu summary + path k handoff-report.md.
