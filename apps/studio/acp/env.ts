// DDR-123 guardrail #1 — keep the spawned Claude Code adapter on the user's
// Pro/Max SUBSCRIPTION, never metered API billing.
//
// Anthropic's auth precedence puts `ANTHROPIC_API_KEY` (#3, API billing) ABOVE
// the subscription OAuth from `/login` (#6, the Pro/Max default). A stray global
// key in the inherited environment would therefore silently switch the user to
// API billing the moment the adapter spawns `claude -p`. We delete it (and the
// equivalent auth-token override) from the child env before spawning. This is
// the single load-bearing detail that makes the whole panel subscription-correct
// — the guarantee lives here, at the bottom of the stack, independent of the UI.

/**
 * Env var names that flip Claude Code off the subscription and onto metered API
 * billing (or a non-subscription auth token). Both are stripped from the child.
 */
export const SUBSCRIPTION_SCRUBBED_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
] as const;

/**
 * Return a copy of `source` with the billing-switching keys removed and any
 * `undefined` values dropped (Bun.spawn's `env` wants a `Record<string,string>`).
 * Pure — never mutates the input, so `process.env` stays intact for the parent.
 */
export function scrubAgentEnv(
  source: Record<string, string | undefined> = process.env
): Record<string, string> {
  const scrubbed = new Set<string>(SUBSCRIPTION_SCRUBBED_ENV_KEYS);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (scrubbed.has(key)) continue;
    out[key] = value;
  }
  return out;
}
