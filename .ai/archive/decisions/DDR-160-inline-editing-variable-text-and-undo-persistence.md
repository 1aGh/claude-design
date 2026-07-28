# DDR-160: Inline-editing variable-driven text — source-tracing resolver, occurrence targeting, and reload-durable undo

- **Date:** 2026-07-10
- **Status:** Accepted (implemented — commits `d7362b50`, `e9b56d93`, `9e20383b`, `78c1ff43`; follow-up to `feature-unified-text-editing`)
- **Tags:** studio, canvas-runtime, text-editing, ast, canvas-edit, occurrence, undo, sessionStorage, dx
- **Related:** [DDR-158](./DDR-158-unified-text-editing-custom-caret-and-world-html-editors.md) (the unified text-editing feature this extends), [DDR-150](./DDR-150-element-editing-robustness.md) (the `{'literal'}` case + the edit-revert net this builds on), [DDR-050](./DDR-050-canvas-undo-redo-command-stack.md) (the undo store this hardens), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (why the canvas iframe store is per-window in split-origin).

## Context

DDR-158 made every text SURFACE editable, but the inline-edit engine (`applyTextEdit`) still only rewrote a literal — a static `JSXText` or a `{'string literal'}`. Real Maude/StudyFi canvases render most of their copy from data: `<p>{t.body}</p>` inside `TOPICS.map((t) => …)`, `<div>{title}</div>` from a local const, `<p>{beat.caption}</p>` in a component fed `<GuideBeat beat={BEATS[0]} />`. Users double-clicked these, typed, and hit the DDR-150 revert toast ("has dynamic content"). The user's framing was decisive: **"text is text" — the literal-vs-variable distinction must not leak to them.** A follow-up round (explicitly requested, no plan file) made variable text editable, then fixed the two things that surfaced from it: undo/redo of a variable edit, and undo surviving the reload.

## Decision

### 1. Trace `{variable}` text back to its source string — never guess the wrong one

`applyTextEdit` gains a resolver (`resolveDynamicTextSpan` + a bounded `resolveValueNode` evaluator) that, for a single `{base}` / `{base.field}` text child, resolves `base` through **three bindings** and rewrites the source StringLiteral it points at:

- **`.map()` callback param** → the mapped array's items (a local `const` array or an inline `[…]`).
- **component prop** → the value of that prop on each `<Comp prop={…}>` usage, in source order.
- **local `const`** → its string value.

Each candidate runs through the evaluator, which follows const bindings, numeric array indices (`BEATS[0]`), and object fields (`.caption`) — depth-capped at 8. `beat.caption` where `beat={BEATS[2]}` resolves to `BEATS[2].caption`. Genuinely computed text (`{price.toFixed(2)}`, template strings, `a + b`, ternaries) has no single source string → still refuses and routes to `/design:edit` (graceful, the DDR-150 hint). The build-time `data-cd-editable` marker gains a `"var"` value so the gate opens for these (`text` = literal, rewritten in place).

### 2. Occurrence + pre-edit text pick the right instance — the safety spine

A `.map()`/component renders ONE source element N×, so the client sends the **occurrence** (index among same-cd-id DOM nodes) with the commit; the resolver indexes the candidate list by it. But an index alone is unsafe (a `.filter().map()`, a reorder), so the **pre-edit text** (`before`) is the primary key: the picked candidate must match `before`; on mismatch, a UNIQUE `before`-match across all candidates rescues it; ties are **never guessed** (return null → refuse). This makes "edit the wrong card" structurally impossible rather than merely unlikely — the reason this warranted a DDR over an ad-hoc patch.

The write itself is unchanged from DDR-150's inert path: the resolved StringLiteral span is overwritten via `JSON.stringify(text)`, so the value can never escape the JS string literal (no markup/expression injection).

### 3. Undo/redo re-targets through the same resolver

The edit-source undo record carries the occurrence; `do()`/`undo()` pass the value CURRENTLY on disk as the resolver's `before` (the side being replaced FROM — `before` on redo, `after` on undo), so a Cmd+Z of a variable edit re-finds the same array item. Literal text ignores both.

