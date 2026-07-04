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

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/** Exit code the shims surface for "Chromium browser binary not installed". */
export const NO_BROWSER_EXIT = 3;

/** One-line, copy-pasteable remediation shown in the export 500 body. */
export const INSTALL_HINT =
  "Playwright's Chromium browser isn't installed. Run:  npx playwright install chromium";

/**
 * Resolve a Chrome-family executable to fall back on when Playwright's OWN
 * bundled browser is absent — the packaged desktop case (RCA
 * issue-desktop-export-failures): the app ships the `playwright` JS closure but
 * NOT its ~150 MB browser, so `chromium.launch()` with no `executablePath` finds
 * nothing. Priority: explicit env override → the shared `_ensure-browser.mjs`
 * resolver (the same Chrome / provisioned chrome-headless-shell the screenshot
 * path uses; `--no-download` so an export never silently triggers a 94 MB
 * fetch). Returns `undefined` when nothing is found — the caller then surfaces
 * the install hint. Reachable at runtime because the shim runs under real `node`
 * (its `import.meta.url` is a genuine disk path, unlike the compiled server).
 */
function resolveBrowserExecutable() {
  for (const env of [
    process.env.MAUDE_BROWSER_EXECUTABLE,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.AGENT_BROWSER_EXECUTABLE_PATH,
  ]) {
    if (env && existsSync(env)) return env;
  }
  try {
    const ensure = join(dirname(fileURLToPath(import.meta.url)), '_ensure-browser.mjs');
    if (!existsSync(ensure)) return undefined;
    const out = execFileSync(process.execPath, [ensure, '--no-download', '--quiet'], {
      encoding: 'utf8',
    });
    const path = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .pop();
    return path && existsSync(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

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
      // Playwright's own browser isn't present (packaged desktop app, or a fresh
      // machine that never ran `playwright install`). Retry once against a
      // resolved Chrome-family engine — system Chrome / a provisioned
      // chrome-headless-shell — before giving up. This is what makes render
      // export work in the bundled app, where only the playwright JS ships.
      const executablePath = resolveBrowserExecutable();
      if (executablePath) {
        try {
          return await chromium.launch({ ...opts, executablePath });
        } catch {
          /* fall through to the install hint */
        }
      }
      // Single clean line — the export endpoint pipes shim stderr into the 500
      // body, so this is what the user reads. No stack trace.
      console.error(INSTALL_HINT);
      process.exit(NO_BROWSER_EXIT);
    }
    throw err;
  }
}
