// shell-importmap.test.ts — regression guard for the bug that broke
// PhotoBgRemoveHarness's first real run (feature-photo-editor, Task 18):
// `@imgly/background-removal` was added to `RUNTIME_PACKAGES` (runtime-bundle.ts,
// Task 7/11) and its `/_canvas-runtime/@imgly_background-removal.js` bundle was
// built + floor-checked, but the hand-maintained `<script type="importmap">` in
// `_shell.html` never got the matching entry — so any CANVAS-side code
// (`import('@imgly/background-removal')`, only ever exercised by the shell's
// OWN client bundle until this task) hit a browser-native "Failed to resolve
// module specifier" the moment it actually ran inside a canvas iframe.
//
// The invariant: every entry in RUNTIME_PACKAGES must have a matching
// `_shell.html` importmap key pointing at `/_canvas-runtime/<slugFor(pkg)>.js`.
// canvas-build.ts externalises the WHOLE list unconditionally (`externalSpecifiers
// = new Set(RUNTIME_PACKAGES)`), so a package added there without a matching
// importmap entry silently ships a canvas-side dead import until something
// actually calls it at runtime — this test catches it at build time instead.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEV_SERVER_ROOT } from '../paths.ts';
import { RUNTIME_PACKAGES, slugFor } from '../runtime-bundle.ts';

const SHELL_HTML_PATH = join(DEV_SERVER_ROOT, '..', '..', 'plugins', 'design', 'templates', '_shell.html');

describe('_shell.html importmap agrees with RUNTIME_PACKAGES', () => {
  const shellHtml = readFileSync(SHELL_HTML_PATH, 'utf8');
  const importmapMatch = shellHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  test('the importmap script block exists', () => {
    expect(importmapMatch).not.toBeNull();
  });
  const importmap = JSON.parse(importmapMatch?.[1] ?? '{}') as { imports?: Record<string, string> };
  const imports = importmap.imports ?? {};

  for (const pkg of RUNTIME_PACKAGES) {
    test(`"${pkg}" resolves to its /_canvas-runtime/ bundle`, () => {
      expect(imports[pkg]).toBe(`/_canvas-runtime/${slugFor(pkg)}.js`);
    });
  }
});
