import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';

const CONFIG_PATH = '.ai/workflows.config.json';

export async function run({ args }) {
  const { positional } = parseArgs(args);
  const sub = positional[0];
  if (!sub || sub === 'help') {
    process.stdout.write(usage());
    return;
  }
  if (sub === 'show') {
    const cfg = await loadConfig();
    process.stdout.write(JSON.stringify(cfg, null, 2) + '\n');
    return;
  }
  if (sub === 'get') {
    const key = positional[1];
    if (!key) throw new Error('mdcc config get <dotted.key>');
    const cfg = await loadConfig();
    const v = getPath(cfg, key);
    if (v === undefined) {
      process.stderr.write(`(unset)\n`);
      process.exit(1);
    }
    if (typeof v === 'object') process.stdout.write(JSON.stringify(v, null, 2) + '\n');
    else process.stdout.write(String(v) + '\n');
    return;
  }
  if (sub === 'set') {
    const key = positional[1];
    const rawValue = positional[2];
    if (!key || rawValue === undefined) throw new Error('mdcc config set <dotted.key> <value>');
    const value = coerce(rawValue);
    const cfg = await loadConfig();
    setPath(cfg, key, value);
    await saveConfig(cfg);
    process.stdout.write(`set ${key} = ${JSON.stringify(value)}\n`);
    return;
  }
  process.stderr.write(`mdcc config: unknown subcommand "${sub}"\n${usage()}`);
  process.exit(2);
}

function usage() {
  return `mdcc config <show|get|set> [args]

  config show                       Print the full resolved config.
  config get <dotted.key>           Print a single value (e.g. motion.complex).
  config set <dotted.key> <value>   Write a value. JSON-parseable values are
                                    stored typed (numbers, booleans, arrays).
`;
}

async function loadConfig() {
  const path = resolve(process.cwd(), CONFIG_PATH);
  try {
    await stat(path);
  } catch {
    throw new Error(`${CONFIG_PATH} not found. Run \`mdcc init\` first.`);
  }
  return JSON.parse(await readFile(path, 'utf8'));
}

async function saveConfig(cfg) {
  const path = resolve(process.cwd(), CONFIG_PATH);
  await writeFile(path, JSON.stringify(cfg, null, 2) + '\n');
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function coerce(raw) {
  // Try JSON first (covers numbers, booleans, null, arrays, objects, quoted strings).
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
