#!/usr/bin/env node
// Walk plugins/flow/.claude-plugin/config.schema.json, emit one MDX page that
// documents every key with its type, default, enum, and description.
// Re-runs on every site build — see site/package.json `prebuild` script.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../../plugins/flow/.claude-plugin/config.schema.json');
const outPath = resolve(__dirname, '../content/docs/reference/config-schema.mdx');
const sourceRepoUrl =
  'https://github.com/1aGh/md-claude/blob/main/plugins/flow/.claude-plugin/config.schema.json';

// Escape `<` that would otherwise be parsed as JSX by MDX (e.g. `<repo>`
// placeholders in schema descriptions). Cheap & sufficient — we don't expect
// any JSX in JSON Schema descriptions.
function mdxEscape(text) {
  return String(text).replace(/</g, '&lt;');
}

function formatDefault(value) {
  if (value === undefined) return null;
  if (value === null) return '`null`';
  if (typeof value === 'string') return `\`${JSON.stringify(value)}\``;
  if (typeof value === 'number' || typeof value === 'boolean') return `\`${value}\``;
  if (Array.isArray(value)) return `\`${JSON.stringify(value)}\``;
  if (typeof value === 'object') return `\`${JSON.stringify(value)}\``;
  return null;
}

function typeLabel(schema) {
  if (!schema) return '_unknown_';
  if (schema.enum) return `enum: ${schema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(' │ ')}`;
  if (Array.isArray(schema.type)) return schema.type.join(' │ ');
  if (schema.type === 'array' && schema.items) {
    const itemType = schema.items.enum
      ? `enum(${schema.items.enum.map((v) => JSON.stringify(v)).join(', ')})`
      : schema.items.type || 'unknown';
    return `\`${itemType}[]\``;
  }
  if (schema.type) return `\`${schema.type}\``;
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const inner = schema.additionalProperties.type || 'unknown';
    return `\`Record<string, ${inner}>\``;
  }
  return '_object_';
}

function renderProperty(key, schema, dottedPath, depth, lines) {
  const heading = '#'.repeat(Math.min(2 + depth, 6));
  const fullKey = dottedPath ? `${dottedPath}.${key}` : key;

  lines.push(`${heading} \`${fullKey}\``);
  lines.push('');

  const meta = [];
  meta.push(`**Type:** ${typeLabel(schema)}`);
  const def = formatDefault(schema.default);
  if (def !== null) meta.push(`**Default:** ${def}`);
  if (schema.minimum !== undefined) meta.push(`**Min:** \`${schema.minimum}\``);
  if (schema.maximum !== undefined) meta.push(`**Max:** \`${schema.maximum}\``);
  if (schema.uniqueItems) meta.push('**Unique items**');
  lines.push(meta.join(' · '));
  lines.push('');

  if (schema.description) {
    lines.push(mdxEscape(schema.description));
    lines.push('');
  }

  if (schema.enum) {
    lines.push('**Allowed values:**');
    lines.push('');
    for (const v of schema.enum) lines.push(`- \`${JSON.stringify(v)}\``);
    lines.push('');
  }

  if (schema.type === 'object' && schema.properties) {
    for (const [childKey, childSchema] of Object.entries(schema.properties)) {
      renderProperty(childKey, childSchema, fullKey, depth + 1, lines);
    }
  }

  if (
    schema.type === 'array' &&
    schema.items &&
    schema.items.type === 'object' &&
    schema.items.properties
  ) {
    lines.push(`_Each item in \`${fullKey}\` is an object:_`);
    lines.push('');
    for (const [childKey, childSchema] of Object.entries(schema.items.properties)) {
      renderProperty(childKey, childSchema, `${fullKey}[]`, depth + 1, lines);
    }
  }
}

async function main() {
  const raw = await readFile(schemaPath, 'utf8');
  const schema = JSON.parse(raw);

  const lines = [
    '---',
    'title: workflows.config.json — schema',
    'description: Auto-generated reference of every key in .ai/workflows.config.json — type, default, allowed values, description.',
    '---',
    '',
    `Auto-generated from [\`plugins/flow/.claude-plugin/config.schema.json\`](${sourceRepoUrl}). Re-runs on every site build.`,
    '',
    'For prose with examples, see the [hand-written config guide](/docs/config).',
    '',
    mdxEscape(schema.description || ''),
    '',
    `**Required keys:** ${(schema.required || []).map((r) => `\`${r}\``).join(', ') || '_none_'}`,
    '',
    '---',
    '',
  ];

  if (schema.type === 'object' && schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      renderProperty(key, child, '', 0, lines);
    }
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${lines.join('\n')}\n`);
  console.log(`[schema-reference] wrote ${outPath}`);
}

main().catch((err) => {
  console.error('[schema-reference] failed:', err);
  process.exit(1);
});
