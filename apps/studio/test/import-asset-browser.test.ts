// Browser-driven pieces of local-file/SVG/PDF ingestion (DDR-167) — the SVG
// execution canary. Spawns real agent-browser sessions, so this is slower
// than import-asset.test.ts and is skipped (not failed) when agent-browser
// can't be resolved, mirroring how the rest of this codebase treats
// browser-dependent verification as a real-environment concern rather than a
// hard CI requirement (e.g. ensure-browser.test.ts's resolution-only tests).
//
// DDR-167 requires the SVG canary fixtures be a PERMANENT regression test,
// not a one-time pre-ship check — this file is that test. The PDF rasterize
// adversarial fixtures (OpenAction/JS canary, SubmitForm/URI/Launch) are NOT
// here: live spike-verification found the planned rasterization mechanism
// (headless-Chromium navigating a file://*.pdf URL) does not render PDF
// content under agent-browser automation (confirmed blank output on both
// chrome-headless-shell and full Chrome) — see DDR-167's addendum. PDF
// rasterization throws "not yet available" rather than shipping broken
// output; there is nothing to fixture-test until a follow-up mechanism lands.

import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';

import { rasterizePdfPage, runSvgExecutionCanary } from '../bin/_import-asset.mjs';

function agentBrowserAvailable(): boolean {
  try {
    execFileSync(process.env.MAUDE_AGENT_BROWSER_BIN || 'agent-browser', ['--version'], {
      stdio: 'ignore',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

const HAS_AGENT_BROWSER = agentBrowserAvailable();
const d = HAS_AGENT_BROWSER ? describe : describe.skip;

d('SVG execution canary (Decision 1, step 6) — permanent regression fixtures', () => {
  test('accepts a clean, allowlist-sanitized SVG (no false positive)', async () => {
    const clean =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="#4f46e5"/></svg>';
    await expect(runSvgExecutionCanary(clean)).resolves.toBe(clean);
  }, 30_000);

  test('trips on a raw <script>-bearing SVG (defense-in-depth if the allowlist sanitizer were ever bypassed)', async () => {
    const malicious =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__MAUDE_IMPORT_CANARY__=true;</script></svg>';
    await expect(runSvgExecutionCanary(malicious)).rejects.toThrow(/canary tripped/);
  }, 30_000);

  test('the sandboxed-render helper does not block the file:// navigation it needs (regression: a bare "*" network route also blocks local file loads)', async () => {
    // A file:// SVG with no scripting at all must still load and be
    // observable — this specifically guards against re-introducing the
    // wildcard-route regression found during implementation.
    const trivial = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    await expect(runSvgExecutionCanary(trivial)).resolves.toBeTruthy();
  }, 30_000);
});

d('PDF rasterization — explicitly NOT shipped (DDR-167 addendum)', () => {
  test('rasterizePdfPage throws "not yet available" rather than producing output', async () => {
    await expect(rasterizePdfPage('/nonexistent.pdf', 1)).rejects.toThrow(/not yet available/);
  });
});
