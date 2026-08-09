// Pre-flight for the two media elements the audio renderer rejects.
//
// RCA `issue-mp4-audio-export-html5audio-silent-degrade`: `renderMediaOnWeb` —
// the ONLY export path that can mux an audio track — supports only
// `@remotion/media` media elements. `remotion`'s `Audio` (which IS
// `Html5Audio`) and `OffthreadVideo` are both rejected at render time. The shim
// catches the throw and degrades to the video-only frame-step path, so the
// export "succeeds" muted — and ~40x slower (measured: ~37 min vs ~45 s on the
// sibling artboard).
//
// DDR-157's blanket "degrade on ANY renderer failure" is right for the class it
// was built for: the recursion overflow is data-dependent, manifests late, and
// the author cannot fix it. `<Html5Audio>` is the opposite — decidable from
// source before a browser is ever launched, always fails, one-line remedy stated
// in the error itself. Swallowing THAT into a generic fallback turns a fixable
// mistake into a mysterious one, so we decide it here instead.
//
// Deliberately a regex-over-known-vocabulary scan rather than a real parser,
// matching the house style of `bin/_canvas-rects-static.mjs`: the vocabulary is
// fixed (two symbols, one module specifier) and a parser dependency for this
// would cost more than it buys.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The elements `@remotion/web-renderer` refuses, and what to do about each. */
export type UnsupportedElement = 'Audio' | 'OffthreadVideo';

export interface UnsupportedFinding {
  element: UnsupportedElement;
  /** Where the `from 'remotion'` import actually lives — the canvas, or a barrel it re-exports through. */
  sourceFile: string;
  /** True when the canvas reached it through a re-export barrel rather than directly. */
  viaBarrel: boolean;
  /** The name the JSX mounts it under — differs from `element` when aliased. */
  localName: string;
}

const CANDIDATE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

/**
 * Named bindings imported from the bare `remotion` specifier.
 *
 * Matches `import { A, B as C } from 'remotion'` and the `export { A } from
 * 'remotion'` re-export form, single or double quoted. Deliberately anchored to
 * the EXACT specifier: `@remotion/media` and `@remotion/transitions` are the
 * supported packages and must never match.
 */
function bindingsFromRemotion(src: string): Map<string, string> {
  // originalName -> localName. Both halves matter and they are NOT
  // interchangeable: the ORIGINAL name identifies which element this is, but the
  // LOCAL name is what the JSX actually mounts. `import { Audio as Sound }`
  // renders `<Sound>`, so checking for `<Audio>` would miss it entirely.
  const found = new Map<string, string>();
  const re = /(?:import|export)\s*\{([^}]*)\}\s*from\s*['"]remotion['"]/g;
  for (const m of src.matchAll(re)) {
    for (const raw of m[1].split(',')) {
      const [orig, alias] = raw.split(/\s+as\s+/).map((s) => s.trim());
      if (!orig) continue;
      found.set(orig, alias || orig);
    }
  }
  return found;
}

/** Relative-specifier imports, with their resolved absolute paths where they exist. */
function localImports(src: string, fromFile: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*from\s*['"](\.[^'"]*)['"]/g;
  for (const m of src.matchAll(re)) {
    const resolved = resolveLocal(m[1], fromFile);
    if (resolved) out.push(resolved);
  }
  return out;
}

function resolveLocal(spec: string, fromFile: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    ...CANDIDATE_EXTS.map((e) => base + e),
    ...CANDIDATE_EXTS.map((e) => path.join(base, `index${e}`)),
  ];
  for (const c of candidates) {
    if (existsSync(c) && !c.endsWith(path.sep)) {
      try {
        if (readFileSync(c, 'utf8')) return c;
      } catch {
        /* directory or unreadable — keep looking */
      }
    }
  }
  return null;
}

/** True when the canvas actually MOUNTS the element (not merely imports it). */
function mounts(src: string, name: string): boolean {
  return new RegExp(`<${name}[\\s/>]`).test(src);
}

/**
 * Scan a canvas for media elements the audio renderer will reject.
 *
 * Follows relative imports ONE hop, because that is the real shape of the bug:
 * `_broadcast.tsx` re-exports `Audio` from `'remotion'`, and every social canvas
 * imports `Audio` from `_broadcast`. A scanner that reads only the canvas file
 * sees a clean local import and misses it entirely.
 *
 * Returns only elements that are both reachable from `'remotion'` AND mounted in
 * the canvas — an unused import is not worth refusing an export over.
 */
export function scanUnsupportedMedia(canvasAbsPath: string): UnsupportedFinding[] {
  let src: string;
  try {
    src = readFileSync(canvasAbsPath, 'utf8');
  } catch {
    // Unreadable canvas is not this check's business to report — the export
    // itself will fail loudly a moment later with a better message.
    return [];
  }

  const findings: UnsupportedFinding[] = [];
  const seen = new Set<UnsupportedElement>();

  const consider = (names: Map<string, string>, sourceFile: string, viaBarrel: boolean) => {
    for (const el of ['Audio', 'OffthreadVideo'] as const) {
      if (seen.has(el)) continue;
      const localName = names.get(el);
      if (!localName) continue;
      // Mounted under whatever name this file bound it to — see bindingsFromRemotion.
      if (!mounts(src, localName)) continue;
      seen.add(el);
      findings.push({ element: el, sourceFile, viaBarrel, localName });
    }
  };

  consider(bindingsFromRemotion(src), canvasAbsPath, false);

  for (const dep of localImports(src, canvasAbsPath)) {
    if (seen.size === 2) break;
    try {
      consider(bindingsFromRemotion(readFileSync(dep, 'utf8')), dep, true);
    } catch {
      /* unreadable dependency — nothing to assert */
    }
  }

  return findings;
}

/**
 * The refusal message for a mounted `<Audio>` from `remotion`.
 *
 * Refuse rather than warn: a music bed silently vanishing from a finished cut is
 * worse than an export that did not run, and the remedy is one word. This
 * mirrors the existing "refused with remediation, never silently truncated"
 * posture of `resolveMaxFrames`.
 */
export function audioRefusalMessage(f: UnsupportedFinding, canvasRel: string): string {
  const where = f.viaBarrel
    ? `${canvasRel} imports it from ${path.basename(f.sourceFile)}, which re-exports it from 'remotion'`
    : `${canvasRel} imports it from 'remotion'`;
  return (
    `this comp mounts <Audio> from 'remotion' — which IS <Html5Audio>, and ` +
    `@remotion/web-renderer rejects it, so the export would silently lose its audio ` +
    `(and run ~40x slower on the frame-step fallback). ${where}. ` +
    `Fix: import { Audio } from '@remotion/media' instead — same props, drop-in. ` +
    `To export muted anyway, pass options.allowUnsupportedMedia.`
  );
}
