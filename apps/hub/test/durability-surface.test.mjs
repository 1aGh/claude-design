// Durability is STATE, not a log line — Phase 0 F5.
//
// The write-side refusal (F1) trades one silent failure for another unless
// somebody sees it: a hub that refuses to write is protecting a peer's history
// and none of its own. `scheduleBackups` deliberately catches, logs and keeps
// the interval running — its own docstring names the failure mode it is
// avoiding ("we had backups until March") — so the refusal recurs every six
// hours into a stream nobody tails.
//
// These tests pin the two properties that make the trade safe: the state
// reaches a caller, and it does NOT reach `/health`.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { fileTarget, scheduleBackups } from '../src/backup.mjs';
import { ensureWorkspaceId } from '../src/workspace-identity.mjs';

const Database = createRequire(import.meta.url)('better-sqlite3');
const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-durability-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function seedDataDir(dir) {
  const db = new Database(join(dir, 'hub.db'));
  db.exec('CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, data BLOB)');
  db.prepare('INSERT OR REPLACE INTO documents VALUES (?, ?)').run('c', Buffer.from('x'));
  db.close();
  return dir;
}

/** Wait for `onStatus` to fire once, then stop the schedule. */
function firstStatus({ dataDir, target }) {
  return new Promise((resolve) => {
    const stop = scheduleBackups({
      dataDir,
      target,
      intervalMs: 15,
      log: { log() {}, error() {} },
      onStatus: (s) => {
        stop();
        resolve(s);
      },
    });
  });
}

test('/health never carries durability — degradation is not a liveness signal', () => {
  // The obvious move is to flip `/health` unhealthy: the HEALTHCHECK is already
  // in the Dockerfile and needs no UI. It is wrong twice over. Under compose
  // restart policies or ECS health-based replacement it kills or cycles a hub
  // that is up and serving correctly, trading no-durability for an outage; and
  // `/health` is unauthenticated, so naming the conflicting workspace there
  // would leak it to anyone who can reach the port.
  //
  // A source-level pin, because this is a trap a later edit walks into while
  // trying to be helpful.
  const src = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  const at = src.indexOf("url === '/health'");
  assert.ok(at > 0, 'the /health handler moved — re-point this pin');
  // The handler is short; a generous window still ends well before /admin.
  const body = src.slice(at, at + 2000);
  assert.ok(
    !/durability/.test(body),
    'durability reached /health: degradation is a report, not a liveness signal'
  );
});

test('a healthy tick reports ok with the generation it wrote', async () => {
  const target = fileTarget(`file://${freshDir()}`);
  const s = await firstStatus({ dataDir: seedDataDir(freshDir()), target });
  assert.equal(s.state, 'ok');
  assert.match(s.generation, /^backups\//);
});

test('an identity conflict is reported as STATE, naming the other workspace', async () => {
  // The assertion that makes the F1 refusal safe to ship. Without it the hub
  // silently stops having backups.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const hubA = seedDataDir(freshDir());
  await firstStatus({ dataDir: hubA, target });

  const s = await firstStatus({ dataDir: seedDataDir(freshDir()), target });
  assert.equal(s.state, 'identity-conflict');
  assert.equal(s.conflictWith, ensureWorkspaceId(hubA));
  assert.match(s.message, /another workspace/);
});

test('the schedule keeps running after a refusal rather than wedging', async () => {
  // `scheduleBackups` catches by design: "a network error must not silently end
  // all future backups". A refusal must not become the exception to that, or a
  // transient conflict would permanently disable durability.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  await firstStatus({ dataDir: seedDataDir(freshDir()), target });

  const dataDir = seedDataDir(freshDir());
  const seen = [];
  await new Promise((resolve) => {
    const stop = scheduleBackups({
      dataDir,
      target,
      intervalMs: 15,
      log: { log() {}, error() {} },
      onStatus: (s) => {
        seen.push(s.state);
        if (seen.length === 2) {
          stop();
          resolve();
        }
      },
    });
  });
  assert.deepEqual(seen, ['identity-conflict', 'identity-conflict']);
});
