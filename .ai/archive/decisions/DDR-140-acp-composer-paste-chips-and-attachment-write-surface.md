# DDR-140: ACP composer paste-chips + clipboard-image attachment write surface (+ reveal mitigation)

- **Date:** 2026-07-02
- **Status:** Accepted (shipped — extends `phase-31-native-collab-acp-sidepanel`)
- **Tags:** dev-server, acp, chat-composer, paste, attachments, canvas-origin, security, auto-approve, prompt-injection, runtime-state
- **Related:** [DDR-123](./DDR-123-native-acp-chat-sidepanel-on-user-subscription.md) (the ACP panel + auto-approve posture this touches), [DDR-088](./DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the `/_api/asset` write surface + caps this mirrors), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (`_chat/` runtime-state taxonomy), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas-origin trust → main-origin-only writes; the untrusted-canvas + `clipboard-write` grant behind the residual risk).

## Context

The ACP composer (DDR-123) took plain text and drove the user's own auto-approving `claude`. Three gaps surfaced in dogfood: (1) `Cmd+C`/`Cmd+V` were dead in the native app; (2) Enter didn't send; (3) a pasted path/URL — or a clipboard **image** (a screenshot has no path) — landed as raw text, when it should collapse to a compact badge like Claude Code's `[Image #1]`.

(1) and (2) are plain fixes (see the commit). This DDR records the **paste-chip model** (3) and the **new file-write surface** it needs, plus the security interaction the review surfaced.

## Decision

### 1. Paste chips: literal token in the textarea, real value in a per-chat map, expand on send

A pasted lone path/URL, or a clipboard image, collapses to a short literal token — `[image-N]` / `[file-N]` / `[link-N]` (image by extension, else `link` for URLs / `file` for paths). The token is the *actual* text in the `<textarea>`, so the existing mirror-overlay renders it as a chip with **no glyph-advance change** (same discipline as the `.chat-cmd-pill`), and the caret stays aligned. The real value lives in a per-chat `attachmentsRef = { map, pending }`; the ACP adapter (`acp-runtime.js`) **expands** each token back to its real value before the prompt reaches `claude` (`expandPasteChips`). Numbering scans the current text so deletes renumber back down.

- **Text pastes** (path/URL) resolve synchronously.
- **Clipboard images** have no path: the chip inserts synchronously, the bytes upload in the background, and the map entry fills on return. `pending` holds the in-flight promises; the adapter awaits them (`Promise.allSettled`) before expanding, so a fast Enter never sends a literal `[image-N]`.

### 2. New write surface `POST /_api/acp/attachment` → `_chat/attachments/` (absolute path)

Clipboard image bytes need to reach disk so the chip can point Claude at a file to `Read`. Rather than reuse `/_api/asset` (versioned `assets/`, canvas-origin), a **sibling** `api.saveChatAttachment` writes under the **runtime** `<designRoot>/_chat/attachments/<sha8>.<ext>` (gitignored — DDR-115; ephemeral, co-located with the chat transcripts, not canvas media) and returns an **absolute** path (Claude runs with its own cwd; a project-relative string could miss). Same load-bearing caps as `saveAsset` (DDR-088 Task 9): magic-byte sniff → `{png,jpg,gif,webp}` only (**SVG rejected** — script-bearing vector), 10 MB, content-addressed name (no user path segment), **shared** session write budget (`assetBytesWritten` — one budget bounds both routes jointly). The route is **main-origin only**: `sameOriginWrite` CSRF gate **and** deliberately absent from `CANVAS_SAFE_API` + `startCanvasServer` routes → the untrusted canvas iframe is 403'd (the dual-allowlist rule). A `GET → 405` / canvas-origin `→ 403` / cross-origin-POST `→ 403` assertion lives in `test/acp-origin-gate.test.ts`.

### 3. Reveal strip — a chip must never hide what it sends (security)

The adversarial review found a real client-side hole (not in the endpoint, which is a clean `saveAsset` sibling): a chip **collapses the value the user can't then see**, and on Enter it expands verbatim into the **auto-approving** agent. Because an untrusted peer canvas is granted `allow: 'clipboard-write'` (DDR-054 split, `app.jsx`), it can *seed* the clipboard (`~/.aws/credentials`, `http://169.254.169.254/…`); the user pastes, sees only `[file-1]`, hits Enter, and `claude` auto-approves the resulting `Read`/`WebFetch`. This is exactly the "don't widen the auto-approve reach" precondition DDR-123 set.

**Mitigation (shipped):** the composer renders an **attachment reveal strip** listing each chip → its real value **before send** (`[file-1] → ~/.aws/credentials`), so display == dispatched — the human-in-the-loop gate the auto-approve posture depends on is restored. `submitMode="enter"` stays (the value is now visible next to the send affordance).

**Residual (accepted, unchanged posture):** the auto-approve model itself is the pre-existing bounded risk. The proper fix remains a per-action **approve/deny UI** in the ACP bridge (DDR-123 follow-up) before the panel's reach is widened to hub/multi-user; this DDR does not add that. Optional hardenings deferred: a separate (smaller) write budget + eviction for `_chat/attachments/`; dropping `clipboard-write` on peer-pushed canvases; a hover/title reveal on the sent-transcript bubble.

## Consequences

- One new main-origin write route; caps + origin gates mirror the audited `/_api/asset` (defender review: 0 blockers).
- `_chat/attachments/` joins the runtime-state trio already in lockstep (`.gitignore` / `gitignore-block.mjs` / `isMaudeRuntimeState`) — no list change needed (`_chat` was already covered).
- The reveal strip is the load-bearing control for the paste feature: **never let a chip collapse a value without surfacing it before an auto-approved send.** A future "attach file" affordance must reuse it.
