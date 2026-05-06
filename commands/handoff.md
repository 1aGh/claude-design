---
description: Migrate aktivní canvas (`_active.json`) do production kódu (apps/web nebo apps/mobile)
argument-hint: "[--target apps/web|apps/mobile] [--force]"
---

# /design:handoff — production migration

Konvertuje aktivní canvas do production kódu Dugmate:
- **`apps/web`** → React + Tailwind v4 + shadcn/ui (Next.js App Router)
- **`apps/mobile`** → React Native + Expo Router + NativeWind

Tokens se mapují na existující `packages/design-tokens`. Nové tokeny (pokud iterace zavedla nějaké navíc) se přidají do `packages/design-tokens/src/tokens.css`.

**Vstup `$ARGUMENTS`:** `[--target apps/web|apps/mobile] [--force]`

- `--target` — kam migrovat. Default = inferováno z názvu active souboru (`Mobile` v názvu → `apps/mobile`, `Studio`/`Desktop` → `apps/web`).
- `--force` — shipni i s otevřenými blockers v latest critique (NEDOPORUČENO).

**Příklad:**
```
/design:handoff                               # auto-detect target
/design:handoff --target apps/web
/design:handoff --force                       # bypass blockers
```

## Pre-requisites (orchestrator si je ohlídá)

Než handoff poběží, skill ověří:
1. **Server běží + `_active.json` má active canvas** (auto-start serveru pokud chybí).
2. **Latest critique pro tenhle canvas má `blockers == 0`** — pokud ne, fail s návrhem `/design "Address: <top blocker>"` first.
   - Override: `--force` (pouze když user explicitně řekne "ship despite blockers").
3. **Target dir exists** — `apps/web/` nebo `apps/mobile/`.

## Postup

Vyvolej skill `design` se vstupem: `handoff $ARGUMENTS`.

Skill:
1. Pre-flight (viz výše).
2. Načte aktivní canvas (cesta z `_active.json`).
3. **Extrakce:**
   - Token usage — grep všechny `var(--*)` reference → `handoff/tokens-used.json` (`{ "tokens": ["--bg-1", "--accent", "--radius-lg", ...], "new": [<tokens not yet in packages/design-tokens>] }`).
   - Layout structure — semantic regions (header, main, aside, sections).
   - Interaction hints — buttons (variant, label, action), inputs (type, placeholder, validation), focus order.
4. **Convert:**
   - Pro `apps/web`: vytvoří/upraví `apps/web/app/<route>/page.tsx` + komponenty pod `packages/features/src/<feature>/`. Tailwind classes mapují na existující theme. shadcn/ui primitives (`@/components/ui/button`, etc.) se použijí kde to dává smysl.
   - Pro `apps/mobile`: vytvoří/upraví `apps/mobile/app/<route>.tsx` + komponenty pod `packages/features/src/<feature>/`. NativeWind classes. Expo Router conventions.
5. **Token sync:** pokud `tokens-used.json` má nové tokeny, přidá je do `packages/design-tokens/src/tokens.css` (s odkazem na pluginový `colors_and_type.css`).
6. **Handoff report:** zapíše `.ai/design/_history/<slug>/handoff/<NNN>-handoff-report.md` (gitignored — pokud chceš track, copy ho do `.ai/decisions/`):
   - Active canvas migrated
   - Files created / modified (relativní paths)
   - Tokens referenced
   - Open critique items carried over (pokud `--force` byl použit)
   - Next steps (run `/verify`, manual smoke test)
7. (history snapshot zůstává v `_history/<slug>/handoff/` jako audit trail)
8. **Návrh navazujících commands:**
   - `/verify` — smoke + a11y na nové cestě
   - `/scenario new <slug>` — pokud surface ještě nemá scenario
   - `/code-review` — pre-commit self-review

## What handoff DOES NOT do

- **Necommituje** — handoff jen napíše soubory, commit dělá user (přes `/done` nebo manuálně).
- **Nespouští testy** — to je `/verify` job.
- **Nemění `apps/api/`** — handoff je čistě UI vrstva.
- **Negeneruje routes** — pokud route neexistuje, fail s návrhem ji založit ručně. Nechceme magii v routingu.

## Failure modes

- **Latest critique má blockers a `--force` nebyl předán** → fail s top blocker quote.
- **Target dir neexistuje** → fail.
- **HTML použil token, který není v `colors_and_type.css`** → fail (pravděpodobně regression v iteraci).
- **shadcn/ui není v `apps/web`** → fail s `pnpm dlx shadcn@latest add` instrukcí.
- **NativeWind není v `apps/mobile`** → fail s linkem na `dugmate-responsive-rules` skill.

Po úspěšném handoff vidíš v terminálu summary + path k handoff-report.md.
