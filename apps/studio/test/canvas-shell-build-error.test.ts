// Spike finding M8 (studyfi-design AWS run, 2026-08-20) — the mount's catch
// showed `err.stack`, which for a failed dynamic import is the bare
// "TypeError: Failed to fetch dynamically imported module". The 422 body the
// server wrote ("Canvas build error: this canvas imports …") names the culprit
// and the rule — and the browser throws it away on non-2xx. The spike spent
// several rounds on token/cookie hypotheses before a manual curl surfaced the
// body.
//
// The shell is a static template, so this suite pins the WIRING the way
// canvas-shell-base.test.ts does: the diagnosis helper exists, and both import
// failure paths (initial mount + soft reload) route through it instead of
// printing the TypeError.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL = readFileSync(
  join(import.meta.dir, '..', '..', '..', 'plugins', 'design', 'templates', '_shell.html'),
  'utf8'
);

describe('a canvas build error reaches the person (M8)', () => {
  test('the shell carries the import-failure diagnosis helper', () => {
    expect(SHELL).toContain('function diagnoseImportFailure(');
    // It refetches the module URL to recover the discarded response body…
    expect(SHELL).toMatch(/diagnoseImportFailure[\s\S]{0,400}fetch\(url/);
    // …and shows the body, not just the status line.
    expect(SHELL).toMatch(/r\.text\(\)/);
  });

  test('the initial mount catch routes through the diagnosis, not err.stack', () => {
    expect(SHELL).toContain('diagnoseImportFailure(canvasUrl, err).then(showError)');
    // The old shape — showError straight from the stack — must not come back.
    expect(SHELL).not.toContain('showError((err && err.stack) || String(err))');
  });

  test('the soft-reload holding toast gets the same diagnosis', () => {
    const soft = SHELL.slice(
      SHELL.indexOf('function softReload'),
      SHELL.indexOf('function softReload') + 1500
    );
    expect(soft).toContain('diagnoseImportFailure(canvasUrl, err)');
  });

  test('a 2xx refetch falls back to the original error — the diagnosis never masks a module-level throw', () => {
    // If the module fetches fine, the failure was inside the module (a runtime
    // throw at import time). Showing an "HTTP 200" line there would point the
    // person at the network when the bug is in their code.
    expect(SHELL).toMatch(/if \(r\.ok\) return fallback/);
  });
});
