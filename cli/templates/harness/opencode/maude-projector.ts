import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const inventoryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'maude-projector.inventory.json'
);

function mergeAbsent(target, additions) {
  for (const [name, value] of Object.entries(additions ?? {})) {
    if (!Object.hasOwn(target, name)) target[name] = value;
  }
}

export async function MaudeProjectorPlugin() {
  let inventory = null;
  try {
    inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  } catch {
    return {};
  }
  if (inventory?.schemaVersion !== 1 || inventory.target !== 'opencode') return {};

  for (const [name, value] of Object.entries(inventory.environment ?? {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name) || typeof value !== 'string') continue;
    const reference =
      /^\$\{([A-Z_][A-Z0-9_]*)\}$/.exec(value)?.[1] ??
      /^\{env:([A-Z_][A-Z0-9_]*)\}$/.exec(value)?.[1];
    if (reference) {
      if (process.env[reference] !== undefined) process.env[name] = process.env[reference];
    } else {
      process.env[name] = value;
    }
  }

  return {
    config: async (config) => {
      config.agent ??= {};
      config.command ??= {};
      config.mcp ??= {};
      config.permission ??= {};
      mergeAbsent(config.agent, inventory.config.agent);
      mergeAbsent(config.command, inventory.config.command);
      mergeAbsent(config.mcp, inventory.config.mcp);
      mergeAbsent(config.permission, inventory.config.permission);
      config.instructions ??= [];
      for (const path of inventory.config.instructions ?? []) {
        if (!config.instructions.includes(path)) config.instructions.push(path);
      }
      config.skills ??= {};
      config.skills.paths ??= [];
      for (const path of inventory.config.skills?.paths ?? []) {
        if (!config.skills.paths.includes(path)) config.skills.paths.push(path);
      }
    },
  };
}
