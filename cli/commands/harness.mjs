import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { lstat, mkdir, readFile, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { parse as parseToml } from '@decimalturn/toml-patch';

import { parseArgs } from '../lib/argv.mjs';
import { assertTargetVersion } from '../lib/harness/compatibility.mjs';
import { discoverClaude } from '../lib/harness/discover-claude.mjs';
import {
  adoptManagedPath,
  assertAllowedPath,
  createManifest,
  hashFile,
  manifestPaths,
  RemovalInterruptedError,
  readFileNoFollow,
  readManifest,
  writeManifest,
} from '../lib/harness/managed-state.mjs';
import { createEnvironmentIR, sha256 } from '../lib/harness/model.mjs';
import { containsRejectedLiteral, sanitizeUntrustedValue } from '../lib/harness/secrets.mjs';
import { CODEX_TARGET_VERSION, lowerCodex } from '../lib/harness/targets/codex.mjs';
import {
  lowerOpenCode,
  OPENCODE_TARGET_VERSION,
  smokeOpenCodeConfig,
} from '../lib/harness/targets/opencode.mjs';
import {
  LockError,
  runManagedTransaction,
  TransactionInterruptedError,
} from '../lib/harness/transaction.mjs';

export const EXIT_CODES = Object.freeze({
  clean: 0,
  drift: 1,
  usage: 2,
  strict: 3,
  ownership: 4,
  source: 5,
  target: 6,
  interrupted: 7,
});

const TARGETS = new Set(['opencode', 'codex']);
const VERBS = new Set(['migrate', 'sync', 'check', 'diff', 'status', 'adopt', 'remove']);
const SAFE_OPENCODE_DEFAULTS = {
  permission: {
    bash: 'ask',
    edit: 'ask',
    external_directory: 'ask',
    webfetch: 'ask',
  },
  tools: { task: false, websearch: false },
};

export async function run({ args, io = defaultIo() }) {
  try {
    return await runHarness(args, io);
  } catch (error) {
    const code = classifyError(error);
    write(io.stderr, `maude harness: ${error.message}\n`);
    process.exitCode = code;
    return { error: error.message, exitCode: code };
  }
}

async function runHarness(args, io) {
  const { flags, positional } = parseArgs(args, {
    booleans: ['global', 'help', 'json', 'strict', 'yes'],
  });
  const verb = positional[0];
  if (!verb || verb === 'help' || flags.help) {
    write(io.stdout, usage());
    return result(EXIT_CODES.clean);
  }
  if (!VERBS.has(verb)) throw usageError(`unknown verb "${verb}"`);
  if (positional.length > 1) throw usageError(`unexpected argument "${positional[1]}"`);

  const scope = resolveScope(flags);
  const selectedTargets = resolveTargets(verb, flags);
  assertDiagnosticOverrides(verb, scope);
  if (verb === 'migrate' && flags.from !== 'claude') {
    throw sourceError('migrate requires --from claude');
  }
  rejectUnknownFlags(flags, verb);

  const context = await createContext({ flags, scope, selectedTargets });
  if (verb === 'status') return await status(context, flags, io);
  if (verb === 'adopt') return await adopt(context, flags, io);
  if (verb === 'remove') return await remove(context, flags, io);

  const projection = await project(context);
  const preview = await buildPreview(context, projection);
  const strictFailure = flags.strict && hasStrictFailure(projection.reports);
  const securityFailure = hasSecurityFailure(projection.reports);

  if (verb === 'check' || verb === 'diff') {
    printPreview(preview, projection, flags, io);
    return finish(strictFailure ? EXIT_CODES.strict : preview.drift ? EXIT_CODES.drift : 0);
  }

  printPreview(preview, projection, flags, io);
  if (securityFailure) {
    throw strictError('unsupported or unproven security capability blocks mutation');
  }
  if (preview.conflicts.length > 0) throw ownershipError(preview.conflicts[0].reason);
  if (!preview.drift) return finish(EXIT_CODES.clean);

  if (verb === 'migrate' && !flags.yes && !(await confirmMutation(io, 'Apply this migration?'))) {
    return finish(EXIT_CODES.drift);
  }
  await ensureTargetRoots(context.targetLayouts);
  await commitProjection(context, projection);
  if (!flags.json) write(io.stdout, 'Harness projection committed.\n');
  return finish(EXIT_CODES.clean);
}

function resolveScope(flags) {
  const global = flags.global === true;
  const project = typeof flags.project === 'string' && flags.project.length > 0;
  if (global === project)
    throw usageError('select exactly one scope: --global or --project <root>');
  return project
    ? { kind: 'project', projectRoot: resolve(flags.project) }
    : { kind: 'global', projectRoot: process.cwd() };
}

function resolveTargets(verb, flags) {
  if (verb === 'status') {
    if (flags.targets || flags.target) throw usageError('status reads all owned targets');
    return [];
  }
  if (verb === 'adopt' || verb === 'remove') {
    if (!flags.target || flags.targets) throw usageError(`${verb} requires exactly one --target`);
    validateTarget(flags.target);
    return [flags.target];
  }
  if (!flags.targets || flags.target) throw usageError(`${verb} requires --targets <list>`);
  const targets = [
    ...new Set(
      String(flags.targets)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
  if (targets.length === 0) throw targetError('target list is empty');
  for (const target of targets) validateTarget(target);
  return targets.sort();
}

function validateTarget(target) {
  if (!TARGETS.has(target)) throw targetError(`invalid target "${target}"`);
}

function rejectUnknownFlags(flags, verb) {
  const common = new Set(['global', 'help', 'json', 'project']);
  const byVerb = {
    adopt: ['path', 'target', 'yes'],
    check: ['strict', 'targets'],
    diff: ['targets'],
    migrate: ['from', 'targets', 'yes'],
    remove: ['target', 'yes'],
    status: [],
    sync: ['targets'],
  };
  const allowed = new Set([...common, ...byVerb[verb]]);
  const unknown = Object.keys(flags).find((flag) => !allowed.has(flag));
  if (unknown) throw usageError(`unsupported option --${unknown} for ${verb}`);
}

async function createContext({ flags, scope, selectedTargets }) {
  await assertDirectory(scope.projectRoot, 'project root');
  const home = resolve(process.env.HOME || homedir());
  await assertDirectory(home, 'home');
  const sourceHome = resolve(process.env.MAUDE_HARNESS_SOURCE_HOME || home);
  await assertDirectory(sourceHome, 'Claude source home');
  const allowedPluginRoots = String(process.env.MAUDE_HARNESS_ALLOWED_PLUGIN_ROOTS || '')
    .split(delimiter)
    .filter(Boolean)
    .map((path) => resolve(path));
  const stateRoot = resolve(
    process.env.MAUDE_HARNESS_STATE_ROOT || join(home, '.config', 'maude', 'harness')
  );
  const paths = await manifestPaths({
    projectRoot: scope.projectRoot,
    scope: scope.kind,
    stateRoot,
  });
  const manifest = await readManifest(paths);
  const targetLayouts = Object.fromEntries(
    selectedTargets.map((target) => [target, targetLayout(target, scope, home)])
  );
  return {
    allowedPluginRoots,
    flags,
    home,
    manifest,
    paths,
    scope,
    selectedTargets,
    sourceHome,
    targetLayouts,
  };
}

function targetLayout(target, scope, home) {
  const sourceProjectRoot = scope.projectRoot;
  const targetProjectRoot =
    scope.kind === 'project'
      ? resolve(process.env.MAUDE_HARNESS_PROJECT_TARGET_ROOT || sourceProjectRoot)
      : sourceProjectRoot;
  if (target === 'opencode') {
    const root =
      scope.kind === 'global'
        ? join(resolve(process.env.XDG_CONFIG_HOME || join(home, '.config')), 'opencode')
        : targetProjectRoot;
    return {
      allowRoots: scope.kind === 'global' ? [root] : [targetProjectRoot],
      configPath: join(root, 'opencode.json'),
      outputRoot: scope.kind === 'global' ? root : join(targetProjectRoot, '.opencode'),
      roots:
        scope.kind === 'global'
          ? [root]
          : [targetProjectRoot, join(targetProjectRoot, '.opencode')],
      target,
    };
  }
  const codexHome = resolve(process.env.CODEX_HOME || join(home, '.codex'));
  const projectConfigRoot = join(targetProjectRoot, '.codex');
  const userSkillsRoot = join(home, '.agents', 'skills');
  const projectSkillsRoot = join(targetProjectRoot, '.agents', 'skills');
  const outputRoot =
    scope.kind === 'global' ? join(codexHome, 'maude') : join(projectConfigRoot, 'maude');
  const allowRoots =
    scope.kind === 'global' ? [codexHome, join(home, '.agents')] : [targetProjectRoot];
  return {
    allowRoots,
    outputRoot,
    projectConfigPath: join(projectConfigRoot, 'config.toml'),
    projectRoot: sourceProjectRoot,
    projectSkillsRoot,
    roots:
      scope.kind === 'global'
        ? [codexHome, outputRoot, userSkillsRoot]
        : [projectConfigRoot, outputRoot, projectSkillsRoot],
    target,
    userConfigPath: join(codexHome, 'config.toml'),
    userSkillsRoot,
  };
}

async function project(context) {
  let discovered;
  try {
    discovered = await discoverClaude({
      allowedPluginRoots: context.allowedPluginRoots,
      home: context.sourceHome,
      projectRoot: context.scope.projectRoot,
    });
  } catch (error) {
    throw sourceError(error.message, error);
  }
  const baseIr = createEnvironmentIR(
    discovered.items.filter((item) => item.scope === context.scope.kind)
  );
  const targetOverrides = Object.fromEntries(
    await Promise.all(
      context.selectedTargets.map(async (target) => [
        target,
        await readTargetOverride(context, target),
      ])
    )
  );
  const overrideHashes = Object.fromEntries(
    Object.entries(targetOverrides).map(([target, override]) => [
      `target-override:${target}`,
      sha256(JSON.stringify(override)),
    ])
  );
  const ir = {
    ...baseIr,
    generationHash: sha256(`${baseIr.serialized}\n${JSON.stringify(overrideHashes)}`),
  };
  const outputs = [];
  const preservedPaths = [];
  const reports = [];
  const observedVersions = {};
  for (const target of context.selectedTargets) {
    const layout = context.targetLayouts[target];
    const observed = observeTargetVersion(target);
    observedVersions[target] = observed;
    try {
      assertTargetVersion(target, observed);
    } catch (error) {
      throw targetError(error.message, error);
    }
    const lowered =
      target === 'opencode'
        ? await lowerOpenCode(ir, {
            configPath: layout.configPath,
            defaultConfig: await openCodeDefaults(context),
            existingConfig: await readJsonIfPresent(layout.configPath),
            observedTargetVersion: observed || OPENCODE_TARGET_VERSION,
            outputRoot: layout.outputRoot,
            overrides: targetOverrides.opencode,
          })
        : await lowerCodex(ir, {
            existingProjectToml: await readTextIfPresent(layout.projectConfigPath),
            existingUserToml: await readTextIfPresent(layout.userConfigPath),
            observedTargetVersion: observed || CODEX_TARGET_VERSION,
            outputRoot: layout.outputRoot,
            projectConfigPath: layout.projectConfigPath,
            projectRoot: layout.projectRoot,
            projectSkillsRoot: layout.projectSkillsRoot,
            projectTrusted:
              context.scope.kind === 'project' &&
              codexProjectTrusted(
                await readTextIfPresent(layout.userConfigPath),
                layout.projectRoot
              ),
            overrides: targetOverrides.codex,
            trustedHookHashes: targetOverrides.codex?.trusted_hook_hashes ?? [],
            userConfigPath: layout.userConfigPath,
            userSkillsRoot: layout.userSkillsRoot,
          });
    const scopedOutputs = selectScopedOutputs(target, context.scope.kind, lowered.outputs, layout);
    await validateOutputs(scopedOutputs);
    outputs.push(...scopedOutputs);
    preservedPaths.push(...(lowered.preservedPaths ?? []));
    reports.push(lowered.report);
  }
  return {
    ir,
    observedVersions,
    outputs: outputs.sort(byPath),
    overrideHashes,
    preservedPaths: [...new Set(preservedPaths)].sort(),
    reports,
  };
}

async function readTargetOverride(context, target) {
  if (context.scope.kind !== 'project') return {};
  const path = join(
    context.scope.projectRoot,
    '.maude',
    'targets',
    target === 'opencode' ? 'opencode.json' : 'codex.toml'
  );
  const text = await readTextIfPresent(path);
  if (!text) return {};
  let value;
  try {
    value = target === 'opencode' ? JSON.parse(text) : parseToml(text);
  } catch (error) {
    throw sourceError(`invalid ${target} target override: ${error.message}`, error);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw sourceError(`${target} target override must be an object`);
  }
  const allowed =
    target === 'opencode'
      ? new Set(['acknowledge', 'exclude', 'permission'])
      : new Set([
          'acknowledge',
          'approval_policy',
          'exclude',
          'sandbox_mode',
          'trusted_hook_hashes',
        ]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw sourceError(`unsupported ${target} target override key ${unknown}`);
  for (const key of ['acknowledge', 'exclude', 'trusted_hook_hashes']) {
    if (value[key] !== undefined && !isStringArray(value[key])) {
      throw sourceError(`${target} target override ${key} must be an array of strings`);
    }
  }
  const sanitized = sanitizeUntrustedValue(value);
  if (containsRejectedLiteral(sanitized.value)) {
    throw sourceError(`${target} target override contains a literal credential`);
  }
  return sanitized.value;
}

function codexProjectTrusted(userToml, projectRoot) {
  if (!userToml) return false;
  let config;
  try {
    config = parseToml(userToml);
  } catch (error) {
    throw targetError(`invalid Codex user config: ${error.message}`, error);
  }
  return config.projects?.[resolve(projectRoot)]?.trust_level === 'trusted';
}

async function openCodeDefaults(context) {
  if (process.env.MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF === '1') return SAFE_OPENCODE_DEFAULTS;
  const smoke = smokeOpenCodeConfig({
    cwd: context.scope.projectRoot,
    env: targetEnvironment(context),
    pure: true,
  });
  return smoke.available ? smoke.config : SAFE_OPENCODE_DEFAULTS;
}

function selectScopedOutputs(target, scope, outputs, layout) {
  if (target !== 'codex') return outputs;
  const excludedConfig = scope === 'global' ? layout.projectConfigPath : layout.userConfigPath;
  return outputs.filter((output) => output.path !== excludedConfig);
}

async function validateOutputs(outputs) {
  const paths = new Set();
  for (const output of outputs) {
    if (paths.has(output.path)) throw targetError(`duplicate target output ${output.path}`);
    paths.add(output.path);
    try {
      if (output.metadata.kind === 'plugin') {
        const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], {
          encoding: 'utf8',
          input: output.contents,
        });
        if (checked.status !== 0) {
          throw new Error(checked.stderr || checked.stdout || 'module syntax check failed');
        }
      } else {
        await output.validate?.(output.contents, output.path);
      }
    } catch (error) {
      throw targetError(`validation failed for ${output.path}: ${error.message}`, error);
    }
  }
}

async function buildPreview(context, projection) {
  const owned = new Map((context.manifest?.outputs ?? []).map((output) => [output.path, output]));
  const changed = [];
  const conflicts = [];
  for (const output of projection.outputs) {
    await assertAllowedPath(output.path, context.targetLayouts[output.metadata.target].allowRoots, {
      allowMissingRoots: true,
    });
    const prior = owned.get(output.path);
    const currentHash = await optionalHash(output.path);
    const desiredHash = sha256(output.contents);
    if (prior && currentHash !== prior.hash) {
      conflicts.push({
        path: output.path,
        reason: `managed output was externally modified: ${output.path}`,
      });
    } else if (!prior && currentHash && currentHash !== desiredHash) {
      conflicts.push({
        path: output.path,
        reason: `unmanaged target collision requires adoption: ${output.path}`,
      });
    } else if (currentHash !== desiredHash) {
      changed.push({
        action: currentHash ? 'update' : 'create',
        path: output.path,
        target: output.metadata.target,
      });
    }
    owned.delete(output.path);
  }
  for (const path of projection.preservedPaths ?? []) {
    const prior = owned.get(path);
    if (!prior) continue;
    const currentHash = await optionalHash(path);
    if (currentHash !== prior.hash) {
      conflicts.push({
        path,
        reason: `managed output became a native source after external modification: ${path}`,
      });
    } else {
      changed.push({ action: 'release-ownership', path, target: prior.target });
    }
    owned.delete(path);
  }
  for (const stale of owned.values()) {
    if (context.selectedTargets.includes(stale.target)) {
      const currentHash = await optionalHash(stale.path);
      if (currentHash !== stale.hash) {
        conflicts.push({
          path: stale.path,
          reason: `stale managed output was externally modified: ${stale.path}`,
        });
      } else {
        changed.push({ action: 'remove-stale', path: stale.path, target: stale.target });
      }
    }
  }
  return { changed, conflicts, drift: changed.length > 0 || conflicts.length > 0 };
}

async function commitProjection(context, projection) {
  const priorOutputs = new Map(
    (context.manifest?.outputs ?? []).map((output) => [output.path, output])
  );
  const requested = new Set(context.selectedTargets);
  const transactionOutputs = [];
  for (const output of projection.outputs) {
    const prior = priorOutputs.get(output.path);
    if (!prior && (await optionalHash(output.path)) === sha256(output.contents)) continue;
    transactionOutputs.push({
      ...output,
      expectedHash: prior?.hash,
      metadata: {
        ...output.metadata,
        ...(prior?.ownership === 'adopted'
          ? {
              backupHash: prior.backupHash,
              backupPath: prior.backupPath,
              originalMode: prior.originalMode,
              ownership: 'adopted',
            }
          : { ownership: 'generated' }),
      },
    });
  }
  for (const stale of priorOutputs.values()) {
    if (
      !requested.has(stale.target) ||
      projection.outputs.some((output) => output.path === stale.path)
    ) {
      continue;
    }
    if ((projection.preservedPaths ?? []).includes(stale.path)) continue;
    transactionOutputs.push(
      stale.ownership === 'adopted'
        ? {
            contents: await readAdoptedBackup(stale, context.paths.backupDir),
            expectedHash: stale.hash,
            operation: 'restore',
            path: stale.path,
            restoreMode: stale.originalMode ?? 0o600,
          }
        : { expectedHash: stale.hash, operation: 'delete', path: stale.path }
    );
  }
  const preserved = (context.manifest?.outputs ?? []).filter(
    (output) => !requested.has(output.target)
  );
  const generationId = projection.ir.generationHash.slice(7);
  const allowRoots = context.selectedTargets.flatMap(
    (target) => context.targetLayouts[target].allowRoots
  );
  await runManagedTransaction({
    allowRoots,
    expectedGenerationId: context.manifest?.generationId ?? null,
    generationId,
    isGenerationCommitted: async (candidate) =>
      (await readManifest(context.paths))?.generationId === candidate,
    outputs: transactionOutputs,
    readGenerationId: async () => (await readManifest(context.paths))?.generationId ?? null,
    recheckSources: async () => {
      const current = await discoverClaude({
        allowedPluginRoots: context.allowedPluginRoots,
        home: context.sourceHome,
        projectRoot: context.scope.projectRoot,
      });
      const currentIr = createEnvironmentIR(
        current.items.filter((item) => item.scope === context.scope.kind)
      );
      const currentOverrides = Object.fromEntries(
        await Promise.all(
          context.selectedTargets.map(async (target) => [
            `target-override:${target}`,
            sha256(JSON.stringify(await readTargetOverride(context, target))),
          ])
        )
      );
      return (
        sha256(`${currentIr.serialized}\n${JSON.stringify(currentOverrides)}`) ===
        projection.ir.generationHash
      );
    },
    scopeDir: context.paths.scopeDir,
    commitManifest: async (committed) => {
      const manifest = createManifest({
        capabilitySummary: combineSummaries(projection.reports),
        generationId,
        outputs: [...preserved, ...committed],
        rootHash: context.paths.rootHash,
        sourceHashes: Object.fromEntries([
          ...projection.ir.items.map((item) => [item.id, item.sourceHash]),
          ...Object.entries(projection.overrideHashes ?? {}),
        ]),
        targetVersions: {
          ...(context.manifest?.targetVersions ?? {}),
          ...projection.observedVersions,
        },
      });
      manifest.lastValidation = new Date().toISOString();
      await writeManifest(context.paths, manifest);
    },
  });
}

async function adopt(context, flags, io) {
  if (!flags.path) throw usageError('adopt requires --path <owned-path>');
  const target = context.selectedTargets[0];
  const layout = context.targetLayouts[target];
  const path = resolve(flags.path);
  if ((context.manifest?.outputs ?? []).some((output) => output.path === path)) {
    throw ownershipError(`path is already managed: ${path}`);
  }
  let preview;
  try {
    preview = await adoptManagedPath({
      allowRoots: layout.allowRoots,
      path,
      paths: context.paths,
      target,
    });
  } catch (error) {
    throw targetError(error.message, error);
  }
  printObject(flags, io, { action: 'adopt', path: preview.path, target });
  if (!flags.yes && !(await confirmMutation(io, 'Adopt this file and retain a private backup?'))) {
    return finish(EXIT_CODES.drift);
  }
  const existing = context.manifest?.outputs ?? [];
  const generationId = `adopt-${sha256(`${context.manifest?.generationId ?? 'none'}:${path}:${preview.hash}`).slice(7, 39)}`;
  let adopted;
  try {
    await runManagedTransaction({
      allowRoots: layout.allowRoots,
      commitManifest: async (committed) => {
        const manifest = createManifest({
          capabilitySummary: context.manifest?.capabilitySummary,
          generationId,
          outputs: [...existing, ...committed],
          rootHash: context.paths.rootHash,
          sourceHashes: context.manifest?.sourceHashes,
          targetVersions: context.manifest?.targetVersions,
        });
        if (context.manifest?.lastValidation)
          manifest.lastValidation = context.manifest.lastValidation;
        await writeManifest(context.paths, manifest);
      },
      expectedGenerationId: context.manifest?.generationId ?? null,
      generationId,
      isGenerationCommitted: async (candidate) =>
        (await readManifest(context.paths))?.generationId === candidate,
      outputs: async () => {
        adopted = await adoptManagedPath({
          allowRoots: layout.allowRoots,
          confirm: true,
          path,
          paths: context.paths,
          target,
        });
        return [
          {
            contents: await readFile(path),
            expectedHash: adopted.hash,
            metadata: adopted,
            mode: adopted.originalMode,
            path,
          },
        ];
      },
      readGenerationId: async () => (await readManifest(context.paths))?.generationId ?? null,
      scopeDir: context.paths.scopeDir,
    });
  } catch (error) {
    throw targetError(error.message, error);
  }
  write(
    io.stdout,
    flags.json
      ? `${JSON.stringify({ ok: true, adopted: adopted.path })}\n`
      : `Adopted ${adopted.path}.\n`
  );
  return finish(EXIT_CODES.clean);
}

async function remove(context, flags, io) {
  const target = context.selectedTargets[0];
  const outputs = (context.manifest?.outputs ?? []).filter((output) => output.target === target);
  printObject(flags, io, {
    action: 'remove',
    outputs: outputs.map((output) => output.path),
    target,
  });
  if (outputs.length === 0) return finish(EXIT_CODES.clean);
  if (!flags.yes && !(await confirmMutation(io, 'Remove these managed outputs?'))) {
    return finish(EXIT_CODES.drift);
  }
  const layout = context.targetLayouts[target];
  const generationId = `remove-${sha256(`${context.manifest.generationId}:${target}`).slice(7, 39)}`;
  await runManagedTransaction({
    allowRoots: layout.allowRoots,
    commitManifest: async () => {
      const manifest = createManifest({
        capabilitySummary: context.manifest.capabilitySummary,
        generationId,
        outputs: context.manifest.outputs.filter((output) => output.target !== target),
        rootHash: context.paths.rootHash,
        sourceHashes: context.manifest.sourceHashes,
        targetVersions: Object.fromEntries(
          Object.entries(context.manifest.targetVersions ?? {}).filter(([name]) => name !== target)
        ),
      });
      if (context.manifest.lastValidation)
        manifest.lastValidation = context.manifest.lastValidation;
      await writeManifest(context.paths, manifest);
    },
    expectedGenerationId: context.manifest.generationId,
    generationId,
    isGenerationCommitted: async (candidate) =>
      (await readManifest(context.paths))?.generationId === candidate,
    outputs: await Promise.all(
      outputs.map(async (output) =>
        output.ownership === 'adopted'
          ? {
              contents: await readAdoptedBackup(output, context.paths.backupDir),
              expectedHash: output.hash,
              operation: 'restore',
              path: output.path,
              restoreMode: output.originalMode ?? 0o600,
            }
          : { expectedHash: output.hash, operation: 'delete', path: output.path }
      )
    ),
    readGenerationId: async () => (await readManifest(context.paths))?.generationId ?? null,
    scopeDir: context.paths.scopeDir,
  });
  return finish(EXIT_CODES.clean);
}

async function readAdoptedBackup(output, backupDir) {
  if (!output.backupPath || !output.backupHash) {
    throw ownershipError(`adopted output has no valid backup metadata: ${output.path}`);
  }
  await assertAllowedPath(output.backupPath, [backupDir], { mustExist: true });
  const bytes = await readFileNoFollow(output.backupPath);
  if (sha256(bytes) !== output.backupHash) {
    throw ownershipError(`adoption backup was modified: ${output.backupPath}`);
  }
  return bytes;
}

function assertDiagnosticOverrides(verb, _scope) {
  const overrides = [
    process.env.MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF === '1' &&
      'MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF',
    process.env.MAUDE_HARNESS_PROJECT_TARGET_ROOT && 'MAUDE_HARNESS_PROJECT_TARGET_ROOT',
  ].filter(Boolean);
  if (overrides.length === 0 || ['check', 'diff', 'status'].includes(verb)) return;
  const roots = [
    process.env.HOME,
    process.env.MAUDE_HARNESS_STATE_ROOT,
    process.env.MAUDE_HARNESS_PROJECT_TARGET_ROOT,
  ].filter(Boolean);
  const conformance =
    process.env.MAUDE_HARNESS_CONFORMANCE === '1' &&
    roots.every((path) => isWithin(realpathSync(tmpdir()), path));
  if (!conformance) {
    throw usageError(
      `${overrides.join(', ')} may not be used by mutating harness verbs outside explicit temporary-root conformance mode`
    );
  }
}

function isWithin(root, path) {
  const nested = relative(resolve(root), resolve(path));
  return (
    nested === '' || (!nested.startsWith(`..${sep}`) && nested !== '..' && !isAbsolute(nested))
  );
}

async function status(context, flags, io) {
  const manifest = context.manifest;
  const ownedTargets = [
    ...new Set((manifest?.outputs ?? []).map((output) => output.target)),
  ].sort();
  const drift = [];
  for (const output of manifest?.outputs ?? []) {
    if ((await optionalHash(output.path)) !== output.hash) drift.push(output.path);
  }
  const value = {
    generation: manifest?.generationId ?? null,
    ownedTargets,
    drift: drift.length > 0,
    driftCount: drift.length,
    counts: manifest?.capabilitySummary ?? {
      degraded: 0,
      native: 0,
      securityFailures: 0,
      unsupported: 0,
    },
    lastValidation: manifest?.lastValidation ?? null,
    observedTargetVersions: manifest?.targetVersions ?? {},
    rollbackAvailable: (manifest?.outputs ?? []).some(
      (output) => output.ownership === 'adopted' || output.backupPath
    ),
  };
  printObject(flags, io, value);
  return finish(value.drift ? EXIT_CODES.drift : EXIT_CODES.clean);
}

function printPreview(preview, projection, flags, io) {
  const value = {
    generation: projection.ir.generationHash,
    drift: preview.drift,
    changed: preview.changed,
    conflicts: preview.conflicts,
    counts: combineSummaries(projection.reports),
    observedTargetVersions: projection.observedVersions,
    capabilities: projection.reports.flatMap((report) =>
      report.records.map(
        ({ acknowledged, enabled, reason, securityRelevant, sourceId, status, target }) => ({
          acknowledged,
          enabled,
          reason,
          securityRelevant,
          sourceId,
          status,
          target,
        })
      )
    ),
  };
  printObject(flags, io, value);
}

function printObject(flags, io, value) {
  if (flags.json) {
    write(io.stdout, `${JSON.stringify(value)}\n`);
    return;
  }
  if (value.generation) write(io.stdout, `generation: ${value.generation}\n`);
  if (value.target) write(io.stdout, `${value.action}: ${value.target}\n`);
  for (const item of value.changed ?? []) write(io.stdout, `  ${item.action} ${item.path}\n`);
  for (const conflict of value.conflicts ?? []) write(io.stdout, `  conflict ${conflict.path}\n`);
  for (const capability of value.capabilities ?? []) {
    if (!capability.enabled) {
      write(
        io.stdout,
        `  ${capability.target} ${capability.status} ${capability.sourceId}: ${capability.reason}\n`
      );
    }
  }
  for (const path of value.outputs ?? []) write(io.stdout, `  remove ${path}\n`);
  if (value.drift !== undefined) write(io.stdout, `drift: ${value.drift ? 'yes' : 'no'}\n`);
}

async function confirmMutation(io, question) {
  if (typeof io.confirm === 'function') return Boolean(await io.confirm(question));
  const interactive = io.isTTY ?? (io.stdin?.isTTY && io.stdout?.isTTY);
  if (!interactive) return false;
  const readline = createInterface({ input: io.stdin, output: io.stdout });
  try {
    const answer = await readline.question(`${question} [y/N] `);
    return /^(?:y|yes)$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

async function ensureTargetRoots(layouts) {
  for (const root of new Set(Object.values(layouts).flatMap((layout) => layout.roots))) {
    await mkdir(root, { mode: 0o700, recursive: true });
  }
}

export function observeTargetVersion(target) {
  if (process.env.MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF === '1') return null;
  const name = target === 'opencode' ? 'opencode' : 'codex';
  const candidates = [
    ...(target === 'codex' && process.env.MAUDE_CODEX_REAL ? [process.env.MAUDE_CODEX_REAL] : []),
    ...String(process.env.PATH || '')
      .split(delimiter)
      .filter(Boolean)
      .map((root) => join(root, name)),
  ];
  for (const candidate of new Set(candidates)) {
    let executable;
    try {
      executable = realpathSync(candidate);
      if (target === 'codex' && isMaudeCodexWrapper(executable)) continue;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10_000 });
    if (result.error?.code === 'ENOENT') continue;
    if (result.status !== 0) throw targetError(`${target} --version failed`);
    return /\d+\.\d+\.\d+/.exec(`${result.stdout}\n${result.stderr}`)?.[0] ?? null;
  }
  return null;
}

function isMaudeCodexWrapper(path) {
  try {
    if (statSync(path).size > 8192) return false;
    return /\bexec\s+maude\s+codex\b/.test(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
}

function targetEnvironment(context) {
  return {
    ...process.env,
    HOME: context.home,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || join(context.home, '.config'),
    CODEX_HOME: process.env.CODEX_HOME || join(context.home, '.codex'),
  };
}

async function readJsonIfPresent(path) {
  const text = await readTextIfPresent(path);
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('must be an object');
    return value;
  } catch (error) {
    throw targetError(`invalid target JSON ${path}: ${error.message}`, error);
  }
}

async function readTextIfPresent(path) {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile())
      throw targetError(`target is not a regular file: ${path}`);
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function optionalHash(path) {
  try {
    return await hashFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function assertDirectory(path, label) {
  const info = await stat(path);
  if (!info.isDirectory()) throw sourceError(`${label} is not a directory: ${path}`);
}

function hasSecurityFailure(reports) {
  return reports.some((report) => report.summary.securityFailures > 0);
}

function hasStrictFailure(reports) {
  return reports.some(
    (report) => report.summary.unsupported > 0 || report.summary.securityFailures > 0
  );
}

function combineSummaries(reports) {
  return reports.reduce(
    (summary, report) => {
      for (const key of Object.keys(summary)) summary[key] += report.summary[key] ?? 0;
      return summary;
    },
    { degraded: 0, native: 0, securityFailures: 0, unsupported: 0 }
  );
}

function classifyError(error) {
  if (error.exitCode) return error.exitCode;
  if (
    error instanceof TransactionInterruptedError ||
    error instanceof RemovalInterruptedError ||
    error instanceof LockError ||
    /interrupted transaction|transaction generation is quarantined|rollback was incomplete/i.test(
      error.message
    )
  ) {
    return EXIT_CODES.interrupted;
  }
  if (
    /externally modified|collision|requires adoption|already managed|ownership/i.test(error.message)
  ) {
    return EXIT_CODES.ownership;
  }
  return EXIT_CODES.source;
}

function codedError(message, exitCode, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { exitCode });
}

const usageError = (message) => codedError(message, EXIT_CODES.usage);
const strictError = (message) => codedError(message, EXIT_CODES.strict);
const ownershipError = (message) => codedError(message, EXIT_CODES.ownership);
const sourceError = (message, cause) => codedError(message, EXIT_CODES.source, cause);
const targetError = (message, cause) => codedError(message, EXIT_CODES.target, cause);

function finish(exitCode) {
  process.exitCode = exitCode;
  return result(exitCode);
}

function result(exitCode) {
  return { exitCode, ok: exitCode === 0 };
}

function byPath(left, right) {
  return left.path.localeCompare(right.path);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function write(stream, value) {
  stream.write(value);
}

function defaultIo() {
  return { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr };
}

function usage() {
  return `maude harness <verb> [options]

  migrate --from claude --targets opencode,codex (--global | --project ROOT) [--yes] [--json]
  sync --targets opencode,codex (--global | --project ROOT) [--json]
  check --targets opencode,codex (--global | --project ROOT) [--strict] [--json]
  diff --targets opencode,codex (--global | --project ROOT) [--json]
  status (--global | --project ROOT) [--json]
  adopt --target opencode|codex --path PATH (--global | --project ROOT) [--yes] [--json]
  remove --target opencode|codex (--global | --project ROOT) [--yes] [--json]

Exactly one scope is mandatory. migrate and adopt preview in non-interactive use;
--yes applies only a fully validated, conflict-free diff. diff is always read-only.

Exit codes: 0 clean/success, 1 drift/preview declined, 2 usage, 3 strict or
security capability failure, 4 ownership conflict, 5 invalid source, 6 invalid
target/config/version, 7 interrupted transaction or recovery required.
`;
}
