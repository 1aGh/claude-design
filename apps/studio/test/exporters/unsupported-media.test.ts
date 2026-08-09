// RCA issue-mp4-audio-export-html5audio-silent-degrade — the pre-flight scanner.
//
// The cases here are the ones the RCA's Testing Requirements name, and the
// barrel case is the one that matters most: the reproducer does NOT import
// `Audio` from 'remotion' in the canvas file. It imports it from `_broadcast`,
// which re-exports it. A scanner that reads only the canvas sees a clean local
// import and waves the export through — which is exactly how this shipped.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { audioRefusalMessage, scanUnsupportedMedia } from '../../exporters/unsupported-media.ts';

function sandbox(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'maude-unsupported-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

describe('scanUnsupportedMedia', () => {
  test('flags a direct <Audio> import from remotion', () => {
    const dir = sandbox({
      'c.tsx': `import { AbsoluteFill, Audio } from 'remotion';
        export const C = () => <AbsoluteFill><Audio src="x.mp3" /></AbsoluteFill>;`,
    });
    const found = scanUnsupportedMedia(join(dir, 'c.tsx'));
    expect(found).toHaveLength(1);
    expect(found[0].element).toBe('Audio');
    expect(found[0].viaBarrel).toBe(false);
  });

  test('flags it in a multi-binding import alongside supported names', () => {
    const dir = sandbox({
      'c.tsx': `import { AbsoluteFill, OffthreadVideo, Audio } from 'remotion';
        export const C = () => <><Audio src="a" /><OffthreadVideo src="v" /></>;`,
    });
    const els = scanUnsupportedMedia(join(dir, 'c.tsx')).map((f) => f.element);
    expect(els).toContain('Audio');
    expect(els).toContain('OffthreadVideo');
  });

  test('sees through a re-export barrel one hop away — the actual shape of the bug', () => {
    const dir = sandbox({
      '_broadcast.tsx': `export { Audio } from 'remotion';
        export const Brand = () => null;`,
      'c.tsx': `import { Audio, Brand } from './_broadcast';
        export const C = () => <><Brand /><Audio src="sax.mp3" /></>;`,
    });
    const found = scanUnsupportedMedia(join(dir, 'c.tsx'));
    expect(found).toHaveLength(1);
    expect(found[0].element).toBe('Audio');
    expect(found[0].viaBarrel).toBe(true);
    expect(found[0].sourceFile).toContain('_broadcast');
  });

  test('does NOT flag the supported @remotion/media import', () => {
    const dir = sandbox({
      'c.tsx': `import { Audio, Video } from '@remotion/media';
        export const C = () => <><Audio src="a" /><Video src="v" /></>;`,
    });
    expect(scanUnsupportedMedia(join(dir, 'c.tsx'))).toHaveLength(0);
  });

  test('does not flag a sibling package whose name merely starts with remotion', () => {
    const dir = sandbox({
      'c.tsx': `import { TransitionSeries } from '@remotion/transitions';
        import { Audio } from '@remotion/media';
        export const C = () => <Audio src="a" />;`,
    });
    expect(scanUnsupportedMedia(join(dir, 'c.tsx'))).toHaveLength(0);
  });

  test('ignores an unused import — not worth refusing an export over', () => {
    const dir = sandbox({
      'c.tsx': `import { AbsoluteFill, Audio } from 'remotion';
        export const C = () => <AbsoluteFill>silent</AbsoluteFill>;`,
    });
    expect(scanUnsupportedMedia(join(dir, 'c.tsx'))).toHaveLength(0);
  });

  test('catches an aliased import mounted under its alias', () => {
    const dir = sandbox({
      'c.tsx': `import { Audio as Sound } from 'remotion';
        export const C = () => <Sound src="a" />;`,
    });
    const found = scanUnsupportedMedia(join(dir, 'c.tsx'));
    expect(found).toHaveLength(1);
    // Reported as the element it IS, but matched on the name it renders under.
    expect(found[0].element).toBe('Audio');
    expect(found[0].localName).toBe('Sound');
  });

  test('an aliased-but-unused import is still not worth refusing over', () => {
    const dir = sandbox({
      'c.tsx': `import { Audio as Sound } from 'remotion';
        export const C = () => <div>silent</div>;`,
    });
    expect(scanUnsupportedMedia(join(dir, 'c.tsx'))).toHaveLength(0);
  });

  test('an unreadable canvas is not this check’s business to report', () => {
    expect(scanUnsupportedMedia('/definitely/not/here.tsx')).toEqual([]);
  });
});

describe('audioRefusalMessage', () => {
  test('states the cause, the cost, and the one-word fix', () => {
    const msg = audioRefusalMessage(
      { element: 'Audio', sourceFile: '/x/_broadcast.tsx', viaBarrel: true, localName: 'Audio' },
      'ui/social/Krpole.tsx'
    );
    expect(msg).toContain('Html5Audio');
    expect(msg).toContain('@remotion/media');
    expect(msg).toContain('_broadcast.tsx');
    // The escape hatch must be discoverable from the refusal itself, or a user
    // who genuinely wants a muted export is stuck.
    expect(msg).toContain('allowUnsupportedMedia');
  });
});
