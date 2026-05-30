// canvas-cursors — Phase 21 custom tool cursors. Validates the data-URI CSS
// cursor shape so a malformed string (which silently disables the cursor in the
// browser) can't ship undetected.

import { describe, expect, test } from 'bun:test';

import { TOOL_CURSORS } from '../canvas-cursors.ts';

const ALL_TOOLS = [
  'move',
  'hand',
  'comment',
  'pen',
  'rect',
  'ellipse',
  'sticky',
  'arrow',
  'text',
  'eraser',
] as const;

describe('canvas-cursors / TOOL_CURSORS', () => {
  test('covers every tool', () => {
    for (const t of ALL_TOOLS) {
      expect(typeof TOOL_CURSORS[t]).toBe('string');
      expect(TOOL_CURSORS[t].length).toBeGreaterThan(0);
    }
  });

  test('move keeps the system arrow', () => {
    expect(TOOL_CURSORS.move).toBe('default');
  });

  test('custom cursors are well-formed data-URI CSS values with hotspot + fallback', () => {
    const fallback: Record<string, string> = {
      hand: 'grab',
      comment: 'crosshair',
      pen: 'crosshair',
      rect: 'crosshair',
      ellipse: 'crosshair',
      sticky: 'crosshair',
      arrow: 'crosshair',
      text: 'text',
      eraser: 'cell',
    };
    for (const [tool, fb] of Object.entries(fallback)) {
      const v = TOOL_CURSORS[tool as keyof typeof TOOL_CURSORS];
      // url("data:image/svg+xml,<encoded>") <hx> <hy>, <fallback>
      expect(v).toMatch(
        new RegExp(`^url\\("data:image/svg\\+xml,%3Csvg[^"]+"\\) \\d+ \\d+, ${fb}$`)
      );
      // The SVG must declare a 32×32 box and be valid encoded markup.
      const decoded = decodeURIComponent(v.slice(v.indexOf(',') + 1, v.indexOf('")')));
      expect(decoded).toContain("width='32'");
      expect(decoded).toContain("height='32'");
      expect(decoded).toContain('</svg>');
    }
  });

  test('hotspots are within the 0..31 image bounds', () => {
    for (const t of ALL_TOOLS) {
      if (TOOL_CURSORS[t] === 'default') continue;
      const m = TOOL_CURSORS[t].match(/"\) (\d+) (\d+),/);
      expect(m).not.toBeNull();
      const hx = Number(m?.[1]);
      const hy = Number(m?.[2]);
      expect(hx).toBeGreaterThanOrEqual(0);
      expect(hx).toBeLessThanOrEqual(31);
      expect(hy).toBeGreaterThanOrEqual(0);
      expect(hy).toBeLessThanOrEqual(31);
    }
  });
});
