// Every secret Maude itself mints, in one place.
//
// Written after the 2026-07-30 /flow:validate found the diagnostic scrubber
// redacting every VENDOR's credentials — GitHub, Anthropic, JWTs, Bearer
// headers — and none of our own. Two independently-correct decisions composed
// into the leak:
//
//   • the project token deliberately is NOT a JWT (DDR-204 / cloud-identity.mjs
//     — one algorithm, nothing to downgrade), so it has TWO dot-separated
//     parts, and
//   • the scrubber's JWT rule correctly requires THREE.
//
// So a token that looks exactly like a JWT to any reviewer sailed through a
// bundle labelled "paths & secrets scrubbed". The `\b(token|secret|…)` rule
// could not catch `HUB_SECRET=…` either, because `_` is a word character and
// `\b` never fires between `HUB` and `_SECRET`.
//
// The fix is not another regex in the scrubber. It is a REGISTRY: whoever adds
// a new minted grammar adds it here, and every consumer that must recognise a
// Maude credential imports it instead of guessing. `credential-grammar.test.ts`
// asserts the registry covers every prefix the codebase actually mints, so a
// sixth grammar cannot be added without this file noticing.

export interface CredentialGrammar {
  /** Short id, used in test names and failure messages. */
  id: string;
  /** What mints it, so a reader can find the source of truth. */
  mintedBy: string;
  /** Matches the credential ANYWHERE in a line of text. */
  pattern: RegExp;
}

/**
 * The grammars. Every `pattern` must be global — the scrubber replaces all
 * occurrences in a line, not just the first.
 */
export const CREDENTIAL_GRAMMARS: CredentialGrammar[] = [
  {
    id: 'peer-token',
    mintedBy: 'apps/hub/src/tokens.mjs (addToken) — the workspace session token',
    pattern: /\bmau_[A-Za-z0-9]{8,}\b/g,
  },
  {
    id: 'personal-token',
    mintedBy: 'apps/cloud/device-auth.mjs — what a signed-in device holds',
    pattern: /\bmpt_[A-Za-z0-9]{8,}\b/g,
  },
  {
    id: 'handoff-code',
    mintedBy: 'apps/cloud/handoff.mjs — the one-time browser→app claim ticket',
    pattern: /\bmhc_[A-Za-z0-9]{8,}\b/g,
  },
  {
    id: 'device-code',
    mintedBy: 'apps/cloud/device-auth.mjs — the poller’s half of the device flow',
    pattern: /\bmdc_[A-Za-z0-9]{8,}\b/g,
  },
  {
    id: 'grant',
    mintedBy: 'apps/cloud/grants.mjs (mintGrant) — the project-grant capability',
    // `mcg_<base64url payload>.<base64url mac>` — like the project token, it
    // is deliberately not a JWT, so the three-part JWT rule cannot see it.
    pattern: /\bmcg_[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    id: 'project-token',
    mintedBy: 'apps/cloud/cell-token.mjs (mintProjectToken) — base64url payload.mac',
    // TWO parts, not three. This is the one the JWT rule structurally cannot
    // see. The payload always starts `eyJ` (a base64url-encoded `{"`), which is
    // what keeps this from matching ordinary dotted words.
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: 'derived-cell-secret',
    mintedBy: 'apps/cloud/cell-token.mjs (deriveCellSecret) — 64 hex, HUB_SECRET and friends',
    pattern: /\b[0-9a-f]{64}\b/g,
  },
];

/**
 * Redact every Maude-minted credential in a string.
 *
 * Deliberately separate from the vendor rules: those chase other people's
 * formats and change when a vendor changes; this one is OURS and changes when
 * WE mint something new.
 */
export function redactMaudeCredentials(text: string, marker = '[redacted]'): string {
  let out = text;
  for (const g of CREDENTIAL_GRAMMARS) out = out.replace(g.pattern, marker);
  return out;
}

/**
 * Environment variable names whose VALUE is a secret regardless of shape.
 *
 * `\b(token|secret)` cannot match inside `HUB_SECRET` — `_` is a word
 * character — so the underscore-joined names need their own rule.
 */
export const SECRET_ENV_PATTERN =
  /\b([A-Z][A-Z0-9]*_(?:SECRET|TOKEN|KEY|PASSWORD|MASTER)[A-Z0-9_]*)(\s*[:=]\s*"?)([^\s"',}]+)/g;
