---
"@1agh/maude": minor
---

Flow and design can now keep their decisions in a **knowledge graph** instead of a folder of markdown, so an agent recalls why something was decided rather than re-deriving it. It's built on [kgai](https://github.com/kgaidev/kgai) and it is **opt-out and capability-gated**: with the `kg` CLI absent — the default for every existing repo — every command runs its classic `.ai/` file path, byte for byte unchanged. Nothing to configure to keep what you have.

Turn it on and the loop's bookends start using it. `/flow:record-ddr` writes the decision into the graph (deterministic `hash(kind:name)` identity, so the DDR-number race on a shared `main` disappears), `/flow:plan` pulls scope-biased prior art before drafting, `/flow:status` overlays your recent movements, `/flow:pause` records a resumable session event that `/flow:resume` reconstructs from, and `/flow:done` syncs once at close. Design decisions — until now recorded nowhere — join too: `/design:new` and `/design:edit` register canvas and edit nodes with their design system, and `/design:video-analyze` / `/design:reel` record footage and cut decisions.

**`/flow:migrate-kgai`** imports an existing repo in one pass. It ingests DDRs *and* the RCA / security-review / code-review verdicts under `.ai/logs/` *and* STATE.md's progress history, each with its **full text** — so "what alternatives did we reject, and why" answers from the graph with no file open — and rebuilds the typed `SUPERSEDES` / `EXTENDS` / `REFERENCES` / `EVIDENCE_FOR` edges between them, including supersedes that were only ever stated in prose. `--only` refreshes a single changed decision, `--archive` moves the migrated sources aside, `--dry-run` shows you the shape first. Your markdown is never deleted.

Across repos, one shared store gives a whole company one memory: every write is tagged with its `repo` and `dept`, search biases to your own scope, and `--all-scopes` widens it — so pulling marketing's reasoning from a dev repo is one query. Because that store is a surface anyone can write to, it comes with an explicit trust model (DDR-189): graph output is quoted as inert data and never executed, hub-origin writes are quarantined, and only a locally-authenticated CLI writes.

Maude Desktop ships the engine itself — `kg` plus its native library as signed sidecars, and the kgai plugin injected into the chat panel — so decisions get captured in the app with nothing installed. Per-user setup and the one-time company setup are documented in `docs/kgai-onboarding.md` and `docs/kgai-company-setup.md`.
