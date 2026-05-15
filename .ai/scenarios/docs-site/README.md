# docs-site scenarios

Cross-platform UI scenarios for the `site/` (Next.js + fumadocs) marketplace + docs surface, anchored to the four artboards under `.design/ui/Docs Site.html` (DS-01 landing, DS-02 docs index, DS-03 docs article, DS-04 cmd-K).

## Platform matrix

| Platform | Status | Rationale |
| --- | --- | --- |
| `web-desktop` (1440×900) | **required** | Primary surface; DS-01..DS-04 designed at this width. |
| `web-mobile` (375×812) | **required** | Sidebar collapse + cmd-K hint visibility regress on narrow viewports. |
| `ios-phone` | **N/A** | Web-only — no native shell. |
| `android-phone` | **N/A** | Web-only — no native shell. |
| `tablet` | **skipped** | Not in scope for v1.x; revisit if docs traffic shows tablet share > 10%. |

The native skip is intentional and is recorded in the plan `.ai/plans/archive/feature-docs-site-mdcc-skin.md` Acceptance Criteria. Do not flag `scenario-runner` `parity_ok != true` against the missing native runs.

## Scenarios

- `landing-first-visit/` — anonymous visitor on `/`, validates DS-01 chrome (Hero + CatalogGrid + MetaFooter).
- `cmd-k-search-flow/` — `⌘K` search palette (DS-04), MDCC re-skin of fumadocs Orama dialog.
- `deep-read-prose-flow/` — `/docs/design/bootstrap` long-form prose (DS-03), SKU breadcrumb + numbered h2 + page-meta footer.
- `theme-toggle/` — paper-light ↔ phosphor-dark parity across DS-01..DS-03.

## How to run

```sh
# All scenarios in this folder
/flow:scenario docs-site

# Single scenario
/flow:scenario docs-site/landing-first-visit
```

Reports land in `<scenario>/<YYYY-MM-DD-HHMM>/report.md` per the top-level `.ai/scenarios/README.md` layout.
