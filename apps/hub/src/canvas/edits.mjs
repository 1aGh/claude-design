// The mutation gate — Cloud Phase 25 B4 + C3.
//
// Everything a browser edit must pass BEFORE the AST engine sees it:
//
//   1. SHAPE. An operation is a name from a closed vocabulary plus typed
//      arguments. Anything else is refused here, in one place, rather than
//      being discovered by the engine halfway through a write.
//   2. CONTAINMENT. The canvas path is resolved against the design root and
//      must land inside it — the same rule the build sandbox applies to
//      imports, for the same reason.
//   3. ROLE. A viewer's session never reaches this module (the cell's
//      read-only gate refuses the request first), but the check is repeated
//      at the call site rather than assumed, because "someone upstream checked"
//      is how a permission model rots.
//
// The engine itself runs in the Bun worker (`edit-worker.ts`).

import { spawn } from 'node:child_process';

import { dirname, resolve, sep } from 'node:path';

import { resolveBunPath, workerEnv, workerScript } from './build.mjs';

/** Wall clock one mutation may take. Generous: it is one AST pass + a rename. */
export const EDIT_TIMEOUT_MS = Number(process.env.MAUDE_CANVAS_EDIT_TIMEOUT_MS ?? 15_000);

/** The closed vocabulary. Adding to it is a deliberate act, in this file. */
export const EDIT_KINDS = Object.freeze([
  'set-style',
  'reposition',
  'set-text',
  'delete-element',
  'resize-artboard',
]);

const MAX_CANVAS_REL = 512;

/**
 * Validate + normalize one operation. Pure, so the rules are testable without
 * a checkout: `{ok, op}` or `{ok:false, error}`.
 */
export function checkEditOp(raw, { designRoot }) {
  if (!raw || typeof raw !== 'object')
    return { ok: false, error: 'an operation object is required' };
  const kind = String(raw.kind ?? '');
  if (!EDIT_KINDS.includes(kind))
    return { ok: false, error: `unknown operation: ${kind || '(none)'}` };

  const rel = String(raw.canvas ?? '');
  if (!rel || rel.length > MAX_CANVAS_REL) return { ok: false, error: 'canvas is required' };
  if (rel.includes('\0')) return { ok: false, error: 'canvas is not a valid path' };
  const root = resolve(designRoot);
  const canvasAbs = resolve(root, rel);
  if (canvasAbs !== root && !canvasAbs.startsWith(root + sep)) {
    return { ok: false, error: 'that canvas is outside this project' };
  }
  if (!/\.(tsx|jsx)$/.test(canvasAbs))
    return { ok: false, error: 'only .tsx canvases can be edited' };

  const op = { kind, canvasAbs };
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  if (kind === 'set-style') {
    if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.id)) {
      return { ok: false, error: 'a valid element id is required' };
    }
    if (typeof raw.property !== 'string' || !/^[a-zA-Z-]{1,64}$/.test(raw.property)) {
      return { ok: false, error: 'a valid CSS property is required' };
    }
    if (raw.value !== null && typeof raw.value !== 'string') {
      return { ok: false, error: 'value must be a string or null' };
    }
    if (typeof raw.value === 'string' && raw.value.length > 512) {
      return { ok: false, error: 'that value is too long' };
    }
    op.id = raw.id;
    op.property = raw.property;
    op.value = raw.value;
  } else if (kind === 'reposition') {
    if (typeof raw.id !== 'string') return { ok: false, error: 'a valid element id is required' };
    if (num(raw.left) === null || num(raw.top) === null) {
      return { ok: false, error: 'left and top must be numbers' };
    }
    op.id = raw.id;
    op.left = raw.left;
    op.top = raw.top;
  } else if (kind === 'set-text') {
    if (typeof raw.id !== 'string') return { ok: false, error: 'a valid element id is required' };
    if (typeof raw.text !== 'string') return { ok: false, error: 'text is required' };
    if (raw.text.length > 10_000) return { ok: false, error: 'that text is too long' };
    op.id = raw.id;
    op.text = raw.text;
  } else if (kind === 'delete-element') {
    if (typeof raw.id !== 'string') return { ok: false, error: 'a valid element id is required' };
    op.id = raw.id;
  } else if (kind === 'resize-artboard') {
    if (typeof raw.artboardId !== 'string' || !raw.artboardId) {
      return { ok: false, error: 'an artboard id is required' };
    }
    const w = num(raw.width);
    const h = num(raw.height);
    if (w === null && h === null) return { ok: false, error: 'width or height is required' };
    if ((w !== null && (w < 16 || w > 20000)) || (h !== null && (h < 16 || h > 20000))) {
      return { ok: false, error: 'that size is out of range' };
    }
    op.artboardId = raw.artboardId;
    if (w !== null) op.width = w;
    if (h !== null) op.height = h;
  }

  if (raw.idIndex !== undefined) {
    const i = num(raw.idIndex);
    if (i === null || i < 0 || i > 1000) return { ok: false, error: 'idIndex is out of range' };
    op.idIndex = i;
  }
  return { ok: true, op };
}

/** Apply one CHECKED operation. Same process posture as the build worker. */
export function applyEditOp(op, { env = process.env } = {}) {
  return new Promise((resolveP) => {
    let child;
    try {
      child = spawn(
        resolveBunPath(env),
        [workerScript('edit-worker.ts', env), JSON.stringify(op)],
        {
          env: workerEnv(env),
          cwd: dirname(op.canvasAbs),
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    } catch (err) {
      resolveP({ ok: false, error: `could not start the editor: ${err.message}` });
      return;
    }
    let out = '';
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolveP(v);
    };
    const deadline = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, error: 'that change took too long and was stopped' });
    }, EDIT_TIMEOUT_MS);
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.on('error', (err) =>
      finish({ ok: false, error: `could not start the editor: ${err.message}` })
    );
    child.on('close', () => {
      try {
        finish(JSON.parse(out));
      } catch {
        finish({ ok: false, error: 'that change could not be applied' });
      }
    });
  });
}
