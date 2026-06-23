// tour-overlay — Phase 3. Render contract for the hand-rolled tour engine.
//
// renderToStaticMarkup doesn't run effects, so the rect stays null on the
// server render → the overlay falls back to a centered card + scrim. We assert
// the a11y dialog contract + step/nav wiring; keyboard/focus-trap behavior is a
// live-only concern (verified via agent-browser).

import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TourOverlay } from '../client/tour/overlay.jsx';

const STEP = { target: '.x', title: 'Welcome', body: 'Body copy here' };

describe('TourOverlay', () => {
  test('renders an accessible dialog with the first step', () => {
    const html = renderToStaticMarkup(
      <TourOverlay open steps={[STEP]} onClose={() => {}} onComplete={() => {}} />
    );
    expect(html).toContain('mdcc-tour');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Welcome');
    expect(html).toContain('Body copy here');
    expect(html).toContain('1 / 1');
    expect(html).toContain('mdcc-tour__scrim'); // no rect on the server → scrim, not spotlight
  });

  test('single step shows Done (not Next) and no Back', () => {
    const html = renderToStaticMarkup(
      <TourOverlay open steps={[STEP]} onClose={() => {}} onComplete={() => {}} />
    );
    expect(html).toContain('Done');
    expect(html).not.toContain('mdcc-tour__back');
  });

  test('multi-step first page shows Next, the counter, and no Back yet', () => {
    const steps = [STEP, { ...STEP, title: 'Two' }, { ...STEP, title: 'Three' }];
    const html = renderToStaticMarkup(
      <TourOverlay open steps={steps} onClose={() => {}} onComplete={() => {}} />
    );
    expect(html).toContain('1 / 3');
    expect(html).toContain('Next');
    expect(html).not.toContain('mdcc-tour__back'); // i === 0
  });

  test('a step with a render graphic widens the card and draws the graphic (Phase 29 / E4)', () => {
    function Graphic() {
      return <div className="cm-info">TWO-LAYER-DIAGRAM</div>;
    }
    const html = renderToStaticMarkup(
      <TourOverlay
        open
        steps={[{ render: Graphic, title: 'Working together', body: 'Two layers.' }]}
        onClose={() => {}}
        onComplete={() => {}}
      />
    );
    expect(html).toContain('mdcc-tour__card--graphic');
    expect(html).toContain('mdcc-tour__graphic');
    expect(html).toContain('TWO-LAYER-DIAGRAM');
    expect(html).toContain('Working together');
  });

  test('closed or empty renders nothing', () => {
    expect(
      renderToStaticMarkup(
        <TourOverlay open={false} steps={[STEP]} onClose={() => {}} onComplete={() => {}} />
      )
    ).toBe('');
    expect(
      renderToStaticMarkup(<TourOverlay open steps={[]} onClose={() => {}} onComplete={() => {}} />)
    ).toBe('');
  });
});
