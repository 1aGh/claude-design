#!/usr/bin/env node
// Test fixture standing in for the `claude` CLI — implements only the one
// subcommand probeAcpAvailabilityAuthed()/getClaudeAuthStatus() shell out to.
// FAKE_CLAUDE_LOGGED_IN=1 controls the reported sign-in state.
//
// FAKE_CLAUDE_STDOUT_NOISE=1 reproduces issue #107: a version-manager shim
// (mise/asdf/volta) or corporate wrapper fronting the real binary and printing
// a banner to STDOUT ahead of the JSON. The second noise line deliberately
// carries braces of its own, pinning that a brace-bearing banner can't outrank
// the real payload.
const [, , cmd, sub] = process.argv;
if (cmd === 'auth' && sub === 'status') {
  const loggedIn = process.env.FAKE_CLAUDE_LOGGED_IN === '1';
  if (process.env.FAKE_CLAUDE_STDOUT_NOISE === '1') {
    process.stdout.write('mise ~/.config/mise/config.toml tools: claude@2.1.246\n');
    process.stdout.write('resolving {claude} from {global} config\n');
  }
  process.stdout.write(
    JSON.stringify({ loggedIn, apiProvider: loggedIn ? 'firstParty' : undefined })
  );
  process.exit(0);
}
process.exit(1);
