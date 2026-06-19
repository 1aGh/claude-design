# Design Decision Records

Permanent log of architectural and product decisions for md-claude. Each DDR is a standalone markdown file following the template in `plugins/flow/commands/record-ddr.md` (installed as `/flow:record-ddr`).

## Index

> Append-only. Newest at the top.

<!-- DDRs go here, format:
- [DDR-NNN: Title](DDR-NNN-title.md) — YYYY-MM-DD, tags
-->
- [DDR-117: Presentation Mode + the shell↔canvas chrome-visibility bridge (non-destructive overlay, dgn:view-chrome)](DDR-117-present-mode-chrome-visibility-bridge.md) — 2026-06-19, dev-server/studio/present-mode/postmessage/chrome-visibility/minimap/zoom/ddr-054/view-only
- [DDR-116: In-UI merge-conflict resolution via a side-picking mergeDriver (two-parent merge commit, "keep both" = copy)](DDR-116-in-ui-merge-conflict-resolution.md) — 2026-06-19, native-app/git/merge-conflict/isomorphic-git/mergedriver/diffview/zero-loss/phase-28/e3

- [DDR-115: Per-user camera split out of versioned canvas meta + one canonical runtime-state taxonomy](DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) — 2026-06-18, dev-server/canvas-meta/viewport/camera/runtime-state/gitignore/taxonomy/changes-panel/git-hygiene

