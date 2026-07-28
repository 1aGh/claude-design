# DDR-154: Skill worked examples are a higher-weight teaching surface than prose rules — re-audit them whenever a later DDR adds a hard constraint

**Status:** Accepted
**Date:** 2026-07-09
**Tags:** design, video, skills, docs, process, video-comp, timeline, ddr-150, worked-examples

## Context

`/flow:bug-rca` + `/flow:bug-fix` this session (`issue-video-timeline-flatmap-clips`) traced a Timeline-panel bug to a concrete, reproducible authoring defect: the user built a 4-clip reel via `REEL_CLIPS.flatMap((clip, i) => …)`, and the Timeline (`apps/studio/client/panels/timeline-parse.js`, an intentional text/regex parser — not a JS evaluator, per [DDR-150](DDR-150-timeline-clip-addressing-and-inline-edit-persistence.md)) collapsed the 4 real clips into one generic fallback row, because a loop produces only one literal `<TransitionSeries.Sequence>` text occurrence in source.

`git blame` on `plugins/design/skills/video-comp/SKILL.md` showed exactly how this happened: commit `62bd6fd2` (2026-07-04, same day as DDR-150) added a new "Make it hand-editable" rule — *"explicit `from`/`durationInFrames`... avoid opaque expressions"* — but the skill's **pre-existing worked example** ("join 4 clips + crossfades", present since the skill's original commit `b746c4da`) was left untouched. That worked example built its `<TransitionSeries>` body with the exact `.flatMap()` shape the new rule now forbade, and even hardcoded a `/* TOTAL */ 195` comment as tacit admission its own total didn't resolve — a defect its own author didn't notice, because nothing forces a worked-example re-audit when a DDR adds a hard constraint to a skill.

The fix committed today (`1fadb89f`) corrected the specific example. This DDR is not about that fix — it's about the fact that a worked example, once written, is *load-bearing content agents copy from far more readily than a prose bullet three paragraphs above it*, and there is currently no process step that catches a worked example drifting out of compliance with a constraint introduced after the example was written. The same class of bug can recur in any skill: a DDR/rule lands, the skill's prose is updated, its examples are not, and the examples silently keep teaching the old (now-wrong) shape.

## Alternatives considered

- **A — Do nothing; rely on bug reports.** Zero process cost, but this is exactly the failure mode that produced today's ticket — the defect sat undetected from 2026-07-04 to 2026-07-09 despite `git blame` making it trivially visible in retrospect. Reactive only.
- **B — Parser-side loop detection.** Have `timeline-parse.js` (or an analogous parser elsewhere) detect "fewer distinct `key=`s than JSX call sites under a `.map`/`.flatMap`" and surface a visible warning instead of silently degrading. Real value as defense-in-depth, but it's per-parser engineering effort and doesn't stop the *next* skill/rule pair from drifting the same way in a domain with no parser to instrument (e.g. a prose-only convention).
- **C — Process rule: worked examples are re-audited whenever a DDR adds a hard constraint to the domain they demonstrate.** Cheap (no new tooling), catches the class of bug at the source (the doc, before an agent ever copies it), and generalizes past `video-comp` to any skill with worked examples (canvas-lib patterns, draw-agent geometry recipes, whiteboard templates, etc.).

## Decision

We adopt **C**, and separately keep **B** as a live follow-up (tracked in `Revisit when` below, not required now) for `video-comp` specifically since the parser is already the right shape to extend.

Going forward: **when a DDR or skill edit introduces a hard "must be written this way" constraint for a domain, the same change must grep that skill's own worked examples for violations of the new rule and fix them in the same commit** — not as a follow-up. A rule with a stale contradicting example immediately below it is worse than no rule, because the example wins: agents pattern-match on "does the shape of what I'm asked to do resemble a worked example" far more readily than on abstract prose, so a contradicting example actively teaches the anti-pattern it sits three paragraphs below a warning against.

Practically, this means: `ddr-keeper` / `claude-md-keeper`-style sweeps and any `/flow:record-ddr` covering a skill's authoring rules should include "does this skill have worked examples that predate this rule — do they comply?" as a checklist item, not rely on someone noticing during a later bug hunt.

## Consequences

**Positive:**
- Closes the exact gap that let `issue-video-timeline-flatmap-clips` sit live for 5 days — the fix (rewriting the worked example itself, not just the prose) is now the expected default move, not a bonus.
- Generalizes: any skill with a "Worked example" section is now implicitly on notice that its examples are contractually bound to every hard rule stated above them in the same file.
- No new tooling/infra — this is a checklist addition to an existing review habit (DDR/skill-editing), not a new system.

**Negative / trade-offs:**
- Purely a discipline/process rule — nothing enforces it mechanically (no lint catches "this .md example contradicts that .md rule"). Relies on the DDR/skill-editing author (or a future `/flow:maintain-docs`-style sweep) actually doing the grep.
- Some worked examples predate rules that will never retroactively apply cleanly (e.g. a rule added for a reason the example's use case doesn't hit) — judgment is still required on whether a given example needs a rewrite or is legitimately out of scope of the new constraint.

## Revisit when

- If this discipline is missed again (another skill ships a rule-contradicting worked example that causes a user-visible bug) — escalate from "process rule" to **Alternative B's parser-side loop detection** for `timeline-parse.js` specifically, and consider a lightweight `/flow:maintain-docs` check that greps skill files for rule/example drift more generally.
- If `plugins/*/skills/*/SKILL.md` worked-example count grows large enough that manual re-audit becomes unreliable — worth a scripted consistency checker at that point, not before.

## Linked
- Plan: —
- PRD: —
- RCA: `.ai/logs/rca/issue-video-timeline-flatmap-clips.md`
- Fix commit: `1fadb89f` — `fix(design): video-comp skill's own worked example taught the loop pattern that breaks Timeline parsing`
- Extends: [DDR-150](DDR-150-timeline-clip-addressing-and-inline-edit-persistence.md) (the static-text-parser design this worked example violated), [DDR-148](DDR-148-video-comp-remotion-authoring-capture-export.md) (the original skill + worked example this corrects)
- Supersedes: none
