#!/usr/bin/env node
// _agent-browser-safe.mjs — hardened agent-browser wrapper, reached via
// `maude design agent-browser-safe <subcommand> [args...]` (DDR-062 dispatch;
// DDR-185 security addendum, round 2).
//
// WHY THIS EXISTS: DDR-185 originally added a bare `Bash(agent-browser:*)`
// allow-list entry so the ACP session wouldn't prompt on the raw
// `agent-browser eval`/`agent-browser screenshot` calls already documented in
// `plugins/design/agents/motion-critic.md` and `plugins/design/commands/edit.md`.
// A security review (ethical-hacker Finding D) found that grant was a
// zero-confirmation, zero-click session-hijack primitive: `agent-browser`'s
// OWN bundled onboarding skill (`plugins/flow/skills/agent-browser/SKILL.md`)
// recommends a PERSISTENT Chrome profile as the default auth strategy for
// real, cross-origin authenticated sites (GitHub, production, ClickUp).
//
// ROUND 2: this file's FIRST hardening pass allowlisted the subcommand but
// only REJECTED a specific list of known-dangerous flags in the remaining
// argv (`--profile`/`--cdp`/etc.). A follow-up verification pass found (a)
// the env-clearing list was a strict subset of the flag reject-list — three
// documented env-var equivalents of already-rejected flags
// (`AGENT_BROWSER_AUTO_CONNECT`, `AGENT_BROWSER_PROXY`/`HTTP_PROXY`/
// `HTTPS_PROXY`/`ALL_PROXY`, `AGENT_BROWSER_ENGINE`) were never cleared, so
// an ordinary ambient env var (a corporate proxy, or a value the user set
// for their own terminal use) leaked straight through; and (b) a further
// `--help` read surfaced `-p`/`--provider <name>` — routes the ENTIRE
// session through a remote cloud browser (browserbase/kernel/browserless/
// agentcore) instead of local Chrome — which was never in the reject list
// at all. Both are instances of the SAME root problem `_curl-local.mjs`'s
// own round-2 rewrite diagnoses: enumerating "known-dangerous flags" against
// a third-party CLI's evolving surface is an unbounded chase, not a fix.
//
// So this file, like curl-local, no longer tries to allowlist/rejectlist
// FLAGS at all. Each allowed subcommand has a FIXED positional-argument
// arity (open=1, eval=1, screenshot=0-1, snapshot=0, get=1-2, wait=1,
// close=0); ANY additional argv token beyond that arity — flag or not, `-`
// prefixed or not — is rejected outright. There is no flag concept left for
// the caller to reach at all, so `--provider`/`-p`, or any FUTURE flag
// neither round of review thought to name, cannot recur here by
// construction. (An eval expression that legitimately starts with `-`, e.g.
// `agent-browser-safe eval "-1 + 2"`, still works — it's exactly the ONE
// expected positional value for `eval`, never scanned for a leading dash.)
//
//   1. The subcommand (argv[0], REQUIRED to be first) must be one of:
//      open/eval/screenshot/snapshot/get/wait/close. Nothing that reads
//      cookies/clipboard/storage, attaches to an already-running Chrome,
//      routes through a remote provider, uploads/downloads files, or spawns
//      the `chat` sub-agent is reachable through this wrapper at all.
//   2. The remaining argv must match that subcommand's fixed arity exactly
//      — no more, no fewer.
//   3. The real `agent-browser` child is spawned with `--allowed-domains
//      localhost,127.0.0.1` forced (agent-browser's own native domain-scope
//      enforcement — verified live: `agent-browser open https://example.com`
//      through this wrapper is refused by agent-browser itself), AND every
//      profile/session/policy/proxy/engine env var agent-browser's own
//      `--help` documents (not just the ones a prior CLI-flag reject-list
//      happened to name) explicitly cleared before spawning — regardless of
//      what the user's own `~/.claude/settings.json` or shell rc ambiently
//      sets (DDR-144's `settingSources:['user']` legitimately still reads
//      those for the user's own manual terminal use; this wrapper's env
//      deletion is what stops that from leaking into the auto-approving ACP
//      session specifically).
//
// Exit: agent-browser's own exit code on success · 2 usage/rejected argv ·
//       1 other (failed to spawn agent-browser at all).

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// [minArgs, maxArgs] positional arguments AFTER the subcommand itself.
export const SUBCOMMAND_ARITY = Object.freeze({
  open: [1, 1],
  eval: [1, 1],
  screenshot: [0, 1],
  snapshot: [0, 0],
  get: [1, 2],
  wait: [1, 1],
  close: [0, 0],
});

