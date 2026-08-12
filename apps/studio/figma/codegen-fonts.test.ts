// figma/codegen-fonts.ts — plan T18.
//
// The thing under test is not really the mapping, it is the REPORT. A font that
// silently falls back looks fine and is not the design, and this import has
// already shipped three "success" reports over lost content. So: every
// substitution produces an entry, the entry is BOUNDED (DDR-219 D9), and a
// family the project genuinely has produces none.

import { describe, expect, test } from 'bun:test';

import {
  FontSubstitutions,
  MAX_FAMILY_DETAIL,
  resolveFontFamily,
  SYSTEM_STACK,
  splitFamilyAndStyle,
  styleToWeight,
} from './codegen-fonts.ts';
import { ImportReport } from './sanitize.ts';

const DS = [{ name: '--font-body', value: "'hanken grotesk','inter',sans-serif" }];

describe('splitting Figma’s Family:Style', () => {
  test.each([
    ['SF Pro:Bold', 'SF Pro', 'Bold'],
    ['SF Pro Display:Semibold', 'SF Pro Display', 'Semibold'],
    ['Inter:Regular', 'Inter', 'Regular'],
    ['Inter', 'Inter', null],
  ])('%s', (raw, family, style) => {
    expect(splitFamilyAndStyle(raw)).toEqual({ family, style });
  });

  test('the style half is a WEIGHT and must not become part of the family', () => {
    expect(styleToWeight('Bold')).toBe(700);
    expect(styleToWeight('Semibold')).toBe(600);
    expect(styleToWeight('Regular')).toBe(400);
    expect(styleToWeight('NotAWeight')).toBeNull();
  });
});

describe('resolveFontFamily', () => {
  test('a family the DS already declares resolves to the token, and is NOT a substitution', () => {
    const r = resolveFontFamily('Inter:Regular', DS);
    expect(r.css).toBe('var(--font-body)');
    expect(r.substituted).toBe(false);
  });

  test('an absent family lands on the DS body token AND reports', () => {
    // Measured on the dogfood machine: SF Pro is not installed, and the DS loads
    // no webfont at all — so copying the name through lands on a serif fallback
    // that looks fine and is not the design.
    const r = resolveFontFamily('SF Pro:Bold', DS);
    expect(r.css).toBe('var(--font-body)');
    expect(r.substituted).toBe(true);
    expect(r.requested).toBe('SF Pro');
  });

  test('with no DS at all it lands on a SANS stack, never a serif default', () => {
    const r = resolveFontFamily('Nunito:Bold', []);
    expect(r.css).toBe(SYSTEM_STACK);
    expect(r.substituted).toBe(true);
  });

  test('the requested family NEVER reaches the artifact verbatim', () => {
    const hostile = resolveFontFamily("Evil';}\n.x{color:red};:Bold", DS);
    expect(hostile.css).not.toContain('color:red');
    expect(hostile.requested).not.toContain(';');
    expect(hostile.requested.length).toBeLessThanOrEqual(MAX_FAMILY_DETAIL);
  });
});

describe('the report', () => {
  test('one entry per FAMILY with a count — not one per element', () => {
    const subs = new FontSubstitutions();
    for (let i = 0; i < 40; i += 1) subs.note(resolveFontFamily('SF Pro:Bold', DS));
    subs.note(resolveFontFamily('Nunito:Regular', DS));
    const report = new ImportReport();
    subs.flush(report, '425:2939');

    // Forty identical entries would bury every other disposition and blow the
    // summary's 200-line cap for no information.
    expect(report.entries).toEqual([
      { nodeId: '425:2939', type: 'FONT', disposition: 'font-substituted', detail: 'Nunito x1' },
      { nodeId: '425:2939', type: 'FONT', disposition: 'font-substituted', detail: 'SF Pro x40' },
    ]);
  });

  test('a family that survived produces NO entry', () => {
    const subs = new FontSubstitutions();
    subs.note(resolveFontFamily('Inter:Regular', DS));
    const report = new ImportReport();
    subs.flush(report, '1:1');
    expect(report.entries).toEqual([]);
  });

  test('a hostile family cannot blow the detail bound — ImportReport would throw', () => {
    const subs = new FontSubstitutions();
    subs.note(resolveFontFamily(`${'A'.repeat(400)}:Bold`, DS));
    const report = new ImportReport();
    expect(() => subs.flush(report, '1:1')).not.toThrow();
    expect(report.entries[0].detail?.length).toBeLessThanOrEqual(64);
  });
});
