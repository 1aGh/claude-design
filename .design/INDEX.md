# .design/ — canvas index

Auto-maintained by `/design:setup-docs`. Lists every canvas + design-system specimen the dev-server browses.

## Design systems

### `project` — MDCC-DSN/01

Industrial-catalogue mood · Paper & Ink palette · Berkeley-forward mono · hard-edges signature · htmx-grain voice. Two-theme (paper-light + phosphor-dark equal-status).

#### Tokens + chrome

- `system/project/colors_and_type.css` — token authority
- `system/project/preview/_layout.css` — specimen chrome (SKU framing, 1px hairlines)
- `system/project/preview/_components.css` — component anatomy (.btn, .tile, .sku, .seg, …)

#### Color specimens

- `system/project/preview/colors-text.html` — ink ladder
- `system/project/preview/colors-surfaces.html` — surface ladder
- `system/project/preview/colors-accent.html` — accent showcase ★
- `system/project/preview/colors-status.html` — semantic status family
- `system/project/preview/colors-themes-side-by-side.html` — paper vs phosphor split

#### Typography + spacing

- `system/project/preview/type-scale.html` — 8-step mono ladder
- `system/project/preview/type-mono.html` — code-grade mono specimen
- `system/project/preview/spacing-scale.html` — 4px-base ladder
- `system/project/preview/motion.html` — hover-only durations + easing

#### Foundations

- `system/project/preview/borders.html` — 1px hairline catalog
- `system/project/preview/elevation.html` — depth-via-rules ladder
- `system/project/preview/focus.html` — focus-ring spec
- `system/project/preview/grid.html` — character-friendly grid
- `system/project/preview/iconography.html` — ASCII / Unicode-glyph catalog
- `system/project/preview/opacity.html` — alpha ladder
- `system/project/preview/radii.html` — sharp-corners spec (0/2/4)
- `system/project/preview/selection.html` — text + element selection

#### Components — universal

- `system/project/preview/components-buttons.html` — primary / ghost / quiet
- `system/project/preview/components-cards.html` — tiles + plain cards
- `system/project/preview/components-inputs.html` — fields + textareas
- `system/project/preview/components-toggles.html` — switches / checks / radios
- `system/project/preview/components-dialogs.html` — modal + drawer
- `system/project/preview/components-tooltips.html` — hover + focus tips
- `system/project/preview/components-tables.html` — data table density
- `system/project/preview/components-callout.html` — info / warn / error blocks
- `system/project/preview/components-status.html` — status pills + dots
- `system/project/preview/skeletons.html` — loading placeholders

#### Components — audience-developer

- `system/project/preview/components-code-block.html` — syntax + line numbers
- `system/project/preview/components-diff-view.html` — added / removed gutters
- `system/project/preview/components-log-stream.html` — timestamps + levels
- `system/project/preview/components-monospace-table.html` — data-grade mono table
- `system/project/preview/components-terminal-pane.html` — prompt + cursor

#### Components — platform-desktop

- `system/project/preview/components-resize-panels.html` — file-tree + main split

#### Brand moments

- `system/project/preview/empty-state.html` — voice + "DO/DON'T" panel ★
- `system/project/preview/logo.html` — wordmark + glyph showcase ★

#### Compositions ("DS in use")

- `system/project/preview/ui_kits-desktop-showcase.html` — full mdcc-design-server mock ★★
- `system/project/preview/ui_kits-desktop-index.html` — catalog launcher

(★ = signature specimen; ★★ = highest-leverage composition)

## Canvases under `ui/`

| Canvas | DS | Platform | Artboards | Phase coverage | Notes |
|---|---|---|---:|---|---|
| `ui/Canvas Viewport.html` ★ | project | desktop | 10 | 3.5 / 4 / 5 / 6 / 8 / 12 | Dev-server canvas meta-design — every viewport state v1.0 → v1.3 (infinite canvas, draw, pin-comments, presentation, live collab, inspector + layers, project+DS tree, DS view, comments list). [Sidecar](./ui/Canvas%20Viewport.meta.json) · [Envelope](./_history/canvas-viewport/000-envelope.md) |
| `ui/Docs Site.html` ★ | project | desktop | 4 | docs / marketing | Re-skin of fumadocs site under MDCC-DSN/01 — marketplace landing (catalog SKU grid + install snippet) + standalone docs (3-pane shell, `/design:new` article, cmd-K palette modal). [Sidecar](./ui/Docs%20Site.meta.json) · [Envelope](./_history/docs-site/000-envelope.md) |
| `ui/Commands Overview.tsx` ★ | project | desktop | 5 | docs / commands | Diagram-flow visualization of the maude commandscape — two parallel sections (`/flow:*` + `/design:*`), each with a layered-DAG dependency subtree and a producer-consumer side-effects flow. `/flow:done` and `/design:new` as fan-out hubs; `STATE.md` and `_history/<slug>/` as gravity-well files. [Sidecar](./ui/Commands%20Overview.meta.json) · [Envelope](./_history/commands-overview/000-envelope.md) |
| `ui/Sync Hub Admin.tsx` | project | desktop | 5 | Phase 9 · hub admin | In-hub operator console for `maude sync` (self-hostable Hocuspocus hub) under MDCC-DSN/01 — sign-in (HUB_SECRET), first-run bootstrap-key claim with fingerprint phishing-defense, dashboard (generate invite / connected peers / hub status / active tokens), issued-credential modal (one-time `mau_…` token receipt), and edge states (empty / rotate-kill-switch / auth-expired / 429). [Sidecar](./ui/Sync%20Hub%20Admin.meta.json) · [Envelope](./_history/sync-hub-admin/000-envelope.md) |

## Research + history

- `_history/_system/project-df4b0d27-domain-research-discovery.json` — Round 0 research payload (anchors, OKLCH ranges, voice samples)
- `_history/_system/project-000-scaffold-roster.yaml` — bootstrap roster (file set + batches + reconcile status)
- `_history/_system/project-000-bootstrap-completeness.md` — completeness-critic report (written post-scaffold)
- `_history/_system/project-000-bootstrap-screenshots/` — agent-browser screenshots of signature specimens
