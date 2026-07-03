# Feature: ACP chat image thumbnails + lightbox

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — especially the ACP composer paste-chip flow, the `_chat/attachments/` write path, and the DDR-054 origin discipline.

## Description

Images that enter the native ACP chat panel currently render as a **text badge** (`[image-1]`) — you can't see what was pasted. This feature renders any image **inline as a thumbnail**, and opens it in a **lightbox** on click. **v1 scope: user-pasted images** (clipboard screenshots dropped into the composer). Agent/skill-sent images (e.g. a `/design:screenshot` pushed into chat) are a fully-designed **follow-up** (see § Follow-up: agent/skill-sent images) — deferred because they need a new emit mechanism + an untrusted-render review, whereas user-paste is well-defined and shippable today.

> **Scope note (2026-07-03):** the scope question (user-paste only vs. also render agent image blocks vs. full skill-emit) was put to the user; no answer within the window, so this plan commits the **recommended v1 (user-paste)** and documents the wider scope as a follow-up. Promote the follow-up into the task list if the user opts in.

## User Story

As a Maude user chatting with Claude in the native panel, I want a pasted screenshot to show as a thumbnail I can click to enlarge, so I can confirm I attached the right image and review it without leaving the chat.

## Problem

- A pasted clipboard image is uploaded to `_chat/attachments/<sha8>.<ext>` and referenced only by a collapsed text chip (`[image-1]`) in the user bubble (`chipNodes`, ChatPanel.jsx). The user never sees the image in the feed.
- There is **no HTTP route to fetch** an attachment — `/_api/acp/attachment` is **POST-only** (write). So even if we wanted to render `<img>`, there's no `src`.
- There is **no lightbox / modal-image pattern** anywhere in the studio client.

## Solution

Three moving parts, all reusing existing patterns:

1. **Serve route** — extend `/_api/acp/attachment` to also handle **GET `?name=<sha8>.<ext>`**, serving the file from `_chat/attachments/` behind a strict **content-addressed allowlist** regex (no path input — traversal-proof by construction). Mirrors `saveChatAttachment`'s containment assert + the `serveFile` helper + the `/_api/asset` route. **Main-origin only** (stays absent from `CANVAS_SAFE_API` + `startCanvasServer` routes — DDR-054/DDR-088).
2. **Thumbnail render** — in the user bubble, an image chip (live) or a detected `_chat/attachments/<name>` path (reload-from-transcript) renders `<img class="chat-thumb" src="/_api/acp/attachment?name=…">` inside a focusable button instead of the text badge. File/link chips keep the text badge.
3. **Lightbox** — a single fixed overlay (backdrop, ESC, backdrop-click, close button; `role="dialog"`) mirroring the existing `tour/overlay.jsx` overlay idiom, opened via a small context callback the thumbnails call.

## Metadata

- **Type**: New Capability (UI)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (dev-server + native ACP panel)
- **Affected Systems**: ACP chat client (`ChatPanel.jsx`, `acp-runtime.js`), dev-server HTTP/API (attachment serve route), chat CSS
- **Dependencies**: none new (zero-dep server; client already on React/assistant-ui)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `apps/studio/client/panels/ChatPanel.jsx`
  - `chipNodes` + `CHIP_RE` + `classifyPaste` + `IMAGE_EXT_RE` (~L139–196) — how chips tokenize/render **today** (the badge to replace for image chips).
  - `HighlightedInput` `onPaste` + `uploadChatImage` (~L231–236, ~L477–540) — where a clipboard image is uploaded and the chip→path `map` (`attachmentsRef.current.map`) is populated.
  - `UserBubble` (~L296) — renders `chipNodes(text,'ub')`; the render target for thumbnails.
  - `toThreadMessages` (~L831) — transcript → thread messages on reload (user text is a single joined string; see Gotcha on reload path).
  - `ChatThread` (~L833) root — where `activeTools` state + `AssistantRuntimeProvider` live; where lightbox state + the thumbnail-open context provider mount.
- `apps/studio/client/panels/acp-runtime.js`
  - `expandPasteChips` (~L257) — chip→real-path expansion at send (the map is `token → absPath|null`).
  - `makeAcpAdapter` `agent_message_chunk` case (~L300) — only `content.type === 'text'` handled (relevant to the follow-up).
- `apps/studio/api.ts`
  - `saveChatAttachment` (L1044–1082) — the write side: content-addressed `<sha8>.<ext>`, `path.join(paths.designRoot,'_chat','attachments')`, containment assert (L1062), returns **absolute** path. **Mirror its containment for the read helper.**
  - `saveAsset` / `sniffImageType` / `ASSET_MAX_BYTES` — shared caps + magic-byte sniff.
