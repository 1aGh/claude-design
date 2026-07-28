# DDR-013: Dev-server splits from monolithic `server.mjs` into seven TypeScript modules on `Bun.serve`

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, typescript, modularity, bun-serve, websocket, file-watcher, refactor, phase-3.4
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) (Task 7 — the rewrite this DDR scopes), `plugins/design/dev-server/server.mjs` (1288 LOC monolith — replaced)

## Context

`plugins/design/dev-server/server.mjs` grew organically from a ~200 LOC zero-dep server in Phase 0 to a 1288 LOC monolith covering: HTTP routing, handwritten RFC-6455 WebSocket upgrade, `/api/*` handlers, active-canvas + selected-element protocol with the iframe inspector, snapshot/rollback stack, recursive `node:fs.watch` adapter, HTML injection of inspector scripts and `/_runtime/*` library tags, and JSON state files (`_server.json`, `_active.json`, `_history/<slug>/`).

Symptoms attributable to the single-file shape:

1. **No safety net for refactors.** Phase 1 wired `node --test` for `cli/`, but never for the server. Every change to `server.mjs` is reviewed by eye.
2. **Cross-concern coupling.** A change to the HTML injection (e.g. adding a new injected script tag) touches HTTP routing, WS upgrade hand-off, *and* the inspector protocol in the same file, with no module boundary signaling which part is being altered.
3. **Implicit shared mutable state.** Active canvas, open tabs, WS connection registry, file-watcher subscription list, snapshot indices — all live as module-level `let` bindings reachable from any function. The actual data flow is invisible.
4. **Handwritten WS upgrade.** ~150 LOC of RFC-6455 hand-rolled (HTTP `Upgrade: websocket`, base64 SHA-1 of `Sec-WebSocket-Key + GUID`, frame parsing, masking, fragmentation). Correct today; one upstream Node deprecation away from breakage. Bun ships native WS in `Bun.serve` — keeping the handwritten upgrade is debt.
5. **`node:fs.watch` macOS unreliability.** Recursive watching exists since Node 19 but FSEvents quirks leak rename events. Bun's recursive `fs.watch` is reimplemented natively and works.
6. **Phase 3.6 extension cost.** Phase 3.6's canvas TSX format needs new routes (`/ui/:slug`, `/_bun_hmr`). With a single 1288 LOC file, every Phase 3.6 PR drags the whole file through review even when only adding a route.

Phase 3.4 forces a runtime swap (Node → Bun, per [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md)) and a tooling swap (JS → TS for the typed Bun surface). Doing the split at the same time piggybacks on a rewrite that's already happening, rather than two refactors back-to-back.

## Alternatives considered

### Option A — Mechanical port (`.mjs` → `.ts`, single file, Bun.serve)

Keep `server.mjs` as `server.ts`, swap `node:http` → `Bun.serve`, swap handwritten WS → `Bun.serve` websocket handler, drop in TypeScript types. No module split.

- **Pros:** Smallest diff. Easiest to bisect if something breaks.
- **Cons:** All the structural problems above remain. Phase 3.6 still pays the single-file extension cost. The TS adoption gives type safety on individual lines but no architectural boundary visibility.
- **Rejected:** the cost of doing the split later is roughly the same as doing it now; doing it now amortizes the rewrite already in flight.

### Option B — Many small modules (~12+ files, one per concern)

Split into ~12 files: routes per top-level path (`route-root.ts`, `route-design.ts`, `route-runtime.ts`, `route-client.ts`, `route-canvas.ts`), per-API-endpoint files (`api-state.ts`, `api-snapshot.ts`, `api-rollback.ts`, `api-active.ts`), plus separate files per WS message type.

- **Pros:** Each file has a single tight responsibility; navigation by filename is fast.
- **Cons:** Cross-file context-switching cost dominates over file-internal cohesion below ~150 LOC. Many files become 30–80 LOC each — under the threshold where a separate file is worth the import-graph overhead. Heavy file count makes "where does this belong?" choices ambiguous; new contributions get scattered.
- **Rejected:** the over-splitting tax is real; we'd be paying it on every code-read for the lifetime of the module set.

### Option C — Seven domain modules (this DDR)

Split into seven `.ts` files, each owning a single domain concern, each ≤ 300 LOC, no ESM cycles, communication via an explicit `Context` object.

