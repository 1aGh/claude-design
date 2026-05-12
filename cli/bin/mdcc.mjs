#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
// mdcc — md-claude CLI. Scaffold .ai workspace, run dev servers, manage config.
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, '..');
const PKG_ROOT = resolve(CLI_ROOT, '..');

const COMMANDS = {
  init: () => import('../commands/init.mjs'),
  config: () => import('../commands/config.mjs'),
  design: () => import('../commands/design.mjs'),
  help: () => import('../commands/help.mjs'),
  version: () => import('../commands/version.mjs'),
};

async function main(argv) {
  const args = argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    const { run } = await COMMANDS.help();
    return run({ args: args.slice(1), pkgRoot: PKG_ROOT });
  }
  if (cmd === '--version' || cmd === '-v') {
    const { run } = await COMMANDS.version();
    return run({ args: [], pkgRoot: PKG_ROOT });
  }

  const loader = COMMANDS[cmd];
  if (!loader) {
    process.stderr.write(`mdcc: unknown command "${cmd}"\nRun \`mdcc help\` for usage.\n`);
    process.exit(2);
  }
  const { run } = await loader();
  return run({ args: args.slice(1), pkgRoot: PKG_ROOT });
}

main(process.argv).catch((err) => {
  process.stderr.write(`mdcc: ${err.message}\n`);
  if (process.env.MDCC_DEBUG) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
