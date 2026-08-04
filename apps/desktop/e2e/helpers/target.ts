// Which shell am I in? — Cloud Phase 27 E4.
//
// The phase's whole claim is "one studio, three shells": the browser loads the
// byte-identical `client.bundle.js` the desktop loads, so everything the design
// is MADE of must be identical for owner, member and viewer. That claim was
// checked by hand, once, by opening the site — which is how "Files panel
// missing in cloud" becomes a customer email rather than a red build.
//
// So the parity spec is written ONCE and runs against either target. Everything
// that legitimately differs lives here, behind a name, rather than as a branch
// inside the assertions:
//
//   · the native shell has `window.__TAURI__`, spawns a sidecar and navigates
//     the webview to loopback; the browser is simply pointed at a URL;
//   · the cell's canvas iframe is ALWAYS cross-origin (a per-project canvas
//     origin), so the DDR-054 deep check can never be asserted there;
//   · the agent panel is physically absent in a tab (C2), and the back-link and
//     project name are physically absent on the desktop (C4).
//
// Anything NOT on that list is a parity assertion, and a difference is a bug.

import { browser } from '@wdio/globals';

export type Target = 'native' | 'cloud';

/**
 * The cloud target's URL. Set by `wdio.parity.conf.ts` — either a real
 * deployment (`MAUDE_E2E_CLOUD_URL`) or the local cell stand-in that config
 * boots when none is given.
 */
export function cloudUrl(): string | null {
  return process.env.MAUDE_E2E_CLOUD_URL || null;
}

export function target(): Target {
  return cloudUrl() ? 'cloud' : 'native';
}

/** True when the webview is running inside the native Tauri shell. */
export async function isNativeShell(): Promise<boolean> {
  // biome-ignore lint/suspicious/noExplicitAny: __TAURI__ is an injected global
  return browser.execute(() => Boolean((window as any).__TAURI__));
}

/**
 * Get the app in front of us, whichever shell that means, and return its URL.
 *
 * NATIVE: the Rust shell spawns the Bun sidecar, polls `_server.json` and
 * navigates the webview to loopback. Cold start runs boot-self-heal (install +
 * build) up to ~90 s, hence the generous default.
 *
 * CLOUD: navigate, then wait for the client to MOUNT rather than for the
 * navigation to finish. A cloud tab that answers 200 with an empty `#root` is
 * exactly the failure this phase shipped once (`cfg is not defined` — every
 * check was HTTP, and a route table says nothing about whether React mounts).
 */
export async function openApp(timeout = 150_000): Promise<string> {
  const url = cloudUrl();
  if (url) {
    await browser.url(url);
    await browser.waitUntil(
      () => browser.execute(() => Boolean(document.querySelector('#root')?.children.length)),
      { timeout, interval: 500, timeoutMsg: `the cloud client never mounted at ${url}` }
    );
    return url;
  }
  let seen = '';
  await browser.waitUntil(
    async () => {
      seen = await browser.getUrl();
      return /^http:\/\/(localhost|127\.0\.0\.1):\d+/.test(seen);
    },
    {
      timeout,
      interval: 1000,
      timeoutMsg: `webview never navigated to the loopback dev-server (last url: "${seen}")`,
    }
  );
  return seen;
}

/**
 * Can this target's canvas iframe be entered from the spec?
 *
 * Never in the cloud: a cell serves canvases from a per-project canvas origin,
 * which is the DDR-054 split doing its job. Saying so here keeps it a stated
 * boundary rather than a mysteriously-skipped assertion.
 */
export function canEnterCanvasFrame(): boolean {
  return target() === 'native';
}
