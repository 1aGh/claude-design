import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseDocument } from 'yaml';

import { createEnvironmentIR, sha256 } from './model.mjs';
import {
  classifyCredential,
  isCredentialReference,
  sanitizeConfiguredEnvironmentValue,
  sanitizeUntrustedText,
  sanitizeUntrustedValue,
} from './secrets.mjs';

const DEFAULT_LIMITS = {
  maxDepth: 8,
  maxEntries: 50_000,
  maxFileBytes: 1024 * 1024,
  maxFiles: 10_000,
  maxFrontmatterBytes: 64 * 1024,
  maxItems: 10_000,
  maxStructureDepth: 32,
  maxStructureNodes: 50_000,
  maxTotalBytes: 25 * 1024 * 1024,
};

export async function discoverClaude({
  home = homedir(),
  projectRoot = process.cwd(),
  allowedPluginRoots = [],
  discoveryFailpoint = async () => {},
  limits = {},
  profile = 'full',
  includeProjectSettings = true,
} = {}) {
  if (!['full', 'plugins', 'runtime'].includes(profile))
    throw new Error(`unknown Claude discovery profile ${profile}`);
  const bounded = { ...DEFAULT_LIMITS, ...limits };
  const canonicalHome = await canonicalDirectory(home, 'home');
  const canonicalProject = await canonicalDirectory(projectRoot, 'project root');
  const claudeHome = join(canonicalHome, '.claude');
  const context = {
    entries: 0,
    failpoint: discoveryFailpoint,
    files: 0,
    items: [],
    limits: bounded,
    totalBytes: 0,
  };
  const approvedPluginRoots = await existingCanonicalDirectories([
    join(claudeHome, 'plugins'),
    ...(includeProjectSettings ? [canonicalProject] : []),
    ...allowedPluginRoots,
  ]);

  const settingsLayers = await readSettingsLayers(
    context,
    claudeHome,
    canonicalProject,
    includeProjectSettings
  );
  addEffectiveSettings(context, settingsLayers);
  addSettingsCapabilities(context, settingsLayers);

  const plugins = await discoverPlugins(
    context,
    claudeHome,
    canonicalProject,
    settingsLayers,
    approvedPluginRoots,
    includeProjectSettings
  );
  if (profile === 'plugins') {
    return createEnvironmentIR(context.items.filter((item) => item.category === 'plugins'));
  }
  if (profile === 'runtime') {
    return createEnvironmentIR(
      context.items.filter(
        (item) =>
          item.category === 'plugins' ||
          item.category === 'permission-mode' ||
          item.category.startsWith('permissions-')
      )
    );
  }
  await discoverInstructions(context, claudeHome, canonicalHome, canonicalProject);
  await discoverAssetRoot(context, claudeHome, 'global', 'global', 10, canonicalHome, false);
  for (const plugin of plugins) {
    await discoverAssetRoot(
      context,
      plugin.root,
      plugin.namespace,
      plugin.scope,
      plugin.precedence,
      plugin.root,
      true
    );
  }
  await discoverAssetRoot(
    context,
    join(canonicalProject, '.claude'),
    'project',
    'project',
    40,
    canonicalProject,
    false
  );

  await discoverMcp(context, join(canonicalHome, '.claude.json'), 'global', 'global', 10);
  for (const plugin of plugins) {
    await discoverMcp(
      context,
      join(plugin.root, '.mcp.json'),
      plugin.namespace,
      plugin.scope,
      plugin.precedence
    );
    await discoverHookFile(context, plugin);
  }
  await discoverMcp(context, join(canonicalProject, '.mcp.json'), 'project', 'project', 40);
  await discoverProjectState(context, canonicalProject);

  return createEnvironmentIR(context.items);
}

async function readSettingsLayers(context, claudeHome, projectRoot, includeProjectSettings) {
  const candidates = [
    {
      path: join(claudeHome, 'settings.json'),
      allowedRoot: dirname(claudeHome),
      precedence: 10,
      scope: 'global',
    },
    {
      path: join(projectRoot, '.claude', 'settings.json'),
      allowedRoot: projectRoot,
      precedence: 40,
      scope: 'project',
    },
    {
      path: join(projectRoot, '.claude', 'settings.local.json'),
      allowedRoot: projectRoot,
      precedence: 50,
      scope: 'project',
    },
  ].filter((candidate) => includeProjectSettings || candidate.scope !== 'project');
  const layers = [];
  for (const candidate of candidates) {
    const source = await readJsonIfPresent(context, candidate.path, candidate.allowedRoot);
    if (source) layers.push({ ...candidate, ...source });
  }
  return layers;
}

function addEffectiveSettings(context, layers) {
  const keys = new Set(layers.flatMap((layer) => Object.keys(layer.value)));
  for (const key of [...keys].sort()) {
    if (['enabledPlugins', 'env', 'hooks', 'permissions'].includes(key)) continue;
    const contributors = layers.filter((layer) => layer.value[key] !== undefined);
    const values = contributors.map((layer) => layer.value[key]);
    const value = key === 'permissions' ? mergePermissions(values) : mergeSettingValues(values);
    const winner = contributors.at(-1);
    addItem(context, {
      category: 'settings',
      name: key,
      scope: winner.scope,
      sourcePath: winner.path,
      precedence: winner.precedence,
      value,
      sourceHash: sha256(JSON.stringify(value)),
      contributors: contributors.map(toContributor),
    });
  }
}

