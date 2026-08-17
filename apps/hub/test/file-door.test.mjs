// The single file write door — Sync v2 (DDR-226 §5).
//
// Two things justify a new door beside the existing ones, and both are tested
// here because both are safety properties rather than conveniences:
//
//   • **Compare-and-swap.** Without it, two peers editing one file inside a
//     poll round-trip resolve as silent last-writer-wins AT THE DOOR — no
//     conflict copy materializes anywhere, and "both ends SEE it" is false in
//     exactly the concurrent case the guarantee exists for.
//   • **The owner gate on code modules.** Until now the receiver gated them and
//     the door did not, so any peer token could land executable modules in a
//     project's `system/**` and the only thing stopping them was that other
//     peers would decline to pull them. A gate on one side is half a gate.
//
// Everything else the door does — shape, containment, class admission, caps —
// is DDR-217's, unchanged, and is covered where those rules live.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { handleFileDoor, parseFileDoorPath } from '../src/file-door.mjs';
import { closeJournal, openJournal } from '../src/journal.mjs';
import { addToken } from '../src/tokens.mjs';

let dataDir;
let designRoot;
let token;
let ownerToken;

const sha = (s) => createHash('sha256').update(s).digest('hex');

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'file-door-data-'));
  designRoot = mkdtempSync(join(tmpdir(), 'file-door-root-'));
  mkdirSync(join(designRoot, 'system/ds/preview'), { recursive: true });
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  writeFileSync(join(designRoot, 'config.json'), '{"canvasGroups":[{"path":"system"}]}');
  token = addToken(dataDir, { label: 'peer', scope: '*' }).value;
  ownerToken = addToken(dataDir, { label: 'owner-peer', scope: '*', role: 'owner' }).value;
});

afterEach(() => {
  closeJournal(dataDir);
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(designRoot, { recursive: true, force: true });
});

