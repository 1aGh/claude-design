# DDR-075: canvas activity overlay is fs-watch-driven (agent-agnostic), file-level first

- **Date:** 2026-06-02
- **Status:** Accepted
- **Tags:** design, dev-server, canvas-lib, ws, hmr, overlay, motion, a11y, phase-13
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun-native server + bun:test), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md) (canvas-lib single source — no `_lib/` shadow), [DDR-029](./DDR-029-annotation-overlay-portal-into-world.md) (world-coord overlay portal precedent), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas-origin trust model / `canvas-hmr` socket), [`.ai/plans/phase-13-canvas-activity-overlay.md`](../plans/phase-13-canvas-activity-overlay.md)

> **Numbering note:** the Phase 13 plan reserved "DDR-029" for this decision, but DDR-029 was already taken (annotation overlay portal) by the time the plan executed and the register had advanced to DDR-074. This decision is filed as **DDR-075**; the plan's acceptance criteria referring to "DDR-029" mean this record.

## Context

Phase 13 adds a live "agent works here" indicator: when a canvas file under `<designRoot>` changes, every open canvas iframe shows a pulsing rim + corner badge on the affected artboard(s) while edits land, then fades. The goal is to let a designer follow an agent's iteration (`/design:edit`, `/design:new`, an external editor, a script) without alt-tabbing to the terminal.

Several design forks had to be settled:

1. **How does the client learn an edit is happening** — push a signal from the agent (`/design:edit` emits "I'm editing X"), or derive it server-side from filesystem events?
2. **How long does "active" persist** after the last write before the overlay fades?
3. **What's the highlight granularity** — whole file, per-artboard, per-element?
4. **Where does the overlay's CSS live**, given the overlay renders inside the canvas iframe (a separate document from the dev-server UI)?

## Decision

### (a) fs.watch-driven, not agent-push

The tracker (`activity.ts`) subscribes to the dev-server's existing `fs:any` bus event (emitted by `fs-watch.ts` on every save) and filters for canvas-shaped files. It does **not** depend on any agent-side push protocol.

**Why:** agent-agnostic by construction. `/design:edit`, `/design:new`, a manual editor save, `git checkout` of a canvas, or a codemod script all emit the same `fs:any` and therefore light up identically. There is no protocol to version, no slash-command coupling, and no way for the overlay to disagree with what's actually on disk. The alternative (each writer announces its own activity over WS) would only cover the writers we taught to announce, would drift from disk truth, and would need a new message contract maintained on both ends.

The cost — we can't attribute *who* is editing (the fs event carries no author) — is acceptable: the overlay answers "what's changing right now," not "who changed it." (Author attribution already exists separately via the Phase 8 `ai-activity` banner.)

### (b) 3000 ms idle debounce

A file flips `active` on its first `fs:any` and back to `idle` after **`ACTIVITY_IDLE_MS = 3000`** of fs silence; the client then cross-fades the overlay out over **200 ms** (`ACTIVITY_FADE_MS`).

**Why 3 s:** an `/design:edit` turn is a *burst* of Edit/Write tool calls separated by seconds of agent "thinking," not one atomic write. A short debounce (e.g. 500 ms) would strobe the overlay on/off between writes within a single turn; a long one (e.g. 10 s) would leave a stale "editing" rim long after the agent moved on. 3 s comfortably bridges intra-turn gaps while clearing promptly once a turn ends. The constant is exported and the pulse period is a CSS var (`--mdcc-activity-pulse-ms`, default 1200 ms) so demos / video capture can retune without code changes.

### (c) file-level MVP; per-artboard behind a regex diff, never element-level

The shipped default highlights **every artboard in the changed file** (file-level). A best-effort refinement (`diffArtboardIds`) reads prev-vs-current file text and, when the change is cleanly confined to one or more `<DCArtboard id="…">` bodies (nothing outside them changed, markers parse unambiguously), narrows the highlight to those artboards and the badge reads `editing — <file>:<artboard>`. Any ambiguity falls back to file-level. Element-level highlighting is explicitly **out of scope** ("artboard stačí" — user).

**Why regex, not AST:** a TSX AST diff would mean pulling in `@babel/parser` / a TS parser as a new dependency for a cosmetic, best-effort hint — against DDR-009's stay-lean spirit. A regex-bounded region diff is sufficient for the fidelity bar (DCArtboards aren't nested in practice) and degrades safely to file-level whenever it's unsure. The read is async + debounced (never blocks the synchronous `mark()`), and the prev-text stash is LRU-capped at 50 files.

### (d) overlay CSS injected via `inspect.ts:injectInspector`, broadcast over `broadcastHmr`

The overlay's styles (`.dc-activity-rim`, `.dc-activity-badge`, the pulse `@keyframes`, the `prefers-reduced-motion` fallback) are appended to the single `<style>` block that `inspect.ts:injectInspector()` already injects into every served canvas shell — **not** shipped as a separate CSS file or added to the dev-server UI's `app.jsx`.

