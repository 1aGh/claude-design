// Relative-import rewriting on a canvas move — issue #114, second bug.
//
// The reported failure verbatim: `ui/AlligatorsAcko.tsx` ended up at
// `ui/print/AlligatorsAcko.tsx` still importing `../system/…`, which resolves
// only from `ui/`, so the canvas 500s with `Could not resolve`.

import { describe, expect, test } from 'bun:test';

import { rerootSpecifier, rewriteRelativeImports } from '../canvas-imports.ts';

describe('rerootSpecifier', () => {
  test('one level deeper adds a hop', () => {
    expect(rerootSpecifier('../system/x/_kit', 'ui', 'ui/print')).toBe('../../system/x/_kit');
  });

  test('one level shallower removes a hop', () => {
    expect(rerootSpecifier('../../system/x/_kit', 'ui/print', 'ui')).toBe('../system/x/_kit');
  });

  test('a sideways move keeps the depth but re-points the path', () => {
    expect(rerootSpecifier('./helpers', 'ui/a', 'ui/b')).toBe('../a/helpers');
  });

  test('moving to the design root itself', () => {
    expect(rerootSpecifier('../system/x', 'ui', '.')).toBe('./system/x');
  });

  test('a same-dir specifier keeps its ./ prefix rather than becoming a package', () => {
    // `path.relative` returns a bare name here; without the ./ re-prefix the
    // bundler would look for a node_modules package called `sibling`.
    expect(rerootSpecifier('./sibling.css', 'ui/a', 'ui/a/b')).toBe('../sibling.css');
    expect(rerootSpecifier('../sibling.css', 'ui/a/b', 'ui/a')).toBe('./sibling.css');
  });

  test('bare and aliased specifiers are never touched', () => {
    for (const spec of ['react', '@maude/canvas-lib', 'motion/react', 'node:path']) {
      expect(rerootSpecifier(spec, 'ui', 'ui/print')).toBe(spec);
    }
  });

  test('a trailing slash survives', () => {
    expect(rerootSpecifier('../lib/', 'ui', 'ui/print')).toBe('../../lib/');
  });
});

describe('rewriteRelativeImports — the reported canvas', () => {
  const SOURCE = [
    'import { DCArtboard } from "@maude/canvas-lib";',
    'import React from "react";',
    'import {',
    '  Sign,',
    '} from "../system/alligators/preview/_kit";',
    'import "../system/alligators/preview/_layout.css";',
    "export { helper } from '../shared/helper';",
    'const Lazy = () => import("../shared/lazy");',
    'export default function AlligatorsAcko() { return <DCArtboard />; }',
  ].join('\n');

  test('every relative specifier is re-rooted for ui/ → ui/print/', () => {
    const out = rewriteRelativeImports(SOURCE, 'ui', 'ui/print');
    expect(out).toContain('from "../../system/alligators/preview/_kit"');
    expect(out).toContain('import "../../system/alligators/preview/_layout.css"');
    expect(out).toContain("from '../../shared/helper'");
    expect(out).toContain('import("../../shared/lazy")');
  });

  test('the bare specifiers are left alone', () => {
    const out = rewriteRelativeImports(SOURCE, 'ui', 'ui/print');
    expect(out).toContain('from "@maude/canvas-lib"');
    expect(out).toContain('from "react"');
  });

  test('quote style is preserved per-specifier', () => {
    const out = rewriteRelativeImports(SOURCE, 'ui', 'ui/print');
    expect(out).toContain("from '../../shared/helper'"); // single stays single
    expect(out).toContain('from "../../system/alligators/preview/_kit"'); // double stays double
  });

  test('the round trip is lossless — move down then back up', () => {
    const down = rewriteRelativeImports(SOURCE, 'ui', 'ui/print');
    expect(rewriteRelativeImports(down, 'ui/print', 'ui')).toBe(SOURCE);
  });

  test('a no-op move rewrites nothing', () => {
    expect(rewriteRelativeImports(SOURCE, 'ui', 'ui')).toBe(SOURCE);
  });

  test('a canvas with no relative imports is returned untouched', () => {
    const bare = 'import { DCArtboard } from "@maude/canvas-lib";\nexport default () => null;\n';
    expect(rewriteRelativeImports(bare, 'ui', 'ui/print')).toBe(bare);
  });

  test('a top-level canvas moving into a folder (dirname === ".")', () => {
    const src = 'import "./system/x/_layout.css";\n';
    expect(rewriteRelativeImports(src, '.', 'print')).toBe('import "../system/x/_layout.css";\n');
  });
});
