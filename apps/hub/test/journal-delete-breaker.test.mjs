// The hub-side deletion breaker — F-1 of the v1.0.0 gate set.
//
// WHY THIS FILE EXISTS. `propagateDeletes` shipped ON rather than after a soak
// release, and the argument for that was "the breakers carry the weight the
// soak window would have carried". The breakers were the DESKTOP's. The hub had
// none: it accepted an unbounded stream of tombstones at the write door, and
// `replayTail` re-classified every replayed row (so a `never`-class path could
// not be injected) while trusting `deleted` verbatim — a distinction that did
// not matter until Increment 6 wired tombstone application, and journal.mjs's
// own containment comment said so in as many words.
//
// A tombstone admitted at the hub is a delete EVERY PEER applies, so this is
// the lossy direction and the one worth pinning. Both doors are covered here:
//
//   • the HTTP door (`handleFileDoor`, method DELETE)
//   • the R2 tail replay (`replayTail`)
//
// The control is a RATE, not a permission — same shape and same numbers as
// `apps/studio/sync/file-plane.ts`, because two different ceilings on one harm
// would just mean the lower one is real and the other is decoration.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { handleFileDoor } from '../src/file-door.mjs';
import {
  closeJournal,
  DELETE_BUDGET_PER_WINDOW,
  DELETE_BUDGET_WINDOW_MS,
  openJournal,
} from '../src/journal.mjs';
import { addToken } from '../src/tokens.mjs';

let dataDir;
let designRoot;
let ownerToken;
let peerToken;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'del-breaker-data-'));
  designRoot = mkdtempSync(join(tmpdir(), 'del-breaker-root-'));
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  mkdirSync(join(designRoot, 'system/ds'), { recursive: true });
  writeFileSync(join(designRoot, 'config.json'), '{"canvasGroups":[{"path":"system"}]}');
  ownerToken = addToken(dataDir, { label: 'owner', scope: '*', role: 'owner' }).value;
  peerToken = addToken(dataDir, { label: 'peer', scope: '*' }).value;
});

afterEach(() => {
  closeJournal(dataDir);
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(designRoot, { recursive: true, force: true });
});

