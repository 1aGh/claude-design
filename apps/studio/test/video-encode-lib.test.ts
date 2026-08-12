// video-encode-lib — frame-clearing contract (feature-fast-video-export Task 6e).
//
// `addVideoFrame`/`addGifFrame` run INSIDE the capture Chromium (real
// OffscreenCanvas + WebCodecs), so the actual pixel behavior needs a live
// browser — not a `bun:test` concern, mirroring video-render-bridge.test.ts's
// split between pure routing (tested here at the source level) and live
// canvas/codec work (manual/agent-browser verification).
//
// What IS worth pinning: the DECISION itself. `drawImage` is called with no
// preceding `clearRect`/`fillRect` reset, so a transparent frame draws OVER
// whatever the encoder canvas already held — a transparent artboard would
// ghost the previous frame's pixels through. This was flagged as a "decide
// deliberately, don't let it drift" item rather than a bug: every capture
// path today feeds `page.screenshot()` output, which Chromium always
// composites onto an opaque background (no `omitBackground` capture exists in
// this codebase), so the ghost case cannot currently occur in practice. If
// that stops being true — a future capture path starts passing genuinely
// transparent frames — this test must be touched, which is the point: an
// accidental `clearRect` add/removal should force a conscious look at this
// comment, not slip through unnoticed.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dir, '..', 'exporters', 'video-encode-lib.ts'), 'utf8');

function body(fnName: string): string {
  const start = SRC.indexOf(`async ${fnName}(`);
  const openBrace = SRC.indexOf('{', start);
  // Cheap brace match — good enough for this file's flat function bodies.
  let depth = 0;
  let end = openBrace;
  for (let i = openBrace; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return SRC.slice(start, end + 1);
}

describe('video-encode-lib — frame-clearing decision (pinned, not a bug)', () => {
  test('addVideoFrame draws without clearing the encoder canvas first', () => {
    const fn = body('addVideoFrame');
    expect(fn).toMatch(
      /ctx\.drawImage\(bmp, 0, 0, vstate\.canvas\.width, vstate\.canvas\.height\)/
    );
    expect(fn).not.toMatch(/clearRect|fillRect/);
  });

  test('addGifFrame draws without clearing the gif canvas first', () => {
    const fn = body('addGifFrame');
    expect(fn).toMatch(
      /ctx\.drawImage\(bmp, 0, 0, gstate\.canvas\.width, gstate\.canvas\.height\)/
    );
    expect(fn).not.toMatch(/clearRect|fillRect/);
  });
});
