# DDR-118 — Teach a visible three-verb action-cycle; don't hide the live/async duality

**Status:** accepted
**Date:** 2026-06-19
**Phase:** phase-29 (Native Maude E4 — onboarding wizard + repo/branch switcher + collab tour)
**Related:** [`collab-model-design.md` § Part 2](../docs/collab-model-design.md) (the recommendation this REVERSES), DDR-111/112 (managed-clone + staging model), DDR-113 (DiffView), DDR-116 (in-UI merge-conflict resolution — the "pick a version, never a merge" backend), DDR-115 (annotations versioned / comments hub-only — the live-vs-async split in storage terms).

## Context

`collab-model-design.md` § Part 2 (the E0 research that grounds the whole native-collab epic) recommended **hiding the live-vs-async duality entirely** behind a single "shared room + note on the table" (*sdílená místnost + vzkaz na stole*) metaphor, with a microcopy contract (A5) that keeps version-control vocabulary off the surface as much as possible. The reasoning: a non-technical user shouldn't have to know that "being together live" (cursors/presence/comments over the hub) and "the work itself" (git commits/push/pull) are two different transports with different timing.

Phase-29 builds the surfaces that this recommendation governs — the first-run onboarding wizard, the persistent repo/draft switcher, and the onboarding/collab tour. Implementing them forced the question: do we hide the duality, or teach it?

## Decision

**We take the opposite call from the research: we surface a visible, three-verb action-cycle and TEACH the live-vs-async split honestly**, rather than hiding it behind a metaphor.

**Two layers, named plainly — never mixed into one diagram:**

| Layer | What's in it | How it behaves | User verb |
| --- | --- | --- | --- |
| **Live (together)** | cursors · who's here · comments · annotations | **Automatic, no buttons** — when you're both here, you see each other instantly | *(none — it just happens)* |
| **The work itself** | the canvas files / design content | **Visible cycle, has buttons** | **Save changes locally → Publish for everyone → Pull changes** |

**Canonical verb set (the only version-control words the new UI uses):**

| Action | UI verb | Replaces (never shown) |
| --- | --- | --- |
| Snapshot your work on your machine | **Save changes locally** | `commit` |
| Send your work to everyone | **Publish for everyone** | `push` |
| Get everyone else's work | **Pull changes** | `pull` / `fetch` / "behind" |
| Separate line of work | **Draft** | `branch` |
| The team's canonical version | **Shared version** | `main` |

**The one hard thing, framed honestly:** when you're *live together*, one person publishing already covers the other — the teammate has seen the work live, so Publish is "just dropping a bookmark," not a hand-off. Diverging work only happens when people are **apart**; then the app shows a **visual picker** ("keep mine / keep theirs / keep both" — DDR-113/116), never a text merge.

## Why we reverse the research

1. **The cycle has to match real buttons.** A "hidden-magic" metaphor can't sit next to a literal **Publish for everyone** button. The phase ships those buttons (the GitPanel, the switcher's draft model, the wizard's success cycle); a metaphor that denies their existence is incoherent the moment the user sees them.

2. **Pure hiding is leaky.** Live-sync (hub) and publish/pull (git) genuinely coexist, and when they diverge the "magic" breaks *more* confusingly than an honestly-shown loop. A user who was never told the two layers exist has no model for "why didn't my teammate see this until I published?" — the exact confusion the research wanted to avoid, reintroduced at the worst moment (a divergence).

3. **Honesty scales to the conflict case.** DDR-116's visual "keep mine/theirs/both" picker only makes sense if the user already understands that two people working apart can produce two versions. The two-layer teaching is the prerequisite for the conflict UI to read as "pick one" instead of "something broke."

4. **The split already exists in storage.** DDR-115 versions annotations (durable, git) but keeps comments hub-only (live, CRDT). The live/async duality is real all the way down; teaching it matches the system rather than papering over it.

## Scope / what this governs

- **New phase-29 surfaces use the canonical verbs verbatim:** `OnboardingWizard` (success-state cycle preview), `RepoBranchSwitcher` ("Draft" / "Shared version" / "everyone"), the collab tour + `CollabModelInfographic` (the two-layer diagram).
- **The collab tour is the teaching vehicle** — a centered infographic step (the two layers) + coach-marks over the real Save/Publish/Pull controls + the presence layer, on the existing tour engine (`overlay.jsx`), offered once after onboarding and re-openable from Help.
- **No raw git terms** (`commit`/`push`/`pull`/`fetch`/`branch`/`merge`/`checkout`/SHA) leak into any user-facing copy on these surfaces. ("Never a confusing **merge**" in the tour uses the word only to *disown* the concept, paired with the visual picker.)

## Consequences / follow-ups

- The infographic must keep the two layers visually distinct (never one merged diagram) or it reintroduces the confusion the research warned about. This is now a design invariant for the tour surface.
- **Vocabulary alignment gap (flagged):** the phase-27/28 GitPanel uses near-synonyms ("Save version" / "Publish changes" / "Get latest") — already jargon-free, so contract-compliant, but not the exact canonical verbs. The collab tour bridges this (the card teaches "Save changes locally" while spotlighting the "Save version" button). Aligning the GitPanel/IdentityBar/SyncBanner copy to the exact canonical verbs is a deferred polish (a vocab migration across phase-27/28 surfaces), not a phase-29 blocker.
- `collab-model-design.md` § Part 2's A5 microcopy contract is **partially superseded** by this DDR for the action-cycle vocabulary; its live-layer guidance (presence is automatic, no buttons) is retained and reinforced.