function addSettingsCapabilities(context, layers) {
  for (const layer of layers) {
    const permissions = layer.value.permissions ?? {};
    for (const kind of ['allow', 'ask', 'deny']) {
      for (const [index, rule] of (permissions[kind] ?? []).entries()) {
        addItem(
          context,
          sourceItem(layer, `permissions-${kind}`, `${layer.scope}:${index}:${rule}`, rule)
        );
      }
    }
    if (permissions.defaultMode) {
      addItem(
        context,
        sourceItem(layer, 'permission-mode', `${layer.scope}:default`, permissions.defaultMode)
      );
    }
    addHooks(
      context,
      layer.value.hooks,
      layer.scope,
      layer.scope,
      layer.path,
      layer.precedence,
      layer.hash
    );
  }
  const environmentNames = new Set(layers.flatMap((layer) => Object.keys(layer.value.env ?? {})));
  for (const name of [...environmentNames].sort()) {
    const contributors = layers.filter((layer) => layer.value.env?.[name] !== undefined);
    const winner = contributors.at(-1);
    const sanitized = sanitizeConfiguredEnvironmentValue(name, winner.value.env[name]);
    const value = {
      name,
      value: sanitized.value,
      ...(sanitized.rejected ? { secretStatus: { $maudeSecret: 'literal-rejected' } } : {}),
    };
    addItem(context, {
      category: 'environment',
      name: `${winner.scope}:${name}`,
      scope: winner.scope,
      sourcePath: winner.path,
      precedence: winner.precedence,
      value,
      sourceHash: sha256(JSON.stringify(value)),
      contributors: contributors.map(toContributor),
    });
  }
}

async function discoverPlugins(
  context,
  claudeHome,
  projectRoot,
  settingsLayers,
  approvedPluginRoots,
  includeProjectInstalls
) {
  const enabled = new Map();
  for (const layer of settingsLayers) {
    for (const [name, value] of Object.entries(layer.value.enabledPlugins ?? {})) {
      if (typeof value !== 'boolean') {
        throw new Error(`enabledPlugins.${name} in ${layer.path} must be boolean`);
      }
      enabled.set(name, value);
    }
  }
  const installedPath = join(claudeHome, 'plugins', 'installed_plugins.json');
  const installed = await readJsonIfPresent(context, installedPath, claudeHome);
  const plugins = [];
  for (const [pluginName, isEnabled] of [...enabled].sort(([a], [b]) => a.localeCompare(b))) {
    if (!isEnabled) continue;
    const installs = installed?.value?.plugins?.[pluginName] ?? [];
    const selected = await selectPluginInstall(installs, projectRoot, includeProjectInstalls);
    if (!selected) {
      const sourceLayer = settingsLayers.findLast(
        (layer) => layer.value.enabledPlugins?.[pluginName] !== undefined
      );
      const value = { enabled: true, missing: true, pluginName };
      addItem(context, {
        category: 'plugins',
        name: pluginName,
        scope: sourceLayer.scope,
        sourcePath: sourceLayer.path,
        precedence: sourceLayer.precedence,
        value,
        sourceHash: sha256(JSON.stringify(value)),
        contributors: [toContributor(sourceLayer)],
      });
      continue;
    }
    const root = await canonicalDirectory(selected.installPath, `plugin ${pluginName}`);
    if (!includeProjectInstalls && isWithin(root, projectRoot)) {
      throw new Error(`plugin ${pluginName} resolves inside an untrusted project: ${root}`);
    }
    if (!approvedPluginRoots.some((approvedRoot) => isWithin(root, approvedRoot))) {
      throw new Error(`plugin ${pluginName} is outside approved roots: ${root}`);
    }
    const scope = selected.projectPath ? 'project' : 'global';
    const precedence = selected.projectPath ? 45 : 20;
    const namespace = pluginName.split('@')[0];
    const value = {
      gitCommitSha: selected.gitCommitSha,
      installPath: root,
      lastUpdated: selected.lastUpdated,
      pluginName,
      scope,
      version: selected.version,
    };
    addItem(context, {
      category: 'plugins',
      name: pluginName,
      scope,
      sourcePath: installedPath,
      precedence,
      value,
      sourceHash: sha256(JSON.stringify(value)),
      contributors: installed
        ? [toContributor({ ...installed, path: installedPath, precedence, scope })]
        : [],
    });
    plugins.push({ namespace, pluginName, precedence, root, scope });
  }
  return plugins;
}

