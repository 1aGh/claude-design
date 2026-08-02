// The cell's structured mutations — Cloud Phase 25 B4.
//
// A UI edit in the browser is a SOURCE TRANSFORMATION, not a blob of TSX the
// client sends up. The client names an operation and its arguments; this
// worker applies it with the SAME AST engine the desktop uses
// (`apps/studio/canvas-edit.ts`), and the `.tsx` on disk stays the source of
// truth. Two reasons that split matters:
//
//   1. Accepting client-authored source would make every member an author of
//      code our own build then runs — a far larger surface than "move this box
//      12 px right", and impossible to check.
//   2. The AST path has a real bug class (the inline-edit DOM-leaf-text vs
//      AST-mixed-source mismatch), and it is fixed in ONE engine. A second
//      implementation for the browser would re-earn those bugs.
//
// Runs under the bundled Bun in its own process, same as the build worker and
// for the same reasons — the engine is TypeScript, and the process boundary is
// where the ceilings and the empty environment live.
//
// Protocol: argv[2] is a JSON operation; stdout is one JSON result.

import {
  deleteElement,
  editAttribute,
  editText,
  resizeArtboard,
} from '../../../studio/canvas-edit.ts';

interface Op {
  kind: string;
  canvasAbs: string;
  id?: string;
  idIndex?: number;
  property?: string;
  value?: string | null;
  text?: string;
  artboardId?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

/** camelCase a CSS property name — the engine writes into a JSX style object. */
function camel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function apply(op: Op): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (op.kind) {
    case 'set-style': {
      if (!op.id || !op.property) return { ok: false, error: 'id and property are required' };
      const value = op.value === null ? '' : String(op.value);
      await editAttribute(
        op.canvasAbs,
        op.id,
        `style.${camel(op.property)}`,
        JSON.stringify(value),
        op.idIndex
      );
      return { ok: true };
    }
    case 'reposition': {
      // What a drag commits: the element's own left/top, in px. Only
      // meaningful for an out-of-flow element, which the client checks before
      // it offers the gesture (same rule as the desktop's arrow-nudge).
      if (!op.id) return { ok: false, error: 'id is required' };
      if (!Number.isFinite(op.left) || !Number.isFinite(op.top)) {
        return { ok: false, error: 'left and top must be numbers' };
      }
      await editAttribute(
        op.canvasAbs,
        op.id,
        'style.left',
        JSON.stringify(`${Math.round(op.left as number)}px`),
        op.idIndex
      );
      await editAttribute(
        op.canvasAbs,
        op.id,
        'style.top',
        JSON.stringify(`${Math.round(op.top as number)}px`),
        op.idIndex
      );
      return { ok: true };
    }
    case 'set-text': {
      if (!op.id || typeof op.text !== 'string')
        return { ok: false, error: 'id and text required' };
      if (op.text.length > 10_000) return { ok: false, error: 'text is too long' };
      await editText(op.canvasAbs, op.id, op.text, { occurrence: op.idIndex });
      return { ok: true };
    }
    case 'delete-element': {
      if (!op.id) return { ok: false, error: 'id is required' };
      await deleteElement(op.canvasAbs, op.id, op.idIndex);
      return { ok: true };
    }
    case 'resize-artboard': {
      if (!op.artboardId) return { ok: false, error: 'artboardId is required' };
      const w = Number.isFinite(op.width) ? Math.round(op.width as number) : undefined;
      const h = Number.isFinite(op.height) ? Math.round(op.height as number) : undefined;
      if (w === undefined && h === undefined)
        return { ok: false, error: 'width or height required' };
      await resizeArtboard(op.canvasAbs, op.artboardId, w, h);
      return { ok: true };
    }
    default:
      return { ok: false, error: `unknown operation: ${op.kind}` };
  }
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'usage: <json-op>' }));
    process.exit(2);
  }
  const op = JSON.parse(raw) as Op;
  const result = await apply(op);
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: String(err?.message ?? err).slice(0, 2000) })
  );
  process.exit(1);
});
