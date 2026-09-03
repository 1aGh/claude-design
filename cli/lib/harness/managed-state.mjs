import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { parse as parseToml } from '@decimalturn/toml-patch';

import {
  HARNESS_MANIFEST_SCHEMA_VERSION,
  unsupportedManifestSchemaMessage,
} from './compatibility.mjs';
import { classifyCredential, sanitizeUntrustedText } from './secrets.mjs';

export const MANIFEST_SCHEMA_VERSION = HARNESS_MANIFEST_SCHEMA_VERSION;
const JOURNAL_SCHEMA_VERSION = 1;
const SAFE_TARGETS = new Set(['codex', 'opencode']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^sha256:[a-f0-9]{64}$/;

export class ScopeLockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LockError';
  }
}

export class RemovalInterruptedError extends Error {
  constructor(failpoint) {
    super(`simulated removal interruption at ${failpoint}`);
    this.name = 'RemovalInterruptedError';
  }
}

export function removalInterruptionFailpoint(expected) {
  return async (actual) => {
    if (actual === expected) throw new RemovalInterruptedError(actual);
  };
}

export async function manifestPaths({
  projectRoot,
  scope,
  stateRoot = join(homedir(), '.config', 'maude', 'harness'),
}) {
  if (scope !== 'global' && scope !== 'project') throw new Error(`invalid harness scope: ${scope}`);
  const canonicalStateRoot = await ensureCanonicalDirectoryTree(stateRoot, 'harness state root');
  const canonicalRoot =
    scope === 'project' ? await canonicalExistingDirectory(projectRoot, 'project root') : null;
  const rootHash = hashBytes(canonicalRoot ?? 'global');
  const scopeDir = join(canonicalStateRoot, scope === 'global' ? 'global' : rootHash.slice(7));
  return {
    backupDir: join(scopeDir, 'backups'),
    canonicalRoot,
    lockPath: join(scopeDir, 'transaction.lock'),
    manifestPath: join(scopeDir, 'manifest.json'),
    rootHash,
    scopeDir,
    stateRoot: canonicalStateRoot,
  };
}

export function createManifest({
  capabilitySummary = {},
  generationId,
  outputs,
  rootHash,
  sourceHashes = {},
  targetVersions = {},
}) {
  if (!generationId || !rootHash || !Array.isArray(outputs)) {
    throw new Error('manifest requires generationId, rootHash, and outputs');
  }
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generationId,
    rootHash,
    sourceHashes: sortObject(sourceHashes),
    outputs: [...outputs].sort((left, right) => left.path.localeCompare(right.path)),
    targetVersions: sortObject(targetVersions),
    capabilitySummary: sortObject(capabilitySummary),
  };
}

