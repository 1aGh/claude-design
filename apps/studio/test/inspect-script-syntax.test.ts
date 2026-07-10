// inspect-script-syntax.test.ts — regression guard for a real bug hit while
// adding the photo-editor's background-removal busy shimmer: INSPECTOR_SCRIPT
// (inspect.ts) is itself a giant template literal, so a stray backtick in an
// inline comment silently truncates/reopens it — tsc DOES catch backtick
// imbalance (it breaks the outer .ts file's own syntax), but nothing catches
// any OTHER malformed-JS mistake inside the injected string (e.g. a stray
// unescaped quote, mismatched braces in the CSS array). This test extracts the
// actual injected <script> body and syntax-checks it directly.

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { type Context, createBus } from '../context.ts';
import { createInspect } from '../inspect.ts';
import { makeSandbox } from './_helpers.ts';

function mkCtx(root: string, designRoot: string): Context {
  return {
    cfg: {} as Context['cfg'],
    projectLabel: 'test',
    bus: createBus(),
    paths: {
      repoRoot: root,
      designRel: '.design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: '',
      systemDirRel: 'system',
    },
  };
}

describe('injectInspector — injected <script> is syntactically valid JS', () => {
  test('the extracted script body compiles with no SyntaxError', () => {
    const { root, designRoot } = makeSandbox();
    const inspect = createInspect(mkCtx(root, designRoot), async () => []);
    const out = inspect.injectInspector('<html><body></body></html>');

    const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);

    for (const body of scripts) {
      // `new Function` only PARSES the body (no window/document access at
      // construction time) — throws SyntaxError on malformed JS, exactly the
      // class of bug a stray backtick / unbalanced brace produces.
      expect(() => new Function(body)).not.toThrow();
    }
  });
});
