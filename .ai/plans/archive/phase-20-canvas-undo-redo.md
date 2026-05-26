# Feature: Canvas Undo / Redo (Cmd+Z / Cmd+Shift+Z)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports (DDR-045 paths, DDR-013 module layout, DDR-048 input-router classify table).

## Description

Per-canvas in-memory undo/redo stack v dev-server UI. **Cmd+Z** undoes the last destructive edit, **Cmd+Shift+Z** (a **Cmd+Y** na non-mac) redo. Cíl: během iterace na canvasu (drag artboardu, kresba, marquee batch-move, equal-spacing distribute, annotation resize, comment drop) jde každý krok vrátit zpět bez sahání do gitu nebo na slash `/design:rollback`.

Cmd+Z/Shift+Z **není** rollback na file-úroveň — to zůstává `/design:rollback` (`_history/<slug>/` snapshot stack, viz `plugins/design/dev-server/history.ts`). Tohle je granulární, per-canvas, in-memory, ephemerální (zahazuje se při switch canvasu / external file edit / reload).

## User Story

Jako designer iterující na canvasu chci stisknout Cmd+Z a vrátit poslední úpravu (drag, stroke, spacing distribute, comment, …), abych mohl rychle experimentovat bez strachu, že každý gestou nenávratně přepíšu `.meta.json` nebo `.annotations.svg`.

## Problem

- Drag artboardu commitne přes `patchCanvasMeta({ layout })` synchronně do `.meta.json` (`canvas-lib.tsx:1283`). Žádný revert kromě `git`.
- Marquee batch-move (DDR-048) commitne všechny dragnuté artboardy najednou — single gesto = N file writes.
- Equal-spacing handles (`equal-spacing-handles.tsx`) distributují pozice → commit do meta.
- Annotation strokes (`annotations-layer.tsx:695`) PUT-ují celý SVG po 200 ms debounce → poslední tah překreslí soubor.
- Comments (WS `commentsPatch` v `ws.ts:77`) měnit text / status bez možnosti undo.
- Phase 4.2 plán (`.ai/plans/archive/phase-4.2-artboard-free-move.md:333`) tenhle gap explicitně odložil: *"Undo/redo for drag commits — single-canvas undo isn't infra'd yet. … Add when project-wide undo is planned."*

S každou novou interaktivní vrstvou (Phase 5 draw, Phase 5.1 annotations FigJam, Phase 6 comments, marquee, equal-spacing) ten dluh roste — uživatel očekává Cmd+Z stejně jako ve Figmě.

## Solution

**Command-pattern stack, ne snapshot stack.** Každý mutator emituje `EditCommand { kind, do(), undo(), label }` s inverzním payloadem (např. `MoveArtboardsCommand` drží `before: Map<id,{x,y}>` a `after: Map<id,{x,y}>`). Stack je per-canvas-iframe, in-memory, max 50 hluboko (ring), žije v React contextu vedle existujícího `useToolMode`/`useSelectionSet`.

**Cmd+Z routing:** rozšířit `classify()` v `input-router.tsx` o `RouterAction { kind: 'undo' | 'redo' }` (dnes Cmd+letter → `no-op` na řádku 125–128). Shell wirne callback do `UndoStackContext.undo()` / `.redo()`.

**Inverze:**
- Move/marquee: před → po pozice (jen dotčené ID).
- Annotation stroke add/erase: `{ added: Stroke[], removed: Stroke[] }`.
- Comment create/resolve/edit: snapshot prev comment object (malý JSON, ≤ 4 KB) + nová verze.
- Viewport pan/zoom: **NE v undo stacku** (Figma/Sketch konvence — viewport je ephemerální navigace, ne edit). `Cmd+0` = fit, viewport historie se nedrží.
- Selection: **NE v undo stacku** (taky Figma konvence — jen edits, ne selection).

**Server kompatibilita:** žádné API změny v `api.ts` / `http.ts`. Undo prostě zavolá ten samý `patchCanvasMeta` / `PUT /_api/annotations` / WS `commentsPatch` s inverzním payloadem. Server zůstává stateless ohledně undo — celý stack je client-side.

**External-edit invalidation:** existující `fs-watch.ts` broadcastuje HMR reload (DDR-013). Když přijde external file change pro aktivní canvas, stack se vyprázdní a HUD toast informuje (jinak by undo restoroval stale stav).

**Phase 8 forward-compat:** až přijde Yjs (live collab), undo se přepne na `Y.UndoManager` (operuje na shared types automaticky). Aktuální `UndoStackContext` má identický public interface (`undo()`, `redo()`, `push(cmd)`) jen swap implementace. To je explicitní v DDR-poznámce — žádné premature CRDT abstrakce, ale interface se nezmění.

## Metadata