export async function readManifest(paths) {
  try {
    await assertCanonicalPrivateScope(paths.scopeDir, { create: false });
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let bytes;
  try {
    bytes = (await readFileNoFollow(paths.manifestPath)).toString('utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let manifest;
  try {
    manifest = JSON.parse(bytes);
  } catch (error) {
    throw new Error(`invalid harness manifest ${paths.manifestPath}: ${error.message}`);
  }
  if (manifest?.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      unsupportedManifestSchemaMessage(paths.manifestPath, manifest?.schemaVersion ?? 'missing')
    );
  }
  if (!Array.isArray(manifest.outputs)) {
    throw new Error(`invalid harness manifest outputs in ${paths.manifestPath}`);
  }
  return manifest;
}

export async function writeManifest(paths, manifest) {
  await assertCanonicalPrivateScope(paths.scopeDir, { create: true });
  await atomicWrite(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
}

export async function hashFile(path) {
  return hashBytes(await readNoFollow(path));
}

export async function adoptManagedPath({ allowRoots, confirm = false, path, paths, target }) {
  if (!SAFE_TARGETS.has(target)) throw new Error(`invalid harness target identifier: ${target}`);
  const checkedPath = await assertAllowedPath(path, allowRoots, { mustExist: true });
  const info = await lstat(checkedPath);
  if (!info.isFile()) throw new Error(`adoption requires a regular file: ${checkedPath}`);
  const bytes = await readNoFollow(checkedPath);
  if (containsRawCredential(bytes.toString('utf8'), checkedPath)) {
    throw new Error(`refusing to back up a literal credential from ${checkedPath}`);
  }
  const hash = hashBytes(bytes);
  if (!confirm) return { action: 'preview', hash, path: checkedPath, target };

  await assertCanonicalPrivateScope(paths.scopeDir, { create: true });
  await ensurePrivateChildDirectory(paths.backupDir, paths.scopeDir, 'machine-local backup');
  const backupPath = join(
    paths.backupDir,
    `${target}-${createHash('sha256').update(checkedPath).digest('hex')}.backup`
  );
  let createdBackup = false;
  try {
    const existingHash = await hashFile(backupPath);
    if (existingHash !== hash) throw new Error(`adoption backup already exists: ${backupPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try {
      await writeExclusive(backupPath, bytes, 0o600);
      await syncDirectory(paths.backupDir);
      createdBackup = true;
    } catch (writeError) {
      if (writeError.code !== 'EEXIST' || (await hashFile(backupPath)) !== hash) throw writeError;
    }
  }
  if ((await hashFile(checkedPath)) !== hash) {
    if (createdBackup) await unlink(backupPath);
    throw new Error(`adoption target changed while being backed up: ${checkedPath}`);
  }
  return {
    action: 'adopted',
    backupHash: hash,
    backupPath,
    hash,
    ownership: 'adopted',
    originalMode: info.mode & 0o777,
    path: checkedPath,
    target,
  };
}

export async function assertManagedOutputsUnmodified(outputs, { allowRoots } = {}) {
  for (const output of outputs) {
    if (allowRoots) await assertAllowedPath(output.path, allowRoots, { mustExist: true });
    let currentHash;
    try {
      currentHash = await hashFile(output.path);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`managed output is missing: ${output.path}`);
      throw error;
    }
    if (currentHash !== output.hash) {
      throw new Error(`managed output was externally modified: ${output.path}`);
    }
  }
}

export async function removeManagedOutputs({
  allowRoots,
  backupRoots,
  failpoint = async () => {},
  outputs,
  scopeDir,
}) {
  await assertCanonicalPrivateScope(scopeDir, { create: true });
  const releaseLock = await acquireScopeLock(scopeDir);
  const parentPins = new Map();
  let journal;
  try {
    await recoverRemovalJournal({ allowRoots, backupRoots, parentPins, scopeDir });
    await assertManagedOutputsUnmodified(outputs, { allowRoots });
    const transactionId = randomUUID();
    const entries = [];
    for (let index = 0; index < outputs.length; index += 1) {
      const output = outputs[index];
      const parent = dirname(output.path);
      if (!parentPins.has(parent)) {
        parentPins.set(parent, await pinAllowedParent(output.path, allowRoots));
      }
      const parentPin = parentPins.get(parent);
      await failpoint(`after-remove-parent-pin:${index}`);
      await failpoint(`before-remove-inspect:${index}`);
      const current = await inspectRegularFile(pinnedChildPath(parentPin, output.path));
      if (current.hash !== output.hash) {
        throw new Error(`managed output was externally modified during removal: ${output.path}`);
      }
      if (output.ownership !== 'generated' && output.ownership !== 'adopted') {
        throw new Error(`invalid managed ownership for ${output.path}`);
      }
      let stagePath = null;
      let restoreHash = null;
      if (output.ownership === 'adopted') {
        await assertBackup(output, backupRoots);
        stagePath = artifactPath(output.path, 'remove-stage', transactionId, index);
        const backup = await readNoFollow(output.backupPath);
        await writeExclusive(pinnedChildPath(parentPin, stagePath), backup, 0o600);
        restoreHash = output.backupHash;
      }
      entries.push({
        claimPath: artifactPath(output.path, 'remove-claim', transactionId, index),
        backupPath: output.ownership === 'adopted' ? output.backupPath : null,
        claimed: false,
        claiming: false,
        discardPath: artifactPath(output.path, 'remove-discard', transactionId, index),
        index,
        installed: false,
        installing: false,
        originalHash: current.hash,
        originalMode: current.mode,
        ownership: output.ownership,
        path: output.path,
        restoreHash,
        restoreMode: output.originalMode ?? 0o600,
        stagePath,
      });
    }
    journal = {
      entries,
      phase: 'prepared',
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      transactionId,
    };
    await writeDurableJson(join(scopeDir, 'removal.json'), journal);
    journal.phase = 'removing';
    await writeDurableJson(join(scopeDir, 'removal.json'), journal);
    for (const entry of entries) {
      entry.claiming = true;
      await writeDurableJson(join(scopeDir, 'removal.json'), journal);
      const parentPin = parentPins.get(dirname(entry.path));
      await claimExistingFile(entry, allowRoots, parentPin);
      entry.claimed = true;
      entry.claiming = false;
      await writeDurableJson(join(scopeDir, 'removal.json'), journal);
      if (entry.ownership === 'adopted') {
        entry.installing = true;
        await writeDurableJson(join(scopeDir, 'removal.json'), journal);
        await installNoClobber(
          entry.stagePath,
          entry.path,
          entry.restoreHash,
          allowRoots,
          entry.restoreMode,
          parentPin
        );
        entry.installed = true;
        entry.installing = false;
        await writeDurableJson(join(scopeDir, 'removal.json'), journal);
      }
      await failpoint(`after-remove:${entry.index}`);
    }
    for (const pin of parentPins.values()) await revalidatePinnedParent(pin);
    journal.phase = 'committed';
    await writeDurableJson(join(scopeDir, 'removal.json'), journal);
    await cleanupRemoval(entries, allowRoots, backupRoots, parentPins);
    await unlink(join(scopeDir, 'removal.json'));
    await syncDirectory(scopeDir);
    return { removed: entries.map((entry) => entry.path) };
  } catch (error) {
    if (error instanceof RemovalInterruptedError) throw error;
    let rollbackError;
    try {
      if (journal?.phase === 'committed') {
        await cleanupRemoval(journal.entries, allowRoots, backupRoots, parentPins);
      } else if (journal) {
        await rollbackRemoval(journal.entries, allowRoots, parentPins);
      } else {
        await recoverRemovalJournal({ allowRoots, backupRoots, parentPins, scopeDir });
      }
      if (journal) {
        await unlink(join(scopeDir, 'removal.json'));
        await syncDirectory(scopeDir);
      }
    } catch (recoveryError) {
      rollbackError = recoveryError;
    }
    if (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'managed removal failed and rollback was incomplete'
      );
    }
    throw error;
  } finally {
    try {
      await closeParentPins(parentPins);
    } finally {
      await releaseLock();
    }
  }
}

export async function recoverManagedRemoval({ allowRoots, backupRoots = [], scopeDir }) {
  await assertCanonicalPrivateScope(scopeDir, { create: false });
  const releaseLock = await acquireScopeLock(scopeDir);
  const parentPins = new Map();
  try {
    return await recoverRemovalJournal({ allowRoots, backupRoots, parentPins, scopeDir });
  } finally {
    try {
      await closeParentPins(parentPins);
    } finally {
      await releaseLock();
    }
  }
}

async function recoverRemovalJournal({ allowRoots, backupRoots = [], parentPins, scopeDir }) {
  const journalPath = join(scopeDir, 'removal.json');
  let journal;
  try {
    journal = JSON.parse((await readFileNoFollow(journalPath)).toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { recovered: false };
    throw new Error(`invalid removal journal ${journalPath}: ${error.message}`);
  }
  await validateRemovalJournal(journal, allowRoots, backupRoots, journalPath);
  for (const entry of journal.entries) await removalPinForEntry(entry, allowRoots, parentPins);
  if (journal.phase === 'committed') {
    await cleanupRemoval(journal.entries, allowRoots, backupRoots, parentPins);
  } else {
    await rollbackRemoval(journal.entries, allowRoots, parentPins);
  }
  await unlink(journalPath);
  await syncDirectory(scopeDir);
  return { recovered: true };
}

async function rollbackRemoval(entries, allowRoots, parentPins) {
  for (const entry of [...entries].reverse()) {
    const pin = await removalPinForEntry(entry, allowRoots, parentPins);
    await normalizeInterruptedRemoval(entry, allowRoots, pin);
    if (entry.installed) {
      await removeInstalledNoClobber(entry, entry.restoreHash, allowRoots, pin);
      entry.installed = false;
    }
    if (entry.claimed) {
      await restoreClaimNoClobber(entry, allowRoots, pin);
      entry.claimed = false;
    }
    await cleanupRemovalEntry(entry, allowRoots, pin);
  }
}

async function normalizeInterruptedRemoval(entry, allowRoots, pin) {
  if (entry.claiming && !entry.claimed) {
    const [claim, target] = await Promise.all([
      inspectOptionalFile(pinnedChildPath(pin, entry.claimPath)),
      inspectOptionalFile(pinnedChildPath(pin, entry.path)),
    ]);
    if (claim?.hash === entry.originalHash && target === null) entry.claimed = true;
    else if (claim?.hash === entry.originalHash && target?.hash === entry.originalHash) {
      await unlinkOwnedArtifact(entry.claimPath, allowRoots, pin);
    } else if (claim || target?.hash !== entry.originalHash) {
      throw new Error(`cannot resolve interrupted removal claim: ${entry.path}`);
    }
    entry.claiming = false;
  }
  if (entry.installing && !entry.installed) {
    const target = await inspectOptionalFile(pinnedChildPath(pin, entry.path));
    if (target?.hash === entry.restoreHash) entry.installed = true;
    else if (target !== null)
      throw new Error(`cannot resolve interrupted removal install: ${entry.path}`);
    entry.installing = false;
  }
}

async function cleanupRemoval(entries, allowRoots, backupRoots, parentPins) {
  for (const entry of entries) {
    const pin = await removalPinForEntry(entry, allowRoots, parentPins);
    await cleanupRemovalEntry(entry, allowRoots, pin);
    if (entry.backupPath) await securelyDeleteBackup(entry.backupPath, backupRoots);
  }
}

async function cleanupRemovalEntry(entry, allowRoots, pin) {
  for (const path of [entry.stagePath, entry.claimPath, entry.discardPath].filter(Boolean)) {
    await unlinkOwnedArtifact(path, allowRoots, pin);
  }
}

async function removalPinForEntry(entry, allowRoots, parentPins) {
  const parent = dirname(entry.path);
  if (!parentPins.has(parent)) {
    parentPins.set(parent, await pinAllowedParent(entry.path, allowRoots));
  }
  return parentPins.get(parent);
}

async function validateRemovalJournal(journal, allowRoots, backupRoots, journalPath) {
  if (
    !isPlainObject(journal) ||
    journal.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
    !UUID.test(journal.transactionId) ||
    !exactKeys(journal, ['entries', 'phase', 'schemaVersion', 'transactionId']) ||
    !['prepared', 'removing', 'committed'].includes(journal.phase) ||
    !Array.isArray(journal.entries)
  ) {
    throw new Error(`invalid removal journal ${journalPath}`);
  }
  const paths = new Set();
  for (let index = 0; index < journal.entries.length; index += 1) {
    const entry = journal.entries[index];
    const prefix = `${journal.transactionId}-${index}`;
    if (
      !isPlainObject(entry) ||
      !exactKeys(entry, [
        'claimPath',
        'backupPath',
        'claimed',
        'claiming',
        'discardPath',
        'index',
        'installed',
        'installing',
        'originalHash',
        'originalMode',
        'ownership',
        'path',
        'restoreHash',
        'restoreMode',
        'stagePath',
      ]) ||
      entry.index !== index ||
      typeof entry.claimed !== 'boolean' ||
      typeof entry.claiming !== 'boolean' ||
      typeof entry.installed !== 'boolean' ||
      typeof entry.installing !== 'boolean' ||
      !['generated', 'adopted'].includes(entry.ownership) ||
      !validMode(entry.originalMode) ||
      !validMode(entry.restoreMode) ||
      !HASH.test(entry.originalHash) ||
      (entry.restoreHash !== null && !HASH.test(entry.restoreHash)) ||
      typeof entry.path !== 'string' ||
      paths.has(entry.path)
    ) {
      throw new Error(`invalid removal journal ${journalPath}`);
    }
    paths.add(entry.path);
    if (
      (journal.phase === 'prepared' &&
        (entry.claimed || entry.claiming || entry.installed || entry.installing)) ||
      (journal.phase === 'committed' &&
        (!entry.claimed || (entry.ownership === 'adopted' && !entry.installed))) ||
      (entry.ownership === 'generated' && (entry.installed || entry.installing))
    ) {
      throw new Error(`invalid removal journal state in ${journalPath}`);
    }
    await assertAllowedPath(entry.path, allowRoots);
    validateArtifact(entry.claimPath, entry.path, `remove-claim-${prefix}`, journalPath);
    validateArtifact(entry.discardPath, entry.path, `remove-discard-${prefix}`, journalPath);
    if (entry.ownership === 'adopted') {
      if (typeof entry.backupPath !== 'string') {
        throw new Error(`invalid removal journal ${journalPath}`);
      }
      await assertAllowedPath(entry.backupPath, backupRoots, {
        mustExist: journal.phase !== 'committed',
      });
      validateArtifact(entry.stagePath, entry.path, `remove-stage-${prefix}`, journalPath);
    } else if (
      entry.backupPath !== null ||
      entry.stagePath !== null ||
      entry.restoreHash !== null
    ) {
      throw new Error(`invalid removal journal ${journalPath}`);
    }
  }
}

export async function assertCanonicalPrivateScope(scopeDir, { create }) {
  if (!isAbsolute(scopeDir)) throw new Error(`machine-local scope must be absolute: ${scopeDir}`);
  const expected = resolve(scopeDir);
  if (create) {
    const parent = dirname(expected);
    const canonicalParent = await realpath(parent);
    if (canonicalParent !== parent)
      throw new Error(`machine-local scope parent is not canonical: ${parent}`);
    try {
      await mkdir(expected, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  const info = await lstat(expected);
  if (info.isSymbolicLink())
    throw new Error(`machine-local scope directory may not be a symlink: ${expected}`);
  if (!info.isDirectory())
    throw new Error(`machine-local scope path is not a directory: ${expected}`);
  if ((info.mode & 0o077) !== 0)
    throw new Error(`machine-local scope directory is not private: ${expected}`);
  if ((await realpath(expected)) !== expected) {
    throw new Error(`machine-local scope directory is not canonical: ${expected}`);
  }
  return expected;
}

export async function assertAllowedPath(
  path,
  allowRoots,
  { allowMissingRoots = false, mustExist = false } = {}
) {
  if (!isAbsolute(path)) throw new Error(`managed path must be absolute: ${path}`);
  if (!Array.isArray(allowRoots) || allowRoots.length === 0) {
    throw new Error('at least one allowlisted target root is required');
  }
  const candidate = resolve(path);
  let selectedRoot;
  let validationRoot;
  for (const root of allowRoots) {
    const absoluteRoot = resolve(root);
    let info;
    try {
      info = await lstat(absoluteRoot);
    } catch (error) {
      if (error.code !== 'ENOENT' || !allowMissingRoots) throw error;
      validationRoot = await nearestCanonicalDirectory(absoluteRoot);
    }
    if (
      info &&
      (info.isSymbolicLink() ||
        !info.isDirectory() ||
        (await realpath(absoluteRoot)) !== absoluteRoot)
    ) {
      throw new Error(`allowlisted target root is not a canonical directory: ${absoluteRoot}`);
    }
    const nested = relative(absoluteRoot, candidate);
    if (
      nested === '' ||
      (!nested.startsWith(`..${sep}`) && nested !== '..' && !isAbsolute(nested))
    ) {
      selectedRoot = absoluteRoot;
      validationRoot ??= absoluteRoot;
      break;
    }
    validationRoot = undefined;
  }
  if (!selectedRoot) throw new Error(`path is outside every allowlisted target root: ${candidate}`);
  await rejectSymlinkSegments(validationRoot, candidate, { mustExist });
  return candidate;
}

async function nearestCanonicalDirectory(path) {
  let current = dirname(path);
  while (true) {
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory() || (await realpath(current)) !== current) {
        throw new Error(`allowlisted target ancestor is not a canonical directory: ${current}`);
      }
      return current;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

export async function ensureAllowedParent(path, allowRoots) {
  const checked = await assertAllowedPath(path, allowRoots);
  const root = allowRoots
    .map((candidate) => resolve(candidate))
    .find((candidate) => isWithin(candidate, checked));
  const nestedParent = relative(root, dirname(checked));
  let current = root;
  for (const segment of nestedParent.split(sep).filter(Boolean)) {
    current = join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink())
        throw new Error(`symlink is not allowed in managed path: ${current}`);
      if (!info.isDirectory()) throw new Error(`managed parent is not a directory: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }
  await revalidateAllowedParent(checked, allowRoots);
  return checked;
}

export async function revalidateAllowedParent(path, allowRoots) {
  await assertAllowedPath(path, allowRoots);
  const parent = dirname(path);
  const info = await lstat(parent);
  if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(parent)) !== parent) {
    throw new Error(`managed parent is not a canonical directory: ${parent}`);
  }
}

export async function pinAllowedParent(path, allowRoots) {
  const checked = await assertAllowedPath(path, allowRoots);
  const parent = dirname(checked);
  const handle = await open(
    parent,
    constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0)
  );
  try {
    const identity = await handle.stat();
    if (!identity.isDirectory()) throw new Error(`managed parent is not a directory: ${parent}`);
    let descriptorPath;
    if (process.platform === 'linux') {
      descriptorPath = `/proc/self/fd/${handle.fd}`;
    } else if (process.platform === 'darwin') {
      descriptorPath = `/.vol/${identity.dev}/${identity.ino}`;
    } else {
      throw new Error(
        `platform cannot safely mutate managed files descriptor-relative: ${process.platform}`
      );
    }
    const descriptorIdentity = await stat(descriptorPath);
    if (
      !descriptorIdentity.isDirectory() ||
      descriptorIdentity.dev !== identity.dev ||
      descriptorIdentity.ino !== identity.ino
    ) {
      throw new Error(`platform cannot safely resolve pinned managed parent: ${parent}`);
    }
    return { descriptorPath, handle, identity, parent };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function revalidatePinnedParent(pin) {
  const handleIdentity = await pin.handle.stat();
  if (
    handleIdentity.dev !== pin.identity.dev ||
    handleIdentity.ino !== pin.identity.ino ||
    !handleIdentity.isDirectory()
  ) {
    throw new Error(`pinned managed parent identity changed: ${pin.parent}`);
  }
  const pathIdentity = await lstat(pin.parent);
  if (
    pathIdentity.isSymbolicLink() ||
    !pathIdentity.isDirectory() ||
    pathIdentity.dev !== pin.identity.dev ||
    pathIdentity.ino !== pin.identity.ino
  ) {
    throw new Error(`managed parent identity changed while pinned: ${pin.parent}`);
  }
}

export async function closeParentPins(pins) {
  await Promise.all([...pins.values()].map((pin) => pin.handle.close()));
}

export function pinnedChildPath(pin, path) {
  if (
    !pin ||
    dirname(path) !== pin.parent ||
    basename(path) !== path.slice(pin.parent.length + 1)
  ) {
    throw new Error(`managed mutation path does not belong to its pinned parent: ${path}`);
  }
  return join(pin.descriptorPath, basename(path));
}

export async function acquireScopeLock(
  scopeDir,
  { afterLink = async () => {}, afterTempSync = async () => {} } = {}
) {
  await assertCanonicalPrivateScope(scopeDir, { create: false });
  const lockPath = join(scopeDir, 'transaction.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomUUID();
    const tempPath = join(scopeDir, `.maude-lock-stage-${token}`);
    try {
      await writeExclusive(
        tempPath,
        `${JSON.stringify({ pid: process.pid, schemaVersion: 1, token })}\n`,
        0o600
      );
      await afterTempSync();
      await linkNoClobber(tempPath, lockPath);
      await afterLink();
      await unlink(tempPath);
      await syncDirectory(scopeDir);
      const handle = await open(lockPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const published = await readLockHandle(handle, lockPath);
      if (published.token !== token) {
        await handle.close();
        throw lockError(`lock ownership token changed during publication: ${lockPath}`);
      }
      await cleanupLockStages(scopeDir);
      return async () => releaseScopeLock({ handle, lockPath, scopeDir, token });
    } catch (error) {
      await unlink(tempPath).catch((cleanupError) => {
        if (cleanupError.code !== 'ENOENT') throw cleanupError;
      });
      if (error.code !== 'EEXIST' && !/no-clobber destination exists/.test(error.message))
        throw error;
      const observed = await readLock(lockPath);
      if (!isDeadPid(observed.pid) || attempt > 0) {
        throw lockError(`harness scope is locked: ${lockPath}`);
      }
      const quarantine = join(scopeDir, `.maude-lock-quarantine-${observed.token}-${randomUUID()}`);
      try {
        await rename(lockPath, quarantine);
      } catch (renameError) {
        if (renameError.code === 'ENOENT') continue;
        throw renameError;
      }
      const quarantined = await readLock(quarantine);
      if (quarantined.token !== observed.token || !isDeadPid(quarantined.pid)) {
        await linkNoClobber(quarantine, lockPath);
        await unlink(quarantine);
        throw lockError(`stale lock changed during takeover: ${lockPath}`);
      }
      await unlink(quarantine);
      await syncDirectory(scopeDir);
    }
  }
  throw lockError(`harness scope is locked: ${lockPath}`);
}

async function cleanupLockStages(scopeDir) {
  for (const name of await readdir(scopeDir)) {
    if (!/^\.maude-lock-stage-[0-9a-f-]{36}$/i.test(name)) continue;
    const path = join(scopeDir, name);
    const info = await lstat(path);
    if (info.isFile() && !info.isSymbolicLink()) await unlink(path);
  }
  await syncDirectory(scopeDir);
}

async function releaseScopeLock({ handle, lockPath, scopeDir, token }) {
  await handle.close();
  const quarantine = join(scopeDir, `.maude-lock-release-${token}-${randomUUID()}`);
  try {
    await rename(lockPath, quarantine);
  } catch (error) {
    if (error.code === 'ENOENT') throw lockError(`lock ownership was lost: ${lockPath}`);
    throw error;
  }
  const observed = await readLock(quarantine);
  if (observed.token !== token) {
    await linkNoClobber(quarantine, lockPath).catch(() => {});
    await unlink(quarantine);
    throw lockError(`lock ownership token changed: ${lockPath}`);
  }
  await unlink(quarantine);
  await syncDirectory(scopeDir);
}

export async function inspectRegularFile(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`symlink is not allowed for managed file: ${path}`);
  if (!info.isFile()) throw new Error(`managed path is not a regular file: ${path}`);
  return { hash: hashBytes(await readNoFollow(path)), mode: info.mode & 0o777 };
}

export async function claimExistingFile(entry, allowRoots, parentPin) {
  const pin = parentPin ?? (await pinAllowedParent(entry.path, allowRoots));
  const ownedPin = !parentPin;
  const targetPath = pinnedChildPath(pin, entry.path);
  const claimPath = pinnedChildPath(pin, entry.claimPath);
  const discardPath = pinnedChildPath(pin, entry.discardPath);
  try {
    await assertArtifactAbsent(claimPath);
    await link(targetPath, claimPath);
    const claim = await inspectRegularFile(claimPath);
    if (claim.hash !== entry.originalHash)
      throw new Error(`managed target changed before claim: ${entry.path}`);
    await assertArtifactAbsent(discardPath);
    await rename(targetPath, discardPath);
    const discarded = await inspectRegularFile(discardPath);
    if (discarded.hash !== entry.originalHash) {
      await linkNoClobber(discardPath, targetPath);
      throw new Error(`managed target changed while being claimed: ${entry.path}`);
    }
    await unlink(discardPath);
    await pin.handle.sync();
  } finally {
    if (ownedPin) await pin.handle.close();
  }
}

export async function installNoClobber(
  stagePath,
  path,
  expectedHash,
  allowRoots,
  mode = 0o600,
  parentPin
) {
  const pin = parentPin ?? (await pinAllowedParent(path, allowRoots));
  const ownedPin = !parentPin;
  const pinnedStage = pinnedChildPath(pin, stagePath);
  const pinnedTarget = pinnedChildPath(pin, path);
  try {
    try {
      await link(pinnedStage, pinnedTarget);
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`managed target appeared or collided: ${path}`);
      if (['EXDEV', 'ENOTSUP', 'EPERM'].includes(error.code)) {
        throw new Error(
          `platform cannot safely install managed target without clobbering: ${path}`
        );
      }
      throw error;
    }
    await verifyAndChmodNoFollow(pinnedTarget, expectedHash, mode);
    await pin.handle.sync();
  } finally {
    if (ownedPin) await pin.handle.close();
  }
}

export async function removeInstalledNoClobber(entry, expectedHash, allowRoots, parentPin) {
  const pin = parentPin ?? (await pinAllowedParent(entry.path, allowRoots));
  const ownedPin = !parentPin;
  const targetPath = pinnedChildPath(pin, entry.path);
  const discardPath = pinnedChildPath(pin, entry.discardPath);
  try {
    await assertArtifactAbsent(discardPath);
    await rename(targetPath, discardPath);
    const discarded = await inspectRegularFile(discardPath);
    if (discarded.hash !== expectedHash) {
      await linkNoClobber(discardPath, targetPath);
      throw new Error(`concurrent edit detected during rollback: ${entry.path}`);
    }
    await unlink(discardPath);
    await pin.handle.sync();
  } finally {
    if (ownedPin) await pin.handle.close();
  }
}

export async function restoreClaimNoClobber(entry, allowRoots, parentPin) {
  const pin = parentPin ?? (await pinAllowedParent(entry.path, allowRoots));
  const ownedPin = !parentPin;
  const targetPath = pinnedChildPath(pin, entry.path);
  const claimPath = pinnedChildPath(pin, entry.claimPath);
  try {
    try {
      await link(claimPath, targetPath);
    } catch (error) {
      if (error.code === 'EEXIST')
        throw new Error(`concurrent edit blocks rollback: ${entry.path}`);
      throw error;
    }
    await verifyAndChmodNoFollow(targetPath, entry.originalHash, entry.originalMode);
    await pin.handle.sync();
  } finally {
    if (ownedPin) await pin.handle.close();
  }
}

export async function unlinkOwnedArtifact(path, allowRoots, parentPin) {
  if (!path) return;
  const pin = parentPin ?? (await pinAllowedParent(path, allowRoots));
  const ownedPin = !parentPin;
  const descriptorPath = pinnedChildPath(pin, path);
  try {
    const info = await lstat(descriptorPath);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error(`owned artifact is not a file: ${path}`);
    await unlink(descriptorPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  } finally {
    if (ownedPin) await pin.handle.close();
  }
}

export async function writeExclusive(path, contents, mode = 0o600) {
  const handle = await open(path, 'wx', mode);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeDurableJson(path, value) {
  await atomicWrite(path, `${JSON.stringify(value)}\n`, 0o600);
}

export async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function artifactPath(path, kind, transactionId, index) {
  return join(dirname(path), `.maude-${kind}-${transactionId}-${index}`);
}

function validateArtifact(path, targetPath, expectedName, journalPath) {
  if (
    typeof path !== 'string' ||
    dirname(path) !== dirname(targetPath) ||
    basename(path) !== `.maude-${expectedName}`
  ) {
    throw new Error(`invalid removal journal artifact in ${journalPath}`);
  }
}

async function assertBackup(output, backupRoots) {
  if (!output.backupPath || !HASH.test(output.backupHash ?? '')) {
    throw new Error(`adopted output has no valid backup metadata: ${output.path}`);
  }
  await assertAllowedPath(output.backupPath, backupRoots, { mustExist: true });
  if ((await hashFile(output.backupPath)) !== output.backupHash) {
    throw new Error(`adoption backup was modified: ${output.backupPath}`);
  }
}

async function atomicWrite(path, contents, mode) {
  const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeExclusive(tempPath, contents, mode);
    await rename(tempPath, path);
    await chmod(path, mode);
    await syncDirectory(dirname(path));
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

export async function readFileNoFollow(path) {
  const pathInfo = await lstat(path);
  if (pathInfo.isSymbolicLink())
    throw new Error(`symlink is not allowed for managed file: ${path}`);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`managed path is not a regular file: ${path}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

const readNoFollow = readFileNoFollow;

async function canonicalExistingDirectory(path, label) {
  if (!path) throw new Error(`${label} is required`);
  const canonical = await realpath(path);
  const info = await stat(canonical);
  if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
  return canonical;
}

async function ensureCanonicalDirectoryTree(path, label) {
  const target = resolve(path);
  const missing = [];
  let current = target;
  while (true) {
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory() || (await realpath(current)) !== current) {
        throw new Error(`${label} crosses a non-canonical directory: ${current}`);
      }
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      missing.unshift(basename(current));
      current = parent;
    }
  }
  for (const segment of missing) {
    current = join(current, segment);
    await mkdir(current, { mode: 0o700 });
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory() || (await realpath(current)) !== current) {
      throw new Error(`${label} could not be created safely: ${current}`);
    }
  }
  return target;
}

async function ensurePrivateChildDirectory(path, parent, label) {
  await assertCanonicalPrivateScope(parent, { create: false });
  if (dirname(path) !== parent) throw new Error(`${label} escapes its parent: ${path}`);
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    (await realpath(path)) !== path
  ) {
    throw new Error(`${label} is not a canonical private directory: ${path}`);
  }
}

async function rejectSymlinkSegments(root, candidate, { mustExist }) {
  const nested = relative(root, candidate);
  let current = root;
  const segments = nested.split(sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink())
        throw new Error(`symlink is not allowed in managed path: ${current}`);
      if (index < segments.length - 1 && !info.isDirectory()) {
        throw new Error(`managed path parent is not a directory: ${current}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (mustExist) throw error;
      return;
    }
  }
}

async function assertArtifactAbsent(path) {
  try {
    await lstat(path);
    throw new Error(`transaction artifact already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function linkNoClobber(source, destination) {
  try {
    await link(source, destination);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`no-clobber destination exists: ${destination}`);
    throw error;
  }
}

async function readLock(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    return await readLockHandle(handle, path);
  } catch (error) {
    if (error instanceof ScopeLockError) throw error;
    throw lockError(`invalid scope lock ${path}: ${error.message}`);
  } finally {
    await handle?.close();
  }
}

async function readLockHandle(handle, path) {
  let value;
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('lock is not a regular file');
    value = JSON.parse((await handle.readFile()).toString('utf8'));
  } catch (error) {
    throw lockError(`invalid scope lock ${path}: ${error.message}`);
  }
  if (
    !isPlainObject(value) ||
    !exactKeys(value, ['pid', 'schemaVersion', 'token']) ||
    value.schemaVersion !== 1 ||
    !UUID.test(value.token) ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0
  ) {
    throw lockError(`invalid scope lock ${path}`);
  }
  return value;
}

function isDeadPid(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

function lockError(message) {
  return new ScopeLockError(message);
}

function hashBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function verifyAndChmodNoFollow(path, expectedHash, mode) {
  const handle = await open(path, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`managed path is not a regular file: ${path}`);
    const bytes = await handle.readFile();
    if (hashBytes(bytes) !== expectedHash) throw new Error(`managed target hash mismatch: ${path}`);
    await handle.chmod(mode);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function inspectOptionalFile(path) {
  try {
    return await inspectRegularFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function containsRawCredential(text, path) {
  if (classifyCredential(text)) return true;
  if (sanitizeUntrustedText(text).findings.length > 0) return true;
  if (extname(path).toLowerCase() === '.json') {
    try {
      if (containsCredentialValue(JSON.parse(text))) return true;
    } catch {
      // Invalid JSON still falls through to assignment scanning.
    }
  }
  if (extname(path).toLowerCase() === '.toml' && containsTomlCredential(text)) return true;
  return containsCredentialAssignment(text);
}

function containsCredentialValue(value, key = '', sensitiveKey = '') {
  if (Array.isArray(value)) {
    return value.some((entry) => containsCredentialValue(entry, key, sensitiveKey));
  }
  if (!value || typeof value !== 'object') {
    return Boolean(classifyCredential(String(value), { key: sensitiveKey || key }));
  }
  return Object.entries(value).some(([nestedKey, nested]) => {
    const nestedSensitiveKey = classifyCredential('literal', { key: nestedKey })
      ? nestedKey
      : sensitiveKey;
    return containsCredentialValue(nested, nestedKey, nestedSensitiveKey);
  });
}

function containsTomlCredential(text) {
  try {
    return containsCredentialValue(parseToml(text));
  } catch {
    // Invalid TOML still receives conservative assignment scanning below.
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || /^\[.*\]$/.test(line)) continue;
    const separator = line.indexOf('=');
    const candidateKey = (separator < 0 ? line : line.slice(0, separator))
      .trim()
      .split('.')
      .at(-1)
      ?.replace(/^['"]|['"]$/g, '');
    if (
      !classifyCredential('literal', { key: candidateKey ?? '' }) &&
      !containsCredentialAssignment(line)
    ) {
      continue;
    }
    if (separator < 0) return true;
    const candidate = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (
      classifyCredential(candidate, { key: candidateKey ?? '' }) ||
      containsCredentialAssignment(line)
    ) {
      return true;
    }
  }
  return false;
}

function containsCredentialAssignment(value) {
  const assignment =
    /(?=(?:^|[{,\s;])["']?([A-Za-z_][A-Za-z0-9_-]*)["']?\s*[:=]\s*(?:(\$\{[A-Z_][A-Z0-9_]*\}|\{env:[A-Z_][A-Z0-9_]*\}|keychain:[A-Za-z0-9._/-]+)|"([^"]*)"|'([^']*)'|([^\r\n,}\s]+)))/g;
  return [...value.matchAll(assignment)].some((match) => {
    if (!classifyCredential('literal', { key: match[1] })) return false;
    const candidate = (match[2] ?? match[3] ?? match[4] ?? match[5]).trim();
    return Boolean(classifyCredential(candidate, { key: match[1] }));
  });
}

async function securelyDeleteBackup(path, backupRoots) {
  await assertAllowedPath(path, backupRoots);
  const pin = await pinAllowedParent(path, backupRoots);
  const descriptorPath = pinnedChildPath(pin, path);
  try {
    await revalidatePinnedParent(pin);
    let handle;
    try {
      handle = await open(descriptorPath, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new Error(`adoption backup is not a regular file: ${path}`);
      const zeroes = Buffer.alloc(Math.min(info.size, 64 * 1024));
      for (let offset = 0; offset < info.size; offset += zeroes.length) {
        await handle.write(zeroes, 0, Math.min(zeroes.length, info.size - offset), offset);
      }
      await handle.truncate(0);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await unlink(descriptorPath);
    await pin.handle.sync();
    await revalidatePinnedParent(pin);
  } finally {
    await pin.handle.close();
  }
}

function validMode(mode) {
  return Number.isInteger(mode) && mode >= 0 && mode <= 0o777;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isWithin(root, path) {
  const nested = relative(root, path);
  return (
    nested === '' || (!nested.startsWith(`..${sep}`) && nested !== '..' && !isAbsolute(nested))
  );
}

function sortObject(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}
