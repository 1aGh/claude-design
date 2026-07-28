# DDR-040: Canva export = PPTX payload + `.canva-handoff.md` artifact, not OAuth + Connect API

- **Date:** 2026-05-22
- **Status:** Accepted
- **Tags:** design, export, canva, phase-6.5, mcp, oauth, handoff, pptx, third-party-integration
- **Related:** [Phase 6.5](../plans/phase-6.5-export.md) T6c + T13, [DDR-039](./DDR-039-export-pptx-via-pptxgenjs.md) (the PPTX engine this builds on), `plugins/design/dev-server/exporters/canva.ts`, `plugins/design/dev-server/exporters/canva-handoff-prompt.ts`, `~/.claude/projects/-Volumes-D-git-claude-design/memory/feedback-mcp-prompt-over-oauth-scaffolding.md`

## Context

Anthropic's [Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs) (April 2026) ships a [Canva integration as headline](https://www.canva.com/newsroom/news/canva-claude-design/), undocumented mechanism. Phase 6.5's original plan (v0, 2026-05-19) mirrored an inferred Connect-API path:

1. User clicks Export → Canva.
2. Maude generates PPTX (via DDR-039's adapter).
3. **If a Canva OAuth token is stored in `_canva-auth.json`**, Maude POSTs the PPTX to the [Canva Connect Design-Imports API](https://www.canva.dev/docs/connect/api-reference/design-imports/create-design-import-job/), polls the job, surfaces the `edit_url`.
4. **If no token**, fall back to a drag-drop instruction toast.

User pushback (2026-05-22, plan revision session): *"connect api zní složitě, vyhodil bych. Lepší ať si to udělá sám např. pokud má napojený canva mcp může si to nějakým promptem exportovat sám z maude."* Translated: drop the Connect API path; if the user has a Canva MCP connected, they can paste a prompt from Maude into their MCP and let it handle import.

The deciding factors against Connect API + OAuth:

1. **Tier gate.** Canva Connect's Design-Imports endpoint requires **Canva Enterprise** for production scope. ~95% of expected Maude users are not on Enterprise. We'd be writing OAuth client code for an endpoint nobody can actually hit at production volume.
2. **Token storage as a risk surface.** `_canva-auth.json` would live under `.design/`. Even with `.gitignore` + `chmod 600`, the file leaks into screenshots, log captures, screen-share recordings, support bundles. The user has to remember to revoke when they switch projects. Every Maude install becomes a place where Canva refresh tokens accumulate.
3. **Auth duplication.** Users with a Canva MCP server connected (Claude Code, Cursor, Goose, etc.) **already configured their Canva auth**. Maude having its own parallel token storage means two places to revoke + reauthenticate when a Canva password changes.
4. **MCP-prompt pattern composes.** If we ship "emit `.canva-handoff.md` with a paste-ready prompt block" as the integration shape, the same pattern works for Figma MCP, Slack MCP, future vendors. One artifact emitter (`canva-handoff-prompt.ts`, rename-ready to `mcp-handoff-prompt.ts` when a second target appears) carries the contract across all of them.

## Decision

**No OAuth scaffolding in Maude. The Canva handoff bundle is two files, zipped:**

1. `<canvas-slug>.pptx` — same authoritative payload from DDR-039. PPTX is the top of Canva's import-fidelity ladder (`PPTX > PDF > SVG > PNG` per Canva docs); it imports as editable text / shapes / images / pages.
2. `<canvas-slug>.canva-handoff.md` — markdown with three sections:
   - **Summary** — artboard count, fidelity caveats (fonts, gradients, blend modes, flex/grid flattening).
   - **Option A: drag-drop** — three-step instructions for the universal Canva web path (works on any Canva tier).
   - **Option B: MCP-prompt** — a fenced `text` block containing a paste-ready prompt for users with a Canva MCP. Slot-filled with the absolute path, canvas slug, and slide count. The user copies the block, pastes it into their agentic tool, and **their MCP** handles the import call. Maude never sees a Canva token.

`canva-handoff-prompt.ts` is a pure markdown builder — no IO, no network. Tests verify the prompt block is self-contained and slot-fills correctly. The adapter (`canva.ts`) is a thin wrapper: `walkCanvas → modelToPptx → buildHandoffMarkdown → JSZip → done`.

The legacy "PNG + CSV + README" raster bundle from Phase 6's original plan is retained as `options.mode === 'raster'` (CLI: `maude design export canva --option mode=raster`). It's reference-only handoff for users who explicitly don't want editability.

## Consequences

**Wins:**

- Zero auth surface in Maude. No OAuth client code, no token files, no `.gitignore` discipline, no refresh-token rotation. The threat model for this feature is "the user already downloaded a ZIP" — same as every other export.
- Works on **every** Canva tier (drag-drop) and gives Enterprise / power-users the same one-click experience they'd get from the Connect API path, by deferring the API call to their own MCP setup.
- Pattern is reusable. When Figma MCP support matures and someone asks "can I export to Figma?", the same shape applies — emit Figma-friendly payload (probably `.fig`-importable JSON or a series of SVG components) + a `.figma-handoff.md` with the prompt block. Or Slack: emit a Markdown summary + Slack-MCP prompt to post into a channel.
- ~50 KB lighter than the Connect API path (no OAuth client + polling client). Bundle budget tightened from 700 KB → **650 KB**.

**Caveats:**

- **The MCP path is currently manual** — user copies prompt, pastes into their tool, waits for the MCP to import. The "automated round-trip" experience that a Connect API integration would provide doesn't exist. Acceptable trade — speed of integration vs. user-facing automation. Re-evaluate if a critical mass of users complain about the copy-paste step.
- **Canva ecosystem may evolve.** If Canva opens up Connect Design-Imports beyond Enterprise tier in a future release, the calculus changes. Re-evaluate the decision at that point — the decision is not "OAuth is bad" but "OAuth is bad **at the current Enterprise gate**."
- **Discoverability of the MCP path depends on the user knowing what an MCP is.** The handoff markdown explains it inline + links to a setup guide (T13 docs). New users without MCP setup default to the drag-drop path, which works fine.
- **Implicit dependency on the user's MCP being correctly configured.** Maude can't validate that the prompt will work — that's the user's MCP's problem. If the prompt fails (no MCP, wrong vendor, expired auth), the user falls back to drag-drop.

## Alternatives considered

- **Connect API + OAuth (the rejected original plan).** Tier-gated, token-storage risk, duplicates auth that the user's MCP already holds. See above.
- **Canva REST Create-Design endpoint with image-only payload.** Researched in v0 of the plan. Endpoint is **image-only** — cannot author shape/text trees. PPTX-via-Design-Imports is the only Canva path that delivers editable elements. Not selecting "image-only" because the whole point of this work is editable handoff.
- **`dom-to-pptx` for the underlying payload.** Decided against in DDR-039 (single-maintainer, less debuggable than authoring from our IR). Re-decision doesn't change here — same PPTX engine, different downstream wrapper.
- **Canva App via Canva Apps SDK.** Would author Canva-native elements directly via an embedded Canva App — highest fidelity, no PPTX intermediate. Requires publishing a Canva App through their App Marketplace + review + ongoing maintenance. Worth it only if Canva handoff is top-3 feature for Maude usage. Tracking as a potential Phase 6.6 follow-up; not Phase 6.5 scope.

## Open questions

- When does the artifact filename pattern generalise? The first time a second target ships (Figma / Slack / something else), rename `canva-handoff-prompt.ts` → `mcp-handoff-prompt.ts` and the file pattern → `<canvas>.<target>-handoff.md`. The current `<canvas>.canva-handoff.md` shape forward-compatible with that rename.
- Should the handoff markdown include screenshots? Phase 6.5 says no — keeps the artifact small + portable. If users start asking for visual previews in the markdown, add an embedded PNG via data URL. Decision deferred to dogfooding feedback.