async function selectPluginInstall(installs, projectRoot, includeProjectInstalls = true) {
  if (includeProjectInstalls) {
    for (const entry of installs) {
      if (!entry.projectPath) continue;
      try {
        if ((await realpath(resolve(entry.projectPath))) === projectRoot) return entry;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  return installs.find((entry) => entry.scope === 'user');
}

async function discoverInstructions(context, claudeHome, home, projectRoot) {
  const candidates = [
    {
      path: join(claudeHome, 'CLAUDE.md'),
      allowedRoot: home,
      importRoot: claudeHome,
      name: 'global:CLAUDE.md',
      scope: 'global',
      precedence: 10,
    },
    {
      path: join(projectRoot, 'CLAUDE.md'),
      allowedRoot: projectRoot,
      name: 'project:CLAUDE.md',
      scope: 'project',
      precedence: 40,
    },
    {
      path: join(projectRoot, '.claude', 'CLAUDE.md'),
      allowedRoot: projectRoot,
      name: 'project:.claude/CLAUDE.md',
      scope: 'project',
      precedence: 41,
    },
  ];
  for (const candidate of candidates) {
    const source = await readTextIfPresent(context, candidate.path, candidate.allowedRoot);
    if (!source) continue;
    const imports = instructionImports(source.value);
    const instructionBody = source.value
      .split(/\r?\n/)
      .filter((line) => !/^\s*@[^\s]+\s*$/.test(line))
      .join('\n');
    const sanitized = sanitizeUntrustedText(instructionBody);
    addItem(context, {
      ...textItem(candidate, 'instructions', source),
      value: {
        body: sanitized.value,
        ...(sanitized.findings.length > 0
          ? { secretStatus: { $maudeSecret: 'literal-rejected' } }
          : {}),
      },
    });
    for (const [index, importPath] of imports.entries()) {
      const imported = await inspectInstructionImport(
        context,
        importPath,
        candidate.path,
        candidate.importRoot ?? candidate.allowedRoot
      );
      const value = {
        ...imported.value,
        reference: importPath,
      };
      addItem(context, {
        category: 'instruction-imports',
        name: `${candidate.name}:import:${index}`,
        scope: candidate.scope,
        sourcePath: imported.path ?? candidate.path,
        precedence: candidate.precedence,
        value,
        sourceHash: imported.sourceHash ?? sha256(importPath),
        contributors: imported.contributor
          ? [
              contributor(candidate.path, candidate.scope, candidate.precedence, source.hash),
              imported.contributor,
            ]
          : [contributor(candidate.path, candidate.scope, candidate.precedence, source.hash)],
      });
    }
  }
}

async function discoverAssetRoot(
  context,
  root,
  namespace,
  scope,
  precedence,
  allowedRoot,
  pluginOrigin
) {
  if (!(await pathExists(root))) return;
  const roots = [
    { category: 'commands', directory: join(root, 'commands'), recursive: false },
    { category: 'agents', directory: join(root, 'agents'), recursive: false },
    { category: 'rules', directory: join(root, 'rules'), recursive: true },
  ];
  for (const asset of roots) {
    for (const file of await markdownFiles(
      context,
      asset.directory,
      allowedRoot,
      asset.recursive
    )) {
      const source = await readText(context, file, allowedRoot);
      const parsed = parseMarkdown(source.value, context.limits.maxFrontmatterBytes, file);
      const slug = asset.recursive
        ? relative(asset.directory, file).replaceAll(sep, '/').replace(/\.md$/, '')
        : basename(file, '.md');
      addItem(context, {
        category: asset.category,
        origin: pluginOrigin ? 'plugin' : 'direct',
        name: `${namespace}:${slug}`,
        scope,
        sourcePath: file,
        precedence,
        value: parsed,
        sourceHash: source.hash,
        contributors: [contributor(file, scope, precedence, source.hash)],
      });
    }
  }

  const skillsRoot = join(root, 'skills');
  for (const file of await namedFiles(context, skillsRoot, allowedRoot, 'SKILL.md')) {
    const inventory = await inventorySkillDirectory(context, dirname(file), allowedRoot);
    const skillFile = inventory.files.find((entry) => entry.path === 'SKILL.md');
    if (!skillFile) throw new Error(`skill directory has no regular SKILL.md: ${dirname(file)}`);
    const parsed = parseMarkdown(
      skillFile.bytes.toString('utf8'),
      context.limits.maxFrontmatterBytes,
      file
    );
    const slug = parsed.frontmatter.name || basename(dirname(file));
    const sourceClosure = inventory.files.map(({ path, hash, bytes }) => {
      let content;
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new Error(`skill supporting file must be UTF-8 text: ${join(dirname(file), path)}`);
      }
      const sanitized = sanitizeUntrustedText(content);
      return {
        content: sanitized.value,
        hash,
        path,
        ...(sanitized.findings.length > 0
          ? { rejected: { $maudeSecret: 'literal-rejected' } }
          : {}),
      };
    });
    addItem(context, {
      category: 'skills',
      origin: pluginOrigin ? 'plugin' : 'direct',
      name: `${namespace}:${slug}`,
      scope,
      sourcePath: file,
      precedence,
      value: { ...parsed, sourceClosure },
      sourceHash: inventory.treeHash,
      contributors: [contributor(file, scope, precedence, inventory.treeHash)],
    });
  }
}

async function discoverMcp(context, path, namespace, scope, precedence) {
  const source = await readJsonIfPresent(context, path, dirname(path));
  if (!source) return;
  for (const [name, server] of Object.entries(source.value.mcpServers ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    sanitizeMcpServer(server);
    validateMcpServer(server, path, name);
    const category = server.disabled
      ? 'mcp-disabled'
      : server.type === 'http'
        ? 'mcp-http'
        : server.type === 'sse'
          ? 'mcp-sse'
          : 'mcp-stdio';
    addItem(context, {
      category,
      name: `${namespace}:${name}`,
      scope,
      sourcePath: path,
      precedence,
      value: server,
      sourceHash: sha256(JSON.stringify(server)),
      contributors: [toContributor({ ...source, path, precedence, scope })],
    });
    if (server.oauth) {
      addItem(
        context,
        sourceItem(
          { ...source, path, precedence, scope },
          'mcp-oauth',
          `${namespace}:${name}`,
          server.oauth
        )
      );
    }
    if (server.env || server.headers) {
      addItem(
        context,
        sourceItem(
          { ...source, path, precedence, scope },
          'mcp-environment',
          `${namespace}:${name}`,
          { env: server.env ?? {}, headers: server.headers ?? {} }
        )
      );
    }
  }
}

async function discoverHookFile(context, plugin) {
  const path = join(plugin.root, 'hooks', 'hooks.json');
  const source = await readJsonIfPresent(context, path, plugin.root);
  if (!source) return;
  addHooks(
    context,
    source.value.hooks,
    plugin.namespace,
    plugin.scope,
    path,
    plugin.precedence,
    source.hash
  );
}

function addHooks(context, hooks, namespace, scope, sourcePath, precedence, sourceHash) {
  for (const [event, groups] of Object.entries(hooks ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    for (const [groupIndex, group] of groups.entries()) {
      for (const [hookIndex, hook] of (group.hooks ?? []).entries()) {
        const type = hook.type ?? (hook.command ? 'command' : 'unknown');
        const category = ['command', 'http', 'prompt', 'agent'].includes(type)
          ? `hooks-${type}`
          : 'hooks-unknown';
        addItem(context, {
          category,
          name: `${namespace}:${event}:${precedence}:${groupIndex}:${hookIndex}`,
          scope,
          sourcePath,
          precedence,
          value: { event, matcher: group.matcher, ...hook },
          sourceHash: sha256(JSON.stringify({ event, matcher: group.matcher, ...hook })),
          contributors: [contributor(sourcePath, scope, precedence, sourceHash)],
        });
      }
    }
  }
}

async function discoverProjectState(context, projectRoot) {
  for (const [directory, category] of [
    ['.ai', 'ai-state'],
    ['.design', 'design-state'],
  ]) {
    const path = join(projectRoot, directory);
    if (!(await pathExists(path))) continue;
    const pathInfo = await lstat(path);
    const canonical = await realpath(path);
    assertWithin(
      canonical,
      projectRoot,
      pathInfo.isSymbolicLink() ? `symlink ${directory}` : directory
    );
    const canonicalInfo = pathInfo.isSymbolicLink() ? await stat(canonical) : pathInfo;
    if (!canonicalInfo.isDirectory()) throw new Error(`${path} is not a directory`);
    const value = { path, mode: 'reference' };
    addItem(context, {
      category,
      name: `project:${directory}`,
      scope: 'project',
      sourcePath: path,
      precedence: 40,
      value,
      sourceHash: sha256(path),
      contributors: [contributor(path, 'project', 40, sha256(path))],
    });
  }
  const configPath = join(projectRoot, '.ai', 'workflows.config.json');
  const source = await readJsonIfPresent(context, configPath, join(projectRoot, '.ai'));
  if (source?.value?.knowledgeGraph) {
    addItem(context, {
      category: 'kgai',
      name: 'project:kgai',
      scope: 'project',
      sourcePath: configPath,
      precedence: 40,
      value: source.value.knowledgeGraph,
      sourceHash: sha256(JSON.stringify(source.value.knowledgeGraph)),
      contributors: [contributor(configPath, 'project', 40, source.hash)],
    });
  }
}

function addItem(context, item) {
  context.items.push(item);
  if (context.items.length > context.limits.maxItems) {
    throw new Error(`Claude inventory exceeds ${context.limits.maxItems} items`);
  }
}

function sourceItem(layer, category, name, value) {
  return {
    category,
    name,
    scope: layer.scope,
    sourcePath: layer.path,
    precedence: layer.precedence,
    value,
    sourceHash: sha256(JSON.stringify(value)),
    contributors: [toContributor(layer)],
  };
}

function textItem(candidate, category, source) {
  return {
    category,
    name: candidate.name,
    scope: candidate.scope,
    sourcePath: candidate.path,
    precedence: candidate.precedence,
    value: source.value,
    sourceHash: source.hash,
    contributors: [contributor(candidate.path, candidate.scope, candidate.precedence, source.hash)],
  };
}

function contributor(sourcePath, scope, precedence, sourceHash) {
  return { sourcePath, scope, precedence, sourceHash };
}

function toContributor(layer) {
  return contributor(layer.path, layer.scope, layer.precedence, layer.hash);
}

function mergeSettingValues(values) {
  if (values.every(isPlainObject)) {
    return values.reduce((result, value) => deepMerge(result, value), {});
  }
  if (values.every(Array.isArray)) return unique(values.flat());
  return structuredClone(values.at(-1));
}

function mergePermissions(values) {
  const result = {};
  for (const value of values) {
    for (const kind of ['allow', 'ask', 'deny']) {
      if (value?.[kind]) result[kind] = unique([...(result[kind] ?? []), ...value[kind]]);
    }
    if (value?.defaultMode !== undefined) result.defaultMode = value.defaultMode;
  }
  return result;
}

function deepMerge(left, right) {
  const result = structuredClone(left);
  for (const [key, value] of Object.entries(right)) {
    result[key] =
      isPlainObject(value) && isPlainObject(result[key])
        ? deepMerge(result[key], value)
        : structuredClone(value);
  }
  return result;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique(values) {
  return [...new Set(values)];
}

function instructionImports(content) {
  return content
    .split(/\r?\n/)
    .map((line) => /^\s*@([^\s]+)\s*$/.exec(line)?.[1])
    .filter(Boolean);
}

function parseMarkdown(content, maxFrontmatterBytes, path) {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return safeMarkdown({ body: content, frontmatter: {}, frontmatterMode: 'none' });
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error(`invalid Markdown frontmatter in ${path}`);
  if (Buffer.byteLength(match[1]) > maxFrontmatterBytes) {
    throw new Error(`frontmatter in ${path} exceeds ${maxFrontmatterBytes} bytes`);
  }
  const document = parseDocument(match[1], {
    logLevel: 'silent',
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length === 0) {
    let parsed;
    try {
      parsed = document.toJS({ maxAliasCount: 0 }) ?? {};
    } catch (error) {
      throw new Error(`invalid Markdown frontmatter in ${path}: ${stableYamlDiagnostic(error)}`);
    }
    if (!isPlainObject(parsed))
      throw new Error(`Markdown frontmatter in ${path} must be an object`);
    const frontmatter = sanitizeUntrustedValue(parsed).value;
    return safeMarkdown({
      body: content.slice(match[0].length),
      frontmatter,
      frontmatterMode: 'yaml',
    });
  }
  if (document.errors.some((error) => /duplicate|unique/i.test(error.message))) {
    throw new Error(
      `invalid Markdown frontmatter in ${path}: ${stableYamlDiagnostic(document.errors[0])}`
    );
  }
  const frontmatter = sanitizeUntrustedValue(parseLooseFrontmatter(match[1], path)).value;
  return safeMarkdown({
    body: content.slice(match[0].length),
    frontmatter,
    frontmatterMode: 'claude-loose',
    frontmatterWarning: stableYamlDiagnostic(document.errors[0]),
  });
}

function parseLooseFrontmatter(source, path) {
  const frontmatter = {};
  const seen = new Set();
  let currentKey;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (pair) {
      currentKey = pair[1];
      if (seen.has(currentKey)) {
        throw new Error(
          `duplicate Markdown frontmatter key in ${path}: LOOSE_DUPLICATE_KEY at line ${index + 2}, column 1`
        );
      }
      seen.add(currentKey);
      frontmatter[currentKey] = looseScalar(pair[2]);
      continue;
    }
    const listItem = /^\s{2}-\s*(.*)$/.exec(line);
    if (listItem && currentKey && frontmatter[currentKey] === '') {
      frontmatter[currentKey] = [unquote(listItem[1].trim())];
      continue;
    }
    if (listItem && currentKey && Array.isArray(frontmatter[currentKey])) {
      frontmatter[currentKey].push(unquote(listItem[1].trim()));
      continue;
    }
    if (/^\s+/.test(line)) {
      throw new Error(
        `unsupported nested Markdown frontmatter in ${path}: LOOSE_UNSUPPORTED_NESTING at line ${index + 2}, column ${line.search(/\S/) + 1}`
      );
    }
    throw new Error(
      `invalid Markdown frontmatter line in ${path}: LOOSE_INVALID_LINE at line ${index + 2}, column 1`
    );
  }
  return frontmatter;
}

function stableYamlDiagnostic(error) {
  const code = /^[A-Z][A-Z0-9_]+$/.test(error?.code) ? error.code : 'YAML_PARSE_ERROR';
  const position = error?.linePos?.[0];
  const line = Number.isInteger(position?.line) ? position.line + 1 : 1;
  const column = Number.isInteger(position?.col) ? position.col : 1;
  return `${code} at line ${line}, column ${column}`;
}

function safeMarkdown(parsed) {
  const body = sanitizeUntrustedText(parsed.body);
  return {
    ...parsed,
    body: body.value,
    ...(body.findings.length > 0 ? { secretStatus: { $maudeSecret: 'literal-rejected' } } : {}),
  };
}

function validateMcpServer(server, path, name) {
  if (!isPlainObject(server)) throw new Error(`MCP server ${name} in ${path} must be an object`);
  const type = server.type ?? (typeof server.command === 'string' ? 'stdio' : undefined);
  if (server.disabled) {
    if (typeof server.url === 'string') {
      sanitizeRemoteMcpUrl(server, path, name, type ?? 'remote');
    }
    return;
  }
  if (type === 'stdio') {
    if (typeof server.command !== 'string' || server.command.length === 0) {
      throw new Error(`STDIO MCP server ${name} in ${path} requires command`);
    }
    if (
      server.args &&
      (!Array.isArray(server.args) ||
        server.args.some(
          (arg) =>
            typeof arg !== 'string' &&
            !(arg && typeof arg === 'object' && arg.$maudeSecret === 'literal-rejected')
        ))
    ) {
      throw new Error(`STDIO MCP server ${name} in ${path} has invalid args`);
    }
    return;
  }
  if (type === 'http' || type === 'sse') {
    sanitizeRemoteMcpUrl(server, path, name, type);
    return;
  }
  throw new Error(`MCP server ${name} in ${path} has unsupported type`);
}

function sanitizeRemoteMcpUrl(server, path, name, type) {
  let url;
  try {
    url = new URL(server.url);
  } catch {
    throw new Error(`${type.toUpperCase()} MCP server ${name} in ${path} has invalid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${type.toUpperCase()} MCP server ${name} in ${path} has unsafe URL`);
  }
  const rawQuery = url.search.slice(1);
  if (rawQuery) {
    const components = rawQuery.split('&').map((component) => {
      const separator = component.indexOf('=');
      const rawKey = separator === -1 ? component : component.slice(0, separator);
      const rawValue = separator === -1 ? undefined : component.slice(separator + 1);
      const key = sanitizeUrlQueryComponent(rawKey);
      const value = rawValue === undefined ? undefined : sanitizeUrlQueryComponent(rawValue);
      if (key.rejected || value?.rejected) {
        server.secretStatus = { $maudeSecret: 'literal-rejected' };
      }
      return value === undefined ? key.value : `${key.value}=${value.value}`;
    });
    url.search = components.join('&');
  }
  const fragment = decodeUrlSegment(url.hash.slice(1));
  if (fragment && !isCredentialReference(fragment)) {
    url.hash = encodeURIComponent('[REDACTED_LITERAL_SECRET]');
    server.secretStatus = { $maudeSecret: 'literal-rejected' };
  }
  const pathSegments = url.pathname.split('/');
  for (let index = 0; index < pathSegments.length; index += 1) {
    const decoded = decodeUrlSegment(pathSegments[index]);
    if (!classifyCredential(`https://credential.invalid/${decoded}`)) continue;
    pathSegments[index] = encodeURIComponent('[REDACTED_LITERAL_SECRET]');
    server.secretStatus = { $maudeSecret: 'literal-rejected' };
  }
  url.pathname = pathSegments.join('/');
  server.url = url.toString();
}

function sanitizeUrlQueryComponent(component) {
  if (!component) return { rejected: false, value: component };
  const decoded = decodeUrlQueryComponent(component);
  if (decoded !== undefined && isCredentialReference(decoded)) {
    return { rejected: false, value: component };
  }
  return {
    rejected: true,
    value: encodeURIComponent('[REDACTED_LITERAL_SECRET]'),
  };
}

function decodeUrlQueryComponent(component) {
  try {
    return decodeURIComponent(component.replaceAll('+', ' '));
  } catch {
    return undefined;
  }
}

function sanitizeMcpServer(server) {
  let rejected = false;
  for (const field of ['env', 'headers']) {
    if (server[field] === undefined) continue;
    if (!isPlainObject(server[field])) throw new Error(`MCP server ${field} must be an object`);
    for (const [key, value] of Object.entries(server[field])) {
      if (typeof value !== 'string') continue;
      const requiresReference = field === 'env' || classifyCredential(value, { key });
      if (requiresReference && !isCredentialReference(value)) {
        server[field][key] = '[REDACTED_LITERAL_SECRET]';
        rejected = true;
      }
    }
  }
  if (Array.isArray(server.args)) {
    for (let index = 0; index < server.args.length; index += 1) {
      const value = server.args[index];
      if (value?.$maudeSecret === 'literal-rejected') {
        rejected = true;
        continue;
      }
      if (typeof value !== 'string') continue;
      const splitKind = mcpSplitArgumentKind(value);
      if (splitKind) {
        const next = server.args[index + 1];
        if (typeof next === 'string' && mcpArgumentValueRejected(splitKind, next)) {
          server.args[index + 1] = '[REDACTED_LITERAL_SECRET]';
          rejected = true;
        }
        continue;
      }
      const concatenated = mcpConcatenatedArgument(value);
      if (concatenated && mcpArgumentValueRejected(concatenated.kind, concatenated.value)) {
        server.args[index] = '[REDACTED_LITERAL_SECRET]';
        rejected = true;
      }
    }
  }
  if (rejected) server.secretStatus = { $maudeSecret: 'literal-rejected' };
}

function mcpSplitArgumentKind(value) {
  if (value === '--env' || value === '-e') return 'env';
  if (value === '--header' || value === '-H') return 'header';
  return undefined;
}

function mcpConcatenatedArgument(value) {
  if (value.startsWith('--env=')) return { kind: 'env', value: value.slice('--env='.length) };
  if (value.startsWith('-e') && value.length > 2) return { kind: 'env', value: value.slice(2) };
  if (value.startsWith('--header=')) {
    return { kind: 'header', value: value.slice('--header='.length) };
  }
  if (value.startsWith('-H') && value.length > 2) return { kind: 'header', value: value.slice(2) };
  return undefined;
}

function mcpArgumentValueRejected(kind, value) {
  if (kind === 'env') {
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(value);
    return Boolean(
      assignment && sanitizeConfiguredEnvironmentValue(assignment[1], assignment[2]).rejected
    );
  }
  const header = /^([^:]+):\s*(.*)$/.exec(value);
  return Boolean(
    header &&
      classifyCredential(header[2].trim(), { key: header[1] }) &&
      !isCredentialReference(header[2].trim())
  );
}

async function inspectInstructionImport(context, importPath, sourcePath, allowedRoot) {
  if (isAbsolute(importPath) || importPath.startsWith('~')) {
    return {
      value: { contained: false, reason: 'absolute and home-relative imports are forbidden' },
    };
  }
  const candidate = resolve(dirname(sourcePath), importPath);
  if (!isWithin(candidate, allowedRoot)) {
    return { value: { contained: false, reason: 'import escapes its allowed root' } };
  }
  const canonicalRoot = await realpath(allowedRoot);
  const relativePath = relative(canonicalRoot, candidate).replaceAll(sep, '/');
  let source;
  try {
    source = await readPinnedRelativeFile(context, canonicalRoot, relativePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { value: { contained: false, reason: 'import is missing' } };
    }
    if (['ELOOP', 'ENOTDIR'].includes(error.code)) {
      return { value: { contained: false, reason: 'instruction import path contains a symlink' } };
    }
    if (error.code === 'MAUDE_NOT_REGULAR') {
      return { value: { contained: false, reason: 'instruction import is not a regular file' } };
    }
    throw error;
  }
  const sanitized = sanitizeUntrustedText(source.bytes.toString('utf8'));
  const sourceHash = sha256(
    `${relativePath}\0${source.identity.dev}:${source.identity.ino}\0${source.hash}`
  );
  return {
    contributor: contributor(candidate, 'import', 0, sourceHash),
    path: candidate,
    sourceHash,
    value: {
      body: sanitized.value,
      contained: true,
      relativePath,
      sourceIdentity: {
        device: String(source.identity.dev),
        inode: String(source.identity.ino),
      },
      ...(sanitized.findings.length > 0
        ? { secretStatus: { $maudeSecret: 'literal-rejected' } }
        : {}),
    },
  };
}

async function readPinnedRelativeFile(context, root, relativePath) {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`instruction import has invalid canonical identity: ${relativePath}`);
  }
  if (parts.length - 1 > context.limits.maxDepth) {
    throw new Error(`${relativePath} exceeds maximum nesting depth ${context.limits.maxDepth}`);
  }
  const pins = [];
  let fileHandle;
  try {
    let parent = await pinImportDirectory(root, root);
    pins.push(parent);
    await context.failpoint('after-instruction-import-parent-pin', {
      depth: 0,
      relativePath,
    });
    for (let index = 0; index < parts.length - 1; index += 1) {
      const logicalPath = join(root, ...parts.slice(0, index + 1));
      parent = await pinImportDirectory(join(parent.descriptorPath, parts[index]), logicalPath);
      pins.push(parent);
      await context.failpoint('after-instruction-import-parent-pin', {
        depth: index + 1,
        relativePath,
      });
    }

    const descriptorPath = join(parent.descriptorPath, parts.at(-1));
    fileHandle = await open(
      descriptorPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
    );
    const before = await fileHandle.stat();
    if (!before.isFile()) {
      const error = new Error(`instruction import is not a regular file: ${relativePath}`);
      error.code = 'MAUDE_NOT_REGULAR';
      throw error;
    }
    if (before.size > context.limits.maxFileBytes) {
      throw new Error(`${join(root, relativePath)} exceeds ${context.limits.maxFileBytes} bytes`);
    }
    const bytes = await fileHandle.readFile();
    const after = await fileHandle.stat();
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      bytes.length !== before.size
    ) {
      throw new Error(`instruction import changed during descriptor read: ${relativePath}`);
    }
    context.files += 1;
    context.totalBytes += bytes.length;
    if (context.files > context.limits.maxFiles) {
      throw new Error(`Claude source exceeds ${context.limits.maxFiles} files`);
    }
    if (context.totalBytes > context.limits.maxTotalBytes) {
      throw new Error(`Claude source exceeds ${context.limits.maxTotalBytes} total bytes`);
    }
    return { bytes, hash: sha256(bytes), identity: { dev: before.dev, ino: before.ino } };
  } finally {
    await fileHandle?.close();
    await Promise.all(pins.reverse().map((pin) => pin.handle.close()));
  }
}

async function pinImportDirectory(descriptorPath, logicalPath) {
  const handle = await open(
    descriptorPath,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0)
  );
  try {
    const identity = await handle.stat();
    if (!identity.isDirectory()) {
      const error = new Error(`instruction import parent is not a directory: ${logicalPath}`);
      error.code = 'ENOTDIR';
      throw error;
    }
    let pinnedPath;
    if (process.platform === 'darwin') {
      pinnedPath = `/.vol/${identity.dev}/${identity.ino}`;
    } else if (process.platform === 'linux') {
      pinnedPath = `/proc/self/fd/${handle.fd}`;
    } else {
      throw new Error(
        `platform cannot safely read instruction imports descriptor-relative: ${process.platform}`
      );
    }
    const pinnedIdentity = await stat(pinnedPath);
    if (
      !pinnedIdentity.isDirectory() ||
      pinnedIdentity.dev !== identity.dev ||
      pinnedIdentity.ino !== identity.ino
    ) {
      throw new Error(`platform cannot resolve pinned instruction import parent: ${logicalPath}`);
    }
    return { descriptorPath: pinnedPath, handle };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

function decodeUrlSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function looseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((part) => unquote(part.trim()))
      .filter(Boolean);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return unquote(value);
}

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function readJsonIfPresent(context, path, allowedRoot) {
  const source = await readTextIfPresent(context, path, allowedRoot);
  if (!source) return undefined;
  try {
    const parsed = JSON.parse(source.value);
    if (!isPlainObject(parsed)) throw new Error('root value must be an object');
    const sanitized = sanitizeUntrustedValue(parsed, {
      maxDepth: context.limits.maxStructureDepth,
      maxNodes: context.limits.maxStructureNodes,
    });
    return {
      ...source,
      findings: sanitized.findings,
      hash: sha256(JSON.stringify(sanitized.value)),
      value: sanitized.value,
    };
  } catch (error) {
    throw new Error(`invalid JSON in ${path}: ${error.message}`);
  }
}

async function readTextIfPresent(context, path, allowedRoot) {
  if (!(await pathExists(path))) return undefined;
  return readText(context, path, allowedRoot);
}

async function readText(context, path, allowedRoot) {
  const source = await readBytes(context, path, allowedRoot);
  return { hash: source.hash, value: source.bytes.toString('utf8') };
}

async function readBytes(context, path, allowedRoot, rejectSymlink = false) {
  const sourceInfo = await lstat(path);
  if (rejectSymlink && sourceInfo.isSymbolicLink()) {
    throw new Error(`Claude source cannot be a symlink: ${path}`);
  }
  const canonical = await realpath(path);
  const canonicalRoot = await realpath(allowedRoot);
  assertWithin(canonical, canonicalRoot, sourceInfo.isSymbolicLink() ? 'symlink source' : 'source');
  const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`Claude source is not a file: ${path}`);
    if (info.size > context.limits.maxFileBytes) {
      throw new Error(`${path} exceeds ${context.limits.maxFileBytes} bytes`);
    }
    context.files += 1;
    context.totalBytes += info.size;
    if (context.files > context.limits.maxFiles) {
      throw new Error(`Claude source exceeds ${context.limits.maxFiles} files`);
    }
    if (context.totalBytes > context.limits.maxTotalBytes) {
      throw new Error(`Claude source exceeds ${context.limits.maxTotalBytes} total bytes`);
    }
    const bytes = await handle.readFile();
    const rechecked = await realpath(path);
    if (rechecked !== canonical) throw new Error(`Claude source changed during read: ${path}`);
    return { bytes, hash: sha256(bytes) };
  } finally {
    await handle.close();
  }
}