| Module | LOC ceiling | Owns |
| --- | --- | --- |
| `server.ts` | 150 | Entry point. `Bun.serve({ port, fetch, websocket, error })` lifecycle. `_server.json` write via `Bun.write`. Root resolution from `process.argv` / `Bun.env` / `process.cwd`. Imports + composes the other six modules. |
| `http.ts` | 200 | Exports `routes: Record<string, RouteHandler>` consumed by `Bun.serve({ routes })` (Bun ≥ 1.3 routing API). Designed for extension — Phase 3.6 adds `/ui/:slug` + `/_bun_hmr` as additional keys without rewriting. |
| `ws.ts` | 100 | Exports the `websocket: { open, message, close, drain }` handlers object for `Bun.serve`. Per-connection state on `ws.data` (Bun's typed slot). **Drops the handwritten RFC-6455 upgrade** (~150 LOC of debt). |
| `api.ts` | 300 | `/api/*` JSON endpoints. Each handler returns a `Response` (`Response.json(...)` shortcut sets content-type). |
| `inspect.ts` | 200 | Active-canvas + selected-element protocol. `_active.json` writer via `Bun.write` with an explicit `selected.v: 1` schema version field (Phase 3.6 bumps to `v: 2`). Inspector-script injection text. |
| `history.ts` | 150 | `_history/<slug>/` snapshot writer via `Bun.write` + rollback reader via `Bun.file().text()`. |
| `fs-watch.ts` | 80 | Wraps `fs.watch(root, { recursive: true })` (Bun's recursive macOS support works out of the box). Pub-sub for subscribers. |

Plus a single auxiliary file:

- `mem.ts` (≤ 80 LOC) — `FinalizationRegistry` registry + heap helpers (Task 8). Imported by `inspect.ts` and `ws.ts` for iframe-scoped state cleanup.

### Communication contract

Modules do not share mutable globals. `server.ts` constructs a single `Context` object:

```ts
type Context = {
  root: string;
  port: number;
  watch: FsWatch;       // returned from createFsWatch(root)
  history: History;     // returned from createHistory(root)
  inspect: Inspect;     // returned from createInspect({ root, watch })
  // ... no http/ws/api in Context; those return their handlers, not state
};
```

Each module exports a `create<X>(ctx)` factory that returns its public surface (e.g. `createInspect(ctx)` returns `{ getActive, setActive, writeActiveJson, getInspectorScript }`). Direct module-level mutable bindings are prohibited — caught by `bun tsc --noEmit` + a lint pass.

### TypeScript scope

`tsconfig.json` at `plugins/design/dev-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["bun-types"],
    "target": "ESNext",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

`strict: true` + `noUncheckedIndexedAccess: true` catch the most common gotchas of porting JS to TS (implicit `any`, possibly-undefined array element access).

- **Selected.**

## Decision

We pick **Option C — seven domain modules in TypeScript** because:

1. **The cost-of-split shrinks with co-timing.** Doing the split during the Node → Bun rewrite means one diff against a baseline-preserved server, not two.
2. **Phase 3.6 extension cost matters.** The next phase adds routes + WS protocols. Module boundaries make those PRs reviewable as bounded diffs instead of "everything in `server.mjs`".
3. **Type safety on the Bun surface.** Bun's `ServerWebSocket<TData>` generic, `Response.json`, `Bun.file().text()` lazy semantics, and `Bun.write`'s overloads all benefit from compiler enforcement.
4. **Handwritten WS upgrade is debt; native WS is leverage.** Bun.serve's native WS handles upgrade, fragmentation, and masking. Drops ~150 LOC permanently. 1.7× perf headroom for Phase 8 collab.
5. **Per-domain ownership.** When a bug surfaces in inspector state, the diff lives in `inspect.ts` + maybe `ws.ts`. The blast radius of any future change is visible from its import graph.

## Module boundaries — invariants

1. **No cross-module mutable state.** State lives inside a factory's closure or on `ws.data` (Bun's per-connection slot). Modules expose getters/setters, never raw `let` bindings.
2. **No ESM cycles.** `server.ts` imports the seven; the seven only import `mem.ts` + Bun + `node:path`/`node:url`. `bun tsc --noEmit` catches accidental cycles.
3. **Each module owns its file format.** `inspect.ts` is the sole writer of `_active.json`; `history.ts` is the sole writer of `_history/<slug>/`; `server.ts` is the sole writer of `_server.json`. Schema changes require touching one module + one DDR.
4. **`http.ts` is a routes table, not a router.** No conditional logic in `http.ts` beyond key lookup. Per-route handlers live in `api.ts` (for `/api/*`) or as inline `Bun.file(...)` returns (for static paths).
5. **`ws.ts` doesn't know about file paths or protocol semantics.** It owns connection lifecycle + message envelope (`type`, `payload`). The active-canvas, history-write, and fs-watch behaviors are dispatched to `inspect.ts` / `history.ts` / `fs-watch.ts` via the `Context`.

## Rejected alternatives — rationale

**Option A (mechanical port)** rejected because the structural problems (mutable globals, cross-concern coupling, no test surface, no extension path for Phase 3.6) outlive the rewrite. Postponing the split makes it harder, not easier — the typed mechanical port adds inertia.

**Option B (many small modules)** rejected because file count is a cost, not a virtue. The seven-module shape sits at the sweet spot where each file has enough cohesion to read in one sitting (~80–300 LOC) and the import graph is small enough to hold in head (server.ts → 6 modules + mem.ts).

## Consequences

**Positive:**

- Every concern has a documented owner. New contributions pick a module by name; new modules need a DDR.
- `bun tsc --noEmit` enforces typed state passing — the `Context` object is the only way modules talk.
- WS handwritten upgrade is gone. -150 LOC, +1.7× perf headroom.
- Tests in `bun:test` target one module at a time (`server-lifecycle.test.ts`, `ws-handshake.test.ts`, `active-state.test.ts`, `history-rollback.test.ts`, `fs-watch.test.ts` — Phase 3.4 Task 11).
- Phase 3.6 adds new routes as keys in `http.ts` and new WS message types as cases in `ws.ts` — no whole-file rewrites.

**Negative / trade-offs:**

- Seven files instead of one means seven file headers and seven import paths to keep in working memory. Mitigation: each module's top-level exports + the `Context` shape are the only contract; everything below is implementation.
- TypeScript adoption adds a build step before `node server.mjs` works the same as before. Mitigation: `bun --watch run server.ts` is the dev loop; `bun build --compile` is the release path. Both are sub-second turnaround.
- `Bun.file` is lazy — every read must be `await`ed. The TypeScript signature forces the await; missing it is a compile error.
- Cross-module communication via factory returns means circular dependencies are caught at compile time. The cost is that the boot order (`server.ts` constructs the Context) must be linear; nothing imports `server.ts`.

## Behavioral rules (for CLAUDE.md follow-up)

This DDR encodes three rules for future server-side code:

1. **Pick a module by concern, not by convenience.** New endpoint? `http.ts` + `api.ts`. New WS message? `ws.ts` (envelope) + dispatched module (semantics). New file format? Single owner module, single writer.
2. **No module-level mutable state.** State on a factory's closure or on `ws.data`. If you reach for `let foo = …` at module scope, you're about to create the bug DDR-013 exists to prevent.
3. **Module ≤ 300 LOC.** If a module grows past 300 LOC, split it (with a DDR explaining the split) — don't shove "just one more handler" into an existing file.

## Revisit when

- **A module crosses 300 LOC** and a clean sub-boundary emerges. Split + DDR.
- **Two modules consistently change together** across multiple PRs. The split is wrong; either merge them or refactor the contract between them.
- **The `Context` object grows beyond ~8–10 fields.** That's a sign the module set has grown without the contract being revisited. Re-examine.
- **Bun ships a higher-level framework wrapper that subsumes the manual routes table.** Re-evaluate whether the manual `http.ts` is still the right shape.

## Linked

- **Plan:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) — Task 7 (rewrite), Task 8 (`mem.ts`), Task 11 (tests)
- **DDR-009:** [Bun runtime authoritative](./DDR-009-bun-runtime-authoritative-for-dev-server.md) — provides the runtime this split targets
- **DDR-012:** [React 19 unified](./DDR-012-react-19-unified-runtime.md) — client-side counterpart of this server split
- **Phase 3.6:** consumes `http.ts` routes table for `/ui/:slug` + `/_bun_hmr` extensions
