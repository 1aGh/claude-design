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

- [x] T1 — ✅ 2026-07-30: `maude://` registered via tauri-plugin-deep-link
  (tauri.conf.json `plugins.deep-link.schemes` → Info.plist / registry at
  bundle time; dev never registers, by platform design). Handler shape
  changed from the plan: the shipped link is `maude://open/<project>?code=…`
  — a **one-time handoff code** (Phase 23 B3), not a workspace/invite pair,
  so the URL never carries anything an attacker could replay. `join/…` is
  not minted anywhere yet — it lands with the invite-email deep link later,
  on the same code shape. Trust posture: Rust only PARKS the untrusted URL
  (state + event); nothing moves without the person clicking Connect, and
  the code exchanges ONLY against the app's configured cloud address.
- [x] T2 — ✅ attach flow: deep link → confirm → one-time code → project
  token → cell exchange → `linkedHub` + credential — the exact state
  `maude design link` writes; the studio picks the link up on next server
  start. Sign-in is the Phase 23 C device flow (already shipped);
  `workspaceDisclosure` stays available on the link surface. NOTE the honest
  scope cut: the flow attaches the CURRENTLY OPEN project; "clone into a
  fresh local folder from nothing" remains the project-switcher's job.
- [x] T3 — partial, honest: the launch page + connect page both carry
  "Download Maude, then come back and press the button again" (the code is
  re-mintable in one click, so re-press IS the survival story). A
  payload-carrying download page (install-time attribution) was NOT built —
  it is machinery for a case one extra click already covers. The browser
  fallback is always present (share view + workspace address).
- [x] T4 — ✅ viewer dignity: a viewer-role project in the CloudBar picker
  gets a working "View <name> in the browser" door (share view) instead of a
  Connect that would be refused, with the why in plain words. AI-less
  dignity was already shipped by the disclosure panel's aiAvailable row
  (Phase 3).
- [x] T5 — ✅ e2e green 2026-07-30 (`pnpm test:e2e:desktop:cloud`, 4/4 in the
  real WKWebView): deep-link confirm strip + code attach covered via the
  same Tauri event the Rust handler emits. OS-level scheme registration
  itself is only testable in a signed bundled app → folded into the DDR-177
  release smoke.

## Acceptance criteria

- [x] Machinery: click "Open in Maude" → app asks → opens the right project
  with zero manual configuration (e2e-proven against the stubbed plane;
  live lane verified end-to-end via curl at every hop).
- [ ] **OWNER GATE (the one human item):** the timed real-human cold start
  (one club member, phone + laptop, no help, no terminal) is RUN and its
  time recorded — the alligators pilot gate. Machinery is ready for it.

## Retro (2026-07-30)

- Phase 23's one-time-code shape made this phase small: the deep link is a
  claim ticket + the already-shipped attach tail, not a new auth lane.
- The e2e bundle must never register the real `maude` scheme —
  LaunchServices would route real links into the throwaway debug app
  (caught at design time, `maude-e2e` in tauri.e2e.conf.json).
- Deep links are untrusted input end to end: park → ask → exchange against
  config only. A drive-by page can at most pop a question.
