import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import {
  acquireScopeLock,
  assertAllowedPath,
  assertCanonicalPrivateScope,
  claimExistingFile,
  closeParentPins,
  ensureAllowedParent,
  inspectRegularFile,
  installNoClobber,
  pinAllowedParent,
  pinnedChildPath,
  readFileNoFollow,
  removeInstalledNoClobber,
  restoreClaimNoClobber,
  revalidatePinnedParent,
  ScopeLockError,
  syncDirectory,
  unlinkOwnedArtifact,
  writeDurableJson,
  writeExclusive,
} from './managed-state.mjs';
import { sha256 } from './model.mjs';

const JOURNAL_SCHEMA_VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^sha256:[a-f0-9]{64}$/;
const GENERATION = /^[A-Za-z0-9._-]{1,128}$/;
const PHASES = new Set(['prepared', 'replacing', 'committing', 'quarantined']);

export { ScopeLockError as LockError };

export class TransactionInterruptedError extends Error {
  constructor(failpoint) {
    super(`simulated interruption at ${failpoint}`);
    this.name = 'TransactionInterruptedError';
  }
}

export function interruptionFailpoint(expected) {
  return async (actual) => {
    if (actual === expected) throw new TransactionInterruptedError(actual);
  };
}

export function transactionFailpoints({ existingIndexes = [], outputCount }) {
  if (!Number.isInteger(outputCount) || outputCount < 1) {
    throw new Error('transaction failpoints require a positive outputCount');
  }
  const existing = new Set(existingIndexes);
  if (
    [...existing].some((index) => !Number.isInteger(index) || index < 0 || index >= outputCount)
  ) {
    throw new Error('transaction failpoint existingIndexes must reference an output');
  }
  const points = [
    'after-lock',
    ...Array.from({ length: outputCount }, (_, index) => `after-parent-pin:${index}`),
    'after-validation',
    'before-replace',
  ];
  for (let index = 0; index < outputCount; index += 1) {
    if (existing.has(index)) points.push(`after-claim:${index}`);
    points.push(`before-install:${index}`, `after-replace:${index}`);
  }
  points.push(
    'before-manifest',
    'after-manifest-callback',
    'after-postcheck',
    'after-manifest-write',
    ...Array.from({ length: outputCount }, (_, index) => `after-claim-cleanup:${index}`),
    'before-journal-unlink'
  );
  return points;
}