/** Put a real file on the hub's disk and give it a journal row. */
function seedFile(journal, rel, body = 'BYTES') {
  const abs = join(designRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
  journal.recordWrite({ designRoot, path: rel, source: 'peer-put' });
  return rel;
}

async function doorDelete(rel, bearer = ownerToken) {
  const journal = openJournal(dataDir);
  const request = {
    headers: { authorization: `Bearer ${bearer}` },
    async *[Symbol.asyncIterator]() {},
  };
  let status = 0;
  let payload = '';
  const response = new Writable({
    write(c, _e, cb) {
      payload += c;
      cb();
    },
  });
  response.writeHead = (s) => {
    status = s;
    return response;
  };
  await handleFileDoor({
    request,
    response,
    pathname: `/api/file/${rel}`,
    method: 'DELETE',
    dataDir,
    secret: '',
    designRoot,
    journal,
    onWritten: ({ path }) => journal.recordWrite({ designRoot, path, source: 'peer-put' }),
    onDeleted: ({ path }) =>
      journal.recordWrite({ designRoot, path, source: 'peer-put', deleted: true }),
  });
  return { status, json: payload ? JSON.parse(payload) : null };
}

describe('the delete breaker at the HTTP door', () => {
  it('lets an ordinary deletion through', async () => {
    const journal = openJournal(dataDir);
    seedFile(journal, 'assets/one.png');
    const res = await doorDelete('assets/one.png');
    assert.equal(res.status, 200);
    assert.equal(res.json.deleted, true);
  });

  it('refuses once the window budget is spent, and says what it refused on', async () => {
    const journal = openJournal(dataDir);
    // Fill the window to the ceiling.
    for (let i = 0; i < DELETE_BUDGET_PER_WINDOW; i += 1) {
      const rel = `assets/spent-${i}.png`;
      seedFile(journal, rel);
      const ok = await doorDelete(rel);
      assert.equal(ok.status, 200, `deletion ${i} should be inside the budget`);
    }

    seedFile(journal, 'assets/one-too-many.png');
    const res = await doorDelete('assets/one-too-many.png');

    // 429, not 403: the credential and the path are both fine — this is a rate.
    assert.equal(res.status, 429);
    assert.match(res.json.error, /deletion breaker/i);
    assert.equal(res.json.limit, DELETE_BUDGET_PER_WINDOW);
    assert.equal(res.json.windowMs, DELETE_BUDGET_WINDOW_MS);
  });

  it('does not quarantine the file it refuses — the refusal leaves no trace on disk', async () => {
    const journal = openJournal(dataDir);
    for (let i = 0; i < DELETE_BUDGET_PER_WINDOW; i += 1) {
      const rel = `assets/spent-${i}.png`;
      seedFile(journal, rel);
      await doorDelete(rel);
    }
    seedFile(journal, 'assets/survivor.png', 'STILL HERE');
    const res = await doorDelete('assets/survivor.png');
    assert.equal(res.status, 429);
    // The point of checking BEFORE the quarantine: a refused delete must not
    // have already moved the file into _trash/.
    assert.equal(
      readIfPresent(join(designRoot, 'assets/survivor.png')),
      'STILL HERE',
      'a refused deletion must leave the file exactly where it was'
    );
  });

  it('the OWNER gate still applies to a delete, independently of the budget', async () => {
    // The door computes the class and refuses a non-owner BEFORE dispatching to
    // the delete handler, so a peer token cannot delete a code module. Budget is
    // untouched here — this is a permission, not a rate.
    const journal = openJournal(dataDir);
    seedFile(journal, 'system/ds/tokens.ts', 'export const x = 1;');
    const res = await doorDelete('system/ds/tokens.ts', peerToken);
    assert.equal(res.status, 403);
  });
});

describe('the delete breaker on the R2 tail replay', () => {
  it('applies tombstones up to the budget and refuses the rest as malformed', () => {
    const journal = openJournal(dataDir);
    // Rows well past the head, so nothing is skipped as already-seen.
    const lines = [];
    const total = DELETE_BUDGET_PER_WINDOW + 5;
    for (let i = 0; i < total; i += 1) {
      lines.push(
        JSON.stringify({
          seq: 1000 + i,
          path: `assets/tail-${i}.png`,
          sha256: null,
          size: null,
          mtimeMs: null,
          class: 'inert-media',
          deleted: true,
          source: 'tail-replay',
          atMs: Date.now(),
        })
      );
    }
    const res = journal.replayTail(lines.join('\n'), { designRoot });

    assert.equal(
      res.applied,
      DELETE_BUDGET_PER_WINDOW,
      'a tail may not apply more tombstones than the window allows'
    );
    assert.equal(res.malformed, 5, 'the overflow counts as malformed — the drill’s own counter');
  });

  it('the budget is CUMULATIVE — a replay cannot top it back up', () => {
    const journal = openJournal(dataDir);
    // Spend most of the window through the ordinary append path first.
    const spent = DELETE_BUDGET_PER_WINDOW - 3;
    for (let i = 0; i < spent; i += 1) {
      const rel = `assets/pre-${i}.png`;
      seedFile(journal, rel);
      journal.recordWrite({ designRoot, path: rel, source: 'peer-put', deleted: true });
    }

    const lines = [];
    for (let i = 0; i < 10; i += 1) {
      lines.push(
        JSON.stringify({
          seq: 5000 + i,
          path: `assets/tail-${i}.png`,
          class: 'inert-media',
          deleted: true,
          source: 'tail-replay',
          atMs: Date.now(),
        })
      );
    }
    const res = journal.replayTail(lines.join('\n'), { designRoot });
    assert.equal(res.applied, 3, 'only the remaining window budget is available to the tail');
    assert.equal(res.malformed, 7);
  });

  it('non-tombstone rows are unaffected by the deletion budget', () => {
    const journal = openJournal(dataDir);
    // Exhaust the deletion budget entirely.
    for (let i = 0; i < DELETE_BUDGET_PER_WINDOW; i += 1) {
      const rel = `assets/pre-${i}.png`;
      seedFile(journal, rel);
      journal.recordWrite({ designRoot, path: rel, source: 'peer-put', deleted: true });
    }
    const lines = [];
    for (let i = 0; i < 6; i += 1) {
      lines.push(
        JSON.stringify({
          seq: 9000 + i,
          path: `assets/write-${i}.png`,
          sha256: 'a'.repeat(64),
          size: 7,
          class: 'inert-media',
          deleted: false,
          source: 'tail-replay',
          atMs: Date.now(),
        })
      );
    }
    const res = journal.replayTail(lines.join('\n'), { designRoot });
    assert.equal(res.applied, 6, 'a spent DELETION budget must not block ordinary writes');
    assert.equal(res.malformed, 0);
  });
});

function readIfPresent(abs) {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}
