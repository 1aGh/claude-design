---
"@1agh/maude": patch
---

Add a `--quick` flag to `/flow:done` for fast, interim closes. It swaps the full `/flow:validate` gate (build + 5-platform cross-platform scenario + a11y audit + design-system-guard) for affected-scope static gates (format/lint/typecheck) plus affected-tests-only, cutting a routine close-out from ~20 min to ~5. DDR sweep, code review (including the security-auditor + ethical-hacker pass), tracker sync, and retro/archive are unchanged — `--quick` only trims Step 1, not tracking or due diligence. Use it for routine/interim closes where a full `/flow:validate` still runs before the branch merges to main.
