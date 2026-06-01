# DDR-071: SVGO as the single new dev-server dependency for the draw engine

- **Date:** 2026-06-01
- **Status:** Accepted
- **Tags:** design, dev-server, draw, svgo, dependency, npm, files-manifest, frozen-lockfile, maude-doctor, packaging
- **Related:** [DDR-070](./DDR-070-svg-generation-geometry-engine.md) (the engine that uses it), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (frozen-lockfile / untrusted-to-peers image), [DDR-058](./DDR-058-maude-doctor-deps-config-quality.md) (`maude doctor` deps source), [Phase 25 plan](../plans/phase-25-designer-draw-svg-agent.md)

## Context

The draw engine (DDR-070) needs to (a) minify the final on-disk SVG asset and
(b) **gate validity** — reject malformed SVG loudly rather than ship a broken
mark. Both are exactly what a mature SVG optimizer provides, and reimplementing
path-data rounding + a plugin pipeline in-house is more risk than one
well-maintained library.

## Decision

**Add `svgo` (^4.0.1) to `plugins/design/dev-server/package.json` `dependencies`
— and *only* there.** It is pure-JS, MIT, Bun-compatible, healthy, and its parser
throws (`SvgoParserError`) on malformed input, so `draw/optimize.ts` gets the
validity gate for free.

Rasterization for the verify loop reuses **agent-browser** (already a soft dep)
via the `DrawProof` artboard ladder — no new rendering dependency. `resvg-js` /
`sharp` were rejected: redundant given agent-browser, and `sharp` is a native
addon hostile to the `bun --compile` / zero-native-dep goals.

### Where it does NOT go, and why — `dependencies.json` is for EXTERNAL tooling

The Phase 25 plan said "update `plugins/design/dependencies.json`". **We
deliberately do not**, and this is the load-bearing part of the decision:

- `dependencies.json` declares *external tools the user installs separately*
  (node, git, bun, agent-browser, playwright, jq, svg2pptx). `cli/lib/preflight.mjs`
  probes each with `dep.check.command || "${dep.id} --version"` and reports
  `missing` on a non-zero exit (DDR-058).
- SVGO is a **bundled npm dependency**, not an external tool. It ships inside the
  `@1agh/maude` tarball (under the already-published `plugins/design/dev-server/`
  path) and is populated on end-user machines by the dev-server boot self-heal
  (`bun install --production`, which includes `dependencies`).
- If we declared it in `dependencies.json`, `maude doctor` would run
  `svgo --version`, find no *global* svgo, and falsely report it **missing** on
  every machine — violating the Phase 25 acceptance criterion "maude doctor
  reports no missing dep after SVGO added". Keeping it out of the manifest is what
  makes that criterion true.

So the rule the plan was reaching for — "declare the dependency" — is satisfied by
`package.json`; the manifest is the wrong home for a shipped npm dep.

## Consequences

- **`files` manifest:** no change needed — `draw/` and the dev-server ship under
  the existing `plugins/design/dev-server` `files` entry; npm excludes
  `node_modules`, and the self-heal repopulates svgo at runtime (it's a
  `dependencies` entry, so `--production` keeps it).
- **Frozen-lockfile / hub image (DDR-054):** unaffected. SVGO is a *dev-server*
  dep, not a *hub* dep — the hub image builds from `plugins/design/hub/bun.lock`,
  which this change does not touch. The dev-server `bun.lock` is untracked; the
  authoritative resolution is the root `pnpm-lock.yaml` (svgo added via
  `pnpm --filter @maude/dev-server add`).
- **Runtime bundles:** unaffected. SVGO is imported only by `draw/optimize.ts`,
  reached via the `svg-optimize` / `draw-build` bun helpers — it is **not** in
  `server.ts`'s import graph, so it isn't compiled into the standalone binary and
  doesn't touch `dist/runtime/*.js`.
- **Supply-chain surface:** one new transitive tree. SVGO is widely used and
  MIT-licensed; acceptable for a dev-tooling dependency that never runs in the
  untrusted-to-peers hub image.
