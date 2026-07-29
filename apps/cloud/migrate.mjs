// Schema migration — Cloud Phase 12.
//
// schema.sql is IF-NOT-EXISTS throughout, so "migrate" is "apply it again":
// proven idempotent against the live D1 (applied 2026-07-28, re-run 2026-07-29
// with changed_db:false on every statement). This module exists so tests, the
// local sqlite tools and any future runner all split the file the same way —
// a second, slightly different splitter is how statement 7 silently never runs.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** schema.sql as an ordered list of executable statements. */
export function schemaStatements() {
  const raw = readFileSync(join(here, 'schema.sql'), 'utf8');
  return raw
    .replace(/--[^\n]*/g, '') // comments carry no semantics for the engine
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s};`);
}

/** Apply the schema through a D1-shaped binding. Safe to run repeatedly. */
export async function applySchema(db) {
  for (const sql of schemaStatements()) {
    await db.prepare(sql).run();
  }
  const row = await db.prepare('SELECT MAX(version) AS v FROM schema_migrations').first();
  return { version: row?.v ?? null, statements: schemaStatements().length };
}
