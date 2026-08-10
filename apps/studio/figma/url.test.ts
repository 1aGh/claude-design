// figma/url.ts — the SSRF chokepoint-1 rejection table (DDR-216 D4).
//
// The accept cases prove the four public URL shapes + bare keys parse; the
// REJECT table is the load-bearing half. Round 1 of the DDR's security review
// attacked this parser specifically (userinfo-in-host, IDN look-alikes, `..`,
// `%2e%2e`, a key carrying `/`/`@`/`#`, a node id smuggling a path, a full
// absolute URL passed as the key) and could not break it — these cases pin
// that result so a later "let's be more forgiving" refactor fails loudly.

import { describe, expect, test } from 'bun:test';

import { FigmaUrlError, normalizeNodeId, parseFigmaTarget } from './url.ts';

const DESIGN_KEY = 'dGNzRC2kmrmGnOxaBa0RI7'; // the real design fixture
const BOARD_KEY = 'Em6NOwaOFTYV7NlQT4NK8l'; // the real FigJam fixture

describe('parseFigmaTarget — accepts the four public shapes', () => {
  const cases: Array<[string, string, { fileKey: string; nodeId?: string; surface: string }]> = [
    [
      'design URL',
      `https://www.figma.com/design/${DESIGN_KEY}/Maude-fixtures`,
      { fileKey: DESIGN_KEY, surface: 'design' },
    ],
    [
      'board URL',
      `https://www.figma.com/board/${BOARD_KEY}/Analyza`,
      { fileKey: BOARD_KEY, surface: 'board' },
    ],
    [
      'legacy /file/ URL normalizes to design',
      `https://www.figma.com/file/${DESIGN_KEY}/Old-link`,
      { fileKey: DESIGN_KEY, surface: 'design' },
    ],
    [
      'proto URL normalizes to design',
      `https://www.figma.com/proto/${DESIGN_KEY}/Proto`,
      { fileKey: DESIGN_KEY, surface: 'design' },
    ],
    [
      'apex host (no www)',
      `https://figma.com/design/${DESIGN_KEY}/x`,
      { fileKey: DESIGN_KEY, surface: 'design' },
    ],
    [
      'node-id is normalized from a-b to a:b',
      `https://www.figma.com/design/${DESIGN_KEY}/x?node-id=2-17`,
      { fileKey: DESIGN_KEY, nodeId: '2:17', surface: 'design' },
    ],
    [
      'node-id already colon-shaped survives',
      `https://www.figma.com/board/${BOARD_KEY}/x?node-id=1%3A8`,
      { fileKey: BOARD_KEY, nodeId: '1:8', surface: 'board' },
    ],
    [
      'other query params are ignored',
      `https://www.figma.com/design/${DESIGN_KEY}/x?t=abc&node-id=2-17&mode=dev`,
      { fileKey: DESIGN_KEY, nodeId: '2:17', surface: 'design' },
    ],
    ['bare key defaults to design', DESIGN_KEY, { fileKey: DESIGN_KEY, surface: 'design' }],
  ];

  for (const [label, input, expected] of cases) {
    test(label, () => {
      expect(parseFigmaTarget(input)).toEqual(expected as never);
    });
  }

  test('a bare key honours the caller-supplied default surface', () => {
    expect(parseFigmaTarget(BOARD_KEY, 'board')).toEqual({ fileKey: BOARD_KEY, surface: 'board' });
  });

  test('surrounding whitespace from a paste is tolerated', () => {
    expect(parseFigmaTarget(`  https://www.figma.com/design/${DESIGN_KEY}/x  `).fileKey).toBe(
      DESIGN_KEY
    );
  });
});

