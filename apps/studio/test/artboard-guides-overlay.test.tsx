// artboard-guides-overlay — feature-1-artboard-kinds-foundation, T4.
// Registry contract + generic guides rendering. Pure renderToStaticMarkup —
// this component has no hooks/context, so (unlike DCArtboard's own overlays)
// it renders fully outside a live DesignCanvas.

import { afterEach, describe, expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import {
  __resetKindOverlayRegistryForTests,
  ArtboardGuidesOverlay,
  registerKindOverlay,
} from '../artboard-guides-overlay.tsx';

const RECT = { x: 10, y: 20, w: 400, h: 200 };

afterEach(() => {
  __resetKindOverlayRegistryForTests();
});

describe('ArtboardGuidesOverlay — generic guides', () => {
  test('renders nothing with no guides and no registered kind content', () => {
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay rect={RECT} kind="digital" visibility={{}} />
    );
    expect(html).toBe('');
  });

  test('positions the overlay at the artboard world rect', () => {
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay
        rect={RECT}
        kind="print"
        guides={{ grid: { size: 40 } }}
        visibility={{ guides: true }}
      />
    );
    expect(html).toMatch(/left:\s*10px/);
    expect(html).toMatch(/top:\s*20px/);
    expect(html).toMatch(/width:\s*400px/);
    expect(html).toMatch(/height:\s*200px/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('pointer-events:none');
  });

  test('visibility.guides === false suppresses the generic guides', () => {
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay
        rect={RECT}
        kind="print"
        guides={{ grid: { size: 40 } }}
        visibility={{ guides: false }}
      />
    );
    expect(html).toBe('');
  });

  test('columns render as one band per column, respecting margin/gutter', () => {
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay
        rect={RECT}
        kind="web"
        guides={{ columns: { count: 4, gutter: 10, margin: 20 } }}
        visibility={{ guides: true }}
      />
    );
    // usable = 400 - 2*20 = 360; (360 - 3*10) / 4 = 82.5px per column, 4 bands.
    const bandCount = (html.match(/width:82\.5px/g) || []).length;
    expect(bandCount).toBe(4);
  });

  test('grid lines are capped, never runaway for a degenerate small size', () => {
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay
        rect={{ x: 0, y: 0, w: 5000, h: 5000 }}
        kind="digital"
        guides={{ grid: { size: 2 } }}
        visibility={{ guides: true }}
      />
    );
    const lineCount = (html.match(/width:1px/g) || []).length;
    expect(lineCount).toBeLessThanOrEqual(400);
  });
});

describe('ArtboardGuidesOverlay — per-kind registry', () => {
  test('registered kind renderer is invoked with rect/kind/guides/visibility', () => {
    let seen: unknown;
    registerKindOverlay('print', (props) => {
      seen = props;
      return <div data-testid="print-bleed" />;
    });
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay rect={RECT} kind="print" visibility={{ bleed: true }} />
    );
    expect(html).toContain('data-testid="print-bleed"');
    expect(seen).toMatchObject({ rect: RECT, kind: 'print', visibility: { bleed: true } });
  });

  test('a renderer registered for one kind does not fire for another', () => {
    registerKindOverlay('web', () => <div data-testid="breakpoint-band" />);
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay rect={RECT} kind="print" visibility={{}} />
    );
    expect(html).not.toContain('breakpoint-band');
  });

  test('re-registering the same kind replaces the previous renderer (HMR-safe)', () => {
    registerKindOverlay('print', () => <div data-testid="v1" />);
    registerKindOverlay('print', () => <div data-testid="v2" />);
    const html = renderToStaticMarkup(
      <ArtboardGuidesOverlay rect={RECT} kind="print" visibility={{}} />
    );
    expect(html).not.toContain('v1');
    expect(html).toContain('v2');
  });
});
