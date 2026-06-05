// canvas-cursors — Phase 21 custom tool cursors. Validates the data-URI CSS
// cursor shape so a malformed string (which silently disables the cursor in the
// browser) can't ship undetected.

import { describe, expect, test } from 'bun:test';

import { resolveToolCursor, TOOL_CURSORS } from '../canvas-cursors.ts';

const ALL_TOOLS = [
  'move',
  'hand',
  'comment',
  'pen',
  'highlighter',
  'shape',
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

  test('Phase 24 — every tool ships a Kenney cursor (move is no longer the bare system arrow)', () => {
    // The brief: ONE unified cursor library for ALL tools. `move` now ships a
    // Kenney arrow glyph with a `default` native fallback (not bare 'default').
    expect(TOOL_CURSORS.move).toContain('url("data:image/svg+xml,');
    expect(TOOL_CURSORS.move).toMatch(/, default$/);
  });

  test('custom cursors are well-formed data-URI CSS values with hotspot + fallback', () => {
    const fallback: Record<string, string> = {
      move: 'default',
      hand: 'grab',
      comment: 'crosshair',
      pen: 'crosshair',
      highlighter: 'crosshair',
      shape: 'crosshair',
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
      // The SVG renders at 24px (Phase 24 — smaller than the 32-unit viewBox)
      // and is valid encoded markup.
      const decoded = decodeURIComponent(v.slice(v.indexOf(',') + 1, v.indexOf('")')));
      expect(decoded).toContain("width='24'");
      expect(decoded).toContain("height='24'");
      expect(decoded).toContain("viewBox='0 0 32 32'");
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

// Phase 24 (DDR-067) — the canvas→shell `tool-cursor` bridge echoes a tool
// TOKEN and the shell resolves it HERE to a trusted cursor. This is the control
// that closes the phase-24 ethical-hacker Finding 2 (an untrusted synced canvas
// posting an invisible/displaced SVG cursor as a clickjacking aid over the
// un-CSP'd shell). These tests assert the confinement so it can't silently
// regress: only known tool ids resolve, and they always resolve to a trusted,
// visible data-URI cursor — never to attacker-supplied bytes.
describe('canvas-cursors / resolveToolCursor (untrusted token → trusted cursor)', () => {
  test('every known tool resolves to its trusted TOOL_CURSORS string', () => {
    for (const t of ALL_TOOLS) {
      expect(resolveToolCursor(t)).toBe(TOOL_CURSORS[t]);
    }
  });

  test('resolved value is always a trusted data-URI cursor (or native fallback) — never raw bytes', () => {
    for (const t of ALL_TOOLS) {
      const v = resolveToolCursor(t);
      expect(typeof v).toBe('string');
      // Each is one of our own frozen entries: a `url("data:image/svg+xml,…")`
      // glyph with a hotspot + native fallback. The shell interpolates THIS,
      // not the message, so there is no attacker-controlled region.
      expect(v).toMatch(/^url\("data:image\/svg\+xml,%3Csvg[^"]+"\) \d+ \d+, [a-z-]+$/);
    }
  });

  test('rejects unknown / prototype-polluting / malformed tokens', () => {
    const hostile = [
      // not a known tool
      'pwn',
      'banana',
      // prototype chain — `in` would match these; `hasOwnProperty` must not
      'constructor',
      'toString',
      'hasOwnProperty',
      '__proto__',
      // shape-gate violations (uppercase / digits / punctuation / whitespace)
      'Move',
      'pen1',
      'pen ',
      ' pen',
      'pen;',
      'pe.n',
      '',
      // the OLD attack vector: a full cursor STRING is no longer accepted —
      // only a bare token is, so an invisible/displaced SVG cursor can't pass
      'url("data:image/svg+xml,%3Csvg/%3E") 0 0, none',
    ];
    for (const tok of hostile) {
      expect(resolveToolCursor(tok)).toBeNull();
    }
  });

  test('rejects non-string tokens (typeof short-circuits BEFORE coercion)', () => {
    // The `{ toString }` / `[ 'pen' ]` cases prove the guard checks `typeof`
    // first and never coerces — a malicious `toString`/`Symbol.toPrimitive`
    // that returns a valid tool id must NOT smuggle a cursor through.
    let coerced = false;
    const hostileCoercible = {
      toString() {
        coerced = true;
        return 'pen';
      },
    };
    for (const tok of [
      null,
      undefined,
      42,
      {},
      [],
      ['pen'],
      true,
      Symbol('pen'),
      hostileCoercible,
    ]) {
      // biome-ignore lint/suspicious/noExplicitAny: deliberate hostile-input test
      expect(resolveToolCursor(tok as any)).toBeNull();
    }
    expect(coerced).toBe(false);
  });
});
