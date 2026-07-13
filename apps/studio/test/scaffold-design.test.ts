import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldDesign } from '../scaffold-design.ts';

// DDR-166 Phase 1 — scaffoldDesign() now seeds THREE canvases (Welcome +
// the two onboarding reference canvases), embedded as escaped template
// literals. A bug in that escaping (an unescaped backtick/${ from the
// source .design/ui/*.tsx files) would silently truncate the written file
// into broken JS at scaffold time — every future new project would boot to
// a corrupt canvas. Exercise the REAL function against a REAL temp dir, not
// a mock, so a truncation shows up as a parse failure below.
describe('scaffoldDesign — onboarding canvas seeding', () => {
  function scaffold() {
    const dir = mkdtempSync(join(tmpdir(), 'maude-scaffold-test-'));
    const result = scaffoldDesign(dir, 'Scaffold Test');
    return { dir, result };
  }

  test('writes ok:true and all three seeded canvases + their meta sidecars', () => {
    const { dir, result } = scaffold();
    try {
      expect(result.ok).toBe(true);
      for (const name of ['Welcome', 'How to use Maude', 'How to make video']) {
        expect(existsSync(join(dir, '.design', 'ui', `${name}.tsx`))).toBe(true);
        expect(existsSync(join(dir, '.design', 'ui', `${name}.meta.json`))).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the two onboarding canvases are non-trivially sized (catches a silent truncation)', () => {
    const { dir } = scaffold();
    try {
      const useMaude = readFileSync(join(dir, '.design', 'ui', 'How to use Maude.tsx'), 'utf8');
      const makeVideo = readFileSync(join(dir, '.design', 'ui', 'How to make video.tsx'), 'utf8');
      // Real sizes are ~30KB/~24KB; a truncated-at-the-first-unescaped-backtick
      // bug would cut this down to a few hundred bytes at most.
      expect(useMaude.length).toBeGreaterThan(10_000);
      expect(makeVideo.length).toBeGreaterThan(10_000);
      // Both files must close their own template structure — the default
      // export is the last thing in each source file.
      expect(useMaude.trim().endsWith('}')).toBe(true);
      expect(makeVideo.trim().endsWith('}')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every seeded .tsx parses as valid TSX (Bun.Transpiler) and has exactly one default export', () => {
    const { dir } = scaffold();
    try {
      const transpiler = new Bun.Transpiler({ loader: 'tsx' });
      for (const name of ['Welcome', 'How to use Maude', 'How to make video']) {
        const src = readFileSync(join(dir, '.design', 'ui', `${name}.tsx`), 'utf8');
        expect(() => transpiler.transformSync(src)).not.toThrow();
        expect(src).toMatch(/export default function \w+/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every seeded meta.json is valid JSON with a matching artboards list', () => {
    const { dir } = scaffold();
    try {
      // Welcome's meta nests artboards under sections[0] (the older, still-live
      // convention); the two onboarding canvases use a top-level `artboards`.
      const welcome = JSON.parse(
        readFileSync(join(dir, '.design', 'ui', 'Welcome.meta.json'), 'utf8')
      );
      expect(welcome.sections[0].artboards.length).toBe(1);
      for (const [name, count] of [
        ['How to use Maude', 10],
        ['How to make video', 7],
      ] as const) {
        const meta = JSON.parse(
          readFileSync(join(dir, '.design', 'ui', `${name}.meta.json`), 'utf8')
        );
        expect(Array.isArray(meta.artboards)).toBe(true);
        expect(meta.artboards.length).toBe(count);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the two onboarding canvases self-declare their own tokens — no system/maude/ import', () => {
    // Real bug caught while authoring this feature: the canvases originally
    // imported system/maude/colors_and_type.css + preview/_components.css,
    // which do NOT exist on a brand-new project (system/ is empty until
    // /design:setup-ds runs) — every var(--token) would resolve to nothing,
    // silently rendering unstyled black-on-black. Assert the fix holds.
    const { dir } = scaffold();
    try {
      for (const name of ['How to use Maude', 'How to make video']) {
        const src = readFileSync(join(dir, '.design', 'ui', `${name}.tsx`), 'utf8');
        // Check for the actual import STATEMENT, not just the path appearing
        // in an explanatory doc comment (which legitimately mentions it).
        expect(src).not.toContain('import "../system/maude');
        // The self-contained token block must still be present.
        expect(src).toContain('const TOKENS');
        expect(src).toContain('--bg-0');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('refuses to clobber an existing project (existing behavior, unchanged)', () => {
    const { dir } = scaffold();
    try {
      const second = scaffoldDesign(dir, 'Scaffold Test');
      expect(second.ok).toBe(false);
      expect(second.error).toMatch(/already a Maude project/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