/** A request/response pair the door can answer into. */
function exchange({ rel, body = 'BYTES', headers = {}, method = 'PUT', bearer = token }) {
  const chunks = body === null ? [] : [Buffer.from(body)];
  const request = {
    headers: { authorization: bearer ? `Bearer ${bearer}` : undefined, ...headers },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
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
  return {
    request,
    response,
    method,
    pathname: `/api/file/${rel}`,
    result: () => ({ status, json: payload ? JSON.parse(payload) : null }),
  };
}

const call = async (ex, over = {}) => {
  const journal = openJournal(dataDir);
  const handled = await handleFileDoor({
    request: ex.request,
    response: ex.response,
    pathname: ex.pathname,
    method: ex.method,
    dataDir,
    secret: '',
    designRoot,
    journal,
    onWritten: ({ path }) => journal.recordWrite({ designRoot, path, source: 'peer-put' }),
    ...over,
  });
  return { handled, ...ex.result() };
};

describe('parseFileDoorPath', () => {
  it('accepts an ordinary project path', () => {
    assert.equal(parseFileDoorPath('/api/file/system/ds/brand.css'), 'system/ds/brand.css');
  });

  it('refuses traversal, absolutes and control characters outright', () => {
    for (const p of [
      '/api/file/../../etc/passwd',
      '/api/file//etc/passwd',
      '/api/file/a/./b',
      '/api/file/a/../b',
      '/api/file/',
      '/api/files/x',
    ]) {
      assert.equal(parseFileDoorPath(p), null, p);
    }
  });

  it('is not this handler’s business for another route', () => {
    assert.equal(parseFileDoorPath('/api/journal'), null);
  });
});

describe('the door writes, and answers with a receipt', () => {
  it('lands the bytes and returns the seq the doručenka needs', async () => {
    const res = await call(exchange({ rel: 'system/ds/brand.css', body: ':root{}' }));
    assert.equal(res.status, 200);
    assert.equal(res.json.sha256, sha(':root{}'));
    assert.equal(typeof res.json.seq, 'number');
    assert.equal(readFileSync(join(designRoot, 'system/ds/brand.css'), 'utf8'), ':root{}');
  });

  it('refuses a body whose declared hash is not what arrived', async () => {
    // A declared hash is a claim; the bytes are the fact. A mismatch is a
    // truncated or tampered upload and the partial is discarded, not kept.
    const res = await call(
      exchange({
        rel: 'system/ds/brand.css',
        body: 'real bytes',
        headers: { 'x-maude-content-sha256': sha('different bytes') },
      })
    );
    assert.equal(res.status, 400);
    assert.equal(existsSync(join(designRoot, 'system/ds/brand.css')), false);
  });

  it('refuses a read-only token', async () => {
    const ro = addToken(dataDir, { label: 'viewer', scope: '*', readOnly: true }).value;
    const res = await call(exchange({ rel: 'system/ds/brand.css', bearer: ro }));
    assert.equal(res.status, 403);
  });

  it('a missing credential and a bad one are the same answer', async () => {
    for (const bearer of [null, 'mau_nope']) {
      const res = await call(exchange({ rel: 'system/ds/brand.css', bearer }));
      assert.equal(res.status, 401);
    }
  });

  it('refuses a path the classifier does not admit', async () => {
    // `config.json` is `never`: a hub that can write it can re-point the sync.
    const res = await call(exchange({ rel: 'config.json', body: '{}' }));
    assert.equal(res.status, 400);
    assert.match(readFileSync(join(designRoot, 'config.json'), 'utf8'), /canvasGroups/);
  });

  it('refuses a method that is not PUT', async () => {
    const res = await call(exchange({ rel: 'system/ds/brand.css', method: 'GET' }));
    assert.equal(res.status, 405);
  });
});

describe('compare-and-swap — why this door exists', () => {
  it('"the hub must hold nothing" succeeds on a first write', async () => {
    const res = await call(
      exchange({
        rel: 'system/ds/brand.css',
        body: 'v1',
        headers: { 'x-maude-expect-hash': 'none' },
      })
    );
    assert.equal(res.status, 200);
  });

  it('…and is REFUSED once the hub holds something', async () => {
    await call(exchange({ rel: 'system/ds/brand.css', body: 'v1' }));
    const res = await call(
      exchange({
        rel: 'system/ds/brand.css',
        body: 'v2',
        headers: { 'x-maude-expect-hash': 'none' },
      })
    );
    assert.equal(res.status, 409);
    assert.equal(res.json.current, sha('v1'));
    // The bytes on disk are untouched — a refused CAS writes nothing.
    assert.equal(readFileSync(join(designRoot, 'system/ds/brand.css'), 'utf8'), 'v1');
  });

  it('an expectation that MATCHES lands', async () => {
    await call(exchange({ rel: 'system/ds/brand.css', body: 'v1' }));
    const res = await call(
      exchange({
        rel: 'system/ds/brand.css',
        body: 'v2',
        headers: { 'x-maude-expect-hash': sha('v1') },
      })
    );
    assert.equal(res.status, 200);
    assert.equal(readFileSync(join(designRoot, 'system/ds/brand.css'), 'utf8'), 'v2');
  });

  it('a STALE expectation is refused, and the answer says what to re-decide against', async () => {
    // The live-concurrent case: we decided from v1, somebody landed v2, and
    // our upload must not silently become v3-over-v2.
    await call(exchange({ rel: 'system/ds/brand.css', body: 'v1' }));
    await call(exchange({ rel: 'system/ds/brand.css', body: 'v2' }));
    const res = await call(
      exchange({
        rel: 'system/ds/brand.css',
        body: 'mine',
        headers: { 'x-maude-expect-hash': sha('v1') },
      })
    );
    assert.equal(res.status, 409);
    assert.equal(res.json.current, sha('v2'));
    assert.equal(readFileSync(join(designRoot, 'system/ds/brand.css'), 'utf8'), 'v2');
  });

  it('NO expectation still works — an older client is not locked out', async () => {
    // The compat matrix is binding: a peer that predates CAS keeps writing.
    await call(exchange({ rel: 'system/ds/brand.css', body: 'v1' }));
    const res = await call(exchange({ rel: 'system/ds/brand.css', body: 'v2' }));
    assert.equal(res.status, 200);
  });
});

describe('the owner gate on code modules — new, and at the DOOR', () => {
  it('an ordinary peer token cannot land executable modules', async () => {
    const res = await call(
      exchange({ rel: 'system/ds/preview/_x.ts', body: 'export const a = 1' })
    );
    assert.equal(res.status, 403);
    assert.equal(existsSync(join(designRoot, 'system/ds/preview/_x.ts')), false);
  });

  it('an owner-scoped one can', async () => {
    const res = await call(
      exchange({
        rel: 'system/ds/preview/_x.ts',
        body: 'export const a = 1',
        bearer: ownerToken,
      })
    );
    assert.equal(res.status, 200);
    assert.equal(existsSync(join(designRoot, 'system/ds/preview/_x.ts')), true);
  });

  it('and the gate is about the CLASS, not the caller’s luck with a path', async () => {
    // Media is admitted for any writer; the gate is narrow on purpose.
    const res = await call(exchange({ rel: 'assets/x.png', body: 'PNG' }));
    assert.equal(res.status, 200);
  });
});

describe('a hub with no checkout', () => {
  it('answers 405 rather than pretending to accept', async () => {
    const res = await call(exchange({ rel: 'system/ds/brand.css' }), {
      designRoot: null,
      journal: null,
    });
    assert.equal(res.status, 405);
  });
});
