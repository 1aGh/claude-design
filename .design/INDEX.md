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
| `ui/Studio.tsx` ★ | **maude** | desktop | 6 | 3.5 / 4 / 5 / 6 / 7 / 9 / 12 / 20–25 | Maude app-shell redesign under the `maude` DS ("Unified Pro Studio", dark-first). The layout the user likes — left file-tree · top menubar+tools+status · bottom context bar · right comments/inspector/CSS-knobs — across 6 artboards: **hero (interactive: collapse sidebar · menubar dropdown · theme flip · tool switch)** · review & presence (threads + AI agent activity) · annotate & draw · ⌘K command palette + What's New · inspect & live CSS knobs · light handoff & export. [Sidecar](./ui/Studio.meta.json) · [Envelope](./_history/studio/000-envelope.md) |
| `ui/Studio Docs.tsx` ★ | **maude** | desktop | 7 | docs / marketing / infographic | Maude documentation redesign ("Studio Docs") under the `maude` DS — docs rendered AS the studio chrome (menubar · nav tree · dotted canvas), light theme as the reading/handoff surface. Built from the real `site/` (Fumadocs) IA. 7 artboards: **landing** (hero + watch-intro chip + install + catalog SKU cards) · docs home (real nav tree + "Pick a direction") · article reader (Getting Started + prose/code/callouts/TOC + **light reading inset**) · command reference (`/design:new` property table + source-of-truth) · ⌘K search palette · **`/docs/flow` with the flow-loop infographic embedded INLINE as a figure** (the in-markdown infographic) · **changelog & roadmap** (combined What's-New + Roadmap timeline — Now/Shipped/Next). Aspiration 4.5/5. [Sidecar](./ui/Studio%20Docs.meta.json) · [Envelope](./_history/studio-docs/000-envelope.md) |
| `ui/Studio Intro Video.tsx` ★ | **maude** | desktop | 2 | intro film / storyboard | "Studio Intro Video" — the v3 intro film for the landing, extracted from Studio Docs. 2 artboards: **main-page placement** (hero "See Maude think." + Play CTA + 16:9 player with scrubber/chapters/captions) · **storyboard & script** (4-keyframe storyboard: blank canvas → agent draws → critics score → hand off · chapters/voiceover · specs). [Sidecar](./ui/Studio%20Intro%20Video.meta.json) · [Envelope](./_history/studio-intro-video/) |
| `ui/Studio Hub.tsx` ★ | **maude** | desktop | 7 | hub redesign · Phase 9 + expansion | "Studio Hub" — the self-hostable Maude sync hub (`plugins/design/hub`) reimagined under the `maude` DS, lifting the Studio app-shell chrome. Re-skins + expands `Sync Hub Admin` (project DS). 7 artboards: **landing** (public splash — real-time sync hero · console preview inset · Docker/Fly/Tailscale deploy targets) · **first-run onboarding wizard** (step rail · fingerprint claim · EXPIRES 24H) · dashboard/overview (app-shell: sidebar nav · stat row · peers · hub status · activity feed) · **peers & presence** (spatial presence map + violet AI-agent cursor — signature) · access tokens (scope chips · sessions · rotate-as-kill-switch confirm) · **invite-issued modal** (one-time `mau_…` credential reveal over inert shell — signature) · states & settings (sign-in · 429 · auth-expired · empty · TLS/storage/danger-zone). Aspiration 4.4/5. [Sidecar](./ui/Studio%20Hub.meta.json) · [Envelope](./_history/studio-hub/000-envelope.md) |

## Research + history

- `_history/_system/project-df4b0d27-domain-research-discovery.json` — Round 0 research payload (anchors, OKLCH ranges, voice samples)
- `_history/_system/project-000-scaffold-roster.yaml` — bootstrap roster (file set + batches + reconcile status)
- `_history/_system/project-000-bootstrap-completeness.md` — completeness-critic report (written post-scaffold)
- `_history/_system/project-000-bootstrap-screenshots/` — agent-browser screenshots of signature specimens
