/**
 * @file  dmg/_arrow-badge.ts — the "drag here" badge mark for the DMG background.
 * Built entirely from apps/studio/draw primitive constructors (circle/polygon/
 * line/group) — no hand-authored SVG path data, per the repo's draw-as-code
 * convention (CLAUDE.md "Draw geometry engine" / DDR-070).
 *
 * Consumed by both _build-arrow-badge.ts (standalone proof asset) and
 * _build-background.ts (embedded into the full DMG composition) so the mark
 * has a single geometric source.
 */

// Kept untyped at the module boundary (draw-build.sh injects the engine via a
// runtime path — see that script's own doc comment) — callers pass the
// already-imported engine module in.
export function arrowBadgePrimitives(engine, opts = {}) {
  const { circle, line, polygon, group } = engine;
  const r = opts.r ?? 16;
  const ringFill = opts.ringFill ?? '#ffffff';
  const arrowColor = opts.arrowColor ?? '#161616';

  // Arrow shaft + head point from the badge's lower-right toward its upper-left
  // (a generic "move this way" cue), built from `line` + a computed `polygon`
  // triangle — never a typed `d="M... L..."` string.
  const tailX = r * 0.52;
  const tailY = r * 0.52;
  const tipX = -r * 0.42;
  const tipY = -r * 0.42;
  const headLen = r * 0.46;
  const headWidth = r * 0.34;

  // Unit vector along the shaft (tail -> tip) and its perpendicular, used to
  // place the two back corners of the arrowhead triangle relative to the tip.
  const dx = tipX - tailX;
  const dy = tipY - tailY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const backX = tipX - ux * headLen;
  const backY = tipY - uy * headLen;

  const head = polygon({
    points: [
      { x: tipX, y: tipY },
      { x: backX + px * headWidth, y: backY + py * headWidth },
      { x: backX - px * headWidth, y: backY - py * headWidth },
    ],
    fill: arrowColor,
  });

  const shaft = line({
    x1: tailX,
    y1: tailY,
    x2: backX,
    y2: backY,
    stroke: arrowColor,
    strokeWidth: r * 0.16,
    strokeLinecap: 'round',
  });

  const ring = circle({ cx: 0, cy: 0, r, fill: ringFill });

  return [ring, group([shaft, head])];
}
