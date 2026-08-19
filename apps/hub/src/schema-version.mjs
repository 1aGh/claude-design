// Which schema is this database? — Track A' A2.
//
// NOW OR NEVER, which is the whole reason this ships with Phase 0 rather than
// with the migration runner that will eventually want it. An UNSTAMPED
// database is ambiguous forever: a future migration meeting one cannot tell
// "this predates versioning" from "this is version N and somebody cleared the
// pragma", so it has to guess, and guessing wrong on a schema migration is how
// you corrupt the one copy of somebody's account table. Every self-hoster who
// deploys before the stamp exists creates a database with that ambiguity baked
// in. The stamp costs five lines and closes it permanently.
//
// The COMMAND (`maude hub upgrade`) is deliberately NOT here. It has no
// now-or-never property — it gets strictly easier to write once every database
// in the field is already stamped — and today it would be a migration runner
// with zero migrations.
//
// `PRAGMA user_version` is SQLite's own four bytes in the header, reserved for
// exactly this. It costs nothing to read, survives VACUUM INTO (so it rides
// the backup generations), and needs no table of our own.

/** Bump when a database's shape changes in a way a migration must know about. */
export const SCHEMA_VERSION = 1;

/**
 * Stamp a freshly opened database, and report what was there before.
 *
 * Called at open time, after the `CREATE TABLE IF NOT EXISTS` block: by then
 * the shape is whatever this build makes it, so recording the version is a
 * statement of fact rather than a promise.
 *
 * A database stamped NEWER than this build is left alone and reported. That is
 * a downgrade — the operator rolled back an image over a database a later
 * version already touched — and silently re-stamping it downwards would erase
 * the only evidence of it.
 *
 * @returns {{ found: number, stamped: number, downgrade: boolean }}
 */
export function stampSchemaVersion(handle, version = SCHEMA_VERSION) {
  const found = Number(handle.pragma('user_version', { simple: true })) || 0;
  if (found > version) return { found, stamped: found, downgrade: true };
  if (found !== version) handle.pragma(`user_version = ${version}`);
  return { found, stamped: version, downgrade: false };
}