export async function runManagedTransaction({
  allowRoots,
  commitManifest = async () => {},
  deviceFor = async (path) => (await stat(path)).dev,
  expectedGenerationId,
  failpoint = async () => {},
  generationId,
  isGenerationCommitted,
  outputs: requestedOutputs,
  readGenerationId,
  recheckSources = async () => true,
  scopeDir,
  staleAgeMs = 24 * 60 * 60 * 1000,
}) {
  validateRequest({ generationId, outputs: requestedOutputs, scopeDir });
  await assertCanonicalPrivateScope(scopeDir, { create: true });
  const releaseLock = await acquireScopeLock(scopeDir);
  const journalPath = join(scopeDir, 'transaction.json');
  let journal;
  let recoveryFinished = false;
  const parentPins = new Map();
  try {
    await failpoint('after-lock');
    await recoverJournal({ allowRoots, isGenerationCommitted, journalPath, parentPins });
    recoveryFinished = true;
    await assertGeneration(expectedGenerationId, readGenerationId);
    const outputs =
      typeof requestedOutputs === 'function' ? await requestedOutputs() : requestedOutputs;
    validateOutputs(outputs);
    await cleanupStaging(outputs, allowRoots, staleAgeMs, parentPins);
    const transactionId = randomUUID();
    const entries = await prepareOutputs({
      allowRoots,
      deviceFor,
      outputs,
      parentPins,
      failpoint,
      scopeDir,
      transactionId,
    });
    journal = {
      entries,
      generationId,
      phase: 'prepared',
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      transactionId,
    };
    await writeDurableJson(journalPath, journal);

    for (const entry of entries) {
      const output = outputs[entry.index];
      if (output.validate) {
        await output.validate(
          output.contents,
          pinnedChildPath(parentPins.get(dirname(entry.path)), entry.stagePath)
        );
      }
    }
    await failpoint('after-validation');
    if (!(await recheckSources())) throw new Error('source snapshot changed during generation');
    await failpoint('before-replace');

    journal.phase = 'replacing';
    await writeDurableJson(journalPath, journal);
    for (const entry of entries) {
      if (entry.existed) {
        entry.claiming = true;
        await writeDurableJson(journalPath, journal);
        await claimExistingFile(entry, allowRoots, parentPins.get(dirname(entry.path)));
        entry.claimed = true;
        entry.claiming = false;
        await writeDurableJson(journalPath, journal);
        await failpoint(`after-claim:${entry.index}`);
      }
      if (entry.outputHash) {
        entry.installing = true;
        await writeDurableJson(journalPath, journal);
        await failpoint(`before-install:${entry.index}`);
        try {
          await installNoClobber(
            entry.stagePath,
            entry.path,
            entry.outputHash,
            allowRoots,
            entry.installMode,
            parentPins.get(dirname(entry.path))
          );
        } catch (error) {
          entry.installing = false;
          await writeDurableJson(journalPath, journal);
          throw error;
        }
        entry.installed = true;
        entry.installing = false;
        await writeDurableJson(journalPath, journal);
      }
      await failpoint(`after-replace:${entry.index}`);
    }
    await revalidateParentPins(parentPins);

    const committedOutputs = entries
      .filter((entry) => entry.operation === 'write')
      .map((entry) => ({
        ...outputs[entry.index].metadata,
        hash: entry.outputHash,
        path: entry.path,
      }));
    await failpoint('before-manifest');
    journal.phase = 'committing';
    await writeDurableJson(journalPath, journal);
    await assertGeneration(expectedGenerationId, readGenerationId);
    try {
      await verifyInstalledOutputs(entries, parentPins, 'before manifest commit');
    } catch (error) {
      journal.phase = 'replacing';
      await writeDurableJson(journalPath, journal);
      throw error;
    }
    await commitManifest(committedOutputs);
    await failpoint('after-manifest-callback');
    await verifyInstalledOutputs(entries, parentPins, 'after manifest commit');
    await failpoint('after-postcheck');
    await failpoint('after-manifest-write');
    await cleanupCommittedEntries({
      allowRoots,
      journal,
      journalPath,
      parentPins,
      scopeDir,
      failpoint,
    });
    await unlink(journalPath);
    await syncDirectory(scopeDir);
    // Once the journal is gone and this function returns, later edits are ordinary external drift.
    return { generationId, outputs: committedOutputs };
  } catch (error) {
    if (error instanceof TransactionInterruptedError) throw error;
    if (!recoveryFinished && !journal) throw error;
    if (journal?.phase === 'quarantined') throw error;
    if (journal?.phase === 'committing') {
      if (!(await installedOutputsMatch(journal.entries, parentPins))) {
        await quarantineAndRestore({
          allowRoots,
          journal,
          journalPath,
          parentPins,
          scopeDir,
          failpoint,
        });
        throw error;
      }
      if (typeof isGenerationCommitted !== 'function') {
        throw new AggregateError(
          [error],
          `transaction commit outcome is ambiguous (${error.message}); recovery requires isGenerationCommitted`
        );
      }
      let committed;
      try {
        committed = await isGenerationCommitted(journal.generationId);
      } catch (recoveryError) {
        throw new AggregateError(
          [error, recoveryError],
          `transaction commit outcome is ambiguous (${error.message}) and could not be checked (${recoveryError.message})`
        );
      }
      if (committed) {
        await cleanupCommittedEntries({
          allowRoots,
          journal,
          journalPath,
          parentPins,
          scopeDir,
        });
        await unlink(journalPath);
        await syncDirectory(scopeDir);
        throw error;
      }
    }
    if (journal) {
      const rollbackError = await rollbackEntries(
        journal?.entries ?? [],
        allowRoots,
        parentPins
      ).catch((recoveryError) => recoveryError);
      if (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `transaction failed (${error.message}) and rollback was incomplete (${rollbackError.message})`
        );
      }
      await unlinkIfPresent(journalPath);
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

async function prepareOutputs({
  allowRoots,
  deviceFor,
  failpoint,
  outputs,
  parentPins,
  scopeDir,
  transactionId,
}) {
  const entries = [];
  try {
    for (let index = 0; index < outputs.length; index += 1) {
      const output = outputs[index];
      const path = await ensureAllowedParent(output.path, allowRoots);
      const parent = dirname(path);
      if (!parentPins.has(parent)) parentPins.set(parent, await pinAllowedParent(path, allowRoots));
      const parentPin = parentPins.get(parent);
      await failpoint(`after-parent-pin:${index}`);
      const existing = await inspectOptional(pinnedChildPath(parentPin, path));
      if (existing && !output.expectedHash) {
        throw new Error(`unmanaged target collision requires adoption: ${path}`);
      }
      if (existing && output.expectedHash !== existing.hash) {
        throw new Error(`managed target was externally modified: ${path}`);
      }
      if (!existing && output.expectedHash) throw new Error(`managed target is missing: ${path}`);
      const operation = output.operation ?? 'write';
      const contents =
        operation === 'delete'
          ? null
          : Buffer.isBuffer(output.contents)
            ? output.contents
            : Buffer.from(output.contents, 'utf8');
      const entry = {
        claimPath: artifactPath(path, 'claim', transactionId, index),
        claimed: false,
        claiming: false,
        discardPath: artifactPath(path, 'discard', transactionId, index),
        existed: existing !== null,
        index,
        installed: false,
        installing: false,
        installMode:
          output.mode ?? (operation === 'restore' ? (output.restoreMode ?? 0o600) : 0o600),
        originalHash: existing?.hash ?? null,
        originalMode: existing?.mode ?? null,
        operation,
        outputHash: contents ? sha256(contents) : null,
        path,
        quarantines: [],
        recoveryHash: existing?.hash ?? null,
        recoveryPath: existing ? join(scopeDir, 'recovery', transactionId, `${index}.bin`) : null,
        restored: false,
        stagePath: contents ? artifactPath(path, 'stage', transactionId, index) : null,
      };
      if (contents) {
        await writeExclusive(pinnedChildPath(parentPin, entry.stagePath), contents, 0o600);
      }
      entries.push(entry);
      if (contents) {
        const [parentDevice, stageDevice] = await Promise.all([
          deviceFor(parentPin.descriptorPath),
          deviceFor(pinnedChildPath(parentPin, entry.stagePath)),
        ]);
        if (parentDevice !== stageDevice) {
          throw new Error(`staging must use the same filesystem as ${path}`);
        }
      }
    }
    return entries;
  } catch (error) {
    await cleanupEntries(entries, allowRoots, parentPins);
    throw error;
  }
}

async function rollbackEntries(entries, allowRoots, parentPins) {
  for (const entry of [...entries].reverse()) {
    const pin = await pinForEntry(entry, allowRoots, parentPins);
    await normalizeInterruptedEntry(entry, allowRoots, pin);
    if (entry.installed) {
      await removeInstalledNoClobber(entry, entry.outputHash, allowRoots, pin);
      entry.installed = false;
    }
    if (entry.claimed) {
      await restoreClaimNoClobber(entry, allowRoots, pin);
      entry.claimed = false;
    }
    await cleanupEntry(entry, allowRoots, parentPins);
  }
}

async function normalizeInterruptedEntry(entry, allowRoots, pin) {
  if (entry.claiming && !entry.claimed) {
    const [claim, target] = await Promise.all([
      inspectOptional(pinnedChildPath(pin, entry.claimPath)),
      inspectOptional(pinnedChildPath(pin, entry.path)),
    ]);
    if (claim?.hash === entry.originalHash && target === null) entry.claimed = true;
    else if (claim?.hash === entry.originalHash && target?.hash === entry.originalHash) {
      await unlinkOwnedArtifact(entry.claimPath, allowRoots, pin);
    } else if (claim || target?.hash !== entry.originalHash) {
      throw new Error(`cannot resolve interrupted target claim: ${entry.path}`);
    }
    entry.claiming = false;
  }
  if (entry.installing && !entry.installed) {
    const target = await inspectOptional(pinnedChildPath(pin, entry.path));
    if (target?.hash === entry.outputHash) entry.installed = true;
    else if (target !== null)
      throw new Error(`cannot resolve interrupted target install: ${entry.path}`);
    entry.installing = false;
  }
}

async function recoverJournal({ allowRoots, isGenerationCommitted, journalPath, parentPins }) {
  let journal;
  try {
    journal = JSON.parse((await readFileNoFollow(journalPath)).toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error(`invalid interrupted transaction journal ${journalPath}: ${error.message}`);
  }
  await validateJournal(journal, allowRoots, journalPath);
  for (const entry of journal.entries) await pinForEntry(entry, allowRoots, parentPins);
  if (journal.phase === 'quarantined') {
    await quarantineAndRestore({
      allowRoots,
      journal,
      journalPath,
      parentPins,
      scopeDir: dirname(journalPath),
    });
    throw new Error(`transaction generation is quarantined: ${journal.generationId}`);
  } else if (journal.phase === 'committing') {
    if (!(await installedOutputsMatch(journal.entries, parentPins))) {
      await quarantineAndRestore({
        allowRoots,
        journal,
        journalPath,
        parentPins,
        scopeDir: dirname(journalPath),
      });
      throw new Error(`committing transaction generation was quarantined: ${journal.generationId}`);
    }
    if (typeof isGenerationCommitted !== 'function') {
      throw new Error(
        `committing transaction requires a durable generation check: ${journal.generationId}`
      );
    }
    if (await isGenerationCommitted(journal.generationId)) {
      await cleanupCommittedEntries({
        allowRoots,
        journal,
        journalPath,
        parentPins,
        scopeDir: dirname(journalPath),
      });
    } else {
      await rollbackEntries(journal.entries, allowRoots, parentPins);
    }
  } else {
    await rollbackEntries(journal.entries, allowRoots, parentPins);
  }
  await unlink(journalPath);
}

async function validateJournal(journal, allowRoots, journalPath) {
  if (
    !isPlainObject(journal) ||
    !exactKeys(journal, ['entries', 'generationId', 'phase', 'schemaVersion', 'transactionId']) ||
    journal.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
    !UUID.test(journal.transactionId ?? '') ||
    !GENERATION.test(journal.generationId ?? '') ||
    !PHASES.has(journal.phase) ||
    !Array.isArray(journal.entries) ||
    journal.entries.length === 0
  ) {
    throw new Error(`invalid transaction journal ${journalPath}`);
  }
  const paths = new Set();
  for (let index = 0; index < journal.entries.length; index += 1) {
    const entry = journal.entries[index];
    if (
      !isPlainObject(entry) ||
      !exactKeys(entry, [
        'claimPath',
        'claimed',
        'claiming',
        'discardPath',
        'existed',
        'index',
        'installed',
        'installing',
        'installMode',
        'originalHash',
        'originalMode',
        'operation',
        'outputHash',
        'path',
        'quarantines',
        'recoveryHash',
        'recoveryPath',
        'restored',
        'stagePath',
      ]) ||
      entry.index !== index ||
      typeof entry.existed !== 'boolean' ||
      typeof entry.claimed !== 'boolean' ||
      typeof entry.claiming !== 'boolean' ||
      typeof entry.installed !== 'boolean' ||
      typeof entry.installing !== 'boolean' ||
      typeof entry.restored !== 'boolean' ||
      !Array.isArray(entry.quarantines) ||
      typeof entry.path !== 'string' ||
      paths.has(entry.path) ||
      !['delete', 'restore', 'write'].includes(entry.operation) ||
      (entry.operation === 'delete'
        ? entry.outputHash !== null || entry.stagePath !== null
        : !HASH.test(entry.outputHash ?? '') || typeof entry.stagePath !== 'string') ||
      !validMode(entry.installMode) ||
      (entry.existed
        ? !HASH.test(entry.originalHash ?? '') ||
          !validMode(entry.originalMode) ||
          entry.recoveryHash !== entry.originalHash ||
          entry.recoveryPath !==
            join(dirname(journalPath), 'recovery', journal.transactionId, `${index}.bin`)
        : entry.originalHash !== null ||
          entry.originalMode !== null ||
          entry.recoveryHash !== null ||
          entry.recoveryPath !== null)
    ) {
      throw new Error(`invalid transaction journal ${journalPath}`);
    }
    for (
      let quarantineIndex = 0;
      quarantineIndex < entry.quarantines.length;
      quarantineIndex += 1
    ) {
      validateQuarantine(
        entry.quarantines[quarantineIndex],
        entry,
        journal,
        quarantineIndex,
        journalPath
      );
    }
    paths.add(entry.path);
    if (
      (!entry.existed && (entry.claimed || entry.claiming)) ||
      (journal.phase === 'prepared' &&
        (entry.claimed || entry.claiming || entry.installed || entry.installing)) ||
      (journal.phase === 'committing' &&
        ((entry.outputHash !== null && !entry.installed) ||
          entry.restored ||
          (entry.existed && !entry.claimed))) ||
      (journal.phase !== 'quarantined' && entry.quarantines.length > 0)
    ) {
      throw new Error(`invalid transaction journal state in ${journalPath}`);
    }
    await assertAllowedPath(entry.path, allowRoots);
    if (entry.stagePath) {
      validateArtifact(
        entry.stagePath,
        entry.path,
        'stage',
        journal.transactionId,
        index,
        journalPath
      );
    }
    validateArtifact(
      entry.claimPath,
      entry.path,
      'claim',
      journal.transactionId,
      index,
      journalPath
    );
    validateArtifact(
      entry.discardPath,
      entry.path,
      'discard',
      journal.transactionId,
      index,
      journalPath
    );
  }
}

async function cleanupStaging(outputs, allowRoots, staleAgeMs, parentPins) {
  const parents = new Set();
  for (const output of outputs) {
    const path = await assertAllowedPath(output.path, allowRoots);
    const parent = dirname(path);
    if (!parentPins.has(parent)) {
      try {
        parentPins.set(parent, await pinAllowedParent(path, allowRoots));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
    parents.add(parent);
  }
  const cutoff = Date.now() - staleAgeMs;
  for (const parent of parents) {
    const pin = parentPins.get(parent);
    let names;
    try {
      names = await readdir(pin.descriptorPath);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      if (!/^\.maude-(?:stage|claim|discard)-[0-9a-f-]{36}-\d+$/i.test(name)) continue;
      const path = join(parent, name);
      const info = await lstat(pinnedChildPath(pin, path));
      if (info.isFile() && !info.isSymbolicLink() && info.mtimeMs <= cutoff) {
        await unlinkOwnedArtifact(path, allowRoots, pin);
      }
    }
  }
}

async function cleanupCommittedEntries({
  allowRoots,
  failpoint = async () => {},
  journal,
  journalPath,
  parentPins,
  scopeDir,
}) {
  await prepareRecoveryBundle({ journal, journalPath, parentPins, scopeDir });
  await requireHealthyCommittedOutputs({
    allowRoots,
    journal,
    journalPath,
    parentPins,
    scopeDir,
  });
  for (const entry of journal.entries) {
    const pin = await pinForEntry(entry, allowRoots, parentPins);
    for (const path of [entry.stagePath, entry.discardPath]) {
      await unlinkOwnedArtifact(path, allowRoots, pin);
    }
  }
  for (const entry of journal.entries) {
    await requireHealthyCommittedOutputs({
      allowRoots,
      journal,
      journalPath,
      parentPins,
      scopeDir,
    });
    const pin = await pinForEntry(entry, allowRoots, parentPins);
    await unlinkOwnedArtifact(entry.claimPath, allowRoots, pin);
    await failpoint(`after-claim-cleanup:${entry.index}`);
    await requireHealthyCommittedOutputs({
      allowRoots,
      journal,
      journalPath,
      parentPins,
      scopeDir,
    });
  }
  await failpoint('before-journal-unlink');
  await requireHealthyCommittedOutputs({
    allowRoots,
    journal,
    journalPath,
    parentPins,
    scopeDir,
  });
}

async function prepareRecoveryBundle({ journal, journalPath, parentPins, scopeDir }) {
  const recoveryRoot = await ensurePrivateDirectory(join(scopeDir, 'recovery'), scopeDir);
  const generationDir = await ensurePrivateDirectory(
    join(recoveryRoot, journal.transactionId),
    recoveryRoot
  );
  for (const entry of journal.entries) {
    if (!entry.existed) continue;
    const existingRecovery = await inspectOptional(entry.recoveryPath);
    if (existingRecovery) {
      if (
        existingRecovery.hash !== entry.recoveryHash ||
        !(await isOwnerOnlyRegularFile(entry.recoveryPath))
      ) {
        throw new Error(`machine-local recovery material was modified: ${entry.recoveryPath}`);
      }
      continue;
    }
    const pin = parentPins.get(dirname(entry.path));
    const claim = await readFileNoFollow(pinnedChildPath(pin, entry.claimPath));
    if (sha256(claim) !== entry.recoveryHash) {
      throw new Error(`rollback claim changed before recovery bundling: ${entry.claimPath}`);
    }
    try {
      await writeExclusive(entry.recoveryPath, claim, 0o600);
    } catch (error) {
      if (
        error.code !== 'EEXIST' ||
        (await inspectRegularFile(entry.recoveryPath)).hash !== entry.recoveryHash ||
        !(await isOwnerOnlyRegularFile(entry.recoveryPath))
      ) {
        throw error;
      }
    }
    await syncDirectory(generationDir);
  }
  await writeDurableJson(journalPath, journal);
}

async function requireHealthyCommittedOutputs({
  allowRoots,
  journal,
  journalPath,
  parentPins,
  scopeDir,
}) {
  if (await installedOutputsMatch(journal.entries, parentPins)) return;
  await quarantineAndRestore({
    allowRoots,
    journal,
    journalPath,
    parentPins,
    scopeDir,
  });
  throw new Error(
    `transaction generation was quarantined during claim cleanup: ${journal.generationId}`
  );
}

async function cleanupEntries(entries, allowRoots, parentPins) {
  for (const entry of entries) await cleanupEntry(entry, allowRoots, parentPins);
}

async function cleanupEntry(entry, allowRoots, parentPins) {
  const pin = await pinForEntry(entry, allowRoots, parentPins);
  for (const path of [entry.stagePath, entry.claimPath, entry.discardPath]) {
    await unlinkOwnedArtifact(path, allowRoots, pin);
  }
}

async function pinForEntry(entry, allowRoots, parentPins) {
  const parent = dirname(entry.path);
  if (!parentPins.has(parent))
    parentPins.set(parent, await pinAllowedParent(entry.path, allowRoots));
  return parentPins.get(parent);
}

async function revalidateParentPins(parentPins) {
  for (const pin of parentPins.values()) await revalidatePinnedParent(pin);
}

async function verifyInstalledOutputs(entries, parentPins, timing) {
  for (const entry of entries) {
    const pin = parentPins.get(dirname(entry.path));
    if (entry.operation === 'delete') {
      if ((await inspectOptional(pinnedChildPath(pin, entry.path))) !== null) {
        throw new Error(`deleted target changed ${timing}: ${entry.path}`);
      }
      continue;
    }
    let current;
    try {
      current = await inspectRegularFile(pinnedChildPath(pin, entry.path));
    } catch (cause) {
      throw new Error(`installed target changed ${timing}: ${entry.path}`, { cause });
    }
    if (!entry.installed || current.hash !== entry.outputHash) {
      throw new Error(`installed target changed ${timing}: ${entry.path}`);
    }
  }
}

async function installedOutputsMatch(entries, parentPins) {
  try {
    await verifyInstalledOutputs(entries, parentPins, 'during recovery');
    return true;
  } catch {
    return false;
  }
}

async function quarantineAndRestore({ allowRoots, journal, journalPath, parentPins, scopeDir }) {
  journal.phase = 'quarantined';
  await writeDurableJson(journalPath, journal);
  const quarantineDir = await ensureQuarantineDirectory(scopeDir);

  for (const entry of journal.entries) {
    const pin = await pinForEntry(entry, allowRoots, parentPins);
    if (!entry.restored) {
      await quarantineEntry({
        allowRoots,
        entry,
        journal,
        journalPath,
        pin,
        quarantineDir,
      });
    }
    await verifyQuarantinedEntry(entry, pin);
  }
}

async function quarantineEntry({ allowRoots, entry, journal, journalPath, pin, quarantineDir }) {
  const discardPath = pinnedChildPath(pin, entry.discardPath);
  const interruptedDiscard = await inspectOptional(discardPath);
  if (interruptedDiscard) {
    if (!entry.quarantines.some((candidate) => candidate.hash === interruptedDiscard.hash)) {
      throw new Error(`untracked quarantine discard contents: ${entry.discardPath}`);
    }
    await unlink(discardPath);
    await pin.handle.sync();
  }

  for (let attempts = 0; attempts < 16; attempts += 1) {
    const targetPath = pinnedChildPath(pin, entry.path);
    const target = await inspectOptional(targetPath);
    if (target === null || (entry.existed && target.hash === entry.originalHash)) break;

    if (target.hash === entry.outputHash && entry.quarantines.length === 0) {
      await removeInstalledNoClobber(entry, entry.outputHash, allowRoots, pin);
    } else {
      await quarantineLiveTarget({ entry, journal, journalPath, pin, quarantineDir, target });
    }
  }

  const remaining = await inspectOptional(pinnedChildPath(pin, entry.path));
  if (remaining !== null && (!entry.existed || remaining.hash !== entry.originalHash)) {
    throw new Error(`cannot quarantine concurrently changing target: ${entry.path}`);
  }
  if (entry.existed && remaining === null) await restoreOriginal(entry, allowRoots, pin);
  for (const quarantine of entry.quarantines) {
    await unlinkOwnedArtifact(quarantine.localPath, allowRoots, pin);
  }
  await unlinkOwnedArtifact(entry.stagePath, allowRoots, pin);
  entry.restored = true;
  await writeDurableJson(journalPath, journal);
}

async function quarantineLiveTarget({ entry, journal, journalPath, pin, quarantineDir, target }) {
  let quarantine = entry.quarantines.find((candidate) => candidate.hash === target.hash);
  if (!quarantine) {
    const quarantineIndex = entry.quarantines.length;
    const localPath = quarantineArtifactPath(entry, journal.transactionId, quarantineIndex);
    const localDescriptorPath = pinnedChildPath(pin, localPath);
    try {
      await link(pinnedChildPath(pin, entry.path), localDescriptorPath);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const local = await inspectRegularFile(localDescriptorPath);
    if (local.hash !== target.hash) {
      throw new Error(`target changed while entering quarantine: ${entry.path}`);
    }
    const path = join(
      quarantineDir,
      `${journal.transactionId}-${entry.index}-${quarantineIndex}.bin`
    );
    const bytes = await readFileNoFollow(localDescriptorPath);
    try {
      await writeExclusive(path, bytes, 0o600);
    } catch (error) {
      if (
        error.code !== 'EEXIST' ||
        (await inspectRegularFile(path)).hash !== local.hash ||
        !(await isOwnerOnlyRegularFile(path))
      )
        throw error;
    }
    await syncDirectory(quarantineDir);
    quarantine = { hash: local.hash, localPath, path };
    entry.quarantines.push(quarantine);
    await writeDurableJson(journalPath, journal);
  }

  await removeLiveTarget(entry, quarantine.hash, pin);
  await unlinkOwnedArtifact(quarantine.localPath, [pin.parent], pin);
}

async function removeLiveTarget(entry, expectedHash, pin) {
  const targetPath = pinnedChildPath(pin, entry.path);
  const discardPath = pinnedChildPath(pin, entry.discardPath);
  const existingDiscard = await inspectOptional(discardPath);
  if (existingDiscard) {
    if (existingDiscard.hash !== expectedHash) {
      throw new Error(`unexpected quarantine discard contents: ${entry.discardPath}`);
    }
    if ((await inspectOptional(targetPath)) === null) {
      await unlink(discardPath);
      await pin.handle.sync();
      return;
    }
    await unlink(discardPath);
  }

  await rename(targetPath, discardPath);
  const discarded = await inspectRegularFile(discardPath);
  if (discarded.hash !== expectedHash) {
    try {
      await link(discardPath, targetPath);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    throw new Error(`target changed while being quarantined: ${entry.path}`);
  }
  await unlink(discardPath);
  await pin.handle.sync();
}

async function verifyQuarantinedEntry(entry, pin) {
  const target = await inspectOptional(pinnedChildPath(pin, entry.path));
  if (entry.existed ? target?.hash !== entry.originalHash : target !== null) {
    throw new Error(`quarantined target is not safely restored: ${entry.path}`);
  }
  if (entry.existed) {
    const claim = await inspectOptional(pinnedChildPath(pin, entry.claimPath));
    const recovery = await inspectOptional(entry.recoveryPath);
    const recoveryUsable =
      recovery?.hash === entry.recoveryHash && (await isOwnerOnlyRegularFile(entry.recoveryPath));
    if (claim?.hash !== entry.originalHash && !recoveryUsable) {
      throw new Error(`quarantined transaction recovery material is not retained: ${entry.path}`);
    }
  }
  for (const quarantine of entry.quarantines) {
    if (
      (await inspectRegularFile(quarantine.path)).hash !== quarantine.hash ||
      !(await isOwnerOnlyRegularFile(quarantine.path))
    ) {
      throw new Error(`machine-local quarantine was modified: ${quarantine.path}`);
    }
  }
}

async function ensureQuarantineDirectory(scopeDir) {
  return await ensurePrivateDirectory(join(scopeDir, 'quarantine'), scopeDir);
}

async function ensurePrivateDirectory(path, parent) {
  if (dirname(path) !== parent)
    throw new Error(`private recovery directory escapes parent: ${path}`);
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
    throw new Error(`machine-local recovery path is not a canonical private directory: ${path}`);
  }
  await syncDirectory(parent);
  return path;
}

async function restoreOriginal(entry, allowRoots, pin) {
  const recovery = await inspectOptional(entry.recoveryPath);
  if (recovery?.hash === entry.recoveryHash && (await isOwnerOnlyRegularFile(entry.recoveryPath))) {
    const stagePath = pinnedChildPath(pin, entry.stagePath);
    const existingStage = await inspectOptional(stagePath);
    if (existingStage && existingStage.hash !== entry.recoveryHash) {
      await unlinkOwnedArtifact(entry.stagePath, allowRoots, pin);
    }
    if (!existingStage || existingStage.hash !== entry.recoveryHash) {
      await writeExclusive(stagePath, await readFileNoFollow(entry.recoveryPath), 0o600);
    }
    await installNoClobber(
      entry.stagePath,
      entry.path,
      entry.recoveryHash,
      allowRoots,
      entry.originalMode,
      pin
    );
    return;
  }
  await restoreClaimNoClobber(entry, allowRoots, pin);
}

async function isOwnerOnlyRegularFile(path) {
  const info = await lstat(path);
  return info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0;
}

async function inspectOptional(path) {
  try {
    return await inspectRegularFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function unlinkIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function artifactPath(path, kind, transactionId, index) {
  return join(dirname(path), `.maude-${kind}-${transactionId}-${index}`);
}

function validateArtifact(path, target, kind, transactionId, index, journalPath) {
  if (
    typeof path !== 'string' ||
    dirname(path) !== dirname(target) ||
    basename(path) !== `.maude-${kind}-${transactionId}-${index}`
  ) {
    throw new Error(`invalid transaction journal artifact in ${journalPath}`);
  }
}

function validateQuarantine(quarantine, entry, journal, quarantineIndex, journalPath) {
  if (
    !isPlainObject(quarantine) ||
    !exactKeys(quarantine, ['hash', 'localPath', 'path']) ||
    !HASH.test(quarantine.hash ?? '') ||
    quarantine.localPath !==
      quarantineArtifactPath(entry, journal.transactionId, quarantineIndex) ||
    quarantine.path !==
      join(
        dirname(journalPath),
        'quarantine',
        `${journal.transactionId}-${entry.index}-${quarantineIndex}.bin`
      )
  ) {
    throw new Error(`invalid transaction quarantine in ${journalPath}`);
  }
}

function quarantineArtifactPath(entry, transactionId, quarantineIndex) {
  return join(
    dirname(entry.path),
    `.maude-quarantine-${transactionId}-${entry.index}-${quarantineIndex}`
  );
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

function validateRequest({ generationId, outputs, scopeDir }) {
  if (
    !GENERATION.test(generationId ?? '') ||
    !scopeDir ||
    (!Array.isArray(outputs) && typeof outputs !== 'function')
  ) {
    throw new Error('transaction requires a safe generationId, scopeDir, and outputs');
  }
  if (Array.isArray(outputs)) validateOutputs(outputs);
}

function validateOutputs(outputs) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new Error('transaction requires at least one output');
  }
  const paths = new Set();
  for (const output of outputs) {
    const operation = output?.operation ?? 'write';
    if (
      !output?.path ||
      !['delete', 'restore', 'write'].includes(operation) ||
      (operation !== 'delete' &&
        !Buffer.isBuffer(output.contents) &&
        typeof output.contents !== 'string')
    ) {
      throw new Error(
        'every transaction output requires a path, valid operation, and required contents'
      );
    }
    if (paths.has(output.path)) throw new Error(`duplicate transaction output: ${output.path}`);
    if (output.expectedHash !== undefined && !HASH.test(output.expectedHash)) {
      throw new Error(`invalid expected output hash: ${output.path}`);
    }
    paths.add(output.path);
  }
}

async function assertGeneration(expectedGenerationId, readGenerationId) {
  if (expectedGenerationId === undefined) return;
  if (typeof readGenerationId !== 'function') {
    throw new Error('generation CAS requires readGenerationId');
  }
  const current = await readGenerationId();
  if (current !== expectedGenerationId) {
    throw new Error(
      `managed generation changed concurrently: expected ${expectedGenerationId ?? 'none'}, found ${current ?? 'none'}`
    );
  }
}
