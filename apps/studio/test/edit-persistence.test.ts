// edit-persistence — DDR-148 dogfood. A CSS edit on a video-comp element must
// survive into the RENDERED module, not just the optimistic DOM overlay — i.e.
// source edit → build → the new value is in the compiled canvas the Player runs.
// This end-to-end guard would have caught the original "my color reverts when
// the video replays" bug (a trailing-comma insert produced `opacity: o, , color`
// → the build FAILED → the Player kept rendering the OLD source).

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCanvasModule } from '../canvas-build.ts';
import { applyEdit } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/tmp/edit-persist.tsx';

/** buildCanvasModule needs the entrypoint on disk — write the source, then build. */
async function buildAt(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'edit-persist-'));
  const abs = join(dir, 'Comp.tsx');
  writeFileSync(abs, source);
  return buildCanvasModule(abs, source);
}

// A frame-driven letter span (the exact shape from the intro demo): computed
// transform/opacity + a trailing comma on the last property.
const COMP = `import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
export default function Comp() {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 20], [40, 0]);
  const o = interpolate(frame, [0, 20], [0, 1]);
  return (
    <AbsoluteFill>
      <span
        style={{
          fontSize: 132,
          fontWeight: 800,
          transform: \`translateY(\${y}px)\`,
          opacity: o,
          color: '#f0ece5',
        }}
      >
        maude
      </span>
    </AbsoluteFill>
  );
}
`;

function spanId(source: string): string {
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const m = withIds.match(/<span[^>]*?data-cd-id="([0-9a-f]{8})"/);
  if (!m) throw new Error('no span id');
  return m[1] as string;
}

describe('edit-persistence — a CSS edit survives into the built module', () => {
  test('SWAP an existing color → the new color is in the compiled canvas', async () => {
    const id = spanId(COMP);
    const edited = applyEdit(CANVAS, COMP, id, 'style.color', "'#ff0000'").source;
    expect(edited).toContain("color: '#ff0000'");
    // The value the Player actually renders is the BUILT module — assert it there.
    const built = await buildAt(edited);
    expect(built.js).toContain('#ff0000');
    expect(built.js).not.toContain('#f0ece5'); // old value fully replaced
  });

  test('INSERT a new prop next to a TRAILING comma → still builds + renders (the bug)', async () => {
    const id = spanId(COMP);
    // Insert a brand-new property where the last one (color) ends with a comma.
    const edited = applyEdit(CANVAS, COMP, id, 'style.letterSpacing', "'-0.04em'").source;
    expect(edited).not.toMatch(/,\s*,/); // NO double comma (the crash that reverted the render)
    const built = await buildAt(edited); // must not throw
    expect(built.js).toContain('-0.04em');
    expect(built.js).toContain('#f0ece5'); // untouched props survive
  });

  test('a SEQUENCE of edits all persist (no edit clobbers a prior one)', async () => {
    let src = COMP;
    const id = spanId(src);
    src = applyEdit(CANVAS, src, id, 'style.color', "'#00ff00'").source;
    src = applyEdit(CANVAS, src, id, 'style.fontWeight', '900').source;
    src = applyEdit(CANVAS, src, id, 'style.fontSize', '148').source;
    const built = await buildAt(src);
    expect(built.js).toContain('#00ff00');
    expect(built.js).toContain('148');
    // the frame-driven values must still be present (edits never touched them)
    expect(built.js).toContain('translateY');
  });
});
