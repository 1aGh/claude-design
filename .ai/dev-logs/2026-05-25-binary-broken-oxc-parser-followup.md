# Follow-up: v0.17.x published binary crashes on startup

**Date:** 2026-05-25
**Status:** Open — needs separate work
**Found during:** ad-hoc bug-fix session for `maude design serve` user errors (commit `a6c76b0`)

## What

The `@1agh/maude-darwin-arm64@0.17.1` binary (and presumably the other six
platform sub-packages built from the same source) crashes immediately on
startup:

```
error: Cannot find native binding. npm has a bug related to optional
dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i`
again after removing both package-lock.json and node_modules directory.
      at node_modules/oxc-parser/src-js/bindings.js:575:15
```

Verified by running the binary directly (`~/.nvm/.../maude-darwin-arm64/maude
--port 4401`) outside the CLI dispatcher — same crash. **Every user of v0.17.x
sees this** as soon as the CLI dispatcher fix from `a6c76b0` lands and the
binary path is actually reached (previously the broken fallback to source
masked the crash with a different error class).

## Why

`bun build --compile` in `plugins/design/dev-server/build.ts` does not embed
the `oxc-parser` NAPI native `.node` binding into the standalone binary.
oxc-parser's `src-js/bindings.js` then walks its platform candidate list at
runtime, finds none of them loadable, and throws.

The same issue affected playwright/pptx in v0.17.0 (commit `4a0d6ab` worked
around it by spawning playwright in a subprocess). oxc-parser is hit via the
top-level imports in `canvas-pipeline.ts`, `canvas-edit.ts`,
`canvas-lib-inline.ts`, and `handoff.ts` — those files run inside the
compiled binary, not in a subprocess.

## Options (pick one in a follow-up plan)

1. **Bun.Transpiler / Bun.build plugin refactor** — replace oxc-parser usage
   with the built-in Bun parser/transpiler that ships inside `bun --compile`
   natively. Cleanest long-term; ~1–2 days work; needs to confirm Bun's API
   covers everything we use (data-cd-id injection, JSX walk, source map).
2. **External oxc-parser** — ship the `@oxc-parser/binding-<platform>.node`
   file alongside each platform tarball; patch the loader (`bun build
   --compile --external oxc-parser` + runtime path).
3. **Subprocess pattern** — mirror commit `4a0d6ab`: extract each
   oxc-parser-using module into a small mjs script the binary spawns
   on demand. Defeats single-binary ideal; many spawn points.

## Workaround until fixed

`MAUDE_FORCE_SOURCE=1 maude design serve` from a `pnpm install`-ed
`claude-design` checkout (works thanks to the dispatcher changes in
`a6c76b0`).

## Why no DDR yet

User chose "skip DDR, retro-note only" — fix path is unclear (option 1 vs 2
vs 3), and binary correctness is not a design decision, it's a build bug.
Promote to DDR when an option is chosen.
