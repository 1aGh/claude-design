import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';

export async function run({ args, pkgRoot }) {
  const { positional } = parseArgs(args);
  const sub = positional[0];

  if (!sub || sub === 'help') {
    process.stdout.write(`mdcc design <serve> [options]

  serve [--port N] [--root PATH]    Start the design plugin dev server in the
                                    current repo. All extra args are forwarded
                                    to the underlying server.

The 'serve' subcommand is equivalent to running 'claude-design-server' — it's
exposed here for discoverability under a single CLI.
`);
    return;
  }

  if (sub !== 'serve') {
    process.stderr.write(`mdcc design: unknown subcommand "${sub}"\n`);
    process.exit(2);
  }

  // Forward everything after 'serve' to the dev server.
  const forwarded = args.slice(args.indexOf('serve') + 1);
  const serverPath = resolve(pkgRoot, 'plugins', 'design', 'dev-server', 'server.mjs');

  const child = spawn(process.execPath, [serverPath, ...forwarded], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    process.stderr.write(`mdcc design serve: ${err.message}\n`);
    process.exit(1);
  });
}
