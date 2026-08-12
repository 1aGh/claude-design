// figma/tailwind-map.ts — Tailwind utility → JSX style object.
//
// The coverage claim is a MEASUREMENT, not an aspiration: 129 distinct classes
// across 64 families were counted on a real 375×812 screen (DDR-219 § Spike),
// and the census below is that exact list. If a future Figma release emits
// something new, this test is where it shows up — as an `unmapped` entry, which
// is the reportable outcome the acceptance criteria demand, not a silent drop.

import { describe, expect, test } from 'bun:test';

import { MAX_CLASSES_PER_ELEMENT, mapClassName } from './tailwind-map.ts';

const DS_FONTS = [{ name: '--font-body', value: "'hanken grotesk','inter',sans-serif" }];

/** Every distinct class observed on `425:2939`. */
const MEASURED_CLASSES = `relative shrink-0 flex content-stretch items-center flex-col absolute
justify-center size-full max-w-none block inset-0 [word-break:break-word] not-italic leading-[0]
whitespace-nowrap size-[24px] w-full text-black items-start border-solid leading-[normal] gap-[8px]
text-[12px] font-normal border bg-[var(--black-10,rgba(15,22,30,0.1))] py-[8px] px-[12px]
rounded-[8px] overflow-clip leading-[20px] font-bold tracking-[0.288px] text-[14px] justify-between
font-[family-name:var(--font,'Inter:Regular')] font-[family-name:var(--font,'Inter:Bold')] p-[10px]
border-black w-[185px] rounded-[9px] min-w-px flex-[1_0_0] text-center self-stretch rounded-[999px]
w-[40px] text-[color:var(--black,#0f161e)] size-[21.5px] rounded-[99px] p-px h-[32px] gap-px
font-['Inter:Regular'] border-[var(--black,#0f161e)] row-1 py-[16px] px-[24px] col-1 w-[34.018px]
w-[16px] text-[10px] text-[#0f161e] size-[32px] px-[10px] mt-0 h-[12px] border-b
border-[var(--black-10,rgba(15,22,30,0.1))] -translate-y-1/2 -translate-x-1/2 w-[54px] w-[375px]
w-[364px] w-[358px] w-[341.871px] w-[327px] w-[25px] w-[18px] w-0 tracking-[0.24px] tracking-[-0.3px]
top-[695.49px] top-[25.01px] top-[191px] top-1/2 text-[16px] size-[16px] size-[14.018px]
rounded-[16px] py-[12px] px-[20px] place-items-start pb-[8px] mt-px ml-[50px] ml-[26px] ml-0
left-[calc(50%-32.5px)] left-[calc(50%-0.02px)] left-[6.35px] left-1/2 leading-[12px] justify-end
inset-[37.5%_18.75%_26.56%_18.75%] inset-[10.42%_16.67%_8.33%_16.67%] inset-[0_4.17%] inset-[0_-0.5px]
inset-[0.49%_0.06%_-0.36%_0.07%] inset-[-6.64%_-7.07%_-7.49%_-7.07%] inline-grid h-full h-[768px]
h-[58.766px] h-[480px] h-[296px] h-[14.454px] h-[14.018px] h-[10px] grid-rows-[max-content]
grid-cols-[max-content] gap-[7px] gap-[4px] font-['SF_Pro_Display:Semibold'] font-['SF_Pro:Bold']
flex-row border-[red] bg-white`
  .trim()
  .split(/\s+/);

describe('the measured surface', () => {
  test('every class from the real screen maps — 129/129, zero unmapped', () => {
    const unmapped: string[] = [];
    for (const cls of MEASURED_CLASSES) {
      const r = mapClassName(cls, { fontTokens: DS_FONTS });
      if (r.unmapped.length > 0) unmapped.push(cls);
    }
    expect(unmapped).toEqual([]);
    expect(MEASURED_CLASSES.length).toBe(129);
  });
});

