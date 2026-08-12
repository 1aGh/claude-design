/**
 * @file       timeline-comp-target.js — which announced comp the Timeline drives.
 * @scope      apps/studio/client/panels/
 * @purpose    On a multi-comp canvas the Timeline shows ONE comp's rows (the
 *             parser scopes to the viewport-active artboard) but the transport
 *             (play / pause / scrub / mute / loop) is a targeted postMessage —
 *             it needs the Player's own comp id.
 *
 *             This used to be resolved by matching the parsed row total against
 *             each comp's `durationInFrames`. Two comps of the SAME length (the
 *             common case — one composition duplicated across artboards) made
 *             `find` return the FIRST one, so the panel drew artboard #2's rows
 *             while Play moved artboard #1 (issue #75). Duration is not an
 *             identity, so the primary key is now the artboard the comp is
 *             mounted in (`artboardId`, resolved by DOM containment in
 *             video-comp.tsx). Duration stays as a fallback, and is only trusted
 *             when it identifies exactly ONE comp.
 */

// Bidi overrides + isolates, zero-width / format characters, and C0/C1
// controls (newlines and tabs included). An artboard label is author-written
// text from an untrusted origin (DDR-054) that the shell RENDERS as chrome, so
// a trailing RLO or a label built entirely of zero-width joiners could make the
// Timeline's chip read as an artboard other than the one the transport is
// scoped to — defeating the exact signal the chip exists to give. Same class
// `sanitizeDisplayText` (file-preview.jsx) and `figma/sanitize.ts` already
// neutralize; widened here because a label, unlike a filename, has no shape
// constraints at all. Written as escapes on purpose — a literal invisible
// character in this class would be unreviewable.
const DISPLAY_UNSAFE =
  /[\u202a-\u202e\u2066-\u2069\u200b-\u200f\u2060\u00ad\ufeff\u0000-\u001f\u007f-\u009f]/g;

/**
 * Neutralize + cap one canvas-origin display string. Returns null for a value
 * that is absent, or that is empty ONCE the unsafe characters are gone — an
 * all-invisible label must read as "no label", not as a blank chip that looks
 * like the panel failed to render.
 *
 * @param {unknown} s
 * @param {number} [max]
 * @returns {string|null}
 */
export function sanitizeArtboardText(s, max = 120) {
  if (typeof s !== 'string') return null;
  const clean = s.replace(DISPLAY_UNSAFE, '').trim().slice(0, max).trim();
  return clean || null;
}

/**
 * @param {Array<{id: string, artboardId?: string|null, durationInFrames?: number}>} comps
 * @param {{ artboardId?: string|string[]|null, total?: number }} [opts] `artboardId`
 *   may be a single id or a confidence-ordered list of candidates.
 * @returns {string|null} the comp id the transport must target
 */
export function resolveCompTarget(comps, opts = {}) {
  if (!Array.isArray(comps) || comps.length === 0) return null;
  const { artboardId = null, total = 0 } = opts;
  // Candidates in confidence order. The caller passes the artboard the ROW
  // PARSER scoped to (derived lexically from the .tsx) followed by the viewport
  // signal canvas-lib reports on pan (derived structurally). They usually agree;
  // when the lexical one names an artboard no comp is actually mounted in — a
  // `<DCArtboard id=…>` inside a comment or a string literal is enough — the
  // pan signal is the better answer, and trying both is what keeps a source
  // file's stale opinion from silently out-ranking the live DOM.
  const candidates = (Array.isArray(artboardId) ? artboardId : [artboardId]).filter(Boolean);
  // Pass 1 — the artboard each comp ANNOUNCED (DOM containment). Runs across
  // every candidate before pass 2 starts, deliberately.
  for (const cand of candidates) {
    const hit = comps.find((c) => c.artboardId === cand);
    if (hit) return hit.id;
  }
  // Pass 2 — an author-set comp id that equals an artboard id (the documented
  // "match the enclosing DCArtboard id" convention). Strictly WEAKER than pass
  // 1: comp ids and artboard ids are separate author-chosen namespaces, so a
  // `<VideoComp id="outro">` mounted inside `intro` must never be able to claim
  // outro's transport while a comp genuinely mounted in outro exists.
  for (const cand of candidates) {
    const hit = comps.find((c) => c.id === cand);
    if (hit) return hit.id;
  }
  if (total > 0) {
    const byTotal = comps.filter((c) => c.durationInFrames === total);
    // Exactly one — unambiguous. Several — duration tells us nothing, so fall
    // through rather than silently picking the first (that WAS the bug).
    if (byTotal.length === 1) return byTotal[0].id;
  }
  return comps[0].id;
}

/**
 * The comp record the panel should read meta (fps, duration) off — same target
 * as the transport, so the readout can never describe a different comp than the
 * one Play moves.
 *
 * @param {Array<{id: string}>} comps
 * @param {string|null} compId
 */
export function activeComp(comps, compId) {
  if (!Array.isArray(comps) || comps.length === 0) return null;
  return comps.find((c) => c.id === compId) ?? comps[0];
}
