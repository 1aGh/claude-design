// _pw-launch.mjs — shared Chromium launcher for the export / screenshot shims.
//
// Every renderer shim (_png/_pdf/_svg/_html/_pptx/_enumerate-artboards/
// _screenshot-playwright.mjs) opens a Chromium instance with `chromium.launch()`.
// Playwright the npm package can be present while its browser BINARY is not — the
// package install and `npx playwright install chromium` are separate steps, and
// the dependency check `npx playwright --version` only proves the former. When
// the binary is missing, `launch()` rejects with a multi-line stack trace that
// `exporters/*.ts` rethrows and `/_api/export` surfaces verbatim as an opaque
// 500 ("nefunguji exporty"). This helper funnels that one failure mode through a
// single place: it prints one actionable line and exits with a distinct code, so
// the export endpoint's 500 body becomes the remediation instead of a stack. Any
// OTHER launch error is rethrown untouched — real diagnostics are preserved.
//
// See `.ai/logs/rca/issue-nefunguji-exporty.md`.

import { chromium } from 'playwright';

/** Exit code the shims surface for "Chromium browser binary not installed". */
export const NO_BROWSER_EXIT = 3;

/** One-line, copy-pasteable remediation shown in the export 500 body. */
export const INSTALL_HINT =
  "Playwright's Chromium browser isn't installed. Run:  npx playwright install chromium";

/**
 * True when a `chromium.launch()` rejection is the "browser binary not
 * downloaded" case (as opposed to a sandbox / port / crash failure). Pure +
 * exported so it's unit-testable without spawning a browser. Matches the stable
 * fragments Playwright emits across versions:
 *   "browserType.launch: Executable doesn't exist at <path>"
 *   "Please run the following command to download new browsers"
 *   "playwright install"
 */
export function isMissingBrowserError(message) {
  const m = String(message ?? '');
  return (
    /Executable doesn'?t exist/i.test(m) ||
    /please run the following command to download/i.test(m) ||
    /playwright install/i.test(m)
  );
}

/**
 * Launch Chromium, mapping the missing-binary failure to a clean exit. Drop-in
 * for `chromium.launch(opts)` — same signature, same resolved Browser.
 */
export async function launchChromium(opts) {
  try {
    return await chromium.launch(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isMissingBrowserError(msg)) {
      // Single clean line — the export endpoint pipes shim stderr into the 500
      // body, so this is what the user reads. No stack trace.
      console.error(INSTALL_HINT);
      process.exit(NO_BROWSER_EXIT);
    }
    throw err;
  }
}
