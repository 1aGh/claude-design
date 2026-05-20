---
"@1agh/maude": minor
---

**Project renamed `md-claude` → Maude.** Atomic rebrand across the npm package, GitHub repo, Claude Code marketplace, CLI binary, dev-server runtime, docs site, and self-dogfooding directories. See [`docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`](../docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md) and [DDR-032](../.ai/decisions/DDR-032-rename-md-claude-to-maude.md).

User-visible changes:

- **npm**: `@1agh/md-claude` → `@1agh/maude`; 7 per-platform sub-packages renamed in lockstep (`@1agh/maude-<slug>`). The old package was unpublished within npm's 72h grace window — `npm i -g @1agh/md-claude` now 404s.
- **GitHub**: repo `1aGh/md-claude` → `1aGh/maude` (GitHub 301-redirects raw URL fetches; marketplace install needs to be re-added by hand because the marketplace `name:` field changed).
- **CLI**: primary bin is `maude` (`maude init`, `maude config`, `maude design serve`). The legacy `mdcc` bin still ships as a deprecation-warning shim and will be removed in v0.17.x. Same for `mdcc-safe` → `maude-safe`. `MD_CLAUDE_SKIP_POSTINSTALL` env var renamed to `MAUDE_SKIP_POSTINSTALL` (old name accepted one cycle).
- **Marketplace install syntax**: `flow@md-claude` → `flow@maude`, `design@md-claude` → `design@maude`.
- **Canvas-lib virtual specifier**: `@mdcc/canvas-lib` → `@maude/canvas-lib`. TSX canvases must update their import statements; the dev-server resolver no longer matches the old name.
- **Workspace scopes** (internal pnpm): `@md-claude/site`, `@md-claude/dev-server`, `@md-claude/hub` → `@maude/*`.
- **Docs site canonical host**: `maude.iagh.cz` (DNS + Vercel wiring is a post-merge maintainer task).

Intentionally preserved as internal namespaces (DDR-032 sub-decision 2): CSS class identifiers `.mdcc-*`, CSS custom properties `--mdcc-*`, the `site/components/mdcc/` path, the `~/.config/mdcc/` XDG config directory, and `site/app/mdcc-tokens.css`.
