# Feature: ACP composer slash-command autocomplete + inline highlight

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan continues the Phase 31 (DDR-123) native ACP chat panel and builds directly on the empty-state CTA added in commit `417079f`.

## Description

Make the native ACP chat composer (`apps/studio/client/panels/ChatPanel.jsx`) command-aware:

1. **Autocomplete / našeptávání** — typing `/` opens a popover of available flow + design slash commands (name + description), filter-as-you-type, keyboard + mouse selectable, so users don't have to memorize which commands exist.
2. **Inline highlight (badge)** — when the message's leading token is a slash command **that actually exists**, that token renders as a styled pill *inside the input* (mirror-overlay technique). Unknown `/tokens` get no pill — the "only for commands that exist" rule.

The authoritative "exists" set comes from ACP's `available_commands_update` (what the user's own `claude` reports for this session — already received by the bridge today and **dropped**). A curated static list of flow/design commands bootstraps the UI instantly; a lazy warm-up on the first `/` fetches the live set without a full prompt.

## User Story

As a Maude user editing designs in the native chat panel, I want the composer to suggest and recognize slash commands so that I can discover and run `/design:*` and `/flow:*` verbs without remembering their exact names.

## Problem

- The composer is a plain textarea. Users must already know `/design:edit`, `/design:setup-ds`, etc. — high recall burden. The empty-state CTA + quick-action row only cover a handful.
- ACP already streams the authoritative command list (`available_commands_update`) but `acp-runtime.js` explicitly drops it (line ~213 + `default: break` in the adapter switch).

## Solution

Capture + cache the ACP command list server-side, push it to the client over the existing `/_ws/acp` socket, merge it with a curated static bootstrap list, and drive two UI affordances (popover + inline pill) off the merged model. No new HTTP surface, no new dependency.

## Metadata

- **Type**: Enhancement
- **Complexity**: Medium–High (mirror-overlay highlight is the finicky part; server change is small)
- **App/Package**: `apps/studio` (dev-server + studio client) — single package
- **Affected Systems**: ACP bridge (`acp/bridge.ts`, `acp/index.ts`), client runtime (`acp-runtime.js`), ChatPanel UI + CSS, committed client bundle
- **Dependencies**: none new. Uses `@assistant-ui/react@0.14.23` composer API + `@agentclientprotocol/sdk@0.28.1` `AvailableCommand` type (both already installed)
- **Decisions locked (via AskUserQuestion)**: inline mirror-overlay highlight (not just a chip) + static-bootstrap ∪ live-ACP with lazy warm-up

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `apps/studio/acp/bridge.ts` (whole file, ~305 lines) — Why: the per-connection ACP client; `client.sessionUpdate` (lines 203–206) is where `available_commands_update` arrives and must be intercepted. `sessionFor` (120–128) creates a session; `ensureStarted` (109–118) spawns the adapter.
- `apps/studio/acp/index.ts` (whole file) — Why: the `Acp` manager. `handlePrompt` (56–82) builds the bridge with `onUpdate`/`onPermission`; `onOpen` (85–88) sends `ready`; `onMessage` (90–118) dispatches `prompt`/`cancel`. Add command cache + `{t:'commands'}` broadcast + `{t:'warm'}` handling here.
- `apps/studio/client/panels/acp-runtime.js` (whole file) — Why: `onFrame` (63–74) drops non-turn frames; `makeAcpAdapter` switch (234–281) drops commands. Add a `commands` frame path + `onCommands`/`warm` on the connection.
- `apps/studio/client/panels/ChatPanel.jsx` (whole file, 809 lines) — Why: `Composer` (264–332) owns the textarea; `ChatThread` (410–462) has `conn` + `chatId` to thread down; `QUICK_ACTIONS`/`SUGGESTIONS` (70–83) are the existing prefill affordances to sit alongside.
- `apps/studio/client/styles/6-acp-chat.css` — Why: `.chat-input`/`.chat-box` (595–625) typography contract the mirror must match **exactly**; `.chat-empty-cta` + `.chat-sug` for badge/pill styling precedent; `prefers-reduced-motion` block (761–770).
- `apps/studio/test/acp-bridge.test.ts` + `apps/studio/test/fixtures/mock-acp-agent.mjs` — Why: the bun:test harness + mock ACP agent to mirror for the new commands/warm test (may need to extend the mock to emit `available_commands_update`).

