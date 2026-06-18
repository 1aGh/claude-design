// github/token.ts — fetch the GitHub access token from the Tauri shell's
// loopback bridge at request time (Phase 28 / DDR-108).
//
// The token lives ONLY in the OS keychain, owned by the Tauri shell. The dev-server
// is a separate process and can't read the keychain, so it fetches the token over
// loopback (keychain.rs → GET /_tauri/github-token, 127.0.0.1-only, per-launch key).
// The endpoint + key arrive as env from the shell at spawn (sidecar.rs):
//   MAUDE_TOKEN_ENDPOINT=http://127.0.0.1:<port>/_tauri/github-token
//   MAUDE_TOKEN_KEY=<per-launch hex>
//
// In non-Tauri mode (`maude design serve` in a browser) those envs are absent →
// this returns null → the /_api/github/* endpoints degrade to "sign in via the
// desktop app". The token is never logged, persisted, or returned to the canvas.

let warnedNoBridge = false;

/**
 * Resolve the current GitHub token from the loopback bridge, or null when not
 * running under the Tauri shell / not signed in. NEVER cache the token (it can be
 * revoked / rotated; the keychain is the single source of truth).
 */
export async function getGithubToken(): Promise<string | null> {
  const endpoint = process.env.MAUDE_TOKEN_ENDPOINT;
  const key = process.env.MAUDE_TOKEN_KEY;
  if (!endpoint || !key) {
    if (!warnedNoBridge) {
      warnedNoBridge = true;
      // One-time, non-secret: explains why github endpoints 401 outside the app.
      console.error(
        '[maude:github] no token bridge (not the desktop app) — GitHub features disabled'
      );
    }
    return null;
  }
  try {
    const res = await fetch(endpoint, {
      headers: { 'X-Maude-Token-Key': key },
      // The bridge is local + instant; don't hang a request on it.
      signal: AbortSignal.timeout(3000),
    });
    if (res.status !== 200) return null; // 404 = not signed in; 403 = bad key
    const token = (await res.text()).trim();
    return token.length > 0 ? token : null;
  } catch {
    // Bridge unreachable (shell quit mid-request, etc.) — treat as signed out.
    return null;
  }
}

/** Whether the token bridge is configured at all (i.e. running under the shell). */
export function tokenBridgeAvailable(): boolean {
  return Boolean(process.env.MAUDE_TOKEN_ENDPOINT && process.env.MAUDE_TOKEN_KEY);
}
