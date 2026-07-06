---
name: maude-positioning
description: Message architecture for talking ABOUT Maude the product (what it is, why it's great, how it differs from Figma / Claude Design). Use whenever writing copy that pitches Maude itself: the homepage/docs intro, a README top blurb, a changelog announcement, a social post introducing the project, an elevator pitch for a non-technical person, or any "why is this different from Figma / Claude" explanation. Composes with michal-voice (that skill is the HOW/tone; this one is the WHAT/argument). Repo-internal, not shipped via the marketplace or npm.
---

# maude-positioning — the message architecture for pitching Maude

Repo-internal skill (Maude-specific, lives in `.claude/skills/`, not shipped via the marketplace or npm, same convention as `whats-new-entry` and `desktop-e2e`). This is the **WHAT** to say about Maude the product. Pair it with the personal `michal-voice` skill for the **HOW** (tone, tics, EN-dev mode) whenever the output is copy Michal is publishing himself.

## When to use

Any time you're about to write copy that pitches Maude itself, not a feature inside it: the homepage hero, a docs intro paragraph, the README top blurb, a changelog announcement post, a tweet/LinkedIn post introducing the project, an elevator pitch for a non-technical friend, or anything answering "what is this and why would I use it" or "how is this different from Figma / Claude Design."

Not for: internal command/skill descriptions, DDRs, code comments, or anything that isn't audience-facing marketing copy.

## The core insight

Every other design tool treats AI as an addition. **Figma** is a human-first, cursor-and-mouse tool that bolted a copilot panel onto the side; the cloud file is still the source of truth. **Claude Design** (claude.ai/design and the wider chat-canvas family) is AI-first but ephemeral: a chat box rendering a preview, no git, no real files on disk, no persistent design system to check new work against, gone when the conversation scrolls past it.

Maude starts from the other direction. It's a real, professional-grade tool (canvases are `.tsx` files, history is git, design tokens are CSS variables checked by critics) whose entire substrate was built for how an AI coding agent actually works: a dev-loop, a filesystem, a repo. Nothing here strains against the grain. That's the "wet dream for designers" feeling: the tool was built around the AI instead of the AI being bent to fit the tool.

**Protect this one sentence through every rewrite:** built around AI, not bent to fit one.

## Positioning statement

For someone already living inside Claude Code (a developer, or a designer pairing with one) who wants to design and ship UI without leaving the agent loop, Maude is a canvas-first design toolkit and agentic workflow system that treats the repo, not a proprietary cloud or a chat scroll, as the source of truth. Unlike Figma, the AI isn't a bolted-on feature. Unlike Claude Design, the work doesn't evaporate when the chat does.

## Differentiation (cite only real, checkable facts)

| Axis | Figma | Claude Design (claude.ai/design) | Maude |
| --- | --- | --- | --- |
| Where the AI sits | Bolted-on copilot panel | Is the whole product | Native substrate: every canvas, critic, and command is built for an agent loop |
| Source of truth | Figma's proprietary cloud | The chat scroll (ephemeral) | Your git repo (`.tsx` canvases, `.ai/` decisions, real commits) |
| Persistence | Cloud file, vendor lock-in | None. Gone when the thread does | Git history, `/design:rollback`, snapshots per canvas |
| Design system enforcement | Manual, or a paid plugin | None | Built-in critics (a11y, brand, tokens, motion...) gate every edit |
| Team sync | Figma's hosted multiplayer (paid) | None | Optional **self-hosted** Yjs hub, no SaaS tier |
| Beyond design | N/A (design-only) | N/A (chat-only) | `flow` runs the same repo-native loop for planning and shipping the whole feature, not just the mock |
| Cost / lock-in | Seat-based SaaS | Bundled into a Claude plan | Open-source, MIT, self-hostable, zero telemetry |

Keep `flow` and the hub as the closing row of every version of this table: secondary to the design-tool hook, never dropped entirely.

## Plain-language mode (non-technical audience)

Skip "canvas," "dev server," "critics." Use this shape instead: *"Most design tools let you sketch a screen, then a developer has to rebuild it from scratch. AI chat tools let you describe a screen, but the second the conversation ends, so does the work. Maude designs the real screen with AI, and a developer can ship it as-is, because it was never a mockup to begin with. It's already the real thing."* Anchor on the rebuild-cost pain a non-technical stakeholder actually feels, not on technical plumbing.

## Proof points (cite only shipped features, never a roadmap item)

- Cmd+Click any element in a live canvas and edit it; it writes straight back to the source `.tsx`.
- Full history/rollback per canvas (`/design:rollback`), because it's git underneath.
- A critic panel (a11y, brand, typography, motion...) grades every AI edit against the project's own design system before a human sees it.
- Optional self-hosted sync hub for team multiplayer, Docker or Fly, no SaaS tier, no cloud middleman.
- Open-source, MIT, zero telemetry, no signup.

## Guardrails

- **Accurate only.** Every claim above must map to a shipped feature. If some copy describes something not yet shipped, that's a bug in the copy, not a marketing choice: fix it or cut the claim.
- **Confident, not sneering.** Contrast Figma and Claude Design on real, checkable differences (git, persistence, self-hosting). Never mock the products or their makers. "Different tool, different job" beats "the other guy sucks."
- **Never claim to replace Figma outright.** Maude doesn't do freeform vector editing or a from-scratch visual design practice. It's for the AI-agent-native slice: prototyping, iterating, and shipping UI from inside Claude Code.
- **`flow` and the hub are always secondary, never absent.** The design-tool insight is the hook (the clearest wow factor). Every piece of copy should still surface `flow` and the self-hosted hub after the hook, not instead of it.
- **Compose with `michal-voice`.** This skill decides the argument. `michal-voice` (EN-dev mode, for anything published in English) decides the sentence shapes: short declaratives, dry self-deprecation, **no em-dash as a clause joiner, ever**, no corporate gloss.