**Why:** the overlay renders *inside the canvas iframe*, which is a different document from the outer dev-server UI. `injectInspector` is the one place that already owns iframe-scoped chrome CSS (the comment-pin layer), so reusing it keeps the canvas iframe self-contained with a single injection point and no extra HTTP fetch. Rules are `html …`-scoped so canvas-page stylesheets can't clobber them.

Relatedly, the `activity:change` → WS forward in `ws.ts` uses **`broadcastHmr`**, not the privileged `broadcast`: with the default canvas-origin split (DDR-054) the canvas iframe holds a `canvas-hmr` socket, not an inspector socket, so only `broadcastHmr` reaches it. The WS-open snapshot also seeds `activity.state` for inspector-origin tabs that open mid-edit.

> **Security residual — accepted, with a follow-up (added 2026-06-02 after the `/flow:validate` adversarial pass).** `broadcastHmr` fans out **unscoped**: every `canvas-hmr` socket (including the segregated, DDR-054-potentially-untrusted canvas origin) receives **every** canvas's `{file, status, artboard_ids, ts}` — not just its own. The client filters by `currentKey`, but the raw stream is readable by any JS on that socket. An earlier draft of this DDR claimed this "widens no trust boundary — same low-sensitivity class the `canvas-hmr` feed already carries." **That was an overstatement.** The plain HMR feed carries the *changed* file's path so the receiving iframe can decide whether to reload itself; the activity feed additionally exposes (a) `artboard_ids` — interior structure the HMR feed never exposed — and (b) a continuous active/idle **edit-timing oracle** (~50 ms resolution). For the **default solo user the canvas origin runs only their own canvases, so there is no untrusted reader** and the residual is moot. It becomes a real (still low-severity, read-only metadata) recon channel **only** under the gated, opt-in untrusted-synced-hub threat (DDR-054/DDR-060: requires `maude design link <hostile-url>` + per-canvas `syncable: true`) — where it *augments* the pre-existing hostile-JSX-execution chain rather than creating a new sink (no write/exec sink on the activity path; the fs→WS→CustomEvent→React lane is XSS-clean — React-escaped text, JSON-encoded transport, static injected CSS). **Accepted for this phase; not a blocker (below the medium severity floor, both validate security agents PASS).** **Follow-up (tracked):** scope the canvas-origin activity payload to the recipient's own canvas (carry the slug at `canvas-hmr` upgrade time, mirroring the collab socket), or strip `artboard_ids` + coarsen `ts` from the canvas-origin variant. Logged in `.ai/logs/security-reviews/`.

### Motion / a11y compliance

The primary "editing" indicator is the **agent-colored border** (Phase 13.3, after several rounds of tuning — a top→bottom scan beam was rejected as "too forceful", then a base-wash+blurred-beam, then a bottom-fade wave whose breathe was imperceptible): a clear `2.5px` border in the active `--mdcc-activity` color with a softly **breathing glow** (`::after` box-shadow, opacity-only — compositor — looping 0.4↔0.85). To keep the outward glow from being clipped, `overflow:hidden` lives on the child wash, not the rim. Behind the border, **one full-artboard wave flows top→bottom** (`.dc-activity-scan::after`: a single `linear-gradient(to top, --mdcc-activity ~20% → transparent)` — a SHARP bottom edge fading up to 0 at the top, `height:135%` (a bit taller than the artboard, so the fade is stretched/fuller) — animated transform-only `translateY(-100% → 100%)` `linear` (~3.8 s), so the sharp edge enters at the top, the whole wave travels straight down and off past the bottom edge, then the next wave enters from the top in a loop). This was iterated through several rejected variants (a top→bottom scan beam "too forceful"; base-wash + blurred beam; an in-place rising/falling tide that "just bounced"; a repeating-gradient flow that "looked like a beam again" and started mid-height) before landing on this single hard-edged descending wave. It is an ambient "live indicator" loop (flow:motion-rules §9): `prefers-reduced-motion: reduce` drops the breathe to a static glow, and the loop is unmounted the moment the file goes idle (flow:motion-rules §5 — infinite-with-control). The overlay is `aria-hidden` decorative chrome with `pointer-events: none`, suppressed in `hide-chrome` / export captures, and inherits the active `--mdcc-activity` color so under an agent (DDR-078) the border + wash glow in the agent's own hue. The badge label is unchanged.

## Consequences

- **Positive:** works for any writer; zero new deps; self-contained iframe injection; safe degradation (file-level fallback, reduced-motion, idle fade); reuses the existing bus + WS plumbing (one new bus event, one new WS message type, additive).
- **Negative / accepted:** no author attribution from the fs path; per-artboard diff is heuristic (regex), so an unusual TSX shape silently falls back to file-level — acceptable because file-level is always correct, just coarser; `canvas-hmr` sockets get no snapshot seed (overlay is ephemeral, live broadcasts suffice); **unscoped activity fan-out is a low-severity recon residual under the gated untrusted-hub threat — see the security note in §(d), follow-up tracked.**
- **Tested:** `activity.test.ts` (classifier + transitions + region diff), `use-canvas-activity.test.tsx` (reducer + key normalization + provider gating), `artboard-activity-overlay.test.tsx` (render contract). Server is Bun-native (`Bun.file`, `setTimeout`); tests are `bun:test`.
