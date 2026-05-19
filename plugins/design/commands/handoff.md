---
name: design:handoff
category: daily
description: Emit a shadcn `registry-item.json` sidecar pro aktivní canvas (production-ready drop pro Next.js / Vite / Bun)
argument-hint: "[--canvas <path>] [--force]"
---

# /design:handoff — shadcn registry-item.json sidecar

Konvertuje aktivní canvas (z `_active.json`) na **`<Slug>.registry.json`** vedle TSX souboru. Cílový projekt to konzumuje přes `bunx shadcn add file://./<Slug>.registry.json` — funguje pro Next.js / Vite / Astro / Remix / Bun, jakýkoli framework, který má `shadcn` CLI.

Co sidecar obsahuje:

1. **`files[0]`** — canvas TSX, **bez `data-cd-id` atributů** (dev-time scaffolding, production je nepotřebuje).
2. **`files[1]`** (jen pro `css_mode: "inline"`) — podmnožina `_components.css` ořezaná na pravidla, jejichž třída se v canvasu vyskytuje (`.btn`, `.tile`, `.sku`, ...). BEM modifikátory (`.btn--ghost`) jedou s base classou.
3. **`files[2]`** (jen pro `css_mode: "inline"`) — podmnožina `colors_and_type.css` tokenů, na které ořezané CSS odkazuje přes `var(--*)`.
4. **`cssVars.theme`** — stejné tokeny v shadcn formátu, aby je CLI grafikovala do `app/globals.css`.
5. **`dependencies`** — npm spec resolvuje z `Bun.Transpiler.scanImports()` (`react`, `react-dom` + cokoli další). React + ReactDOM jsou floor (DDR-012).
6. **`registryDependencies`** — `@/components/ui/*` importy se mapují na shadcn primitive names (`button`, `card`, ...).

**Vstup `$ARGUMENTS`:** `[--canvas <path>] [--force]`

- `--canvas <path>` — explicitní cesta k canvas .tsx (default = `_active.json.active`).
- `--force` — emitni sidecar i s otevřenými blockers v latest critique.

**Příklad:**
```
/design:handoff
/design:handoff --canvas .design/ui/Docs\ Site.tsx
/design:handoff --force
```

## Pre-requisites

1. **Canvas je `.tsx`** — TSX je jediný podporovaný formát.
2. **`handoffTargets[0].path === "registry:item"`** v `.design/config.json` (default po Task 10 update).
3. **Latest critique má `blockers === 0`** — pokud ne, fail s návrhem `/design:edit "Address: <top blocker>"`. Override `--force`.

## Postup

### 1. Resolve canvas + meta

```bash
CFG=.design/config.json
DESIGN_ROOT=$(jq -r '.designRoot' "$CFG")
ACTIVE=$(jq -r '.active' "$DESIGN_ROOT/_active.json")
CANVAS="$DESIGN_ROOT/$ACTIVE"
[ "${CANVAS##*.}" != "tsx" ] && echo "handoff: canvas is not .tsx — migrate first" && exit 1
```

Načti `<canvas>.meta.json` (kvůli `title` + `subtitle` → registry `title`/`description`).

### 2. Pre-flight blocker check

Stejně jako `/design:critic` — `_history/<slug>/<NNN>-critic.md` posledního běhu. `blockers: 0` ⇒ pokračuj, jinak fail.

### 3. Shell out na `bin/handoff.sh`

```bash
bash plugins/design/dev-server/bin/handoff.sh "$CANVAS" "$DESIGN_ROOT"
```

Wrapper zavolá `bun run handoff.ts --emit <canvas> <designRoot>`. Skript:

1. Načte canvas TSX.
2. Stripne `data-cd-id` atributy (AST-aware, oxc-parser + magic-string).
3. Klasifikuje importy (npm vs `@/components/ui/*`).
4. Pro `css_mode: "inline"` canvases:
   - Sebere každý `className` literal token (`btn`, `btn--ghost`, `sku`, ...).
   - Ořeže `_components.css` jen na pravidla s odpovídajícími base classami (BEM modifikátory + pseudo-classy se vezmou se sebou).
   - Z ořezaného CSS extrahuje `var(--*)` reference + ořeže `colors_and_type.css` na ně.
5. Složí `RegistryItem` strukturu per [shadcn registry-item schema](https://ui.shadcn.com/schema/registry-item.json).
6. Zapíše atomicky na `<canvas-dir>/<Slug>.registry.json`.

### 4. Reportuj výstup

```
✅ Handoff sidecar: .design/ui/Docs Site.registry.json
   files: 3  (component + style + theme)
   deps:  2  (react, react-dom)
   registryDependencies: 0
   
   Konzumace v target projektu:
     bunx shadcn add file://$(pwd)/.design/ui/Docs\ Site.registry.json
```

### 5. Návazné kroky

- Pokud sidecar je úspěšně emitnutý + komponenta jede v scratch projektu → ulož path do `_history/<slug>/handoff/<NNN>-registry.json.md` jako log.
- Pro multi-canvas batch handoff: smyčka přes `_active.json.open_tabs` nebo `find .design/ui -name '*.tsx'`.

## What handoff DOES / DOES NOT do

**DOES:**
- Stripne `data-cd-id` (dev scaffolding off).
- Resolvuje `dependencies` z importů (`react` + `react-dom` always).
- Bunduje použitou podmnožinu `_components.css` + tokenů (pro `css_mode: "inline"`).
- Atomicky zapíše sidecar.

**DOES NOT:**
- Necommituje. Sidecar zůstává v `.design/ui/` — uživatel commituje, kdy chce.
- Nespouští testy.
- Nepushuje na shadcn registry namespace (pro public hosting použij vlastní pipeline).
- Nemění target framework (canvas TSX je už React 19, target projekt taky — žádný runtime translation).

## Failure modes

- **Canvas není `.tsx`** → fail "migrate first".
- **`handoffTargets` v configu nemá `registry:item`** → fail s návrhem `mdcc config set handoffTargets ...`.
- **`bun` v PATH chybí** → fail s pokynem nainstalovat Bun (Phase 3.4).
- **Latest critique má blockers + bez `--force`** → fail s top blocker quote.
- **`_components.css` nebo `colors_and_type.css` neexistuje** → emit s prázdným CSS bundle (TSX-only registry-item; consumer dostane self-contained komponentu, ale tříd `_components.css` nepoužije — to je v podstatě same-stack handoff between mdcc projekty).

Po úspěšném handoff vidíš shell output s path k sidecar a kopírovací `bunx shadcn add` command.