### 4. Undo survives the HMR iframe reload (split-origin) via sessionStorage

An artboard text edit rewrites the `.tsx` → HMR reload of the canvas iframe. In split-origin (DDR-054) the undo store lives on the **iframe's own window** (`window.top` is cross-origin), which the reload destroys → Cmd+Z afterwards found an empty stack (annotation edits write a sidecar SVG, never reload → their history survived — the asymmetry users reported). The stack now mirrors to **sessionStorage** (`maude-undo:<canvasFile>`, per-origin, survives a reload), validated + size-capped on load. The in-memory window Map stays the fast path; sessionStorage is the durable backstop.

## Rejected

- **Flatten mixed content to plain text on commit** — destroys inline formatting / the dynamic binding; data loss.
- **Occurrence index alone** — silently edits the wrong `.map()` item when the array is filtered/reordered. The `before`-verification + unique-match + no-guess rule is the whole point.
- **Extending the engine to rewrite computed expressions** — no single source string exists; correctly routes to the agent.

## Consequences

- Inline text editing now works for the data-driven text that dominates real canvases; the literal-vs-variable distinction is invisible to the user.
- New editable-text shapes must keep the build-time `data-cd-editable` predicate (`inlineEditableKind`) in lockstep with `applyTextEdit`'s acceptance, and the client must keep sending occurrence + `before` for `var` edits (undo/redo depends on it).
- **Verification ceiling (honest):** the variable-editing round-trip is covered by unit tests, real-canvas scripts, and the desktop-e2e (`.map()` card edit + undo/redo, 9/9). The undo-across-reload fix manifests ONLY in split-origin, which neither the desktop-e2e (forces same-origin) nor agent-browser (can't penetrate the cross-origin iframe, per DDR-159) can exercise — it is unit-tested via a window-store-wipe simulation and needs a real split-origin `dev:desktop` confirmation. The custom-caret blink (DDR-158) is likewise a user-visual gate.

### Security posture (defender + attacker review, 2026-07-10)

The JS/JSX-injection invariant holds STRUCTURALLY: the resolver only ever overwrites a proven `StringLiteral` span with `JSON.stringify(text)`, single-file-scoped (no import following), so a `{variable}` edit can never inject executable source or hit the wrong file. Every net-new risk the attacker surfaced is **downstream of the already-accepted DDR-054 F1 residual** (a canvas-origin XSS/RCE, deferred to the Task-8 CSP) and **does not affect solo-mode users** (no split origin; the canvas is the user's own trusted content). The three cheap hardenings the review recommended were landed rather than deferred, because they close a source-write path strictly more dangerous than the `select` path the shell already guards:

- **Active-window gate on the write relays** — `edit-text` / `apply-edit` now require `e.source === activeWin`, mirroring the existing `select` guard (`client/app.jsx`). A background/synced untrusted canvas can no longer drive a gestureless source write into another canvas; this also shrinks the blast of a restored undo record to the active canvas (attacker F-B, and the cross-canvas leg of the F-A chain).
- **Durable-store validation** — the sessionStorage undo layer now runs a DDR-054 §2g `__proto__`/`constructor`/`prototype` reviver on load AND validates each restored `CommandRecord`'s shape, so a poisoned `maude-undo:*` entry can't replay an arbitrary record on Cmd+Z (attacker F-A / defender LOW #1+#2).
- **Resolver DoS caps** — a candidate-count cap (1000) in the resolver and a 4 MB canvas-byte cap before the AST walk bound the per-candidate `walkAst` cost (attacker F-C).

The residual: the durable undo layer widens the *post-exploitation* profile of the F1 residual from "momentary" to "persistent + cross-canvas" — consciously accepted here on the same DDR-054 deferral basis (F1-contingent, solo-mode-unaffected, mitigated by the active-window gate). Reports: `.ai/logs/security-reviews/unified-text-editing-20260710-{defender,attacker}.md`.
