// artboard-kinds — feature-1-artboard-kinds-foundation, T1/T2.
//
// DCArtboard rendered OUTSIDE a DesignCanvas (no WorldContext, no rect) takes
// the specimen/legacy early-return branch — it still computes + emits the
// resolved `data-dc-kind` attribute (readBackAttrs is built before the
// `!ctx || !rect` check), so that resolution logic is testable via
// renderToStaticMarkup without a live DOM/layout pass. The label-strip kind
// chip (T3) only renders in the full DesignCanvas layout path (like the
// video corner badge it sits beside) — covered by /design:smoke, not here
// (see use-canvas-activity.test.tsx's header comment for the same split).

import { describe, expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { DCArtboard } from '../canvas-lib.tsx';

// Minimal displayName-only stand-in for VideoComp — subtreeHasVideoComp
// identity-matches OR falls back to `displayName === 'VideoComp'` (the same
// fallback minified builds rely on), so this exercises the fallback path
// without pulling in the real VideoComp's rendering/registration machinery.
function FakeVideoComp() {
  return null;
}
FakeVideoComp.displayName = 'VideoComp';

describe('DCArtboard kind resolution (data-dc-kind readback)', () => {
  test('absent kind, no video subtree ⇒ digital', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100}>
        hi
      </DCArtboard>
    );
    expect(html).toContain('data-dc-kind="digital"');
  });

  test('explicit kind="print" is emitted verbatim', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100} kind="print">
        hi
      </DCArtboard>
    );
    expect(html).toContain('data-dc-kind="print"');
  });

  test('explicit kind="web" is emitted verbatim', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100} kind="web">
        hi
      </DCArtboard>
    );
    expect(html).toContain('data-dc-kind="web"');
  });

  test('absent kind + VideoComp subtree ⇒ video fallback (Design Decision 1)', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100}>
        <FakeVideoComp />
      </DCArtboard>
    );
    expect(html).toContain('data-dc-kind="video"');
  });

  test('explicit kind="digital" supersedes a VideoComp subtree', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100} kind="digital">
        <FakeVideoComp />
      </DCArtboard>
    );
    expect(html).toContain('data-dc-kind="digital"');
  });

  test('digital kind (default) carries no other resolved-kind attribute value', () => {
    const html = renderToStaticMarkup(
      <DCArtboard id="a" label="A" width={100} height={100}>
        hi
      </DCArtboard>
    );
    expect(html).not.toContain('data-dc-kind="print"');
    expect(html).not.toContain('data-dc-kind="web"');
    expect(html).not.toContain('data-dc-kind="video"');
  });
});
