// figma/codegen-values.ts — the codegen lane's value grammar.
//
// Two things are being defended here, and they pull in opposite directions:
// a `var()` WITH a fallback must be ADMITTED (it is the fidelity this whole
// route exists for), and nothing SHARED with the tree translator or DDR-172's
// token importer may be widened to get it. So the tests assert both the new
// admissions and that the old refusals still refuse.

import { describe, expect, test } from 'bun:test';

import {
  cssPropToCamel,
  isAllowedArbitraryProperty,
  isCodegenColor,
  isCodegenKeyword,
  isCodegenLength,
  isCodegenLengthList,
  isCodegenNumber,
  isCodegenShortValueList,
  MAX_VALUE_LEN,
  normalizeCalc,
  splitVar,
  unescapeArbitrary,
} from './codegen-values.ts';
import { isValidColorValue } from './style-map.ts';

describe('the shared grammar is not widened', () => {
  test('style-map still refuses a fallback-bearing var() — that is the point', () => {
    // If this ever passes, someone widened `VAR_RE` instead of composing, which
    // is verbatim the root pattern the DDR-216 review named twice.
    expect(isValidColorValue('var(--black,#0f161e)')).toBe(false);
    expect(isValidColorValue('var(--black)')).toBe(true);
  });

  test('the lane admits it locally', () => {
    expect(isCodegenColor('var(--black,#0f161e)')).toBe(true);
    expect(isCodegenColor('var(--black-10,rgba(15,22,30,0.1))')).toBe(true);
  });
});

describe('isCodegenColor', () => {
  test.each([
    ['#0f161e', true],
    ['rgba(15,22,30,0.1)', true],
    ['var(--accent)', true],
    ['var(--accent, #fff)', true],
    ['white', true],
    ['transparent', true],
    // The fallback is validated as a colour IN ITS OWN RIGHT, so a URL smuggled
    // into it is refused by the grammar and not merely by the canvas CSP.
    ['var(--x,url(https://attacker.example/p))', false],
    ['url(https://attacker.example/p)', false],
    ['var(--x);color:red', false],
    ['expression(alert(1))', false],
    ['var(--ABC)', false],
    ['#0f161e /* */', false],
  ])('%s -> %s', (value, expected) => {
    expect(isCodegenColor(value as string)).toBe(expected);
  });

  test('nested var() fallbacks terminate', () => {
    expect(isCodegenColor('var(--a,var(--b,var(--c,#fff)))')).toBe(true);
    expect(isCodegenColor('var(--a,var(--b,var(--c,var(--d,var(--e,#fff)))))')).toBe(false);
  });

  test('a value over the length cap is refused before any grammar runs', () => {
    expect(isCodegenColor(`#${'0'.repeat(MAX_VALUE_LEN)}`)).toBe(false);
  });
});

describe('lengths', () => {
  test.each([
    ['375px', true],
    ['0', true],
    ['4.17%', true],
    ['1.5rem', true],
    ['100vh', true],
    ['auto', true],
    ['calc(50% - 32.5px)', true],
    ['99999999px', false],
    ['red', false],
    ['12px;color:red', false],
    ['calc(50% - 32.5px) !important', false],
  ])('%s -> %s', (v, expected) => {
    expect(isCodegenLength(v as string)).toBe(expected);
  });

  test('a shorthand of up to four lengths', () => {
    expect(isCodegenLengthList('37.5% 18.75% 26.56% 18.75%')).toBe(true);
    expect(isCodegenLengthList('0 4.17%')).toBe(true);
    expect(isCodegenLengthList('1px 2px 3px 4px 5px')).toBe(false);
  });
});

describe('normalizeCalc', () => {
  test('re-spaces the operator Figma omits', () => {
    // `calc(50%-32.5px)` is INVALID CSS — a browser drops the declaration — so a
    // pass-through would silently lose the position.
    expect(normalizeCalc('calc(50%-32.5px)')).toBe('calc(50% - 32.5px)');
    expect(normalizeCalc('calc(50%-0.02px)')).toBe('calc(50% - 0.02px)');
  });

  test('REGRESSION: a custom-property name is not an arithmetic expression', () => {
    // The first version used a lookbehind regex and rewrote this to
    // `var(--black - 10,…)`, which is a broken declaration on the single most
    // common value shape this whole route exists to preserve.
    expect(normalizeCalc('var(--black-10,rgba(15,22,30,0.1))')).toBe(
      'var(--black-10,rgba(15,22,30,0.1))'
    );
    expect(normalizeCalc('calc(var(--gap-2) + 4px)')).toBe('calc(var(--gap-2) + 4px)');
  });

  test('a leading sign is not an operator', () => {
    expect(normalizeCalc('calc(-4px)')).toBe('calc(-4px)');
  });

  test('a value with no calc is returned untouched', () => {
    expect(normalizeCalc('1 0 0')).toBe('1 0 0');
  });
});

describe('unescapeArbitrary', () => {
  test('an underscore is a space', () => {
    expect(unescapeArbitrary('37.5%_18.75%')).toBe('37.5% 18.75%');
    expect(unescapeArbitrary("'SF_Pro:Bold'")).toBe("'SF Pro:Bold'");
  });

  test('an escaped underscore stays an underscore', () => {
    expect(unescapeArbitrary('a\\_b_c')).toBe('a_b c');
  });
});

describe('splitVar', () => {
  test('splits at depth 1 only', () => {
    expect(splitVar('var(--a,rgba(1,2,3,0.5))')).toEqual({
      name: '--a',
      fallback: 'rgba(1,2,3,0.5)',
    });
    expect(splitVar('var(--a)')).toEqual({ name: '--a', fallback: null });
    expect(splitVar('#fff')).toBeNull();
  });
});

describe('arbitrary properties are an allowlist', () => {
  test('admits what Figma emits', () => {
    expect(isAllowedArbitraryProperty('word-break')).toBe(true);
    expect(isAllowedArbitraryProperty('font-variation-settings')).toBe(true);
  });

  test('refuses everything else, including things a denylist would forget', () => {
    for (const prop of ['behavior', '-moz-binding', 'content', 'background-image', 'src']) {
      expect(isAllowedArbitraryProperty(prop)).toBe(false);
    }
  });
});

describe('misc predicates', () => {
  test('numbers are magnitude-bounded, not only shape-checked', () => {
    expect(isCodegenNumber('0.5')).toBe(true);
    expect(isCodegenNumber('999999999')).toBe(false);
  });

  test('keywords are short and lowercase', () => {
    expect(isCodegenKeyword('max-content')).toBe(true);
    expect(isCodegenKeyword('break-word')).toBe(true);
    expect(isCodegenKeyword('URL(x)')).toBe(false);
  });

  test('short value lists', () => {
    expect(isCodegenShortValueList('1 0 0')).toBe(true);
    expect(isCodegenShortValueList('max-content')).toBe(true);
    expect(isCodegenShortValueList('1 2 3 4 5 6 7')).toBe(false);
  });

  test('camelCase, because a hyphenated key in a JSX style OBJECT is a syntax error', () => {
    expect(cssPropToCamel('word-break')).toBe('wordBreak');
    expect(cssPropToCamel('font-variation-settings')).toBe('fontVariationSettings');
  });
});
