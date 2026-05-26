/**
 * @file       commands/equal-spacing-command.ts — undo label helpers for
 *             equal-spacing / align gestures.
 * @scope      plugins/design/dev-server/commands/equal-spacing-command.ts
 * @purpose    Distribute + align both call `dragBus.commitPositions(moved)`,
 *             which wraps the move in a generic MoveArtboardsCommand. Per
 *             DDR-050 the underlying command type is shared (the inverse
 *             payload is identical — a layout snapshot pair) and only the
 *             HUD label differs. These helpers compute the labels.
 *
 *             Why not a separate Command class? The wrapping logic would
 *             duplicate `before`/`after`/`patchFn` + add an indirection.
 *             A label is a one-line string; a factory is overkill.
 *             Keeping `MoveArtboardsCommand` as the only artboard-layout
 *             command keeps the future Yjs swap (Phase 8) one-for-one.
 */

export type AlignMode =
  | 'left'
  | 'right'
  | 'center-x'
  | 'top'
  | 'bottom'
  | 'center-y';

/** "equal-space 3 artboards" — N must be ≥ 3 (distribute requires it). */
export function equalSpacingLabel(n: number): string {
  return `equal-space ${n} artboard${n === 1 ? '' : 's'}`;
}

/** "align left 4 artboards" — N must be ≥ 2 (align requires it). */
export function alignLabel(mode: AlignMode, n: number): string {
  return `align ${mode} ${n} artboard${n === 1 ? '' : 's'}`;
}