describe('parseFigmaTarget — the rejection table (SSRF chokepoint 1)', () => {
  const rejects: Array<[string, string]> = [
    // ── the host must never come from input ──────────────────────────────
    ['userinfo-in-host', `https://www.figma.com@evil.tld/design/${DESIGN_KEY}/x`],
    ['userinfo with password', `https://user:pw@www.figma.com/design/${DESIGN_KEY}/x`],
    ['plain non-figma host', `https://evil.tld/design/${DESIGN_KEY}/x`],
    ['suffix look-alike (evil-figma.com)', `https://evil-figma.com/design/${DESIGN_KEY}/x`],
    ['figma.com as a subdomain of evil', `https://figma.com.evil.tld/design/${DESIGN_KEY}/x`],
    ['IDN homograph', `https://www.figɱa.com/design/${DESIGN_KEY}/x`],
    ['cyrillic homograph', `https://www.figmа.com/design/${DESIGN_KEY}/x`],
    ['loopback', `http://127.0.0.1/design/${DESIGN_KEY}/x`],
    ['link-local metadata host', `http://169.254.169.254/design/${DESIGN_KEY}/x`],

    // ── scheme ───────────────────────────────────────────────────────────
    ['file scheme', `file:///design/${DESIGN_KEY}/x`],
    ['data scheme', 'data:text/plain,figma'],
    ['javascript scheme', 'javascript:alert(1)'],

    // ── the key position ─────────────────────────────────────────────────
    ['traversal in the key position', 'https://www.figma.com/design/../../etc/passwd'],
    ['percent-encoded traversal', 'https://www.figma.com/design/%2e%2e%2f%2e%2e/x'],
    ['encoded slash in the key', 'https://www.figma.com/design/aaaa%2Fbbbb/x'],
    ['key too short', 'https://www.figma.com/design/short/x'],
    ['key too long', `https://www.figma.com/design/${'a'.repeat(65)}/x`],
    ['key with a hyphen', 'https://www.figma.com/design/abcd-efghij/x'],
    ['key with a dot', 'https://www.figma.com/design/abcdefghi.j/x'],
    ['no key segment', 'https://www.figma.com/design/'],
    ['unknown surface segment', `https://www.figma.com/community/${DESIGN_KEY}/x`],

    // ── bare-key position ────────────────────────────────────────────────
    ['bare key with a slash', 'aaaaaaaaaa/bbbb'],
    ['bare key with an @', 'aaaaaaaaaa@evil.tld'],
    ['bare key with a #', 'aaaaaaaaaa#frag'],
    ['an absolute URL passed where a key is expected', 'https://evil.tld/aaaaaaaaaa'],

    // ── shape ────────────────────────────────────────────────────────────
    ['empty', ''],
    ['whitespace only', '   '],
    ['over-length input', `https://www.figma.com/design/${DESIGN_KEY}/${'x'.repeat(2100)}`],
  ];

  for (const [label, input] of rejects) {
    test(`rejects: ${label}`, () => {
      expect(() => parseFigmaTarget(input)).toThrow(FigmaUrlError);
    });
  }

  test('rejection messages never echo the input back', () => {
    // An error path that reflects attacker-controlled input is a namable
    // exfil/reflection channel — DDR-172 Decision 1 closed the same class for
    // token-file parse errors, and DDR-216 D10 makes it a rule for this verb.
    const hostile = 'https://evil.tld/design/CANARYCANARY/x?node-id=1-2';
    try {
      parseFigmaTarget(hostile);
      throw new Error('expected a rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(FigmaUrlError);
      expect((err as Error).message).not.toContain('CANARY');
      expect((err as Error).message).not.toContain('evil.tld');
    }
  });
});

describe('normalizeNodeId — a malformed id means "whole file", never "some other node"', () => {
  test('normalizes the hyphen form', () => {
    expect(normalizeNodeId('457-608')).toBe('457:608');
  });

  test('passes a well-formed colon id through', () => {
    expect(normalizeNodeId('2:17')).toBe('2:17');
  });

  for (const bad of [
    null,
    undefined,
    '',
    'abc',
    '1',
    '1:2:3',
    '../1-2',
    '1-2;rm -rf',
    '1-2 OR 1=1',
    `${'9'.repeat(11)}-1`, // over the digit ceiling
  ]) {
    test(`drops malformed id: ${JSON.stringify(bad)}`, () => {
      expect(normalizeNodeId(bad as string)).toBeUndefined();
    });
  }
});
