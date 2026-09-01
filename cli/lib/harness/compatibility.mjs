export const HARNESS_MANIFEST_SCHEMA_VERSION = 1;

export const TARGET_COMPATIBILITY = Object.freeze({
  codex: Object.freeze({ version: '0.152.0' }),
  opencode: Object.freeze({ version: '1.18.25' }),
});

export function assertTargetVersion(target, observedVersion) {
  const supported = TARGET_COMPATIBILITY[target]?.version;
  if (!supported) throw new Error(`unknown harness target ${target}`);
  if (!observedVersion || observedVersion === supported) return;

  throw new Error(
    `unsupported ${target} version ${observedVersion}; this Maude release supports ${supported}. ` +
      `Upgrade Maude with \`npm install -g @1agh/maude@latest\` for a newer compatibility registry, ` +
      `or install ${target} ${supported}, then rerun \`maude harness check\`. No target files were changed.`
  );
}

export function unsupportedManifestSchemaMessage(path, observedVersion) {
  return (
    `unsupported harness manifest schema ${String(observedVersion)} in ${path}; ` +
    `this Maude release supports schema ${HARNESS_MANIFEST_SCHEMA_VERSION}. ` +
    'Upgrade Maude with `npm install -g @1agh/maude@latest`, then rerun `maude harness check`. ' +
    'Do not delete the manifest or its backups; no target files were changed.'
  );
}
