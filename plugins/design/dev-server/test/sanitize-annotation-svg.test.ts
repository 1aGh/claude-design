// sanitizeAnnotationSvg — A3 (DDR-060 F1 re-audit). Strips executable constructs
// from a persisted annotation SVG while leaving the legit presentational
// vocabulary (strokesToSvg: path/rect/ellipse/g/line/polyline/text) byte-intact.

import { describe, expect, test } from 'bun:test';

import { sanitizeAnnotationSvg } from '../api.ts';

// The exact shape strokesToSvg() emits — must survive sanitization unchanged.
const LEGIT =
  '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
  '<path data-id="p1" data-tool="pen" stroke="#d63b1f" stroke-width="2" fill="none" d="M0 0 L10 10" pointer-events="stroke"/>' +
  '<rect data-id="r1" data-tool="rect" stroke="#222" stroke-width="2" fill="none" x="5" y="5" width="20" height="20"/>' +
  '<ellipse data-id="e1" data-tool="ellipse" stroke="#222" stroke-width="2" fill="none" cx="10" cy="10" rx="4" ry="4"/>' +
  '<g data-id="a1" data-tool="arrow" stroke="#222" stroke-width="2" fill="none"><line x1="0" y1="0" x2="9" y2="9"/><polyline points="3,3 9,9 5,7" fill="#222"/></g>' +
  '<text data-id="t1" data-tool="text" data-anchor-id="x" data-font-size="14" fill="#222" text-anchor="middle" dominant-baseline="middle">label</text>' +
  '</svg>';

describe('sanitizeAnnotationSvg — A3', () => {
  test('leaves the legit annotation vocabulary byte-identical (zero regression)', () => {
    expect(sanitizeAnnotationSvg(LEGIT)).toBe(LEGIT);
  });

  test('strips <script> blocks', () => {
    const dirty = LEGIT.replace('</svg>', '<script>fetch("/_api/export")</script></svg>');
    const out = sanitizeAnnotationSvg(dirty);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('fetch("/_api/export")');
  });

  test('strips <foreignObject> (the SVG-XSS smuggle)', () => {
    const dirty = LEGIT.replace(
      '</svg>',
      '<foreignObject><div onload="x"></div></foreignObject></svg>'
    );
    const out = sanitizeAnnotationSvg(dirty);
    expect(out.toLowerCase()).not.toContain('foreignobject');
  });

  test('strips inline event-handler attributes (onload/onclick/…)', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
      '<rect x="0" y="0" width="9" height="9" onload="alert(1)" onclick=\'evil()\'/>' +
      '</svg>';
    const out = sanitizeAnnotationSvg(dirty);
    expect(out).not.toMatch(/\son\w+\s*=/i);
    expect(out).toContain('<rect');
    expect(out).toContain('width="9"');
  });

  test('strips <image>/<use> and javascript: URLs', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
      '<image href="javascript:alert(1)"/><use href="#x"/>' +
      '</svg>';
    const out = sanitizeAnnotationSvg(dirty);
    expect(out.toLowerCase()).not.toContain('<image');
    expect(out.toLowerCase()).not.toContain('<use');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });
});
