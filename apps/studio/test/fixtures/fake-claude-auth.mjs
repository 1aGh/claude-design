#!/usr/bin/env node
// Test fixture standing in for the `claude` CLI — implements only the one
// subcommand probeAcpAvailabilityAuthed()/getClaudeAuthStatus() shell out to.
// FAKE_CLAUDE_LOGGED_IN=1 controls the reported sign-in state.
const [, , cmd, sub] = process.argv;
if (cmd === 'auth' && sub === 'status') {
  const loggedIn = process.env.FAKE_CLAUDE_LOGGED_IN === '1';
  process.stdout.write(JSON.stringify({ loggedIn, apiProvider: loggedIn ? 'firstParty' : undefined }));
  process.exit(0);
}
process.exit(1);
