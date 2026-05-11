# Design Decision Records

Trvalý log architekturních a produktových rozhodnutí pro claude-design. Každý DDR je samostatný markdown podle šablony v `.claude/commands/ddr.md`.

## Index

> Append-only. Nejnovější nahoře.

<!-- DDRs go here, formát:
- [DDR-NNN: Titulek](DDR-NNN-titulek.md) — YYYY-MM-DD, tags
-->

## Pravidla

- **Numbering:** zero-padded, 3 číslice, sekvenční (DDR-001, DDR-002, …).
- **Status:** `Accepted` jakmile commitnuto. `Proposed` jen v PR. `Superseded by DDR-NNN` když nahrazeno.
- **Nemažeme.** Superseded DDRs zůstávají — to je trail jak jsme se sem dostali.
- **Cross-link:** plán + commit + nový kód, který implementuje, by měly DDR linkovat.

Jak vytvořit: `/ddr <titulek>`. Jak najít související: čti tento index, případně `grep -l <tag> .ai/decisions/*.md`.
