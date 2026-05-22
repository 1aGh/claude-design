#!/usr/bin/env node
// Walk plugins/{flow,design}/commands/*.md, write one MDX reference page per command.
// Output lives at content/docs/commands-{flow,design}/<name>.mdx + meta.json.
// Run as a prebuild step — see site/package.json `prebuild` script.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../');
const docsRoot = resolve(__dirname, '../content/docs');
const repoUrl = 'https://github.com/1aGh/maude/blob/main';

const plugins = [
  {
    slug: 'flow',
    label: 'Flow',
    sourceDir: 'plugins/flow/commands',
    prefix: '/flow:',
    daily: [
      'plan',
      'execute',
      'done',
      'validate',
      'status',
      'pause',
      'resume',
      'scenario',
      'quick',
      'release',
      'help',
    ],
  },
  {
    slug: 'design',
    label: 'Design',
    sourceDir: 'plugins/design/commands',
    prefix: '/design:',
    daily: ['design', 'new'],
  },
];

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const [, yaml, body] = match;
  const frontmatter = {};
  let currentKey = null;
  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      let value = kv[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      frontmatter[currentKey] = value;
    } else if (currentKey && line.startsWith(' ')) {
      frontmatter[currentKey] += ` ${line.trim()}`;
    }
  }
  return { frontmatter, body: body || '' };
}

function deriveSummary(body) {
  // First non-heading, non-blockquote paragraph after the frontmatter.
  const lines = body.split('\n');
  const buf = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line.trim()) {
      if (buf.length) break;
      continue;
    }
    if (line.startsWith('#') || line.startsWith('>')) {
      if (buf.length) break;
      continue;
    }
    buf.push(line.trim());
    if (buf.join(' ').length > 240) break;
  }
  return mdxEscape(buf.join(' ').slice(0, 320));
}

// Escape `<` that would otherwise be parsed as JSX by MDX. Cheap & sufficient
// for auto-generated docs — we don't expect any JSX in command prompts.
function mdxEscape(text) {
  return text.replace(/</g, '&lt;');
}

function escapeYamlString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function relativeSourcePath(plugin, name) {
  return `${plugin.sourceDir}/${name}.md`;
}

async function emitPlugin(plugin) {
  const sourceDir = join(repoRoot, plugin.sourceDir);
  const targetDir = join(docsRoot, `commands-${plugin.slug}`);

  let files;
  try {
    files = (await readdir(sourceDir)).filter((f) => f.endsWith('.md'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Source plugins/ tree isn't here (e.g. Vercel deploy uploads only site/).
      // The committed `content/docs/reference/<slug>/` already has the
      // last-regenerated MDX; leave it alone and skip.
      console.log(
        `[command-reference] ${plugin.slug}: source ${plugin.sourceDir} not found — skipping (using committed reference)`
      );
      return 0;
    }
    throw err;
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  files.sort();

  const pages = [];

  for (const file of files) {
    const name = file.replace(/\.md$/, '');
    const raw = await readFile(join(sourceDir, file), 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);

    const description = frontmatter.description || `${plugin.prefix}${name}`;
    const category = frontmatter.category || 'uncategorized';
    const argHint = frontmatter['argument-hint'] || '';
    const summary = deriveSummary(body);
    const invocation = argHint ? `${plugin.prefix}${name} ${argHint}` : `${plugin.prefix}${name}`;
    const isDaily = plugin.daily.includes(name);
    const sourceRel = relativeSourcePath(plugin, name);

    const mdx = `---
title: ${plugin.prefix}${name}
description: "${escapeYamlString(description)}"
---

| Property | Value |
| -------- | ----- |
| **Command** | \`${plugin.prefix}${name}\` |
| **Category** | \`${category}\`${isDaily ? ' (daily)' : ''} |
| **Argument hint** | ${argHint ? `\`${argHint.replace(/\|/g, '\\|')}\`` : '_(none)_'} |
| **Source** | [\`${sourceRel}\`](${repoUrl}/${sourceRel}) |

## Description

${mdxEscape(description)}

## Invocation

\`\`\`text
${invocation}
\`\`\`

${summary ? `## Summary\n\n${summary}\n` : ''}
## Source of truth

This page is auto-generated from the command's frontmatter. The exact prompt Claude runs — including directives, edge-case handling, and tool-routing logic — lives in the source file:

[**\`${sourceRel}\`**](${repoUrl}/${sourceRel}) → read it for the full behavior.
`;

    await writeFile(join(targetDir, `${name}.mdx`), mdx);
    pages.push({ name, category, isDaily });
  }

  // Group pages by category for the sidebar, with daily commands first.
  const byCategory = new Map();
  for (const page of pages) {
    const key = page.isDaily ? 'daily' : page.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(page);
  }

  const categoryOrder = [
    'daily',
    'setup',
    'utils',
    'validate',
    'bug',
    'record',
    'maintain',
    'review',
    'release',
    'uncategorized',
  ];
  const sortedKeys = [
    ...categoryOrder.filter((k) => byCategory.has(k)),
    ...[...byCategory.keys()].filter((k) => !categoryOrder.includes(k)).sort(),
  ];

  const sidebarPages = [];
  for (const key of sortedKeys) {
    const items = byCategory
      .get(key)
      .map((p) => p.name)
      .sort();
    if (sidebarPages.length || key !== 'daily') sidebarPages.push(`---${key}---`);
    sidebarPages.push(...items);
  }

  await writeFile(
    join(targetDir, 'meta.json'),
    `${JSON.stringify({ title: `${plugin.label} commands`, pages: sidebarPages }, null, 2)}\n`
  );

  return pages.length;
}

async function main() {
  await mkdir(docsRoot, { recursive: true });
  const counts = {};
  for (const plugin of plugins) {
    counts[plugin.slug] = await emitPlugin(plugin);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[command-reference] generated ${total} pages`);
}

main().catch((err) => {
  console.error('[command-reference] failed:', err);
  process.exit(1);
});