async function inventorySkillDirectory(
  context,
  directory,
  allowedRoot,
  depth = 0,
  skillRoot = directory
) {
  if (depth > context.limits.maxDepth) {
    throw new Error(`${directory} exceeds maximum nesting depth ${context.limits.maxDepth}`);
  }
  const info = await lstat(directory);
  if (info.isSymbolicLink())
    throw new Error(`skill directory cannot contain symlink: ${directory}`);
  if (!info.isDirectory()) throw new Error(`skill root is not a directory: ${directory}`);
  const canonicalDirectoryPath = await realpath(directory);
  const canonicalRoot = await realpath(allowedRoot);
  assertWithin(canonicalDirectoryPath, canonicalRoot, 'skill directory');
  const files = [];
  for (const entry of (await readdir(canonicalDirectoryPath, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    context.entries += 1;
    if (context.entries > context.limits.maxEntries) {
      throw new Error(`Claude source exceeds ${context.limits.maxEntries} directory entries`);
    }
    const path = join(canonicalDirectoryPath, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`skill directory cannot contain symlink: ${path}`);
    if (entry.isDirectory()) {
      const nested = await inventorySkillDirectory(
        context,
        path,
        canonicalRoot,
        depth + 1,
        skillRoot
      );
      files.push(...nested.files);
      continue;
    }
    if (!entry.isFile()) throw new Error(`skill directory contains non-regular file: ${path}`);
    if (isSkillRuntimeCacheFile(entry.name)) continue;
    const source = await readBytes(context, path, canonicalRoot, true);
    files.push({
      bytes: source.bytes,
      hash: source.hash,
      path: relative(skillRoot, path).replaceAll(sep, '/'),
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const sourceClosure = files.map(({ path, hash }) => `${path}\0${hash}`).join('\n');
  return { files, treeHash: sha256(sourceClosure) };
}

function isSkillRuntimeCacheFile(name) {
  return name === '.DS_Store' || name.endsWith('.pyc') || name.endsWith('.pyo');
}

async function markdownFiles(context, directory, allowedRoot, recursive) {
  return listFiles(context, directory, allowedRoot, {
    recursive,
    matches: (name) => name.endsWith('.md') && !name.startsWith('_'),
  });
}

async function namedFiles(context, directory, allowedRoot, targetName) {
  return listFiles(context, directory, allowedRoot, {
    recursive: true,
    matches: (name) => name === targetName,
  });
}

async function listFiles(
  context,
  directory,
  allowedRoot,
  { recursive, matches },
  depth = 0,
  visited = new Set()
) {
  if (!(await pathExists(directory))) return [];
  if (depth > context.limits.maxDepth) {
    throw new Error(`${directory} exceeds maximum nesting depth ${context.limits.maxDepth}`);
  }
  const directoryInfo = await lstat(directory);
  const canonicalDirectoryPath = await realpath(directory);
  const canonicalRoot = await realpath(allowedRoot);
  assertWithin(
    canonicalDirectoryPath,
    canonicalRoot,
    directoryInfo.isSymbolicLink() ? 'symlink directory' : 'directory'
  );
  if (visited.has(canonicalDirectoryPath)) return [];
  visited.add(canonicalDirectoryPath);
  const resolvedDirectoryInfo = directoryInfo.isSymbolicLink()
    ? await stat(canonicalDirectoryPath)
    : directoryInfo;
  if (!resolvedDirectoryInfo.isDirectory()) {
    throw new Error(`Claude asset root is not a directory: ${directory}`);
  }
  const entries = await readdir(canonicalDirectoryPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    context.entries += 1;
    if (context.entries > context.limits.maxEntries) {
      throw new Error(`Claude source exceeds ${context.limits.maxEntries} directory entries`);
    }
    const path = join(canonicalDirectoryPath, entry.name);
    if (entry.isSymbolicLink()) {
      const canonicalPath = await realpath(path);
      if (!isWithin(canonicalPath, canonicalRoot)) {
        throw new Error(`symlink source escapes its allowed root: ${path}`);
      }
      const resolvedInfo = await stat(canonicalPath);
      if (recursive && resolvedInfo.isDirectory()) {
        files.push(
          ...(await listFiles(
            context,
            canonicalPath,
            canonicalRoot,
            { recursive, matches },
            depth + 1,
            visited
          ))
        );
        continue;
      }
      throw new Error(`Claude asset cannot contain symlink: ${path}`);
    }
    if (entry.isFile() && matches(entry.name)) files.push(path);
    if (recursive && entry.isDirectory()) {
      files.push(
        ...(await listFiles(
          context,
          path,
          canonicalRoot,
          { recursive, matches },
          depth + 1,
          visited
        ))
      );
    }
  }
  return files;
}

async function canonicalDirectory(path, label) {
  const absolute = resolve(path);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw new Error(`${label} cannot be a symlink: ${absolute}`);
  if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${absolute}`);
  return realpath(absolute);
}

async function existingCanonicalDirectories(paths) {
  const directories = [];
  for (const path of paths) {
    if (!(await pathExists(path))) continue;
    directories.push(await canonicalDirectory(path, 'approved plugin root'));
  }
  return directories;
}

function isWithin(path, root) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function assertWithin(path, root, label) {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} path escapes its allowed root: ${path}`);
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