- **GitHub Issue**: TBD — otevři po review tohoto plánu
- **Type**: New Capability
- **Complexity**: Medium (5 mutator surfaces × wiring, 1 input-router rozšíření, 1 React context, ~6 unit testů)
- **App/Package**: `plugins/design/dev-server/`
- **Affected Systems**: input-router, canvas-lib (`DesignCanvas` ↔ artboard drag), annotations-layer, comments-overlay, marquee-overlay, equal-spacing-handles, contextual-toolbar
- **Dependencies**: žádný nový npm dep. Použít React 19 `useReducer` + `useSyncExternalStore` (stack je dlouhodobě nemutabilní mimo `dispatch`).

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/input-router.tsx` (lines 90–232) — `classify()` dispatch table. Cmd+letter dnes routuje na `no-op` (řádek 125–128) — sem přidat Cmd+Z/Cmd+Shift+Z.
- `plugins/design/dev-server/input-router.tsx` (lines 420–461) — `onKeyDown` listener registrace, `addEventListener('keydown', …, true)` capture mode na document.
- `plugins/design/dev-server/canvas-lib.tsx` (lines 451–479) — `patchCanvasMeta()` jediný call site na PATCH `/_api/canvas-meta`. Sem se musí napojit `MoveArtboardsCommand.do()` / `.undo()`.
- `plugins/design/dev-server/canvas-lib.tsx` (lines 1270–1290) — `commitArtboardPositions` (drag commit). Místo přímého `patchCanvasMeta` volat `undoStack.push(new MoveArtboardsCommand(before, after))`.
- `plugins/design/dev-server/use-artboard-drag.tsx` — kde se commit hand-off děje pro single drag (a marquee batch).
- `plugins/design/dev-server/artboard-marquee.tsx` + `marquee-overlay.tsx` — batch select + group move; jedna gesta = jeden `MoveArtboardsCommand` s N artboardy.
- `plugins/design/dev-server/equal-spacing-handles.tsx` + `equal-spacing-detector.ts` — distribute → tady to commitne batch pozic.
- `plugins/design/dev-server/annotations-layer.tsx` (lines 688–711) — `scheduleSave()` 200 ms debounce PUT. Komand musí flush-nout pending save **před** push do stacku (jinak inverze míchá staré + nové strokes).
- `plugins/design/dev-server/comments-overlay.tsx` (lines 380–400) — comment create POST.
- `plugins/design/dev-server/ws.ts` (lines 70–90) — WS `comment:patch` handler (server consumes `commentsPatch`).
- `plugins/design/dev-server/fs-watch.ts` — HMR broadcast. Tady přidat `'canvas-meta-external'` event hook (nebo reusovat existing reload signal) pro invalidaci stacku.
- `plugins/design/dev-server/canvas-shell.tsx` — kořen iframe React stromu; sem mount `<UndoStackProvider>` a HUD toast.
- `plugins/design/dev-server/history.ts` (whole) — **read-only kontext.** Tohle je file-grained `/design:rollback` cesta, NE undo. Plán to záměrně **neměkká** — granulární undo a file rollback jsou dva oddělené mechanismy.
- `.ai/plans/archive/phase-4.2-artboard-free-move.md:333` — explicit deferral, zdroj motivace.
- `.ai/plans/phase-8-live-collaboration-yjs-lan.md` — Phase 8; v DDR uvést, že interface `UndoStackContext` zůstane stejný i po swapu na `Y.UndoManager`.

### Files to Create

- `plugins/design/dev-server/undo-stack.ts` — typy `EditCommand`, `UndoStackState`, reducer + factory. Pure logic (žádný React, žádný DOM) → snadno testable přes `bun:test`.
- `plugins/design/dev-server/use-undo-stack.tsx` — React Context + Provider + `useUndoStack()` hook. Wraps reducer + flushes external-edit invalidation z fs-watch.
- `plugins/design/dev-server/commands/move-artboards-command.ts` — první command type. Drží `before: Map<id,{x,y}>`, `after: Map<id,{x,y}>`. `do()` a `undo()` posílají PATCH přes injectnuté `patchFn`.
- `plugins/design/dev-server/commands/annotation-strokes-command.ts` — `{ added: Stroke[], removed: Stroke[] }`. `do()` posílá nový SVG payload, `undo()` posílá previous.
- `plugins/design/dev-server/commands/comment-command.ts` — `CommentCreate` / `CommentEdit` / `CommentDelete` / `CommentResolve` varianty.
- `plugins/design/dev-server/commands/equal-spacing-command.ts` — wrapper kolem `MoveArtboardsCommand` (sdílí pozice diff).
- `plugins/design/dev-server/undo-hud.tsx` — minimální toast "Undo: move 3 artboards" / "Redo: stroke" v rohu canvas-shellu, 1.2 s auto-dismiss.
- `plugins/design/dev-server/test/undo-stack.test.ts` — reducer semantika (push, undo, redo, branch-discard, depth cap).
- `plugins/design/dev-server/test/input-router-undo.test.ts` — classify Cmd+Z / Cmd+Shift+Z / Cmd+Y / isEditable guard.
- `plugins/design/dev-server/test/move-artboards-command.test.ts` — inverze pozic, idempotence redo.
- `plugins/design/dev-server/test/annotation-strokes-command.test.ts` — add/erase round-trip.
- `.ai/decisions/DDR-050-canvas-undo-redo-command-stack.md` — viz Decisions sekce níže.

### Documentation

- DDR-013 (`.ai/decisions/DDR-013-server-modular-split-typescript.md`) — module layout convention, ≤ 300 LOC per file.
- DDR-045 (`.ai/decisions/DDR-045-real-disk-path-resolution-for-compiled-dev-server.md`) — path discipline; tady irelevant ale uvádí dev-server compile constraints.
- DDR-048 (input-router classify table) — pattern, jak rozšířit `RouterAction`.
- React 19 `useSyncExternalStore` docs — preferovaný pattern pro Context se subscriberem mimo React (potřebujeme to pro fs-watch hook).
- Figma UX reference: viewport + selection jsou ne-undoable. Toto je standard, nepřevracet.

### Patterns to Follow

Příklad rozšíření `classify()` (`input-router.tsx:122–141`):

```ts
if (input.type === 'keydown') {
  if (input.isEditable) return { kind: 'no-op' };
  if (input.metaKey || input.ctrlKey) {
    const k = (input.key || '').toLowerCase();
    if (k === 'z' && input.shiftKey) return { kind: 'redo' };
    if (k === 'z') return { kind: 'undo' };
    if (k === 'y') return { kind: 'redo' };           // Windows / Linux konvence
    if (input.key === 'Escape') return { kind: 'escape' };
    return { kind: 'no-op' };
  }
  // … (existing tool letters)
}
```

Příklad command tvaru (sleduje DDR-013 module split a aktuální `History` interface naming):

```ts
// undo-stack.ts
export interface EditCommand {
  readonly kind: string;              // 'move-artboards' | 'annotation-strokes' | …
  readonly label: string;             // HUD: "move 3 artboards"
  do(): Promise<void> | void;
  undo(): Promise<void> | void;
}

