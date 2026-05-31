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

  // Bypasses the F1 confirming pass found against the prior denylist — the
  // allowlist must close all of them.
  test('drops namespaced <svg:script> (denylist missed this)', () => {
    const out = sanitizeAnnotationSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><svg:script>alert(1)</svg:script></svg>'
    );
    expect(out.toLowerCase()).not.toContain('<svg:script');
    expect(out.toLowerCase()).not.toContain('script>');
  });

  test('drops <style> (CSS @import / url(javascript:) exfil lane)', () => {
    const out = sanitizeAnnotationSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><style>@import url("//evil")</style></svg>'
    );
    expect(out.toLowerCase()).not.toContain('<style');
  });

  test('strips style= (CSS url(javascript:)) and entity-encoded xlink:href on survivors', () => {
    const out = sanitizeAnnotationSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
        '<rect x="0" y="0" width="9" height="9" style="fill:url(javascript:alert(1))"/>' +
        '<text xlink:href="javascript&#58;alert(1)">hi</text></svg>'
    );
    expect(out).not.toMatch(/\sstyle\s*=/i);
    expect(out).not.toMatch(/href\s*=/i);
    // The legit elements + safe attrs survive.
    expect(out).toContain('<rect');
    expect(out).toContain('width="9"');
    expect(out).toContain('<text');
  });

  test('drops <set>/<animate> animation elements (attribute-name vector)', () => {
    const out = sanitizeAnnotationSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><rect><set attributeName="onload" to="alert(1)"/></rect></svg>'
    );
    expect(out.toLowerCase()).not.toContain('<set');
    expect(out.toLowerCase()).not.toContain('<animate');
  });

  // Phase 24 (DDR-067 security review) — a handler glued onto the previous
  // attribute's closing quote with NO separating whitespace is a distinct
  // attribute to HTML/SVG parsers; the old `\s`-anchored denylist missed it.
  test('strips a quote-glued on*= handler (no separating whitespace)', () => {
    const out = sanitizeAnnotationSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
        '<circle cx="1" cy="1" r="2"onload="alert(document.cookie)"/>' +
        '<rect x="0" y="0" width="9" height="9"onclick=\'evil()\'/></svg>'
    );
    // (a bare /on\w+=/ would false-match `data-mdcc-annotations="1"` — target
    // the actual handler names instead)
    expect(out).not.toMatch(/\bon(?:load|click|error|mouse\w+|focus)\s*=/i);
    expect(out).not.toContain('alert(document.cookie)');
    expect(out).not.toContain('evil()');
    // The legit element + its real attributes survive intact.
    expect(out).toContain('<circle');
    expect(out).toContain('r="2"');
    expect(out).toContain('<rect');
    expect(out).toContain('width="9"');
  });

  // Phase 24 — the new shape/arrowhead vocabulary survives byte-intact.
  test('keeps Phase 24 <polygon>/<circle> + data-* attrs byte-intact', () => {
    const phase24 =
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
      '<polygon data-id="pg" data-tool="polygon" stroke="#222" stroke-width="2" fill="none" data-shape="diamond" points="20,0 40,20 20,40 0,20"/>' +
      '<g data-id="a" data-tool="arrow" stroke="#111" stroke-width="2" fill="none" data-start-head="circle" data-line-type="curved"><path d="M0 0 Q10 10 20 0"/><circle cx="20" cy="0" r="6" fill="#111"/></g>' +
      '<g data-id="st" data-tool="sticky" data-r="8" data-fs="16" fill="#fce8a6" data-bold="1" data-align="center"><rect x="0" y="0" width="200" height="200" rx="8" ry="8"/><text data-sticky-body="1" x="12" y="12" font-size="16" fill="#1a1a1a" dominant-baseline="hanging">x</text></g>' +
      '</svg>';
    expect(sanitizeAnnotationSvg(phase24)).toBe(phase24);
  });
});