- [DDR-114: GitHub identity implementation — OAuth App (device flow) boundary, hand-rolled REST, loopback token bridge](DDR-114-github-oauth-app-implementation-boundary.md) — 2026-06-18, native-app/github/oauth/device-flow/octokit/keychain/security/phase-28/e3
- [DDR-113: Visual diff renders the "before" by building the canvas at a git ref (`?sha=`)](DDR-113-visual-diff-historical-render.md) — 2026-06-18, native-app/git/visual-diff/canvas-render/security/dos/phase-27/e2
- [DDR-112: Staging model — simplified "select files to save", no git index](DDR-112-simplified-staging-model.md) — 2026-06-17, native-app/git/staging/commit/vocabulary/phase-27/e2
- [DDR-111: Managed projects directory — `~/Documents/Maude Projects/`](DDR-111-managed-projects-directory.md) — 2026-06-17, native-app/git/projects-dir/gitignore/phase-27/phase-28/e2/e3
- [DDR-110: Three-lane collaboration model (git lifecycle + hub co-edit + ephemeral) + non-technical mental model + repo/branch IA](DDR-110-three-lane-collaboration-model.md) — 2026-06-16, native-app/collaboration/git/yjs/hub/vocabulary/phase-27
- [DDR-109: Native-shell security model (loopback sidecar, strict CSP, deep-link allowlist, keychain secrets)](DDR-109-native-shell-security-model.md) — 2026-06-16, native-app/security/tauri/csp/sidecar/keychain/deep-link/phase-26
- [DDR-108: GitHub auth — OAuth "Sign in with GitHub" (device/PKCE) → OS keychain](DDR-108-github-auth-oauth-device-flow.md) — 2026-06-16, native-app/auth/github/oauth/keychain/phase-28/e3
- [DDR-107: Git engine — isomorphic-git (pure-JS), detect-and-prefer system git](DDR-107-git-engine-isomorphic-git.md) — 2026-06-16, native-app/git/isomorphic-git/zero-setup/phase-27/dependencies
- [DDR-106: Tauri v2 native-shell architecture (apps/studio relocation, sidecar lifecycle, binary→triple naming, CSP)](DDR-106-tauri-v2-native-shell-architecture.md) — 2026-06-16, native-app/tauri/shell/sidecar/csp/phase-26
- [DDR-105: Phase 12.2 — source-write surface hardening (JSX-attribute escaper consistency + CSRF Origin guard on the edit-* routes)](DDR-105-css-panel-write-surface-hardening.md) — 2026-06-12, dev-server/security/csrf/escaping/source-write/edit-attr/edit-css/edit-text/trust-boundary/ddr-054-followup
- [DDR-104: Phase 12.2 — CSS-panel UX model (hybrid vocabulary, curated tier + custom-attributes escape hatch, token-first, DOM-authored value source)](DDR-104-css-panel-ux-model.md) — 2026-06-11, dev-server/inspector/css-panel/ux/design-tokens/vocabulary/escape-hatch/value-source/provenance/canvas-first/ddr-103/ddr-093
- [DDR-103: Phase 12 — in-canvas direct edit (CSS knobs + inline text) write model + deferrals](DDR-103-phase-12-in-canvas-direct-edit.md) — 2026-06-11, dev-server/inspector/css-writeback/text-editing/source-rewrite/layers-tree/canvas-origin/trust-boundary/ddr-019/ddr-054
- [DDR-102: Hub-sync cold-start divergence resolution — journal-gated fast-forward, dual snapshot, newest-wins](DDR-102-cold-start-divergence-resolution.md) — 2026-06-11, sync/hub/data-safety/conflict-resolution/rate-limit/multiplexing/incident
- [DDR-101: Command catalog is a shared `.mjs` single-source with build-time parity assertion](DDR-101-command-catalog-shared-mjs-single-source.md) — 2026-06-11, docs-site/command-reference/source-of-truth/build-script/diagrams/drift-guard
- [DDR-100: Annotations FigJam v3 — group tag-array, embedded arrow binds, CLI write verb](DDR-100-annotations-figjam-v3-data-model.md) — 2026-06-11, annotations/figjam/groups/connectors/bindings/ai-surface/schema/dev-server
- [DDR-099: Docs site retargeted from the `project` DS to the `maude` DS ("Studio Docs")](DDR-099-site-token-retarget-maude.md) — 2026-06-08, site/fumadocs/design-system/tokens/theme-bridge/changelog/roadmap/a11y/dogfooding
- [DDR-098: Studio full-functionality pass — scope calls (Plan C)](DDR-098-studio-full-functionality-scope-calls.md) — 2026-06-07, dev-server/studio/client/shell/canvas-origin/export/inspector/presence/command-palette/hub-sync/ddr-096/ddr-060-superseded
- [DDR-097: Hub admin redesign — "Studio Hub" maude reskin + operator surfaces](DDR-097-hub-admin-maude-reskin-and-operator-surfaces.md) — 2026-06-08, hub/admin/maude/csp/operator-surfaces/canvases/activity/settings/scope/tokens/security
- [DDR-080: Moodboard direction gate — cheap pre-scaffold visual approval before the expensive bootstrap](DDR-080-moodboard-direction-gate.md) — 2026-06-02, design/setup-ds/bootstrap/moodboard/direction-gate/hero-preview/aesthetic-ambition/ddr-033/ddr-057/ddr-073
- [DDR-079: TSX sync defaults ON for a linked project (supersedes DDR-072's opt-in)](DDR-079-tsx-sync-default-on.md) — 2026-06-02, design/dev-server/sync/linked-mode/syncTsx/default-on/opt-out/ux/ddr-072-superseded
- [DDR-076: An empty hub doc never clobbers a non-empty local canvas (cold-start seeds local UP)](DDR-076-empty-hub-doc-never-clobbers-local-canvas.md) — 2026-06-02, design/dev-server/sync/linked-mode/cold-start/hub-wins/data-loss/reconcile/agent
- [DDR-074: Draw engine composition layer + discriminating critic metrics (φ rejected)](DDR-074-draw-composition-layer-and-discriminating-critic-metrics.md) — 2026-06-01, design/dev-server/draw/composition/armature/color-harmony/apca/vme-balance/critic-metrics/golden-ratio-myth/deep-research
- [DDR-071: SVGO as the single new dev-server dependency for the draw engine](DDR-071-svgo-dependency.md) — 2026-06-01, design/dev-server/draw/svgo/dependency/npm/files-manifest/frozen-lockfile/maude-doctor/packaging
- [DDR-070: SVG generation via a deterministic geometry engine + rank-not-score verify loop](DDR-070-svg-generation-geometry-engine.md) — 2026-06-01, design/dev-server/draw/svg/geometry-engine/draw-agent/verify-loop/vlm-as-judge/optical-adjustment/regression-prevention
- [DDR-069: PPTX export via svg2pptx (native editable shapes) with a PNG fallback](DDR-069-pptx-native-via-svg2pptx.md) — 2026-06-01, design/dev-server/export/pptx/svg2pptx/python-dependency/canva/keynote/fonts/regression-prevention
- [DDR-068: Preview specimens import `_layout.css` as sole CSS entry; `/design:smoke` gates on computed style](DDR-068-specimen-css-entry-and-smoke-style-gate.md) — 2026-06-01, design/dev-server/smoke/render-gate/css/import-graph/regression-prevention/ux
- [DDR-066: `/flow:done` offers handoff as a soft prompt, never auto-runs it](DDR-066-soft-handoff-prompt-in-flow-done.md) — 2026-05-30, flow/design/handoff/cross-plugin/ux
- [DDR-062: Plugins reach ALL executable logic through the on-PATH `maude` CLI (`maude design <verb>` dispatch)](DDR-062-plugins-reach-executable-logic-via-maude.md) — 2026-05-29, design/flow/dev-server/cli/marketplace/npm-distribution/reachability/dispatch/phase-c/lever-6
- [DDR-061: Sidecar cache layout + Monitor pattern + background-overlap orchestration (Phase C)](DDR-061-sidecar-cache-monitor-background-orchestration.md) — 2026-05-29, flow/design/cache/cli/orchestration/latency/invalidation/monitor/background/phase-c
- [DDR-060: The TSX-only canvas migration silently broke the HTML-centric linked-mode sync (and the collab roadmap's `.html` assumption)](DDR-060-tsx-only-format-breaks-html-centric-sync.md) — 2026-05-28, design/dev-server/sync/linked-mode/tsx/security/csp/sandbox/phase-9/phase-9.1
- [DDR-049: Motion One (`motion/react`) is the canonical motion library; CSS-only is an opt-in escape hatch](DDR-049-motion-one-as-canonical-motion-library.md) — 2026-05-26, design/dev-server/canvas-lib/motion/handoff/registry-item/sub-agent-vocab/phase-3.7
- [DDR-045: Real-disk path resolution for compiled dev-server binaries — centralize in `paths.ts`, walk up from `process.execPath`, anchor on `http.ts` only](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) — 2026-05-25, design/dev-server/bun-compile/paths/npm-install/marketplace-cache/phase-19.1/phase-19.2
- [DDR-044: Marketplace install vs npm install — commit `client.bundle.js` + `styles.css`; self-heal `node_modules/` on first boot](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) — 2026-05-25, design/dev-server/marketplace-install/gitignore/distribution/self-heal/phase-19
- [DDR-021: `/design:smoke` is the gate for infra changes + bulk multi-canvas operations](DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md) — 2026-05-19, design/dev-server/smoke/render-gate/validation/flow-execute/phase-3.6
- [DDR-020: Single dev-server runtime — `server.ts` (Bun) authoritative, `server.mjs` sunset](DDR-020-single-dev-server-runtime-bun.md) — 2026-05-19, design/dev-server/bun/server.mjs/server.ts/sunset/runtime/phase-3.6
- [DDR-019: Canvas format — `.tsx` files transpiled by Bun, with auto-injected `data-cd-id` and shared `_shell.html`](DDR-019-canvas-tsx-format.md) — 2026-05-18, design/dev-server/canvas/tsx/oxc/magic-string/bun-transpiler/data-cd-id/handoff/shadcn/phase-3.6
- [DDR-018: Tree groups via `kind` discriminator — server scans PROJECT root + RUNTIME gitignored alongside canvases](DDR-018-tree-groups-via-kind-discriminator.md) — 2026-05-17, design/dev-server/sidebar/server/file-tree/phase-3.5
- [DDR-017: Dev-server shell = shadcn-style menubar + single-canvas viewport (tabs row killed)](DDR-017-dev-server-shell-menubar-single-canvas.md) — 2026-05-17, design/dev-server/shell/chrome/menubar/ux/phase-3.5
- [DDR-016: `plugins/design/dev-server/runtime/` is the canvas-runtime library home — not meta-design, not shell chrome](DDR-016-runtime-folder-purpose.md) — 2026-05-15, design/dev-server/runtime/audit/library/bundle/react/phase-3.4
- [DDR-015: Per-platform Bun binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Claude-Code pattern)](DDR-015-per-platform-binary-distribution.md) — 2026-05-15, distribution/npm/bun/binary/optionalDependencies/postinstall/hardlink/ci-matrix/claude-code-pattern/phase-3.4
- [DDR-014: Dev-server CSS uses `@layer reset, tokens, layout, shell, components, utilities` with Lightning CSS at build time](DDR-014-css-layer-architecture.md) — 2026-05-15, design/dev-server/css/cascade/layers/lightningcss/oklch/tokens/build-pipeline/phase-3.4
- [DDR-013: Dev-server splits from monolithic `server.mjs` into seven TypeScript modules on `Bun.serve`](DDR-013-server-modular-split-typescript.md) — 2026-05-15, design/dev-server/typescript/modularity/bun-serve/websocket/file-watcher/refactor/phase-3.4
- [DDR-012: React 19 everywhere — shell and canvases share a single runtime](DDR-012-react-19-unified-runtime.md) — 2026-05-15, design/dev-server/runtime/react/preact/framework/bundle-size/complexity/perf-budgets/phase-3.4/phase-3.6
- [DDR-011: Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork](DDR-011-mdcc-skin-of-fumadocs-vs-fork.md) — 2026-05-15, site/docs/fumadocs/design-system/theming/css-tokens/upgrade-burden
- [DDR-010: `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel](DDR-010-design-system-keeper-agent.md) — 2026-05-15, design/agents/quality-gate/pattern-priors
- [DDR-009: Bun runtime authoritative for `plugins/design/dev-server/` (no Node fallback)](DDR-009-bun-runtime-authoritative-for-dev-server.md) — 2026-05-15, design/dev-server/runtime/bun/distribution/perf/lock-in/npm/ci/phase-3.4
- [DDR-008: `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers](DDR-008-dev-server-bin-canonical-helper-home.md) — 2026-05-15, design/dev-server/bash/helpers/dry/ci/npm-distribution
- [DDR-007: Stable element-id schema — paired `data-dc-screen` + `data-dc-element` attributes on canvas content](DDR-007-stable-element-id-schema-data-dc-attrs.md) — 2026-05-15, design/runtime/inspector/screenshots/critics/comments/schema
- [DDR-006: Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter](DDR-006-plugin-namespace-in-name-frontmatter.md) — 2026-05-13, flow/design/plugin-design/slash-commands/naming/deprecation
- [DDR-005: Docs site stack and hosting — Fumadocs + Vercel](DDR-005-docs-site-stack-and-hosting.md) — 2026-05-13, infra/docs/fumadocs/vercel
- [DDR-004: Flow commands use `<group>-<verb>` prefix; subdirectory namespacing is not viable](DDR-004-flow-command-naming-prefix-convention.md) — 2026-05-13, flow/naming/plugin-design/slash-commands/ux/deprecation
- [DDR-003: `/flow:release` walks a user-authored runbook instead of dispatching on provider](DDR-003-release-runbook-vs-provider-dispatch.md) — 2026-05-12, flow/release/changelog/design-pattern
- [DDR-002: Release flow via Changesets, with a wrapper preserving plugin parity](DDR-002-changesets-release-flow.md) — 2026-05-12, infra/release/changesets
- [DDR-001: Monorepo with a single npm publisher](DDR-001-monorepo-single-publisher.md) — 2026-05-12, infra/monorepo/packaging

## Rules

- **Numbering:** zero-padded, three digits, sequential (DDR-001, DDR-002, …).
- **Status:** `Accepted` once committed. `Proposed` only inside an open PR. `Superseded by DDR-NNN` when replaced.
- **We never delete.** Superseded DDRs stay — they're the trail of how we got here.
- **Cross-link:** the plan, the commit, and the new code that implements the decision should all link the DDR.

How to create one: `/flow:record-ddr <title>`. How to find related ones: read this index, or `grep -l <tag> .ai/decisions/*.md`.