export interface UndoStackState {
  past: EditCommand[];
  future: EditCommand[];
  depth: number;                      // ring cap = 50
}
```

Příklad provider mount v `canvas-shell.tsx` (root iframe React strom):

```tsx
<UndoStackProvider canvasFile={file} onExternalEdit={() => stack.clear()}>
  <DesignCanvasFrame …>
    {/* existing kids */}
  </DesignCanvasFrame>
  <UndoHud />
</UndoStackProvider>
```

---

## Design Decisions

> Tahle feature je dev-tool UI (canvas-shell HUD + keyboard), ne brand surface. Žádný design-system probe není potřeba — sleduj existing tool-palette / context-menu / contextual-toolbar vizuál.

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `tool-palette.tsx` styling | `plugins/design/dev-server/tool-palette.tsx` | Match jeho `--bg-2` background + `--fg-1` text pro `UndoHud` toast — drží shell-chrome consistency. |
| `context-menu.tsx` motion | `plugins/design/dev-server/context-menu.tsx` | Fade-in 120 ms, fade-out 200 ms — reuse `--dur-fast` / `--dur-base`. `prefers-reduced-motion` → 1 ms collapse (DDR-043 invariant). |

### Existing screens / blocks reused

Žádný — undo HUD je nová minor surface (≤ 200 LOC, jeden toast div).

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| Žádný | — | — | HUD je text-only ("Undo: move 3 artboards"). Žádné glyfy. |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| HUD background | `--bg-2` | Match tool-palette / contextual-toolbar. |
| HUD text | `--fg-1` | Secondary text role. |
| HUD border | `--border-subtle` | 1px hairline. |
| Fade-in duration | `--dur-fast` | 120 ms. |
| Fade-out duration | `--dur-base` | 200 ms. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `UndoHud` | Žádný toast komponent v dev-serveru nemáme. | — (čistě inline-styled `<div>` v `canvas-shell.tsx`) |

---

## Tasks

Execute in order. Each task is atomic and testable. Pure logic (Tasks 1–5) jde paralelně s wiring (Tasks 6–10) — sebrat to do bumpu když je core stack zelený.

### Task 1: CREATE `undo-stack.ts` reducer + types

- **Do**: Definuj `EditCommand`, `UndoStackState`, `UndoAction = { type: 'push' | 'undo' | 'redo' | 'clear', cmd? }`. Reducer: `push` zahodí `future`, append do `past`, capnij na 50 (shift z hlavy). `undo`: vezmi top of past, zavolej `cmd.undo()`, přesuň do `future`. `redo`: vezmi top of future, zavolej `cmd.do()`, přesuň do `past`. `clear`: reset obojí.
- **Pattern**: Sleduj reducer styl z `use-selection-set.tsx` (immutable spread, žádné mutace).
- **Gotcha**: `cmd.do()` / `.undo()` mohou být async (server PATCH). Reducer ale musí být synchronous → vrať promise z dispatcheru, ne z reduceru. Pattern: `dispatch({ type: 'undo' })` v hooku, který interně `await cmd.undo()` **před** state updatem (jinak HUD ukáže "Undo: X" ale write selhal). Možná `useReducer` nestačí → custom hook s plain state + async runner.
- **Validate**: `bun test plugins/design/dev-server/test/undo-stack.test.ts` — 8 testů (push, double-push, undo, undo-empty, redo, redo-empty, push-discards-future, depth-cap-50).

### Task 2: CREATE `use-undo-stack.tsx` React Context + Provider

- **Do**: `UndoStackProvider` drží state, exposuje `{ push, undo, redo, canUndo, canRedo, lastLabel }`. Subscribe na fs-watch HMR signal (přes window event nebo existing `useCanvasReload` hook) → na external edit pro aktivní canvas zavolej `clear()` + nasypej label "Edit history reset (external change)".
- **Pattern**: `useSyncExternalStore` pro fs-watch subscribe; viz [React 19 docs](https://react.dev/reference/react/useSyncExternalStore). `createContext` defaults na no-op (provider missing = silent disable).
- **Gotcha**: Provider musí být **per canvas iframe**, ne shell-wide. Switch canvasu = nový iframe = nový provider = prázdný stack. Confirm to testem.
- **Validate**: `bun test plugins/design/dev-server/test/use-undo-stack.test.ts` — render provider, push fake command, undo, assert command.undo() called once.

### Task 3: UPDATE `input-router.tsx` classify table → `undo` / `redo` action kinds

- **Do**: Přidej `{ kind: 'undo' } | { kind: 'redo' }` do `RouterAction` union. V `classify()` rozšiř Cmd+letter větev (řádek 125–128) o Cmd+Z / Cmd+Shift+Z / Cmd+Y (Windows redo). `isEditable` guard zůstává — typing do `<textarea>` nesmí trigger undo (browser native undo wins tam).
- **Pattern**: Stejné jako tool-letter větev. **Pozor**: `metaKey || ctrlKey` — chytá oba mac+windows. Nepřidávej platform sniff.
- **Gotcha**: Browser native Cmd+Z na `<input>` / `<textarea>` v canvas content musí fungovat (text editing v artboard). `isEditable` to už řeší. Ale Cmd+Z mimo input v iframe musí být **preventDefault**-ed jinak browser udělá nějakou page-level akci (žádnou, ale buď safe). Listener už je `addEventListener('keydown', …, true)` capture mode (řádek 449) — preventDefault uvnitř onKeyDown po klasifikaci na `'undo'`.
- **Validate**: `bun test plugins/design/dev-server/test/input-router.test.ts` — přidej 6 case: Cmd+Z, Cmd+Shift+Z, Ctrl+Z, Ctrl+Y, Cmd+Z s isEditable=true (→ no-op), Cmd+Z s altKey=true (→ no-op).

### Task 4: UPDATE `input-router.tsx` `useInputRouter` → `onUndo` / `onRedo` callbacks

- **Do**: Přidej `onUndo?: () => void`, `onRedo?: () => void` do `RouterCallbacks`. V `onKeyDown` po classify volej `callbacks.onUndo()` / `.onRedo()` + `e.preventDefault()`.
- **Pattern**: Sleduj `onTool` / `onEscape` přidávací styl.
- **Gotcha**: `useInputRouter` hook si callbacks bere přes `useRef` (latest-ref pattern, řádek ~440) aby se nelistenil re-attach. Drž to.
- **Validate**: typecheck `bun tsc --noEmit` v `plugins/design/dev-server/`.

### Task 5: CREATE `commands/move-artboards-command.ts`

- **Do**: Třída/factory `MoveArtboardsCommand(before, after, patchFn)`. `before` a `after` jsou `Map<artboardId, { x: number, y: number }>`. `do()` a `undo()` volají `patchFn({ layout: { artboards: […] } })` — to je injection point, aby tests nemuseli stubovat globální fetch. Label: `"move ${before.size} artboard${s}"`.
- **Pattern**: Sleduj `patchCanvasMeta` payload shape (`canvas-lib.tsx:451`).
- **Gotcha**: Aktuální `patchCanvasMeta` přijímá **celý** layout array, ne diff (`api.ts:523–528` shallow-merge). Takže `do()` / `undo()` musí znát plný `ArtboardRect[]` aktuálního canvasu, ne jen N dotčených → command si při `push` čte celý layout. Tady je past: kdyby v mezičase přibyl artboard přes external edit, undo by ho retoroval pryč. → To je proč Task 2 vyžaduje external-edit invalidaci.
- **Validate**: `bun test test/move-artboards-command.test.ts` — vytvoř, `do()` → assert patchFn volaný s `after`, `undo()` → assert patchFn volaný s `before`.

### Task 6: UPDATE `canvas-lib.tsx` `commitArtboardPositions` → push do undo stacku

- **Do**: Místo přímého `patchCanvasMeta(…)` zavolat `undoStack.push(new MoveArtboardsCommand(before, after, patchCanvasMeta))`. Push zahrnuje `do()`, takže write proběhne. `before` snapshot vezmi z `worldState.artboardsBeforeDrag` (drag hook už drží start positions).
- **Pattern**: `useArtboardDrag` už drží `dragStart` ref s pre-drag positions — reuse.
- **Gotcha**: Drag, který jen "kliknul a pustil" (žádný movement, dx=dy=0) **nepushovat** — žádný edit nenastal. Detect přes `before` ≡ `after` deep-equal a skip.
- **Validate**: Manual smoke v dev-serveru (Task 12) — drag artboard, Cmd+Z → návrat, Cmd+Shift+Z → znovu.

### Task 7: UPDATE `artboard-marquee.tsx` / `marquee-overlay.tsx` → batch command

- **Do**: Marquee group-move už agreguje pozice přes selection set. Při release vytvoř **jeden** `MoveArtboardsCommand` s N entries v `before` / `after`. Ne N samostatných commands (uživatel by musel Cmd+Z N-krát).
- **Pattern**: Reuse Task 5 command, jen větší map.
- **Gotcha**: Marquee může mít také batch-resize / batch-rotate v budoucnu (ne v této fázi). Drž command API rozšiřitelné — `MoveArtboardsCommand` ne `TransformCommand`. Budoucí `ResizeArtboardsCommand` bude separate.
- **Validate**: Manual — marquee 3 artboardy, drag, Cmd+Z → všechny tři zpět najednou.

### Task 8: UPDATE `equal-spacing-handles.tsx` → `EqualSpacingCommand` wrapping `MoveArtboardsCommand`

- **Do**: Equal-spacing distribute vrací nové pozice pro N artboardů → zabaľ do `MoveArtboardsCommand` se label `"equal-space ${N} artboards"`. Žádný nový command type — jen label override.
- **Pattern**: Factory function vrací `MoveArtboardsCommand` s custom label.
- **Gotcha**: Equal-spacing detector je čistý algoritmus (`equal-spacing-detector.ts`) — neoperuje na DOM. Wiring do undo stacku se děje v handles komponentě, ne v detektoru.
- **Validate**: Manual — selectni 3 artboardy, equal-space, Cmd+Z → původní (nerovnoměrné) rozložení.

### Task 9: CREATE `commands/annotation-strokes-command.ts` + UPDATE `annotations-layer.tsx`

- **Do**: `AnnotationStrokesCommand(file, prevStrokes, nextStrokes, putFn)`. `do()` posílá `PUT /_api/annotations` s `nextStrokes` jako SVG. `undo()` posílá `prevStrokes`. V `annotations-layer.tsx` `setStrokes` (řádek 705): **před** push do undo stacku flush-ni pending `scheduleSave` timer (jinak inverze dostane stale prev). Druhá past: stroke add po stroke add v rychlé sekvenci → každý jeden command, nebo coalesce do 500 ms okna? — **Decision: každý stroke jeden command.** Figma to dělá taky (Cmd+Z = jeden tah). Coalesce vede k matoucímu UX ("proč mi Cmd+Z vrátí dva tahy?").
- **Pattern**: Same shape as `MoveArtboardsCommand` ale full SVG payload místo diffu.
- **Gotcha**: Eraser tool maže existing strokes → `prev = [stroke1, stroke2, stroke3]`, `next = [stroke1, stroke3]`. Command je správný (nahrazuje celý set), ne diff. Důvod: server endpoint je `PUT` celého souboru, ne `PATCH` diff. Větší payload, ale jednoduché.
- **Validate**: `bun test test/annotation-strokes-command.test.ts` — add stroke, undo → empty SVG, redo → stroke zpět. Manual: nakresli 3 tahy, Cmd+Z 3× → prázdno, Cmd+Shift+Z 3× → zpět.

### Task 10: CREATE `commands/comment-command.ts` + UPDATE `comments-overlay.tsx` + `ws.ts`

- **Do**: Tři varianty: `CommentCreateCommand` (do = POST `/_comments`, undo = WS `comment:delete`), `CommentEditCommand` (do = WS `comment:patch` new text, undo = WS `comment:patch` prev text), `CommentResolveCommand` (do = `status:'resolved'`, undo = `status:'open'`). Server-side: `ws.ts:77` už má `commentsPatch` handler. Přidej **`comment:delete`** message type (server delete by id) — neexistuje dnes; verify via `api.ts` interface `commentsPatch`. Pokud `commentsDelete` chybí, dopiš ho minimálně (line ~140 v `api.ts`, mirror `commentsPatch` flow).
- **Pattern**: Same shape — `prev` snapshot, `next` payload.
- **Gotcha**: Comments persistují přes WS broadcast (Phase 6) → undo create musí dělat full delete (ne soft hide). Pokud chybí `commentsDelete`, je to **scope creep** — buď přidej minimální `commentsDelete(id): Promise<boolean>` jako součást této fáze, **nebo** dočasně comments z undo vynechej a otevři follow-up issue. **Doporučuju druhé** — nepřibírat server API změny mimo skein této fáze. Comments out of v0 of undo; document in plan retro a otevři follow-up.
- **Validate**: Manual — drop comment, Cmd+Z → pin zmizí; resolve comment, Cmd+Z → unresolve. Pokud Task 10 vypadne dle gotchy nahoře, tento step skip-ni.

### Task 11: CREATE `undo-hud.tsx` + mount v `canvas-shell.tsx`

- **Do**: Minimal `<div>` v top-right rohu canvas iframe, fixed pos, z-index nad selection halo. Text = `lastLabel` z context. Auto-dismiss 1.2 s po posledním `push` / `undo` / `redo`. CSS: `--bg-2` background, `--fg-1` text, `--dur-fast` fade-in / `--dur-base` fade-out. `prefers-reduced-motion` → 1 ms (DDR-043).
- **Pattern**: Sleduj toast pattern z `export-dialog.tsx` (success message po export).
- **Gotcha**: HUD nesmí intercept-ovat clicks (`pointer-events: none`). Test: klikni "skrze" HUD na artboard pod ním → selection musí proběhnout.
- **Validate**: Manual — trigger 3× po sobě undo, HUD updatuje label bez flickeru.

### Task 12: UPDATE `canvas-shell.tsx` → wire `onUndo` / `onRedo` z input-routeru do contextu

- **Do**: `useInputRouter({ onUndo: () => undoStack.undo(), onRedo: () => undoStack.redo(), … })`. `<UndoStackProvider>` mount kolem `<DesignCanvasFrame>` (nebo dovnitř, podle toho co je per-canvas).
- **Pattern**: Existing context mounts v `canvas-shell.tsx`.
- **Gotcha**: Focus management — input-router listener je na `document` v capture mode (řádek 449). Když je shell focused (ne canvas iframe), key event jde do **shell** routeru, ne canvas. Provider tedy musí buď žít v shellu (sdílený stack napříč canvasy = špatně), nebo shell forwarduje undo signal aktivnímu iframe přes window.postMessage. **Decision: provider per iframe (per canvas).** Shell-level Cmd+Z jen forwarduje do focused iframe přes `iframe.contentWindow.postMessage({ type: 'mdcc:undo' })`. Iframe poslouchá window message a interně dispatch-uje. Více kódu, ale clean separation. **Pozor**: tohle vyžaduje druhý listener path v `input-router.tsx` (window message → action) — nebo separátní `use-window-message-router.tsx`. Designe to v Task 12 detail spec.
- **Validate**: Manual — focus shell (klikni mimo iframe), Cmd+Z → musí pořád fungovat na active canvas.

### Task 13: External-edit invalidation hook

- **Do**: `fs-watch.ts` už broadcastuje HMR reload signal na WS. Klient (canvas iframe) ho dostává přes existing `useCanvasReload` (nebo hard reload of iframe — verify). Když přijde signál pro active canvas file, `UndoStackProvider` zavolá `clear()` + setLastLabel("Edit history reset"). HUD jednou flushne label, pak dismiss.
- **Pattern**: Subscribe-once v `useEffect` Provider mount.
- **Gotcha**: HMR může proběhnout i pro JS reload (build watcher). Filtruj signál na file = current canvas file. Pokud aktuální `fs-watch.ts` neumí "external vs. self-induced" rozlišit, přidej krátký debounce (ignore reload do 300 ms po vlastním PATCH-i, považuj za echo).
- **Validate**: Manual — drag artboard, otevři `.meta.json` ručně v editoru, zapiš, focus zpět na canvas, Cmd+Z → HUD "Edit history reset", undo no-op.

### Task 14: DDR-050 — Canvas Undo/Redo Command Stack

- **Do**: Napiš `.ai/decisions/DDR-050-canvas-undo-redo-command-stack.md` s rozhodnutími:
  1. Command-pattern (inverse-payload), ne snapshot.
  2. Per-canvas-iframe scope, in-memory, ephemerální. Žádná persistence napříč session-y.
  3. Viewport + selection **ne**-undoable.
  4. Phase 8 swap: interface `UndoStackContext` zůstává; impl přepne na `Y.UndoManager`.
  5. Depth cap = 50. Důvod: typický design session má 10–30 edits před save / canvas switch.
  6. External edit invalidation = stack clear (ne attempt-to-merge).
  7. Comments v0 out — follow-up issue (Task 10 gotcha).
- **Pattern**: Sleduj DDR-013 + DDR-048 strukturu.
- **Validate**: Read-back, peer review (asked v PR).

### Task 15: Tests — full bun:test pass

- **Do**: Spusť `bun test plugins/design/dev-server/` — všechny 8+ nových testů + existing 287 musí projít.
- **Pattern**: `bun:test` (DDR-013).
- **Gotcha**: Snapshot testy v `dist/client.bundle.js` se nebudou updatovat manuálně — `bun run build.ts` re-runne build a smoke test asserts size budget < 80 KB gz.
- **Validate**: `bun test` + `bun run build.ts` v `plugins/design/dev-server/`.

### Task 16: UPDATE `plugins/design/commands/help.md` (a `CATEGORIES.md` pokud má knihu shortcuts)

- **Do**: Přidej Cmd+Z / Cmd+Shift+Z do shortcut tabulky vedle `V/H/C/B/R/O/A/E`. Žádný separátní slash command — undo je čistě keyboard.
- **Pattern**: Existing shortcuts sekce.
- **Validate**: Manual read-back, slash command `/design:help` zobrazí update.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm biome lint plugins/design/dev-server/`
2. **Types**: `bun tsc --noEmit -p plugins/design/dev-server/tsconfig.json`
3. **Tests**: `bun test plugins/design/dev-server/`  (target 287 → 295+ tests, 0 fail)
4. **Build**: `bun run plugins/design/dev-server/build.ts` (assert bundle ≤ 80 KB gz)
5. **Cross-platform scenario**: tohle je in-dev-server UI, ne uživatelský produkt → **scenario-runner se nehodí**. Místo toho manual smoke v Task 12+13 = autoritativní validace. Nepředstírej, že tu existuje `scenario-runner` flow.
6. **Design System Guard**: skip — dev-server HUD je internal tool chrome, ne brand surface (žádný `<designRoot>/system/` DS check).
7. **A11y**: Cmd+Z přes klávesnici je inherentně keyboard-only path → ✅. HUD toast musí být `aria-live="polite"` aby screenreader oznámil "Undo: move 3 artboards". Validate Task 11 spec.
8. **Manual**:
   - Single drag → Cmd+Z → restore.
   - Marquee batch drag 3 artboards → 1× Cmd+Z → all restored.
   - Equal-space → Cmd+Z → original spacing.
   - Annotation stroke add → Cmd+Z → stroke gone; Cmd+Shift+Z → stroke back.
   - Eraser delete stroke → Cmd+Z → stroke back.
   - Comment drop → Cmd+Z → comment gone (jen pokud Task 10 v scope; jinak skip).
   - External `.meta.json` edit → stack invalidates, HUD says "Edit history reset".
   - Cmd+Z inside `<textarea>` (focus na input v artboard) → browser native text undo, NE canvas undo.
   - Switch canvas (open jiný `.tsx` v shell) → undo stack restartuje na prázdno.
   - 50× drag → 51× Cmd+Z → poslední edit už nejde undo-nout (depth cap reached).
   - Cross-platform: Mac Cmd+Z, Windows/Linux Ctrl+Z a Ctrl+Y.

