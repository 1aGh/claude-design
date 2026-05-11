# Design Decision Records

Permanent log of architectural and product decisions for claude-design. Each DDR is a standalone markdown file following the template in `.claude/commands/ddr.md`.

## Index

> Append-only. Newest at the top.

<!-- DDRs go here, format:
- [DDR-NNN: Title](DDR-NNN-title.md) — YYYY-MM-DD, tags
-->

## Rules

- **Numbering:** zero-padded, three digits, sequential (DDR-001, DDR-002, …).
- **Status:** `Accepted` once committed. `Proposed` only inside an open PR. `Superseded by DDR-NNN` when replaced.
- **We never delete.** Superseded DDRs stay — they're the trail of how we got here.
- **Cross-link:** the plan, the commit, and the new code that implements the decision should all link the DDR.

How to create one: `/ddr <title>`. How to find related ones: read this index, or `grep -l <tag> .ai/decisions/*.md`.
