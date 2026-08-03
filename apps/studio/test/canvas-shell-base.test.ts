// The canvas shell under a based origin — Cloud Phase 27 (DDR-209).
//
// The fleet's canvas origin puts the project in the PATH:
// `canvas.<zone>/<project>/_canvas-shell.html`. Every URL the shell builds must
// therefore hang off the path it was SERVED from, not off the origin root —
// otherwise the browser asks for `canvas.<zone>/.design/…`, the data plane reads
// `.design` as a project name, and every dynamic import fails with
// "Failed to fetch dynamically imported module".
//
// Two mechanisms, because the shell has two kinds of URL and only one of them
// can be built at runtime:
//
//   built by JS        → `withCap()` prefixes the derived base.
//   the IMPORTMAP      → cannot be: it must be static and present before any
//                        module loads, and the server cannot rewrite it either
//                        (the data plane strips the project segment before the
//                        request arrives, so only the browser knows the base).
//                        Importmap addresses resolve against the DOCUMENT's base
//                        URL, so `./` gets it for free.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL = readFileSync(
  join(import.meta.dir, '..', '..', '..', 'plugins', 'design', 'templates', '_shell.html'),
  'utf8'
);

/** The shell's own derivation, mirrored so the test breaks when it changes. */
const baseOf = (pathname: string) => pathname.replace(/\/_canvas-shell(\.html)?$/, '');

describe('the canvas shell hangs off the path it was served from', () => {
  test('the base is derived from location, and is empty at the origin root', () => {
    expect(baseOf('/alligators/_canvas-shell.html')).toBe('/alligators');
    expect(baseOf('/alligators/_canvas-shell')).toBe('/alligators');
    expect(baseOf('/_canvas-shell.html')).toBe('');
    expect(baseOf('/_canvas-shell')).toBe('');
    expect(SHELL).toContain("location.pathname.replace(/\\/_canvas-shell(\\.html)?$/, '')");
  });

  test('NO importmap entry is origin-absolute', () => {
    // `"/_canvas-runtime/react.js"` resolves against the origin and drops the
    // project. This is the one that cannot be fixed at runtime, so it is the one
    // most worth pinning.
    expect(SHELL).not.toContain('"/_canvas-runtime/');
    expect(SHELL).toContain('"./_canvas-runtime/');
  });

  test('a relative importmap address resolves under the project, and at the root', () => {
    // The actual browser rule, exercised rather than asserted.
    expect(
      new URL('./_canvas-runtime/react.js', 'https://canvas.cloud.maude.sh/alligators/_canvas-shell.html?t=x').href
    ).toBe('https://canvas.cloud.maude.sh/alligators/_canvas-runtime/react.js');
    expect(new URL('./_canvas-runtime/react.js', 'http://localhost:4399/_canvas-shell.html').href).toBe(
      'http://localhost:4399/_canvas-runtime/react.js'
    );
  });

  test('withCap prefixes the base AND carries the capability', () => {
    const base = '/alligators';
    const cap = 'cap-1';
    const withCap = (u: string) => {
      const abs = u.startsWith('/') ? base + u : u;
      return cap ? abs + (abs.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(cap) : abs;
    };
    expect(withCap('/.design/ui/Home.tsx')).toBe('/alligators/.design/ui/Home.tsx?t=cap-1');
    expect(withCap('/_api/canvas-meta?file=x')).toBe('/alligators/_api/canvas-meta?file=x&t=cap-1');
    expect(SHELL).toContain("const abs = u.startsWith('/') ? base + u : u;");
  });
});
