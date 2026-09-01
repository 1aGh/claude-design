import { createHash } from 'node:crypto';

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

export function createEnvironmentIR(items) {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      id: item.id ?? `${item.category}:${item.name}`,
      contributors: [...(item.contributors ?? [])].sort(compareContributors),
      secretReferences: item.secretReferences ?? findSecretReferences(item.value),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (let index = 1; index < normalizedItems.length; index += 1) {
    if (normalizedItems[index - 1].id === normalizedItems[index].id) {
      throw new Error(
        `duplicate Claude inventory identity ${normalizedItems[index].id}: ${normalizedItems[index - 1].sourcePath} and ${normalizedItems[index].sourcePath}`
      );
    }
  }
  const sources = [
    ...new Set(normalizedItems.flatMap((item) => item.contributors.map(sourceKey))),
  ].sort();
  const payload = { schemaVersion: 1, items: normalizedItems, sources };
  const serialized = stableStringify(payload);
  return { ...payload, serialized, generationHash: sha256(serialized) };
}

export function findSecretReferences(value) {
  const references = new Map();
  visitStrings(value, (candidate) => {
    for (const match of candidate.matchAll(/\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]*)?\}/g)) {
      references.set(`env:${match[1]}`, { kind: 'env', name: match[1] });
    }
    for (const match of candidate.matchAll(/\{env:([A-Z_][A-Z0-9_]*)\}/g)) {
      references.set(`env:${match[1]}`, { kind: 'env', name: match[1] });
    }
    for (const match of candidate.matchAll(/\bkeychain:([A-Za-z0-9._/-]+)/g)) {
      references.set(`keychain:${match[1]}`, { kind: 'keychain', name: match[1] });
    }
  });
  return [...references.values()].sort((left, right) =>
    `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`)
  );
}

function compareContributors(left, right) {
  return (
    left.precedence - right.precedence ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.sourceHash.localeCompare(right.sourceHash)
  );
}

function sourceKey(contributor) {
  return `${contributor.precedence}:${contributor.scope}:${contributor.sourcePath}:${contributor.sourceHash}`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortValue(nested)])
  );
}

function visitStrings(value, visit) {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const nested of value) visitStrings(nested, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const nested of Object.values(value)) visitStrings(nested, visit);
}