export const ALLOWED_SUBCOMMANDS = Object.freeze(Object.keys(SUBCOMMAND_ARITY));

// Env vars agent-browser's own `--help` documents as controlling
// profile/session/policy/proxy/engine behavior — every one of them is an
// env-var equivalent of a capability this wrapper's subcommand/arity model
// already refuses to let the caller reach via a flag, so none of them may
// leak through from the ambient environment either. Cleared (deleted, not
// empty-string — agent-browser validates an explicit empty session name as
// invalid rather than unset), not just the profile/session/policy trio the
// first pass covered.
export const CLEARED_ENV_KEYS = Object.freeze([
  'AGENT_BROWSER_PROFILE',
  'AGENT_BROWSER_SESSION_NAME',
  'AGENT_BROWSER_ACTION_POLICY',
  'AGENT_BROWSER_CONFIRM_ACTIONS',
  'AGENT_BROWSER_CONFIRM_INTERACTIVE',
  'AGENT_BROWSER_AUTO_CONNECT',
  'AGENT_BROWSER_ENGINE',
  'AGENT_BROWSER_PROXY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
]);

/** Returns a block-reason string if this argv should be refused, else null. */
export function validateArgv(argv) {
  const sub = argv[0];
  if (!sub || !ALLOWED_SUBCOMMANDS.includes(sub)) {
    return `subcommand "${sub ?? ''}" is not on the allow-list (${ALLOWED_SUBCOMMANDS.join(', ')}) — no global flags are permitted before the subcommand`;
  }
  const rest = argv.slice(1);
  const [min, max] = SUBCOMMAND_ARITY[sub];
  if (rest.length < min || rest.length > max) {
    const expected = min === max ? `exactly ${min}` : `${min}-${max}`;
    return `"${sub}" takes ${expected} argument(s), got ${rest.length} — no flags of any kind are accepted here (agent-browser-safe has no flag vocabulary at all; see --help)`;
  }
  return null;
}

const HELP = `agent-browser-safe — hardened agent-browser wrapper (reached via \`maude design agent-browser-safe\`)

Usage:
  maude design agent-browser-safe <subcommand> [args...]

Allowed subcommands (fixed argument count, NO flags of any kind):
  open <url>              screenshot [path]        get <thing> [selector]
  eval <js>                snapshot                 wait <sel|ms>
                                                      close

Forces --allowed-domains localhost,127.0.0.1 and a non-persistent profile,
regardless of any ambient AGENT_BROWSER_*/*_PROXY environment.

Exit: agent-browser's own exit code · 2 usage/rejected argv · 1 other.`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(`${HELP}\n`);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const blockReason = validateArgv(argv);
  if (blockReason) {
    process.stderr.write(`agent-browser-safe: ${blockReason}\n`);
    process.exit(2);
  }
  const [sub, ...rest] = argv;
  const env = { ...process.env };
  for (const key of CLEARED_ENV_KEYS) delete env[key];
  env.AGENT_BROWSER_ALLOWED_DOMAINS = 'localhost,127.0.0.1';
  const result = spawnSync(
    'agent-browser',
    [sub, ...rest, '--allowed-domains', 'localhost,127.0.0.1'],
    { stdio: 'inherit', env }
  );
  if (result.error) {
    process.stderr.write(
      `agent-browser-safe: failed to run agent-browser: ${result.error.message}\n`
    );
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

// Run only when invoked directly (not when imported by the test). This shim
// runs under real `node` on a real on-disk path (never embedded in
// `bun --compile`), so the classic argv[1] guard is correct here — see the
// v0.38.0 self-heal memory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