- `apps/studio/http.ts`
  - `/_api/acp/attachment` POST handler (L664–692) — extend for GET; note `sameOriginWrite` gate is POST-only, GET needs the loopback/main-origin posture instead.
  - `serveFile(absPath, headers)` (L465) — the reusable file responder.
  - `/_api/asset` (L1328) — the closest sibling route (image serve/write); copy its shape + comments discipline.
  - CSP `img-src 'self' data: blob:` (L114) — same-origin `<img src>` is allowed (no CSP change needed for v1; `data:` matters only for the follow-up).
  - `CANVAS_SAFE_API` allowlist + `startCanvasServer` routes — the GET route must be in **NEITHER** (privileged, main-origin only).
- `apps/studio/client/styles/6-acp-chat.css`
  - `.chat-paste-chip`, `.chat-ctx`/`.chat-ctx-x` (existing chip + close-button idiom), `.chat-activity*`, and the `prefers-reduced-motion` block (~L988) to extend.
- `apps/studio/client/tour/overlay.jsx` and `apps/studio/client/whats-new.jsx` — existing fixed-overlay patterns (ESC/backdrop) to mirror for `ChatLightbox`.

### Files to Create

- `apps/studio/test/acp-attachment-serve.test.ts` — GET serve-route name-guard (valid content-addressed name → 200; `../`, non-hex, `.svg`, absolute path → 4xx) + canvas-origin gate.
- `apps/studio/test/chat-attachments.test.ts` — pure client helpers (`attachmentName`, `extractAttachmentRefs`) exported from `acp-runtime.js`.
- (No new component file — `ChatLightbox` lives inline in `ChatPanel.jsx`, matching how the panel's other subcomponents are colocated.)

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/ChatPanel.tsx` (`ChatPanel.meta.json`) | `handed-off` | The approved mock for the panel shell/states. It does **not** depict a thumbnail/lightbox — this feature adds new chrome; ground the *shell/tone* (Spark mark, mono labels, token palette) in it, invent only the thumbnail + overlay. |

### Documentation

- ACP `ImageContent` block — `@agentclientprotocol/sdk/schema/schema.json:634` (`type:"image"`, base64 `data` + `mimeType`) — Why: the shape the **follow-up** renders as a `data:` URI.

### Patterns to Follow

- **Content-addressed serve (traversal-proof):** the name is our own `<sha8>.<ext>` — allowlist `^[0-9a-f]{8}\.(png|jpe?g|gif|webp)$`, resolve under the fixed dir, assert containment (copy `api.ts:1062`). Never accept a caller path.
- **Main-origin-only route:** every privileged route documents "absent from CANVAS_SAFE_API + startCanvasServer" (http.ts passim). Do the same; add a `canvas-origin-gate` assertion.
- **Small subcomponent + context callback:** `ChatThread` already provides `AssistantRuntimeProvider`; add a tiny React context (`openLightbox`) so deeply-nested thumbnails open the single overlay without prop-drilling.

---

## Design Decisions

> No `.ai/maude-design-system.md` / `-prd.md` exist in this repo (confirmed absent) — the design system for this surface **is** `client/styles/6-acp-chat.css` + the studio token set. All new styles use tokens; **no hardcoded colors**.

### Components

| Component | Source | Notes |
| --------- | ------ | ----- |
| `ChatLightbox` | new, inline in `ChatPanel.jsx` | Fixed overlay; mirror `tour/overlay.jsx` (ESC/backdrop). `role="dialog"` `aria-modal`. |
| thumbnail button | extend `chipNodes` / `UserBubble` | `<button class="chat-thumb-btn">` wrapping `<img class="chat-thumb" loading="lazy">`. |

### Existing patterns reused

| Pattern | Source | Notes |
| ------- | ------ | ----- |
| chip close-button "×" | `.chat-ctx-x` (6-acp-chat.css / Composer) | reuse glyph + a11y-label idiom for the lightbox close. |
| overlay ESC/backdrop | `client/tour/overlay.jsx` | key-handler add/remove on mount; backdrop click closes. |

### Tokens

| Purpose | Token (existing) |
| ------- | ---------------- |
| Thumb border / radius | `--border` (or `--border-0`), `--radius-*` |
| Lightbox scrim | an existing overlay/scrim token (grep `--scrim`/`--overlay`; else `color-mix` over `--bg-0`) |
| Focus ring | existing `--focus`/`--ring` token used by chat controls |

### A11y

- Thumbnail is a real `<button>` (Enter/Space open), `aria-label="Open pasted image"`, visible focus ring.
- Lightbox: `role="dialog"` `aria-modal="true"`, focus the close button on open, restore focus to the thumbnail on close, ESC + backdrop close, `<img alt>` non-empty.
- Reduced-motion: any zoom/fade collapses via the existing `prefers-reduced-motion` block.

---

## Tasks

Execute in order. Each task is atomic and testable.

### ✅ Task 1: ADD a GET serve branch to `/_api/acp/attachment` (server) — completed

- **Do**: In `api.ts`, add `resolveChatAttachment(name): string | null` — validate `name` against `^[0-9a-f]{8}\.(png|jpe?g|gif|webp)$`, join under `path.join(paths.designRoot,'_chat','attachments')`, run the same containment assert as `saveChatAttachment` (L1062), return the abs path iff the file exists, else `null`. In `http.ts`, make `/_api/acp/attachment` branch on method: keep POST as-is; add **GET** → read `?name=`, call `resolveChatAttachment`, and `serveFile(abs, { 'Content-Type': <by ext>, 'Cache-Control': 'public, max-age=31536000, immutable' })` (content-addressed ⇒ immutable) or `404`.
- **Pattern**: `saveChatAttachment` (api.ts:1044), `serveFile` (http.ts:465), `/_api/asset` (http.ts:1328).
- **Gotcha**: `sameOriginWrite` is a POST/CSRF gate — do NOT apply it to GET; the main-origin posture (route absent from `CANVAS_SAFE_API` + `startCanvasServer`) is the boundary. Keep it that way. Name is the ONLY input and must be regex-allowlisted — never resolve a caller-supplied path segment.
- **Validate**: `bun test test/acp-attachment-serve.test.ts test/canvas-origin-gate.test.ts`

### ✅ Task 2: EXPOSE the attachment reference to the rendered bubble (client) — completed

- **Do**: Export two pure helpers from `acp-runtime.js`: `attachmentName(absPathOrText)` (basename if it matches the attachments path) and `extractAttachmentRefs(text)` → returns ordered segments splitting `text` into plain runs, `[image-N]` chips, and `_chat/attachments/<sha8>.<ext>` path matches. In `ChatThread`, keep a per-chat `Map(chipToken → name)` populated when `uploadChatImage` resolves (basename of the returned abs path); provide it + `openLightbox` via a React context.
- **Pattern**: `expandPasteChips` (acp-runtime.js:257), `chipNodes` (ChatPanel.jsx:145).
- **Gotcha**: **two render paths** — the *live* bubble text holds the chip `[image-N]` (resolve via the map); the *reloaded* bubble text (from transcript, `toThreadMessages`) holds the **expanded absolute path** under `_chat/attachments/` (resolve via `extractAttachmentRefs`). Handle both; when a thumbnail renders from a path match, do **not** also print the raw abs path.
- **Validate**: `bun test test/chat-attachments.test.ts`

### ✅ Task 3: RENDER image chips/paths as thumbnails in `UserBubble` (client) — completed

- **Do**: Replace `chipNodes` usage in `UserBubble` with a renderer that walks `extractAttachmentRefs(text)`: image chip (map→name) OR attachments-path match → `<button class="chat-thumb-btn" onClick={()=>openLightbox(src)} aria-label="Open pasted image"><img class="chat-thumb" src={`/_api/acp/attachment?name=${name}`} alt="pasted image" loading="lazy"/></button>`; file/link chips → existing text chip; plain text → text.
- **Pattern**: `chipNodes` (ChatPanel.jsx:145), `.chat-ctx` chip render.
- **Gotcha**: `src` uses the serve route by **name only**. `loading="lazy"`. Keep the button keyboard-focusable. Guard a still-`null` (pending upload) map entry → fall back to the text chip until the upload resolves.
- **Validate**: manual live (paste screenshot → thumbnail appears in bubble).

### ✅ Task 4: ADD the `ChatLightbox` overlay + open/close wiring (client) — completed

- **Do**: Inline `ChatLightbox({ src, onClose })` — fixed overlay div, backdrop, centered `<img>`, a `×` close button; ESC + backdrop-click close; `role="dialog"` `aria-modal="true"`; focus the close button on open, restore focus on close. In `ChatThread`, hold `lightboxSrc` state, render `<ChatLightbox>` at panel root when set, and pass `openLightbox=setLightboxSrc` through the context from Task 2.
- **Pattern**: `client/tour/overlay.jsx` (ESC/backdrop overlay), `.chat-ctx-x` (close glyph + label).
- **Gotcha**: add/remove the ESC keydown listener on mount only while open; ensure it doesn't collide with the composer's `onKeyDownCapture`. z-index above the panel. Don't lock global scroll.
- **Validate**: manual live (click thumbnail → lightbox opens; ESC/backdrop/× close; focus returns).

### ✅ Task 5: STYLE thumbnail + lightbox (CSS) — completed

- **Do**: In `6-acp-chat.css` add `.chat-thumb-btn` (button reset, inline-block, focus ring), `.chat-thumb` (max-width ~180px, max-height ~140px, `object-fit: cover`, radius + border token, `cursor: zoom-in`, hover), `.chat-lightbox` (`position: fixed; inset: 0`, scrim bg, grid/flex center, z-index above panel), `.chat-lightbox img` (`max-width: 90vw; max-height: 90vh; object-fit: contain`), `.chat-lightbox-close`. Add both to the `prefers-reduced-motion` collapse block.
- **Pattern**: existing `.chat-activity*` + reduced-motion block (6-acp-chat.css:~988).
- **Gotcha**: tokens only — no hex/rgb. Scrim via an existing scrim token or `color-mix(in oklch, var(--bg-0) 80%, transparent)`.
- **Validate**: `npx biome check` on the CSS; visual check.

### ✅ Task 6: TEST — serve-route guard + client ref helpers — completed

- **Do**: `test/acp-attachment-serve.test.ts` — GET valid name → 200 + image content-type; `name=../../etc/passwd`, `name=abc`, `name=x.svg`, missing `name` → 4xx; assert the route is unreachable / 405 from the canvas origin (extend `canvas-origin-gate.test.ts` if that's the established home). `test/chat-attachments.test.ts` — `attachmentName` + `extractAttachmentRefs` over: a chip-only string, an expanded-abs-path string, mixed text, and a non-attachment path (must NOT match).
- **Pattern**: `test/acp-activity.test.ts` (pure-helper style), `test/canvas-origin-gate.test.ts`.
- **Validate**: `pnpm test:dev-server`

### ✅ Task 7: REBUILD the committed client bundle (release) + commit dist — completed (rebuild done; commit pending user confirmation)

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` only (per CLAUDE.md — never ship the dev-unminified self-heal bundles; leave `dist/runtime/*` untouched).
- **Gotcha**: if a test-boot churned `dist/runtime/*`, `git restore` those before committing; stage only your source + the two release artifacts.
- **Validate**: `git diff --cached --name-only` shows only intended files; bundle contains the new class names.

---

## Validation

1. **Lint**: `pnpm lint` (biome) on changed files.
2. **Tests**: `pnpm test:dev-server` (bun) — new serve-guard + helper tests green; full studio suite has no NEW failures (known-flaky export server-boot timeouts are pre-existing and unrelated).
3. **Build**: `pnpm build` (site) unaffected; client bundle rebuilt `--release`.
4. **Live (native panel — per the native-app-verification ceiling):** paste a clipboard screenshot into the composer → thumbnail in the bubble → click → lightbox → ESC/backdrop/× close → focus returns. **Reload the chat** (switch away + back / reopen) → the thumbnail persists (resolved from the transcript's `_chat/attachments/` path).
5. **Web-panel smoke (agent-browser):** same flow at `http://localhost:<port>` to catch DOM/CSS regressions the native shell hides.
6. **Security spot-check:** `curl` the GET route with a traversal `name` → 4xx; confirm the route 404/405s from the canvas origin.

> This is internal studio chrome (desktop + web panel), not a 5-platform product screen — the full `scenario-runner` matrix doesn't apply. Live native + agent-browser web is the right coverage (memory: native-app-verification-ceiling).

---

## Follow-up: agent/skill-sent images (v2 — designed, NOT in this plan's committed tasks)

Promote into the task list if the user opts in. Two layers:

1. **Render ACP `image` content blocks** — in `makeAcpAdapter` (`acp-runtime.js`), handle `content.type === 'image'` on `agent_message_chunk` (and on `tool_call_update` output) by emitting an image part with a `data:${mimeType};base64,${data}` src → same thumbnail + lightbox. CSP already allows `data:` (`img-src … data:`). Cheap once v1's render/lightbox exists.
2. **Emit mechanism** — for a `/design:*` skill to actually *push* a screenshot into chat, the agent/tool must surface a servable reference (write to `assets/` or `_chat/attachments/`, then reference it in a tool result the client detects as an image → thumbnail via the Task-1 serve route). This is the larger, thornier piece.

**Untrusted-render review (DDR-054):** the chat agent is the user's own loopback Claude (trusted), but rendering agent-referenced paths / `data:` images widens what the feed will display. Reuse the same content-addressed allowlist + main-origin discipline; a data: image is inert (no script) but should still be size-capped. **Record a DDR** for the v2 render surface before building it.

---

## Acceptance Criteria

- [ ] All v1 tasks completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (lint/format)
  - [ ] Tests (serve-guard + helpers green; no new suite failures)
  - [ ] Client bundle rebuilt `--release`, only intended dist artifacts staged
  - [ ] Live native: paste → thumbnail → lightbox → close → reload persists
  - [ ] Security: traversal `name` rejected; route off canvas origin
- [ ] No DDR-worthy decision left unrecorded (a DDR is required before the v2 render surface, not for v1)
- [ ] Code follows the ACP panel's conventions; no regressions to the paste-chip/send flow
