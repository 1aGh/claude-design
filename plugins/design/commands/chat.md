---
name: design:chat
category: daily
description: Otevři (focusni) native ACP chat sidepanel v Maude okně — agent chat běžící na tvé vlastní `claude` CLI subscription (DDR-123). Native-app only.
argument-hint: ""
---

# /design:chat — surface the native ACP chat sidepanel

Otevře (nebo focusne) **Assistant** sidepanel v běžícím native Maude okně, kde můžeš hnát `/design:edit`, `/design:new`, `/design:critic`, `/design:screenshot` a sledovat, jak se canvas mění — aniž bys opustil tu samou sdílenou plochu. Panel jede na **tvé vlastní instalaci `claude` na Pro/Max subscription** (žádný login v Maude, nikdy metered API billing — DDR-123).

> **Native-app only.** Panel existuje jen v native Maude shellu (ne web surface) — ACP spawnuje agenta lokálně na tvém stroji, což spolehlivě umí jen Tauri shell (DDR-123, scope note phase-31). Z terminálového web-studia panel neotevřeš; tam zůstává terminál-driven workflow.

## Co to dělá

Single source of truth je `maude design chat-open` (on-PATH `maude` dispatchuje do bundled helperu — DDR-062). Helper přečte port běžícího dev-serveru z `<designRoot>/_server.json` a POSTne `/_api/acp/focus`; server emituje bus event, který shell (app.jsx) přeloží na „otevři Assistant panel" (native-only).

## Postup

1. Ujisti se, že běží native Maude (panel se renderuje uvnitř něj). Pokud server neběží, otevři Maude app.
2. Spusť focus:

```bash
maude design chat-open
```

3. Assistant panel se otevře v Maude okně (nebo `⌘⇧A` přímo v appce).

## Stavy panelu

- **Ready** — claude je nainstalovaný + přihlášený; piš prompty, quick-actions (`/design:edit`, `/design:new`, `/design:critic`, `/design:screenshot`) prefillnou composer.
- **Working…** — agent streamuje; **Stop** (⌘↵ odešle, Esc/Stop ruší turn).
- **Not connected** — `claude` není nainstalovaný / přihlášený → plain explainer („otevři terminál, spusť `claude` a `/login`"), nikdy error. Detekce přes `GET /_api/acp/status`.

## Failure modes

- **No running server** (`_server.json` chybí) → „Open Maude first."
- **Focus request failed** → server běží, ale `/_api/acp/focus` nedostupné (starý build?) — restartuj Maude.
- **Web surface** → panel se neotevře (native-only); použij terminálový Claude Code.
