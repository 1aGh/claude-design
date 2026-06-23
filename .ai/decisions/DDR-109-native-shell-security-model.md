# DDR-109: Native-shell security model — loopback-only sidecar, strict CSP, `maude://` allowlist, keychain secrets

- **Date:** 2026-06-16
- **Status:** Accepted (founding decision for the native-collab arc — phase-26 Task 1). The CSP + loopback parts are enforced in phase-26 (Task 5); the keychain + deep-link parts are exercised from phase-28.
- **Tags:** native-app, security, csp, loopback, deep-link, keychain, tauri, webview, phase-26
- **Related:** [DDR-106](./DDR-106-tauri-v2-native-shell-architecture.md) (the shell + lifecycle this hardens), [DDR-108](./DDR-108-github-auth-oauth-device-flow.md) (OAuth token → keychain; callback allowlist), [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (git creds from keychain), [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md) (cross-origin canvas iframe the CSP must permit), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (iframe sandbox/CSP for peer-authored canvas code), [DDR-056](./DDR-056-linked-mode-gitignore-strategy.md) (`gitignore-block.mjs` keeps secrets out of git). Mirrors the existing dev-server posture: the canvas iframe is untrusted (DDR-054/063), every write endpoint is main-origin-only (the `canvas-create.ts` pattern), and hub tokens are never committed. Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md).

## Context

The native shell broadens Maude's attack surface before phase-28 ever ships a real GitHub token: it adds an OS webview, a spawned sidecar, a custom URL scheme (`maude://`), local git credentials, GitHub OAuth tokens, a new write API, and (phase-31) a local agent bridge. We lock this down **as a founding decision**, not after the tokens land.

The existing trust model already says: the canvas iframe is **untrusted** (DDR-054/063, cross-origin by default), and privileged routes (file-write, export, config) are **main-origin-only** (the `canvas-create.ts` pattern, asserted by `canvas-origin-gate.test.ts`). The shell must not weaken any of that.

## Decision

The native shell adopts four hard constraints:

### 1. Loopback-only sidecar

The webview only ever loads `http://localhost:<port>` (and the `canvasOrigin` `localhost:<canvasPort>` from `_server.json`). The dev-server binds loopback; the shell never navigates to a remote URL. The phase-31 `acp-bridge` likewise **rejects any non-loopback connection at the WebSocket upgrade** (asserted in `acp-bridge.test.ts`), mirroring the dev-server's own loopback model.

### 2. Strict CSP in `tauri.conf.json` → `app.security.csp`

```
default-src 'self' http://localhost:* ws://localhost:*;
frame-src http://localhost:*;
script-src 'self' 'unsafe-inline' http://localhost:*;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: http://localhost:* asset:;
connect-src http://localhost:* ws://localhost:*;
```

> **Correction vs the phase-26 plan:** the plan's CSP used `127.0.0.1`. The dev-server writes `url: http://localhost:<port>` and a separate `canvasOrigin` port (DDR-063) — WKWebView treats `localhost` and `127.0.0.1` as **different origins**, and the two ports are cross-origin to each other. The CSP must use `localhost:*` (wildcard port) to cover both the main UI and the canvas iframe. `style-src 'unsafe-inline'` is required (the client + canvases use inline styles — note the `reference_csp_style_src_drops_inline_styles` lesson: `style-src 'self'` silently drops all inline styles).

CSP cannot grant iframe permissions — only the iframe's `sandbox` attribute can. If the DDR-063 cross-origin iframe's `postMessage` inspector channel breaks in WKWebView, the fix is `sandbox="allow-same-origin allow-scripts"` on the iframe in the dev-server HTML template, gated by the DDR-054 trust model — **not** a CSP relaxation.

### 3. `maude://` deep-link allowlist

The `maude://` scheme (registered in `tauri.conf.json` → `bundle.macOS.urlSchemes`) accepts only an explicit allowlist of actions (`maude://open?path=…`, and the OAuth callback per DDR-108). Unknown verbs are dropped. A deep link never causes a filesystem write or a spawn without going through the same main-origin-only endpoint validation as any other request.

### 4. Secrets in the OS keychain — never on disk

GitHub OAuth tokens (DDR-108), git HTTPS credentials (DDR-107), and hub tokens migrate to the OS keychain via the Tauri keychain plugin. They never appear in `_server.json`, `.design/`, any committed file, or the deep-link URL. `gitignore-block.mjs` (DDR-056) continues to keep anything file-resident out of git.

## Consequences

- **Positive:** the broadened surface is locked down before real credentials exist; the dev-server's existing untrusted-iframe + main-origin-only model carries through unchanged; one documented place (this DDR) for every shell-security invariant the later phases reference.
- **Negative / accepted:** `script-src 'unsafe-inline'` + `style-src 'unsafe-inline'` are required by the current client/canvas rendering — accepted because the only loaded origins are loopback (no remote script can reach the inline-script allowance). Revisit if the client moves off inline scripts.
- **Enforced where:** phase-26 Task 5 verifies the CSP + cross-origin iframe + HMR + inspector in WKWebView; phase-28 exercises the keychain + OAuth callback; phase-31 adds the `acp-bridge` loopback assertion. Every new `/_api/git/*` + `/_api/github/*` endpoint gets the per-endpoint defender + adversarial review (the canvas-create F1/F2 pattern) and a `canvas-origin-gate.test.ts` entry proving the untrusted iframe 403s it.

## Alternatives considered

- **Bind the sidecar to `0.0.0.0` for "LAN collaboration"** — rejected: real-time collaboration is the hub's job (DDR-052/064), not an exposed local server. Loopback-only removes a whole class of local-network attack.
- **Relax CSP to make the cross-origin iframe "just work"** — rejected: CSP can't grant iframe permissions anyway; the correct lever is the `sandbox` attribute under the DDR-054 trust model.
- **Store tokens in a config file (like today's `~/.config/maude/hubs.json`)** — rejected for the shell: GitHub `repo` tokens are too high-value for a flat file; the keychain is the right store and Tauri makes it cheap.

## Addendum (2026-06-17 — phase-26 close security review)

A defender + adversarial pass at phase-26 close (`.ai/logs/security-reviews/native-app-phase26.md`) confirmed the invariants hold and produced two hardenings + one tracked follow-up:

- **§1 loopback-only is now CODE-ENFORCED** (was prose): `server_json::is_loopback_url()` gates both `window.navigate` sites to `http://localhost|127.0.0.1` only, so a poisoned `_server.json` `url` (from an untrusted cloned project) can't redirect the webview (review F3).
- **`MAUDE_DEV_SERVER_ROOT` override** requires the `http.ts` anchor (not just a `dist/` dir) so a planted directory can't hijack the dev-server runtime root (review F4).
- **Follow-up (F2, tracked):** the dev-server's MAIN origin ships no CSP header (only the canvas origin does — `http.ts` env-gated POC). Not phase-26-introduced; the main UI's controls are Origin-gated writes + the DDR-054/063 canvas split. Emit a real main-origin CSP in a dedicated dev-server hardening pass before public distribution.
- The Bun build-time macro RCE hypothesis (F1) was **empirically disproven** — the pass-1 oxc transpile rejects macro import attributes before `Bun.build`, so untrusted canvas TSX cannot execute at build time.