describe('the disambiguations that are easy to get wrong', () => {
  test('text-[16px] is a font size and text-[#hex] is a colour', () => {
    expect(mapClassName('text-[16px]').declarations).toEqual({ fontSize: '16px' });
    expect(mapClassName('text-[#0f161e]').declarations).toEqual({ color: '#0f161e' });
  });

  test("Tailwind's own color: hint wins", () => {
    expect(mapClassName('text-[color:var(--black,#0f161e)]').declarations).toEqual({
      color: 'var(--black,#0f161e)',
    });
  });

  test('border-[red] is a colour, border-[2px] is a width', () => {
    expect(mapClassName('border-[red]').declarations).toEqual({ borderColor: 'red' });
    expect(mapClassName('border-[2px]').declarations).toEqual({
      borderWidth: '2px',
      borderStyle: 'solid',
    });
  });

  test('a negative utility carries its sign on the FAMILY, not the value', () => {
    expect(mapClassName('-ml-[26px]').declarations).toEqual({ marginLeft: '-26px' });
  });

  test('transforms compose into ONE declaration', () => {
    expect(mapClassName('-translate-x-1/2 -translate-y-1/2').declarations.transform).toBe(
      'translateX(-50%) translateY(-50%)'
    );
  });

  test('leading-[0] becomes normal — a zero line box hides the text', () => {
    // D6b's rule in miniature: the translator can GUARANTEE visibility, so it
    // does, rather than faithfully reproducing a collapsed line and reporting
    // success on an empty-looking screen.
    expect(mapClassName('leading-[0]').declarations).toEqual({ lineHeight: 'normal' });
    expect(mapClassName('leading-[20px]').declarations).toEqual({ lineHeight: '20px' });
  });

  test('size-[N] sets both axes', () => {
    expect(mapClassName('size-[16px]').declarations).toEqual({ width: '16px', height: '16px' });
  });
});

describe('what must NOT get through', () => {
  test.each([
    'bg-[url(https://attacker.example/beacon.png)]',
    '[behavior:url(#x)]',
    '[content:"pwned"]',
    'w-[99999999px]',
    'text-[expression(alert(1))]',
    'bg-[#fff;position:fixed]',
    'grid-cols-[repeat(999999,1fr)]',
  ])('%s is reported, never emitted', (cls) => {
    const r = mapClassName(cls);
    expect(r.declarations).toEqual({});
    expect(r.unmapped.length).toBeGreaterThan(0);
  });

  test('an unknown utility is REPORTED — "never silently dropped" is the criterion', () => {
    const r = mapClassName('flex definitely-not-a-tailwind-class');
    expect(r.declarations).toEqual({ display: 'flex' });
    expect(r.unmapped).toEqual(['definitely-not-a-tailwind-class']);
  });

  test('a class list long enough to be a payload is capped, and the cap is reported', () => {
    const many = Array.from({ length: MAX_CLASSES_PER_ELEMENT + 10 }, () => 'flex').join(' ');
    const r = mapClassName(many);
    expect(r.unmapped).toContain('class-cap-reached');
  });

  test('an oversized single token never reaches a grammar', () => {
    const r = mapClassName(`w-[${'1'.repeat(500)}px]`);
    expect(r.declarations).toEqual({});
    expect(r.unmapped).toEqual(['oversized']);
  });
});

describe('DS tokens', () => {
  test('a bare hex snaps onto a near DS token', () => {
    const r = mapClassName('bg-[#0f161e]', {
      tokens: [{ name: '--fg-0', hex: '#0f161e' }],
    });
    expect(r.declarations.background).toBe('var(--fg-0)');
  });

  test('a var() Figma already resolved is NOT re-snapped — that would be a downgrade', () => {
    const r = mapClassName('bg-[var(--black,#0f161e)]', {
      tokens: [{ name: '--fg-0', hex: '#0f161e' }],
    });
    expect(r.declarations.background).toBe('var(--black,#0f161e)');
  });
});
