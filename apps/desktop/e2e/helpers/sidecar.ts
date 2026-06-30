import { browser } from '@wdio/globals';

/**
 * Wait until the native shell's webview has navigated to the loopback dev-server.
 * The Rust shell spawns the Bun sidecar, polls `_server.json`, then navigates the
 * webview to `http://localhost:<port>` (server_json.rs). Cold start runs
 * boot-self-heal (bun install + build) up to ~90 s, so the default timeout is
 * generous. Returns the resolved URL.
 */
export async function waitForSidecar(timeout = 150_000): Promise<string> {
  let url = '';
  await browser.waitUntil(
    async () => {
      url = await browser.getUrl();
      return /^http:\/\/(localhost|127\.0\.0\.1):\d+/.test(url);
    },
    {
      timeout,
      interval: 1000,
      timeoutMsg: `webview never navigated to the loopback dev-server (last url: "${url}")`,
    }
  );
  return url;
}