---

## Scenario Coverage (UI tasks — required)

Aplikuje se na user-facing UI features. Toto je **dev-server vnitřní UI** (interakce v Maude orchestrator chrome, ne aplikace, kterou by uživatel sám deployoval). Žádné `.ai/scenarios/` runner-y. Validace = manuál smoke list v Validation #8.

---

## Acceptance Criteria

- [ ] All tasks completed (Task 10 může být partial — comments out of v0 acceptable, follow-up issue otevřen)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` passes overall:
  - [ ] Static (`biome lint`, `bun tsc --noEmit`, no new warnings beyond pre-existing 4)
  - [ ] Tests (`bun test` — target 295+ tests, 0 fail)
  - [ ] Build (`bun run build.ts` — bundle ≤ 80 KB gz)
  - [ ] Manual smoke list (10 items in Validation #8) — všechny zelené
- [ ] DDR-050 napsaný a linked z STATE.md
- [ ] `plugins/design/commands/help.md` updated (shortcut tabulka)
- [ ] Code follows project conventions, no regressions in DDR-048 input-router classify
- [ ] Phase 8 forward-compat note v DDR-050 explicit — `UndoStackContext` interface freeze

---

## Risks

1. **Focus / iframe message-passing complexity (Task 12 gotcha).** Shell-level Cmd+Z vs canvas-level scoped stack — pokud postMessage forwarding nesedne, pošli plán k revize. **Mitigace**: prototyp Task 12 první (před wiring), validate s 2 otevřenými canvasy.
2. **`fs-watch` echo problem (Task 13 gotcha).** Self-induced PATCH reload → invaliduje vlastní stack. **Mitigace**: 300 ms debounce s self-write timestamp, nebo distinguish via WS broadcast origin tag.
3. **Async command failure mid-stack (Task 1 reducer gotcha).** PATCH selže během `undo()` — stack v inconsistent state. **Mitigace**: rollback state pokud `cmd.undo()` reject-uje + HUD "Undo failed, retry?".
4. **Coalescing strokes (Task 9 decision).** Decision: žádný coalesce, každý stroke = command. Pokud users budou stěžovat ("ručně kreslím a Cmd+Z mi maže po jednotlivých liniích"), revize do v1 přes coalesce v 300 ms okně.

## Confidence

**7/10** pro one-pass implementaci. Body off:
- −1 za focus/postMessage complexity (Task 12) — vyžaduje prototyp.
- −1 za external-edit invalidation flake (Task 13) — fs-watch echo behavior potřebuje empirický test.
- −1 za comments scope ambiguity (Task 10) — buď doděláme `commentsDelete` server API, nebo defer.

Mitigace: rozdělit do dvou commitů — (a) core stack + artboard/marquee/equal-spacing/annotations (Tasks 1–9, 11, 13–16), (b) comments + commentsDelete API (Task 10, follow-up). Pak je (a) confidence **9/10**.

## Retro

- **Task 12's "postMessage forwarding" gotcha evaporated** once we moved `UndoStackProvider` to mount at `<DesignCanvas>` (one level above `<CanvasShell>` / `<DesignCanvasInner>`) instead of inside the shell. Both the artboard commit path AND the input-router callbacks then share one per-iframe context — input-router listens on `document` which is inside the iframe, so the keystroke reaches the right provider naturally. The plan over-specified the focus risk; a simpler mount choice eliminated the whole class. Lesson for future: when wiring a context across two cousins under a third ancestor, the answer is usually "promote the provider," not "build a message bus between siblings."
- **Async runner needed ref-as-authoritative-store, not useState + stateRef-mirror.** First implementation followed the standard pattern (state owned by `useState`, refreshed into `stateRef` during render). It worked for one synchronous push but failed any subsequent `undo()` in the SSR-capture test because the captured `undo` closure read `stateRef.current` which was set during the initial render and never re-set. Refactored to: `stateRef` IS the store; `setState` is purely for triggering re-renders; `writeState` updates both atomically. This also matches the future Y.UndoManager swap (Yjs owns its own store via subscribe). Lesson: when a hook's actions need to read state BETWEEN React renders (here: serialized async runner over 30 Hz key-repeat), the ref must be authoritative.
- **Annotations layer had FIVE inline `setStrokesState((prev) => …)` sites scattered across the file** — eraseAt, endStroke, commitText, updateStroke, deleteStrokes, translateStrokes. The plan called out three; we found five plus one mount-time loader (correctly excluded). Lesson: when adding a cross-cutting mutator wrap, grep for the underlying state setter across the file before estimating scope. The estimate was off by ~60%; total file diff was 200 LOC instead of the planned ~80.
- **Smoke gate caught a pre-existing bug, not a regression.** `smoke.sh` reports OK on 404 "Not found" pages because it doesn't validate response semantically — it just confirms a screenshot was taken. The wave-1 baseline had the same false-positive shape; phase-20 is innocent. Worth filing for a separate fix in the dev-server bin scripts (validate that the iframe DOM contains the expected `[data-dc-screen]` or `.specimen-hd` marker before declaring OK).
- **DDR-050's "Phase 8 forward-compat" rule is the most load-bearing part of the design.** The public `UndoStackValue` interface is now frozen — Yjs swap is a one-file diff. If we had let consumers (canvas-lib, annotations-layer) reach into implementation details, the migration would touch every command site. The discipline cost was zero (the natural shape of push/undo/redo/clear matches Y.UndoManager 1:1).
- **Plan's "rozdělit do dvou commitů" advice paid off.** Comments out of v0 was clearly the right call — the server CRDT shape for commentsPatch reconciliation needs Phase-8-Yjs as scaffolding. Ship the 90% now, follow-up on the 10%.

## Post-ship learnings (added 2026-05-26 after the third fix landed)

Three bugs surfaced within hours of the original commit `274cae4`. Pattern across all of them: **the test suite's SSR-capture pattern + reducer purity gave a false sense of completeness.** The reducer + commands tested cleanly in isolation, but their interaction with React-state-owning consumers (the iframe's strokes, the iframe's lifecycle) was never observable through SSR. Lessons:

- **Bug 1 (annotation undo silently PUT-ed but didn't refresh local state):** the unit test confirmed `putFn` was called twice; nothing asserted that local React state matched the server. The plan's commit-side optimistic state update created the illusion of correctness because the *first* operation (push) DID update state — the bug only showed on the *second* op (undo) which re-used putFn without state update. **Fix the contract, not the test:** fold local-state into the side-effect (putStrokes does both), so every code path that PUTs also refreshes state.
- **Bug 2 (history lost on canvas switch):** the rev-1 plan explicitly said "ephemeral per iframe" and the user explicitly wanted the opposite. The "per-iframe" framing was an implementation detail bleeding into the user-facing rule. **Lesson for /plan:** when describing scope, distinguish "the data structure lives here" from "the user-observable history lives here." They are not the same.
- **Bug 3 (drag emits one undo per pointermove tick):** the original code's `translateStrokes` was designed for keyboard nudge — discrete one-press-one-edit gestures. Reusing it for drag (continuous many-frames-one-gesture) inherited the wrong granularity. **Lesson:** when wiring a new gesture through an existing mutator, audit the gesture's *frequency profile* (discrete vs continuous) before reusing the path. Coalescing is a per-gesture choice, not a per-mutator one.
- **DDR namespace collision (DDR-049 used by two phases the same day):** parallel work streams hadn't checked the DDR registry before authoring. Both DDR files coexisted on `main` for several hours before this `/done` caught the collision. **Lesson for /flow:plan and /flow:record-ddr:** the next free DDR number should be looked up at write-time, not at plan-time. The motion DDR (landed first) keeps DDR-049; this undo DDR renumbered to DDR-050. All code/doc/plan refs migrated as part of the post-ship sweep.
- **Three iteration loops in one day** — the user reported each issue within minutes of reading the previous fix's commit. The cadence held because the architecture turned out to be the right shape (command-record + sinks-registry) — the fixes were either label-level (putStrokes does state too) or gesture-level (drag coalesce), never structural. Validates the "ship the 90%, follow-up on the 10%" advice from the original retro.
