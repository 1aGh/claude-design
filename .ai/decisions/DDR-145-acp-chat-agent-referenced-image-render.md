# DDR-145 — ACP chat: render agent-referenced designRoot images as thumbnails

**Status:** accepted
**Date:** 2026-07-03
**Relates:** feature-acp-chat-image-thumbnails-lightbox (v1 = user-pasted images; its plan required a DDR before any v2 render surface), DDR-054 (canvas-origin trust split), DDR-088 (media vocabulary + serve discipline), DDR-123 (the chat agent is the user's own loopback `claude`)

## Context

v1 shipped thumbnails + a lightbox for **user-pasted** images (`_chat/attachments/` chips). Immediately in dogfood, the user hit the obvious next gap: `/design:screenshot` replies "Saved to: `.design/_history/…/001-smoke.png`" — and nothing renders. Expectation: the assistant mentioning an image ⇒ see the image.

The v1 plan deferred agent-sent images because the general mechanism (ACP `image` content blocks + a skill emit path) needs its own design. But the dominant real case is much narrower: **the assistant's text already contains a path to an image that the main origin already serves** (the repoRoot/designRoot static fall-through with `safePathUnderRoot` containment, `X-Content-Type-Options: nosniff`). No new server surface is needed at all.

## Decision

Render-only client slice: `designImageRefs(text, designRel)` (pure, `acp-runtime.js`) scans **assistant** bubble text for image paths under the project's `<designRel>/` and `ChatText` renders them as a thumbnail strip under the markdown (same `ChatThumb` button + shared `ChatLightbox` as v1). The path stays visible in the text; the strip only adds the preview.

Guardrails (all load-bearing, tested in `test/chat-attachments.test.ts`):

- **Containment by construction** — only tokens under `<designRel>/` map to URLs (`/<designRel>/…`); the served lane is the existing static fall-through with its `safePathUnderRoot` clamp. Nothing outside designRel ever renders; `not-<designRel>/` lookalikes are rejected (prefix must be a path segment).
- **Raster only** — `png|jpe?g|gif|webp`; SVG stays excluded (scriptable) exactly like the attachment serve route.
- **Cap 6 per message, deduped** — bounds a hallucinated/hostile wall of paths (transcript text can embed tool output — indirect-injection surface).
- **Render-only** — an `<img>` + button; no fetch of content into the DOM as markup, no `dangerouslySetInnerHTML`, React escapes the text lane.

`designRel` flows from the existing `/_config` load in `app.jsx` (`cfg.designRel`, default `.design`) via a `ChatPanel` prop into `ChatMediaContext` — custom design roots work; a missing value degrades to no thumbnails, never to a wrong fetch.

## What this deliberately does NOT do (still the v2 backlog)

- **ACP `image` content blocks** (base64 `data:` URIs on `agent_message_chunk` / `tool_call_update`) — still unhandled; needs a size cap decision.
- **A skill emit mechanism** (a `/design:*` command *pushing* an image into chat as a first-class part) — the thornier layer; unchanged.

Both remain gated on their own review per the v1 plan's follow-up section.

## Security fan-out (defender + attacker, 2026-07-03)

Two defenders + one attacker over the working-tree diff. Findings at/above the `medium` floor were fixed before commit:

- **A9 / F-traversal (MEDIUM, FIXED)** — `designImageRefs` admitted `.` `/` `%` `\` in the path body, so `.design/../../etc/x.png` collapsed to `/etc/x.png` in the browser (`..%2f` decoded server-side; `..\..\` rewritten `\`→`/` by WHATWG *after* a naive guard — the attacker's re-run finding), silently widening the fetch surface from designRel to the whole repoRoot. The server's `safePathUnderRoot(repoRoot)` was the only real backstop — the client guarantee was illusory. **Fix:** ALLOWLIST the canonical form, don't blocklist spellings — reject any `%`, then require `new URL(url).pathname` to be byte-identical to the emitted URL AND still under `/rel/` (so `..`, `..\`, `%2f`, and mixed spellings all drop). Backslash + percent + dot-segment regression tests (`chat-attachments.test.ts`).
- **F1 (MEDIUM, FIXED)** — the v1 attachment GET `serveFile` lacked `X-Content-Type-Options: nosniff` that its sibling static lane sets, serving *uploaded* bytes on the privileged main origin. **Fix:** nosniff added to the attachment GET response.
- **F2 (MEDIUM, MITIGATED)** — auto-rendering an image an *assistant message* named lends the chat feed's authority to arbitrary designRoot imagery (an injected assistant could paint a forged "✅ deploy succeeded" screenshot). **Mitigation:** referenced-path thumbnails carry a monospace filename caption (`chat-thumb-fig`/`chat-thumb-cap`) marking them as "a file that was referenced," distinct from first-class pasted media; the path also stays visible in the bubble text. Full first-class-vs-referenced media affordance stays a product follow-up.
- **F4 (LOW→hardened)** — the empirical scan was already linear (2 ms worst-case), but the regex quantifiers were bounded (`{0,256}`/`{1,256}`) so a hostile long token can't drive backtracking regardless.

**Below-floor, tracked (NOT fixed here):**
- **F3 (LOW)** — `_chat/attachments/` names are 32-bit `sha8` + `immutable` 1-year cache: a birthday collision (2³² offline) pins the wrong image. Widen to ≥16 hex (or drop `immutable` + assert byte-equality on skip-if-exists) if attachments ever cross the hub boundary. Local-only today.
- **F5 (LOW)** — `resolveChatAttachment` containment is lexical (`path.resolve`), not `realpath`; a symlink under `_chat/attachments/` would be followed. Requires local/agent file-write (already implies read); `_chat/` is per-user runtime (not hub-synced, DDR-115), so no remote path.

Reports: `.ai/logs/security-reviews/{ddr-145,feature-acp}-image-thumbnails-defender.md`.

## Consequences

- `/design:screenshot` (and any agent reply naming a designRoot image) now previews inline in the desktop chat feed; click → lightbox.
- The thumbnail strip is additive under the bubble — transcripts and the markdown lane are untouched, so reload renders identically (same text in ⇒ same refs out).
- If a future designRoot serve hardening narrows the static lane, the strip degrades to broken-image icons, not to a privilege change — the client holds no serving authority.
