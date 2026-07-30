# Cloud Phase 17 — Desktop attach: maude:// deep link + the invite's client half

> **Status 2026-07-30 — deliberately still open; the one remaining cloud
> phase that is buildable.** Everything server-side it depends on now exists:
> invites send a real email with one link (Phase 22), the share view is the
> phone fallback (Phase 18), and a browser signs into the project through the
> dashboard. What remains is genuinely DESKTOP work: protocol registration in
> the signed .app (only testable in a bundled build, not `tauri dev` — the
> scheme registers at install), the attach flow UI, and an acceptance gate
> that requires a HUMAN (the timed club-member cold start). Per the
> native-app verification ceiling, half-shipping Rust changes into the signed
> shell at the tail of a long autonomous run is the wrong trade — this phase
> wants its own focused session with a full build + notarize + E2E cycle.

> The invite currently dead-ends on a phone at "install a desktop app" — the
> persona the arc is staked on (DDR-193 §5) converts to zero. This phase builds
> the desktop half; the browser fallback ("keep looking in the browser") is
> Phase 18's share view, and the invite email always offers BOTH.

## Tasks

- [ ] T1 — `maude://` protocol registration in the Tauri app (macOS Info.plist +
  Windows registry via tauri.conf); handler parses `maude://join/<workspace>/<invite>`
  and `maude://open/<workspace>/<project>`.
- [ ] T2 — attach flow: deep link → sign-in (magic link / existing session) →
  clone/attach the remote project into a local folder → open in Studio. Reuses
  `signInToWorkspace` + `workspaceDisclosure` (Phase 3) — the disclosure panel
  shows BEFORE the first sync.
- [ ] T3 — deferred-link survival: invite clicked before the app is installed
  must survive the install (download page carries the payload; app checks it on
  first run). "Keep looking in the browser" is always present as the fallback.
- [ ] T4 — **viewer role + AI-less dignity** (USER-ADVOCATE): a member without a
  Claude subscription gets a first-class read/comment/edit state with no dead
  menus and a plain-language explanation of what works and why.
- [ ] T5 — desktop-e2e scenario `workspace-attach` (DOM-driven, data-testid per
  house rules) covering deep link → disclosure → canvas visible.

## Acceptance criteria

- [ ] Fresh machine: click invite → install → app opens the right project with
  zero manual configuration.
- [ ] The timed real-human cold start (one club member, phone + laptop, no help,
  no terminal) is RUN and its time recorded — the alligators pilot gate.
