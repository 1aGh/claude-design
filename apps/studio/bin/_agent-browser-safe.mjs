#!/usr/bin/env node
// _agent-browser-safe.mjs — hardened agent-browser wrapper, reached via
// `maude design agent-browser-safe <subcommand> [args...]` (DDR-062 dispatch;
// DDR-185 security addendum).
//
// WHY THIS EXISTS: DDR-185 originally added a bare `Bash(agent-browser:*)`
// allow-list entry so the ACP session wouldn't prompt on the raw
// `agent-browser eval`/`agent-browser screenshot` calls already documented in
// `plugins/design/agents/motion-critic.md` and `plugins/design/commands/edit.md`.
// A security review (ethical-hacker Finding D) found that grant was a
// zero-confirmation, zero-click session-hijack primitive: `agent-browser`'s
// OWN bundled onboarding skill (`plugins/flow/skills/agent-browser/SKILL.md`)
// recommends a PERSISTENT Chrome profile as the default auth strategy for
// real, cross-origin authenticated sites (GitHub, production, ClickUp) —
// and nothing in the bare Bash prefix rule stopped `agent-browser` from
// navigating to any of them and using `eval`'s in-page `fetch()` to read or
// exfiltrate an authenticated session, driven entirely by DDR-054 untrusted
// project content with no human in the loop anywhere in the chain.
//
// This verb closes that with the SAME allowlist discipline `curl-local`
// applies to curl (a blocklist of "known-dangerous flags" is exactly how
// curl-local's first cut missed `-K`/`--resolve` — see this DDR's addendum):
//   1. The subcommand (argv[0], REQUIRED to be first — no global flags ahead
//      of it, closing the parsing ambiguity a "scan for the first non-flag
//      token" approach would have) must be one of a closed set actually used
//      by this repo's own design workflows: open/eval/screenshot/snapshot/
//      get/wait/close. Nothing that reads cookies/clipboard/storage, attaches
//      to an already-running Chrome via CDP, uploads/downloads files, or
//      spawns the `chat` sub-agent is reachable through this wrapper at all.
//   2. Every remaining argument is checked against a closed set of REJECTED
//      flags that could override the safety constraints below — `--profile`/
//      `--session-name` (persistent auth), `--allowed-domains`/`--engine`
//      (widen or dodge the domain scope this wrapper forces), `--action-
//      policy`/`--confirm-actions`/`--confirm-interactive` (agent-browser's
//      own policy knobs — forcing them here rather than letting the caller
//      set them), `--cdp`/`--auto-connect` (attach to an unrelated running
//      Chrome instance), `--proxy` (route traffic through an attacker-
//      controlled proxy). ANY of these anywhere in argv[1:] fails closed.
//   3. The real `agent-browser` child is spawned with `--allowed-domains
//      localhost,127.0.0.1` forced (agent-browser's own native domain-scope
//      enforcement — see its `--help`), AND the profile/session/policy env
//      vars explicitly cleared/overridden so an ambient `AGENT_BROWSER_*`
//      setting from the user's own shell rc or `~/.claude/settings.json`
//      (which DDR-144's `settingSources:['user']` legitimately still reads)
//      can't leak a persistent, authenticated profile into this call either.
//
// Exit: agent-browser's own exit code on success · 2 usage/rejected argv ·
//       1 other (failed to spawn agent-browser at all).

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ALLOWED_SUBCOMMANDS = Object.freeze([
  'open',
  'eval',
  'screenshot',
  'snapshot',
  'get',
  'wait',
  'close',
]);

// Matched as a whole token, OR as the `--flag=value` form of the same flag —
// NOT a substring match (so e.g. a screenshot path that happens to contain
// "profile" isn't falsely rejected).
export const REJECTED_FLAGS = Object.freeze([
  '--profile',
  '--session-name',
  '--allowed-domains',
  '--action-policy',
  '--confirm-actions',
  '--confirm-interactive',
  '--cdp',
  '--auto-connect',
  '--proxy',
  '--engine',
]);

/** Returns a block-reason string if this argv should be refused, else null. */
export function validateArgv(argv) {
  const sub = argv[0];
  if (!sub || !ALLOWED_SUBCOMMANDS.includes(sub)) {
    return `subcommand "${sub ?? ''}" is not on the allow-list (${ALLOWED_SUBCOMMANDS.join(', ')}) — no global flags are permitted before the subcommand`;
  }
  for (const a of argv.slice(1)) {
    const bare = a.split('=')[0];
    if (REJECTED_FLAGS.includes(bare)) {
      return `flag "${a}" is not allowed — it can override this wrapper's safety constraints`;
    }
  }
  return null;
}

const HELP = `agent-browser-safe — hardened agent-browser wrapper (reached via \`maude design agent-browser-safe\`)

Usage:
  maude design agent-browser-safe <subcommand> [args...]

Allowed subcommands: ${ALLOWED_SUBCOMMANDS.join(', ')}
Forces --allowed-domains localhost,127.0.0.1 and a non-persistent profile,
regardless of any ambient AGENT_BROWSER_* environment.

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
  // Clear (delete, not empty-string — agent-browser validates an explicit
  // empty AGENT_BROWSER_SESSION_NAME as an invalid value rather than treating
  // it as unset) any ambient profile/session/policy env before forcing the
  // domain scope. Deleting rather than setting '' also means a FUTURE
  // AGENT_BROWSER_* knob this list doesn't yet know about still only leaks
  // through if it was already in process.env — not a new gap this wrapper
  // introduces.
  const env = { ...process.env };
  for (const key of [
    'AGENT_BROWSER_PROFILE',
    'AGENT_BROWSER_SESSION_NAME',
    'AGENT_BROWSER_ACTION_POLICY',
    'AGENT_BROWSER_CONFIRM_ACTIONS',
    'AGENT_BROWSER_CONFIRM_INTERACTIVE',
  ]) {
    delete env[key];
  }
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
