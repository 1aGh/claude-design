// Surfaces a cloud tab must not offer — Cloud Phase 27, found by using it.
//
// The phase's rule is C1's: role shapes what is OFFERED, never what is VISIBLE.
// That rule is about ROLES. A different question turned up the moment the real
// studio actually ran in a browser: what about a control whose feature cannot
// exist in THIS SHELL at all?
//
// Three answers, and the difference between them is the whole point:
//
//   the agent chat        ABSENT, WITH A NOTICE. It runs on your own Claude
//                         subscription on your own machine (DDR-123). The
//                         feature exists and you can have it — the menu row
//                         stays, disabled, saying where. (C2)
//
//   "Sign in to Maude     ABSENT, SILENTLY. It offers to do the thing you have
//    Cloud"               already done: you reached this tab THROUGH a Maude
//                         account. There is nothing to explain.
//
//   AI generation /       ABSENT, SILENTLY. These configure ffmpeg, mlx-vlm, a
//   Subtitles / Video     HuggingFace cache and your own provider keys — none
//                         of which a browser tab has, and whose routes a cell
//                         refuses by design (DDR-209 D1). Left in, they render
//                         as a wall of `HTTP 404`, which is what the owner saw.
//
// Source-level assertions, because the menubar's dropdowns do not open under a
// synthetic click and a test that cannot fail is worse than no test. What these
// pin is exactly what would regress: someone re-introducing `TABS.map` or
// dropping the gate on `<CloudBar />`.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STUDIO = join(import.meta.dir, '..');
const APP = readFileSync(join(STUDIO, 'client', 'app.jsx'), 'utf8');
const SETTINGS = readFileSync(join(STUDIO, 'client', 'panels', 'SettingsPanel.jsx'), 'utf8');

describe('the cloud shell offers nothing it cannot honour', () => {
  test('the local-machine settings tabs are flagged, and only those three', () => {
    const flagged = [
      ...SETTINGS.matchAll(/\{ id: '([a-z-]+)', label: '[^']+', local: true \}/g),
    ].map((m) => m[1]);
    expect(flagged.sort()).toEqual(['ai-generation', 'subtitles', 'video']);
  });

  test('the tab rail renders the FILTERED list, not the raw table', () => {
    // `TABS.map` is what shipped the wall of 404s.
    expect(SETTINGS).toContain('{tabs.map((t) => (');
    expect(SETTINGS).not.toContain('{TABS.map(');
    // …and every keyboard path must walk the same list, or End/Home select a
    // tab that is not on screen.
    expect(SETTINGS).not.toMatch(/setTab\(TABS\[/);
    expect(SETTINGS).toContain('const tabs = useMemo(');
  });

  test('a remembered tab this shell does not have cannot select nothing', () => {
    // Open Video on the desktop, then open Settings in the cloud.
    const init =
      /const \[tab, setTab\] = useState\(\(\) => \{[\s\S]*?\}\);/.exec(SETTINGS)?.[0] ?? '';
    expect(init).toContain('!(cloud && t.local)');
  });

  test('the cloud sign-in is not offered inside the cloud', () => {
    expect(APP).toContain('{cloud ? null : <CloudBar />}');
  });

  test('every component that gates on the shell is actually GIVEN the flag', () => {
    // The bug this exists for: three `cfg?.cloud` reads inside a component that
    // never receives `cfg` — a ReferenceError at render, and a blank app.
    for (const call of ['<Menubar', '<Sidebar', '<SettingsPanel']) {
      const at = APP.indexOf(call);
      expect(at).toBeGreaterThan(0);
      const props = APP.slice(at, at + 900);
      expect(props).toContain('cloud={cfg?.cloud ?? null}');
    }
  });

  test('no component reaches for `cfg` where only the flag was passed', () => {
    // `cfg` is a real variable at the top level, so a stray reference in a
    // child component is a ReferenceError the bundler happily emits.
    for (const fn of ['function Menubar({', 'function Sidebar({']) {
      const start = APP.indexOf(fn);
      expect(start).toBeGreaterThan(0);
      // Bounded window: the component's own body, not the whole file.
      const body = APP.slice(start, APP.indexOf('\nfunction ', start + 10));
      expect(body).not.toMatch(/\bcfg\?\./);
      expect(body).not.toMatch(/\bcfg\./);
    }
  });
});