### Files to Create

- `apps/studio/client/panels/slash-commands.js` — pure command model: `STATIC_COMMANDS`, `normalizeName`, `buildCommandModel`, `matchLeadingCommand`, `filterCommands`. No DOM → unit-testable.
- `apps/studio/test/slash-commands.test.ts` — bun:test for the pure helpers above.
- `apps/studio/test/acp-commands.test.ts` — bun:test: an agent `available_commands_update` → a `{t:'commands'}` client frame; a `{t:'warm'}` frame creates a session without a prompt.

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/ChatPanel.tsx` | (approved mock) | chat | The panel's approved look; its empty-sub already says "run a slash command". No command-menu/autocomplete specimen exists yet — this feature is net-new UI. Mirror the `.st-row-badge` / `.chat-empty-cta` badge idiom for the pill; do not invent a foreign style. |

### Documentation

- `@assistant-ui/react` composer API (installed d.ts) — `useComposerRuntime()` → `.getState().text`, `.setText(str)`, `.subscribe(cb)`; `useComposer((c) => c.text)` for reactive read. Why: read the live composer text (popover filter + mirror) and insert a picked command.
- `@agentclientprotocol/sdk` `AvailableCommand = { name: string; description: string; input?: … }` on `available_commands_update`. Why: the exact shape to cache/forward.

### Patterns to Follow

- **Subscription pattern** (mirror for `onCommands`): `acp-runtime.js` `onActivity` (109–113) — a `Set` of listeners + immediate replay of current value + unsubscribe closure.
- **Frame dispatch** (mirror for the `commands` frame): `onFrame` (63–74) handles `ready` outside the turn; add `commands` the same way (independent of `turnHandler`).
- **Bridge option wiring** (mirror for `onCommands`): `AcpBridgeOptions` (29–36) `onUpdate`/`onPermission`; add `onCommands?`.
- **WS main-origin gating**: `/_ws/acp` is already loopback + main-origin only (DDR-054/DDR-123). New `{t:'warm'}`/`{t:'commands'}` frames ride that socket — **no new origin surface**, so no `canvas-origin-gate` assertion needed. Do NOT add an HTTP route (keeps the dual-allowlist untouched).

---

## Design Decisions

### Command model (`slash-commands.js`)

- `STATIC_COMMANDS`: curated array of `{ name, description, argHint, group }` for the daily flow + design verbs, hand-sourced from `plugins/{design,flow}/commands/*.md` frontmatter (`name` + `description`). This is the instant bootstrap (plugin markdown is NOT shipped to the client, so it must be baked in). Live ACP is the drift-proof authority; the static list is just discovery UX. Include a header comment pointing at the source-of-truth frontmatter.
- `normalizeName(raw)`: strip a leading `/`, trim, lowercase. **RISK/verify (Task 8):** the exact `name` format Claude Code's ACP adapter reports for plugin commands (`design:edit` vs `design-edit` vs `edit`) is unconfirmed — normalize both the ACP names and static names through the same fn and match on the result; adjust the fn once the real payload is logged.
- `buildCommandModel(staticList, liveList)` → `{ all, existsSet }`:
  - `all` = union of static ∪ live, deduped by normalized name, each entry `{ name, description, argHint, group, live: boolean }`, sorted (group then name).
  - `existsSet` = `liveList.length ? Set(liveNames) : Set(staticNames)` — **strict live authority once warmed; optimistic static fallback before** (the shipped flow/design commands are safe to badge cold).
- `matchLeadingCommand(text)`:
  - Popover-open test: `/^\/[\w:-]*$/.test(text.trimStart())` (still typing the first token, no space yet) → returns the partial token.
  - Highlight test: `text.match(/^(\/[\w:-]+)(\s|$)/)` → returns the full leading command token (command may be followed by args). Commands are leading-token only (matches Claude Code) — mid-string `/` is intentionally out of scope.
- `filterCommands(all, token)`: prefix-match first, then substring, capped (~8) for the popover.

### Inline highlight — mirror-overlay (the finicky part)

- `HighlightedInput` wraps `ComposerPrimitive.Input` in a relatively-positioned `.chat-input-wrap`.
- Behind the textarea, an `aria-hidden` `.chat-input-mirror` div renders `useComposer((c) => c.text)`, with the leading command token wrapped in `<span className="chat-cmd-pill">` **only when** `existsSet.has(normalizeName(token))`. Otherwise plain text.
- Textarea sits on top with `color: transparent; background: transparent; caret-color: var(--fg-0)`; `::placeholder` stays visible. The mirror is always the visible text layer (single render path — no transparency toggling).
- **Exact-match contract (load-bearing):** mirror and textarea MUST share font-family, font-size, line-height, letter-spacing, padding, width, and `white-space: pre-wrap; overflow-wrap: break-word`. Any drift shifts the pill off the text. Sync `scrollTop` on input for the rare multi-line overflow. This is the #1 verification target.

### Popover

- `CommandPopover` anchored above `.chat-box` (`.chat-cmd-menu`, absolute, opens upward — the composer is at panel bottom). Rows = `.chat-cmd-item` with name (mono, group-colored) + description (muted). Keyboard: ↑/↓ move, Enter/Tab insert, Esc close; mouse hover + click insert. Insert = `composerRuntime.setText('/' + name + ' ')` then close + refocus.
- Open state + active-index live in `Composer`; keydown intercepted via `onKeyDownCapture` on `.chat-box` so it beats the textarea's ctrlEnter submit.
- `data-testid` hooks for a future desktop-e2e scenario: `chat-cmd-menu`, `chat-cmd-item-<normalizedName>`, `chat-cmd-pill`.

### Warm-up

- `conn.warm(chatId)` sends `{t:'warm', chat}` once, on the first `/` of the connection. Server `getOrCreateBridge(ws)` + `bridge.warmUp(chatId)` = `ensureStarted()` + `sessionFor(chatId)` (no prompt).
- **RISK/verify (Task 8):** whether `newSession` alone makes Claude Code's adapter emit `available_commands_update` is unconfirmed. If it does → live set populates on first `/`. If not → live set populates after the first real prompt; the static bootstrap covers the gap either way (graceful degradation — no hard dependency).
- This warms the adapter on `/` instead of first send — a minor, user-initiated relaxation of the bridge's "opening costs nothing" comment. Update that comment (bridge.ts lines 1–4) to note warm-up is `/`-triggered, not open-triggered.

### Icons / Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Command pill bg/fg | `--accent-tint` / `--accent` | recognized-command highlight |
| `design:` group accent | `--accent` | group-color the mono name |
| `flow:` group accent | `--presence-agent` (or a second accent) | distinguish groups; confirm a suitable token exists in the maude DS, else reuse `--accent` |
| Popover surface | `--bg-2` / `--border-default` / `--shadow-lg` | mirror `.chat-menu` (lines 124–137) |
| Description text | `--fg-2` | muted |

No hardcoded colors. Reduced-motion: pill + popover are static (no entrance animation, or gate any fade behind the existing `prefers-reduced-motion` block).

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `HighlightedInput` | inline command pill in a textarea | wraps `ComposerPrimitive.Input` |
| `CommandPopover` | autocomplete menu | none (own markup, `.chat-menu` idiom) |
| `useSlashCommands(conn)` hook | merge static + live ACP, expose `{all, existsSet}` | subscribes `conn.onCommands` |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ADD `onCommands` capture to the ACP bridge

- **Do**: In `acp/bridge.ts`, add `onCommands?: (commands: AvailableCommand[]) => void` to `AcpBridgeOptions`. In the `client.sessionUpdate` callback (lines 203–206), before/after the existing `onUpdate`, detect `params.update.sessionUpdate === 'available_commands_update'` and call `this.opts.onCommands?.(params.update.availableCommands ?? [])`. Import `AvailableCommand` from `@agentclientprotocol/sdk`.
- **Do**: Add `async warmUp(chatId: string): Promise<void>` — `await this.ensureStarted(); await this.sessionFor(chatId);` (no prompt). Best-effort; let callers swallow errors.
- **Pattern**: existing `SessionUpdate` handling + `sessionFor` (120–128).
- **Gotcha**: keep the transcript append untouched; commands are chrome, don't write them to `_chat/*.jsonl`.
- **Validate**: `bun test apps/studio/test/acp-bridge.test.ts` still green.

### Task 2: CACHE + broadcast commands, handle `warm` in the ACP manager

- **Do**: In `acp/index.ts` `createAcp`, add closure state `let latestCommands: AvailableCommand[] = []`. Factor a `getOrCreateBridge(ws)` helper from `handlePrompt`'s bridge-build block; wire `onCommands: (cmds) => { latestCommands = cmds; send(ws, { t: 'commands', commands: cmds }); }`.
- **Do**: In `onOpen`, after the `ready` send, `if (latestCommands.length) send(ws, { t: 'commands', commands: latestCommands })` (instant last-known set for a freshly opened panel).
- **Do**: In `onMessage`, handle `frame.t === 'warm'` → `const chatId = sanitizeChatId(typeof frame.chat === 'string' ? frame.chat : 'default'); void getOrCreateBridge(ws).warmUp(chatId).catch(() => {})`.
- **Do**: Update the frame doc comment (21–26) to list `warm` (in) + `commands` (out).
- **Pattern**: `handlePrompt` bridge build (63–71); `send` (38–44).
- **Gotcha**: `latestCommands` is process-wide (survives chat switches, not restarts) — acceptable; static list covers cold start. Don't persist to disk (avoids DDR-115 gitignore-taxonomy churn).
- **Validate**: new `bun test apps/studio/test/acp-commands.test.ts` (Task 9).

### Task 3: SURFACE commands + warm on the client connection

- **Do**: In `acp-runtime.js` `createAcpConnection`, add `commandListeners = new Set()`, `let commands = []`. In `onFrame`, add `if (frame.t === 'commands') { commands = frame.commands || []; for (const fn of commandListeners) fn(commands); return; }` (independent of `turnHandler`).
- **Do**: Expose `onCommands(fn)` (replay-current + unsubscribe, mirror `onActivity`) and `async warm(chatId) { await ensureOpen(); ws?.send(JSON.stringify({ t: 'warm', chat: chatId || undefined })); }`.
- **Pattern**: `onActivity` (109–113), `ready` branch (64–69).
- **Validate**: bundle builds (Task 10); no runtime error on frame receipt.

### Task 4: CREATE the pure command model `slash-commands.js`

- **Do**: Implement `STATIC_COMMANDS` (daily design + flow verbs from `plugins/{design,flow}/commands/*.md` frontmatter), `normalizeName`, `buildCommandModel`, `matchLeadingCommand`, `filterCommands` per Design Decisions.
- **Pattern**: plain ES module, no imports, no DOM — like `canvas-url.js`.
- **Gotcha**: normalize BOTH static and ACP names through `normalizeName` before set membership — don't assume ACP includes the `plugin:` prefix.
- **Validate**: `bun test apps/studio/test/slash-commands.test.ts` (Task 9).

### Task 5: BUILD `useSlashCommands` + `CommandPopover`

- **Do**: `useSlashCommands(conn)` — `useState` seeded from `STATIC_COMMANDS`; `useEffect(() => conn.onCommands(setLive), [conn])`; return `useMemo(() => buildCommandModel(STATIC_COMMANDS, live), [live])`.
- **Do**: `CommandPopover({ items, activeIndex, onPick, onHover })` — `.chat-cmd-menu` opening upward; rows `.chat-cmd-item` (group-colored mono name + muted description); `data-testid` per Design Decisions.
- **Pattern**: `.chat-menu` dropdown (ChatPanel 711–747 + CSS 124–169).
- **Validate**: renders in the bundle; no console errors.

### Task 6: BUILD `HighlightedInput` (mirror-overlay)

- **Do**: `.chat-input-wrap` (relative) containing `.chat-input-mirror` (aria-hidden, reads `useComposer(c => c.text)`, wraps leading token in `.chat-cmd-pill` iff `existsSet.has(normalizeName(token))`) + `ComposerPrimitive.Input className="chat-input chat-input--overlay"` on top. Sync `scrollTop` mirror←textarea on input.
- **Gotcha**: the exact-typography contract (see Design Decisions) — this is the load-bearing risk. Build the mirror CSS by copying `.chat-input`'s box model verbatim.
- **Validate**: manual — type `/design:edit foo`, pill hugs the token; type `/nope foo`, no pill; resize panel, pill stays aligned.

### Task 7: WIRE popover + highlight into `Composer`

- **Do**: Thread `conn` + `chatId` from `ChatThread` (410–462) into `Composer`. In `Composer`, read `useComposer(c => c.text)` + `useComposerRuntime()`; compute open-state via `matchLeadingCommand`; on first-ever open, `conn.warm(chatId)` (guard with a ref). Replace `ComposerPrimitive.Input` with `HighlightedInput`; render `CommandPopover` when open. Intercept ↑/↓/Enter/Tab/Esc via `onKeyDownCapture` on `.chat-box` (prevent submit when picking). Insert via `runtime.setText('/' + name + ' ')`.
- **Pattern**: `Composer` (264–332); keep the running/stopbar branch (318–329) untouched.
- **Gotcha**: only intercept keys when the popover is open, else normal ctrlEnter submit must work.
- **Validate**: manual keyboard + mouse selection; Esc closes; picking inserts + refocuses.

### Task 8: VERIFY the live ACP payload (de-risk normalization + warm-up)

- **Do**: With a real `claude` connected, boot the dev-server against a scratch `.design/` project, open the panel, type `/`, and log the `available_commands_update` frame (temporary `console.log` in `onFrame`, or inspect the WS in devtools). Confirm (a) the exact `name` format for plugin commands, (b) whether `warmUp`/`newSession` alone emits it or only a prompt does.
- **Do**: Adjust `normalizeName` + the warm-up expectation to match reality; remove temp logging.
- **Gotcha**: this is the single biggest unknown — do it before polishing CSS.
- **Validate**: static badge set matches the live set for installed commands; no false "exists".

### Task 9: ADD tests

- **Do**: `slash-commands.test.ts` — `normalizeName` variants, `matchLeadingCommand` (partial vs full vs none vs mid-string), `buildCommandModel` (cold static-fallback vs warm live-authority), `filterCommands` ranking.
- **Do**: `acp-commands.test.ts` — mirror `acp-bridge.test.ts`; extend `mock-acp-agent.mjs` if needed to emit an `available_commands_update`; assert the manager sends `{t:'commands'}`; assert `{t:'warm'}` creates a session (spy `newSession`) without a prompt.
- **Pattern**: `acp-bridge.test.ts` + `test/fixtures/mock-acp-agent.mjs`.
- **Validate**: `bun test apps/studio/test/slash-commands.test.ts apps/studio/test/acp-commands.test.ts`.

### Task 10: ADD CSS + REBUILD the committed bundle

- **Do**: Add `.chat-input-wrap`, `.chat-input-mirror`, `.chat-cmd-pill`, `.chat-cmd-menu`, `.chat-cmd-item` (+ group-color + active state) to `6-acp-chat.css`, all maude tokens, reduced-motion-safe. Copy `.chat-input`'s box model into `.chat-input-mirror`.
- **Do**: Rebuild release-minified: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` (per CLAUDE.md — committed bundle is what ships).
- **Validate**: `grep -c chat-cmd-menu dist/styles.css` and `grep -c "t:'warm'\|warm" dist/client.bundle.js` non-zero; build prints clean sizes.

---

## Validation

1. **Lint/format**: `pnpm exec biome check apps/studio/acp apps/studio/test` (client dir is Biome-excluded by design — the new `.js`/`.jsx` client files won't be linted; `acp/*.ts` + `test/*.ts` will).
2. **Tests**: `bun test apps/studio/test/slash-commands.test.ts apps/studio/test/acp-commands.test.ts apps/studio/test/acp-bridge.test.ts apps/studio/test/acp-origin-gate.test.ts`
3. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (clean sizes; change present in artifacts)
4. **Native dogfood (required — panel is `isNativeApp()`-gated)**: run the bundled desktop app, open Assistant, type `/` (popover), arrow+enter (insert), type a real vs fake command (pill vs no pill), send a `/design:*` command (still works). Browser mode can't render this panel.
5. **Desktop E2E (optional, high-value)**: add a scenario via the `desktop-e2e` skill using the new `data-testid`s (`chat-cmd-menu`, `chat-cmd-item-*`, `chat-cmd-pill`).
6. **Manual edge cases**: mirror/pill alignment on resize + multi-line; Esc/blur closes popover; ctrlEnter submit still works when popover closed; warm-up doesn't double-spawn.

---

## Scenario Coverage (UI tasks)

The panel is native-only, so `agent-browser`/5-platform scenarios don't reach it (memory: native-app verification ceiling). Coverage is: pure-helper unit tests + bridge frame test + a `desktop-e2e` WebdriverIO scenario driving the popover by `data-testid` (DOM-driven, not computer-use).

**New scenario to create (optional):** `acp-slash-autocomplete` — open Assistant → type `/design` → assert `chat-cmd-menu` visible with `chat-cmd-item-design-edit` → ArrowDown+Enter → assert composer text prefilled → assert `chat-cmd-pill` present.

---

## Acceptance Criteria

- [x] Typing `/` opens a filtered popover of flow + design commands; ↑/↓/Enter/Tab/Esc + click work; pick prefills `"/name "`. _(code complete; interactive proof = native dogfood)_
- [x] A leading command **that exists** renders an inline pill; an unknown `/token` renders no pill. _(mirror-overlay + existsSet gate; native dogfood for pixels)_
- [x] Live ACP `available_commands_update` is captured, cached, pushed over `/_ws/acp`, and is authoritative for the exists-set once warmed; static list bootstraps instantly before that.
- [x] Task 8 done: real ACP payload inspected (98 cmds, fires on session/new); `normalizeName` (colon+prefix) + warm-up match reality.
- [x] New tests green (13); existing acp tests green; `sameOriginWrite`/origin gating untouched (no new HTTP route — WS-only).
- [x] `dist/client.bundle.js` + `dist/styles.css` rebuilt release-minified; runtime bundles preserved at HEAD.
- [x] ctrlEnter submit + existing quick-actions/CTA/empty-state unaffected (full suite 1727 pass).
- [ ] No DDR-worthy decision left unrecorded (candidate: the `/`-triggered warm-up relaxing lazy-spawn — likely a bridge-comment note, not a full DDR; confirm at `/flow:done` retro).
- [x] Bridge warm-up comment documents `/`-triggered timing (bridge.ts `warmUp` docstring + acp-runtime.js header).
- [ ] `pnpm --filter @maude/site gen:roadmap` run + `site/lib/roadmap.json` diff committed alongside this plan (per CLAUDE.md new-plan rule) — **at commit time**.

---

## Retro

- **The plan's Task 8 de-risking paid off, and better than expected.** The single biggest unknown — the real ACP `available_commands_update` shape + timing — was resolved by a 30-line probe against the live `claude` in minutes: it fires on `session/new` alone (warm-up works with zero prompt) and uses the exact `plugin:verb` colon form the static list assumed. Scheduling that probe *right after* the server wiring (not after the UI) meant the whole client build stood on verified reality, not a guess. Keep front-loading "one live probe" for any integration whose payload/timing the plan can't see.
- **WS-only beat adding an HTTP route.** The plan's late pivot to deliver the live catalogue over the existing `/_ws/acp` (cache + `onOpen` replay + `{t:'commands'}`) instead of a `GET /_api/acp/commands` avoided touching the DDR-054 dual-allowlist and the canvas-origin gate entirely — smaller surface, one fewer security question, and the origin-gate test needed no change. Prefer riding an already-gated channel over minting a new endpoint.
- **The dev-server self-heal `dist/` trap bit mid-execute and cost a detour.** Running the *full* `bun test` suite booted the server, whose first-launch self-heal regenerated all of `dist/` to unminified dev form (client.bundle 7.4 MB, motion_react 488 kB). Recovery = `git checkout HEAD -- apps/studio/dist/` then rebuild only the client artifacts `--release`. **Lesson for `/execute` + `/done`:** after a green full-suite run, treat `dist/` as dirty-by-boot; either run targeted tests only, or restore+rebuild `dist` before staging. Worth a CLAUDE.md/known-issues note if it recurs.
- **Shared-tree concurrency is the norm here.** A parallel session was live-editing `canvas-shell.tsx` (reworking phase-12.1) during this execute. Because `client.bundle.js`'s only entry is `client/app.jsx` (canvas-shell compiles into the separate iframe runtime), my rebuilt artifacts stayed clean of it — but the discipline of *staging explicit paths, never `git add -A`* was load-bearing. `/plan` should keep assuming a dirty/concurrent `main`.
- **Mirror-overlay highlight was the right call but remains the least-verified piece.** The inline pill's exact-typography contract (mirror ≡ textarea box model) is sound in code but only truly provable in the native `.app` (isNativeApp gate). Next time, add the `data-testid`s *and* a desktop-e2e scenario in the same pass so the highlight isn't left to manual dogfood.
