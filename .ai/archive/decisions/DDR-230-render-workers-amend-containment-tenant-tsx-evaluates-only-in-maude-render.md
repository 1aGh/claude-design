# DDR-230: Render workers amend containment — tenant TSX evaluates only in `maude-render`

- **Date:** 2026-08-20
- **Status:** Accepted
- **Tags:** cloud, containment, export, render-workers, security, self-host
- **Extends:** DDR-209 (A′1), DDR-193
- **Evidence:** RCA `issue-cloud-studio-export-not-found` (graph: `rca:maude/issue-cloud-studio-export-not-found`)

## Context

DDR-209 A′1: *"No tenant-authored TSX is ever EVALUATED by vendor-operated compute… no browser enters the image."* Under it, every `/_api/export*` surface is pruned from a workspace cell and `REFUSED` by the hub proxy, so the hosted cloud studio — and every self-hosted workspace hub, which runs the same code path (DDR-192 §1) — cannot export anything: PNG, PDF, PPTX, ZIP, MP4 all die with `{"error":"not found"}`. The RCA established this as deliberate, and the debate that followed (browser-side export in the member's tab vs an external render worker) ended with the owner ratifying the worker: pixel-exact CDP fidelity, Safari coverage, the existing background-job UX, and zero second implementation of the exporter spine all favor a service; the browser-side lane's `foreignObject` rasterization is lossy exactly where a design tool cannot afford it.

## Decision

Tenant TSX MAY be evaluated by vendor-operated compute **only** inside the dedicated `maude-render` service, under this contract:

1. **No secrets.** The render image and its environment hold no `HUB_SECRET`, no `CELL_SECRET_MASTER`, no provider keys, no tenant store, no control-plane credentials. There is nothing in the process worth escaping Chromium for.
2. **Single tenant per invocation.** One job renders one project's content; no cross-job state survives (stateless per job, teardown after).
3. **Scoped ingress and egress.** Ingress is authenticated with `MAUDE_RENDER_SECRET` (shared between the dispatching cell/hub and the service). The worker reaches the tenant's canvas ONLY through a `mintRenderToken` capability (viewer role, subject `render-service`, 15-minute TTL — the exact grant the member's own canvas iframe holds, `apps/hub/src/render-token.mjs`), against the canvas-origin surface the member's browser already consumes. No mutation surface is reachable with it.
4. **The cell and hub images stay browser-free.** `FORBIDDEN_MODULES`, the Dockerfile assertion, the entrypoint re-check and `scripts/check-containment.sh` are untouched. A cell still *cannot* render; it can only enqueue and dispatch.
5. **In-cell, a render is always a JOB.** The synchronous `POST /_api/export` stays `REFUSED`/pruned. The job lane (`/_api/export-jobs`, `/_api/export-jobs/download`, `/_api/export-history`) escapes the `/_api/export` forbidden prefix via an explicit exact-path `except` list (`workspace-mode.ts`) — an unlisted future `/_api/export-*` route stays forbidden by default. Browser-free formats (zip) run in-cell; a cell with no render service configured (`lane none`) refuses browser formats with a remedy, never a 404.

Precedent: Cloud Phase 25 A0 amended the same invariant once before, for the bounded canvas-build sandbox. The invariant's real threat model — tenant code executing next to secrets and other tenants — is preserved: the evaluation moves to a process that holds neither.

## Alternatives rejected

- **Browser-side export (member's tab).** No invariant amendment and free self-host parity, but: lossy PNG/PDF (`foreignObject` rasterization), Chromium-only video (`renderMediaOnWeb`/WebCodecs — a Safari member could not export video at all), no background jobs (tab must live), and a permanently divergent second capture path — the DDR-209 A′2 anti-pattern. Remains a candidate for a later "instant preview-quality" lane.
- **Loosening the `/_api/export` prefix to exact-match.** Would silently allow any future `/_api/export-*` route in cells; the `except` list keeps deny-by-default.
- **Cloudflare Browser Rendering API.** A puppeteer endpoint, not a place our exporter spine runs unchanged; session/time limits bite long MP4 renders. A container image with `chrome-headless-shell` + Bun mirrors the desktop spine exactly.

## Security review (2026-08-21) — findings folded in

An adversarial review (defender + attacker) ran against the implementation before rollout. Fixed in-diff:

- **SSRF via the canvas-origin allowlist (HIGH).** The origin matcher tested the raw request string, which `new URL()` then reinterpreted — `https://canvas-x@169.254.169.254#.cloud.maude.sh` (userinfo + fragment) passed a raw prefix/suffix test yet resolves to the metadata IP. Fixed: parse first, reject embedded credentials, match the parsed `scheme://host` only, and the `*` wildcard stands for one hostname-label run (`[a-z0-9-]+`) — no dot, no delimiter. The token-proxy fetch is also `redirect: 'error'` (a 3xx was the second SSRF lane).
- **Write-capable forwarded token (MEDIUM), now §c-conformant.** The cell forwards a **dedicated viewer-scoped** render token (`x-maude-render-token`, minted `role: 'viewer'` in the hub proxy) — never the member's own `x-maude-canvas-token`, which carries their project role and opens the canvas origin's HTTP write lanes. The worker reads; it holds only read.
- **Untrusted artifact metadata (MEDIUM).** The render service's `x-maude-filename` response header has two sinks in the cell — a `Bun.write` path and a `Content-Disposition` header — so it is reduced at the trust boundary to a strict-charset basename (`[A-Za-z0-9._-]`), closing both path traversal and header injection. The artifact body is read with a hard byte cap (streaming counter) so a hostile worker cannot OOM the cell.

Accepted for v1, with mitigation + a named follow-up:

- **Cross-tenant render DoS (MEDIUM).** The fleet render container is a singleton; one wedging comp could hold capacity until the cell aborts. Mitigated by `MAX_CONCURRENT` (default 2) + a 503-when-full queue; genuine per-tenant fairness (sharding by job across N named instances) is the follow-up lever.
- **Single fleet-wide ingress bearer on a publicly-reachable worker (MEDIUM).** Bounded: the worker holds no secrets and fetches only allowlisted canvas origins, and a leaked bearer alone renders nothing — every job also needs a valid, short-lived, viewer-scoped render token to get any canvas bytes back. Moving ingress to a Cloudflare Worker-to-Worker service binding (no public route) is the follow-up hardening.

## Consequences

- New deployable: `apps/render/` (own Worker + container class on Cloudflare for the managed fleet; optional `maude-render` sidecar image for self-hosted hubs — the hub dispatches when `MAUDE_RENDER_URL` is set and the UI states the reduced surface when not).
- `exporters/jobs.ts` gains the render-lane dispatch (`local` | `remote` | `none`); the exporter adapters themselves are unchanged — that reuse is the point.
- The rollout is gated by an adversarial security review (token replay, `canvasBase` SSRF, artifact-stream poisoning, Chromium escape, misconfiguration lanes) before any fleet deploy.
