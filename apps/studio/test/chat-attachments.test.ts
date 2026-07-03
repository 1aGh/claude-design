// ACP chat image thumbnails — the pure ref helpers behind the two render paths:
// a LIVE user bubble carries the collapsed chip token ([image-1]), a RELOADED
// bubble (transcript) carries the expanded absolute `_chat/attachments/` path.
// Both must resolve to the same content-addressed `<sha8>.<ext>` name the GET
// serve route accepts — and nothing else may match (a random project path must
// never render as a thumbnail).

import { describe, expect, test } from 'bun:test';

import {
  attachmentName,
  designImageRefs,
  extractAttachmentRefs,
} from '../client/panels/acp-runtime.js';

const ABS = '/Users/x/proj/.design/_chat/attachments/ab12cd34.png';

describe('chat-attachments / attachmentName', () => {
  test('extracts the content-addressed basename from attachment paths', () => {
    expect(attachmentName(ABS)).toBe('ab12cd34.png');
    expect(attachmentName('_chat/attachments/00ff00ff.webp')).toBe('00ff00ff.webp');
    expect(attachmentName(`  ${ABS}  `)).toBe('ab12cd34.png'); // trimmed
    expect(attachmentName('/x/_chat/attachments/deadbeef.jpeg')).toBe('deadbeef.jpeg');
  });

  test('rejects everything that is not a servable attachment path', () => {
    expect(attachmentName('/Users/x/proj/assets/ab12cd34.png')).toBeNull(); // wrong dir
    expect(attachmentName('/x/_chat/attachments/ab12cd34.svg')).toBeNull(); // never served
    expect(attachmentName('/x/_chat/attachments/AB12CD34.png')).toBeNull(); // uppercase hex
    expect(attachmentName('/x/_chat/attachments/abc.png')).toBeNull(); // short hash
    expect(attachmentName(`${ABS}/../secret.png`)).toBeNull(); // trailing junk
    expect(attachmentName('')).toBeNull();
    expect(attachmentName(null)).toBeNull();
  });
});

describe('chat-attachments / extractAttachmentRefs', () => {
  test('chip-only string (live bubble)', () => {
    expect(extractAttachmentRefs('[image-1]')).toEqual([
      { type: 'chip', token: '[image-1]', kind: 'image' },
    ]);
  });

  test('expanded absolute path (reloaded bubble) — path never leaks as text', () => {
    expect(extractAttachmentRefs(`look at ${ABS}`)).toEqual([
      { type: 'text', text: 'look at ' },
      { type: 'attachment', name: 'ab12cd34.png', raw: ABS },
    ]);
  });

  test('mixed text, multiple ref kinds, order preserved', () => {
    const segs = extractAttachmentRefs(`fix [image-2] and [file-1] then ${ABS} done`);
    expect(segs).toEqual([
      { type: 'text', text: 'fix ' },
      { type: 'chip', token: '[image-2]', kind: 'image' },
      { type: 'text', text: ' and ' },
      { type: 'chip', token: '[file-1]', kind: 'file' },
      { type: 'text', text: ' then ' },
      { type: 'attachment', name: 'ab12cd34.png', raw: ABS },
      { type: 'text', text: ' done' },
    ]);
  });

  test('non-attachment paths and near-miss tokens stay plain text', () => {
    expect(extractAttachmentRefs('/Users/x/proj/assets/ab12cd34.png')).toEqual([
      { type: 'text', text: '/Users/x/proj/assets/ab12cd34.png' },
    ]);
    expect(extractAttachmentRefs('[image-x] [screenshot-1]')).toEqual([
      { type: 'text', text: '[image-x] [screenshot-1]' },
    ]);
    expect(extractAttachmentRefs('')).toEqual([]);
  });
});

describe('chat-attachments / designImageRefs (assistant-mentioned images — DDR-145)', () => {
  test('the /design:screenshot reply shape — backticked relative path', () => {
    expect(
      designImageRefs('Saved to: `.design/_history/.design-ui-smoke/screenshots/001-smoke.png`')
    ).toEqual(['/.design/_history/.design-ui-smoke/screenshots/001-smoke.png']);
  });

  test('absolute path is clamped to the designRel-relative URL', () => {
    expect(designImageRefs('see /Users/x/proj/.design/exports/hero.png done')).toEqual([
      '/.design/exports/hero.png',
    ]);
  });

  test('custom designRel + trailing punctuation + dedup + cap', () => {
    expect(designImageRefs('wrote mocks/a.png.', 'mocks')).toEqual(['/mocks/a.png']);
    expect(designImageRefs('x .design/a.png and .design/a.png again')).toEqual(['/.design/a.png']);
    const many = Array.from({ length: 9 }, (_, i) => `.design/s/${i}0000000.png`).join(' ');
    expect(designImageRefs(many)).toHaveLength(6);
  });

  test('never matches outside designRel, non-images, SVG, or lookalike dirs', () => {
    expect(designImageRefs('site/public/logo.png')).toEqual([]);
    expect(designImageRefs('.design/ui/Canvas.tsx')).toEqual([]);
    expect(designImageRefs('.design/assets/mark.svg')).toEqual([]); // scriptable — excluded
    expect(designImageRefs('not-.design/a.png')).toEqual([]); // prefix must be a path segment
    expect(designImageRefs('', undefined)).toEqual([]);
  });

  test('traversal is rejected before it can escape designRel (DDR-145 A9 fix)', () => {
    // A `..` dot-segment would collapse to /etc/x.png in the browser.
    expect(designImageRefs('.design/../../etc/secret.png')).toEqual([]);
    expect(designImageRefs('.design/../.git/config.png')).toEqual([]);
    // Percent-encoding would decode past <rel>/ server-side — reject any `%`.
    expect(designImageRefs('.design/..%2f..%2fsecrets/cam.png')).toEqual([]);
    expect(designImageRefs('.design/%2e%2e/x.png')).toEqual([]);
    // Backslash: WHATWG rewrites `\`→`/` for http(s), so `..\..\` would climb out
    // AFTER a naive guard — the canonical-form allowlist catches it (attacker F).
    expect(designImageRefs('.design/..\\..\\secret.png')).toEqual([]);
    expect(designImageRefs('.design/a\\..\\..\\x.png')).toEqual([]);
    // A legit path that merely CONTAINS "dotdot"-ish text (not a segment) is fine.
    expect(designImageRefs('.design/a..b/hero.png')).toEqual(['/.design/a..b/hero.png']);
  });
});
