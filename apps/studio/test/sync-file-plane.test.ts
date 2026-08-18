// The file plane, both directions — Sync v2 Increment 3 (DDR-226 §§3–7).
//
// `decide-file.ts` proves the TABLE and `file-ledger.ts` proves the ORDERING.
// This proves the thing neither can: that a real pass reads a journal, scans a
// real tree, and carries out what the table said — moving bytes the right way,
// parking what must be parked, and refusing what a receiver must refuse.
//
// The hub here is a fixture, not a stub of our own logic: it answers the real
// wire shapes (`GET /api/journal`, `GET /_project-file/`, `PUT /api/file/`)
// and enforces the compare-and-swap, so a client that gets the protocol wrong
// fails here rather than in production.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFileLedger, type FileLedger } from '../sync/file-ledger.ts';
import {
  createFilePlane,
  DELETE_BUDGET_PER_WINDOW,
  foldRemote,
  REANCHOR_STORM_LIMIT,
  scanLocalFiles,
} from '../sync/file-plane.ts';

const HUB = 'https://hub.test';
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

let root: string;
let ledger: FileLedger;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'file-plane-'));
  mkdirSync(join(root, 'system/ds'), { recursive: true });
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'config.json'), '{"canvasGroups":[{"path":"system"},{"path":"ui"}]}');
  ledger = createFileLedger({ designRoot: root, hubUrl: HUB, flushMs: 0 });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A hub that answers the real routes and enforces the real preconditions. */
function fakeHub(initial: Record<string, string> = {}) {
  let seq = 0;
  const rows = new Map<
    string,
    { seq: number; sha256: string | null; size: number; body: string; deleted?: boolean }
  >();
  const puts: { rel: string; expect: string | null; body: string }[] = [];
  const deletes: string[] = [];
  let lieAboutSize = false;
  let forceReanchor = false;
  let reanchorBudget = 0;
  let epochValue = 'epoch-1';
  const add = (rel: string, body: string) => {
    seq += 1;
    rows.set(rel, { seq, sha256: sha(body), size: body.length, body });
  };
  for (const [rel, body] of Object.entries(initial)) add(rel, body);

  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    if (u.pathname === '/api/journal') {
      const since = Number(u.searchParams.get('since') ?? '0');
      const askedEpoch = u.searchParams.get('epoch');
      if (reanchorBudget > 0) {
        reanchorBudget -= 1;
        return new Response(JSON.stringify({ epoch: epochValue, head: seq, reanchor: true }), {
          status: 200,
        });
      }
      if (forceReanchor) {
        return new Response(JSON.stringify({ epoch: epochValue, head: seq, reanchor: true }), {
          status: 200,
        });
      }
      if (askedEpoch && askedEpoch !== epochValue) {
        return new Response(JSON.stringify({ epoch: epochValue, head: seq, reanchor: true }), {
          status: 200,
        });
      }
      if (since > seq) {
        return new Response(JSON.stringify({ epoch: epochValue, head: seq, reanchor: true }), {
          status: 200,
        });
      }
      const entries = [...rows.entries()]
        .filter(([, r]) => r.seq > since)
        .map(([path, r]) => ({
          seq: r.seq,
          path,
          sha256: r.sha256,
          size: lieAboutSize ? 0 : r.size,
          mtimeMs: 0,
          class: 'companion-text',
          deleted: r.deleted === true,
        }))
        .sort((a, b) => a.seq - b.seq);
      return new Response(
        JSON.stringify({ epoch: epochValue, head: seq, entries, truncated: false }),
        {
          status: 200,
        }
      );
    }
    if (u.pathname.startsWith('/_project-file/')) {
      const rel = decodeURIComponent(u.pathname.slice('/_project-file/'.length));
      const row = rows.get(rel);
      if (!row) return new Response('nope', { status: 404 });
      return new Response(row.body, { status: 200 });
    }
    if (u.pathname.startsWith('/api/file/') && init?.method === 'DELETE') {
      const rel = u.pathname
        .slice('/api/file/'.length)
        .split('/')
        .map(decodeURIComponent)
        .join('/');
      const headers = new Headers(init.headers as HeadersInit);
      const expect = headers.get('x-maude-expect-hash');
      const current = rows.get(rel)?.sha256 ?? null;
      if (expect && expect !== 'none' && current !== expect) {
        return new Response(JSON.stringify({ error: 'moved', current }), { status: 409 });
      }
      deletes.push(rel);
      seq += 1;
      rows.set(rel, { seq, sha256: null, size: 0, body: '', deleted: true });
      return new Response(JSON.stringify({ ok: true, path: rel, deleted: true, seq }), {
        status: 200,
      });
    }
    if (u.pathname.startsWith('/api/file/') && init?.method === 'PUT') {
      const rel = u.pathname
        .slice('/api/file/'.length)
        .split('/')
        .map(decodeURIComponent)
        .join('/');
      const headers = new Headers(init.headers as HeadersInit);
      const expect = headers.get('x-maude-expect-hash');
      const current = rows.get(rel)?.sha256 ?? null;
      const wantsAbsent = expect === 'none';
      if (expect && !(wantsAbsent ? current === null : current === expect)) {
        return new Response(JSON.stringify({ error: 'moved', current }), { status: 409 });
      }
      const body = Buffer.from(init.body as ArrayBuffer).toString('utf8');
      puts.push({ rel, expect, body });
      add(rel, body);
      return new Response(JSON.stringify({ ok: true, seq, sha256: sha(body) }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;

  /**
   * A rewind: the log comes back from an older generation. Rows above `to` are
   * gone and the head moves back — which is what makes a peer's cursor
   * unhonourable and forces the re-anchor.
   */
  const rewindTo = (to: number) => {
    for (const [rel, r] of [...rows]) if (r.seq > to) rows.delete(rel);
    seq = to;
  };

  return {
    fetchImpl,
    rows,
    puts,
    add,
    rewindTo,
    deletes,
    /** Tombstone a path hub-side, as another peer's delete would. */
    tombstone: (rel: string) => {
      seq += 1;
      rows.set(rel, { seq, sha256: null, size: 0, body: '', deleted: true });
    },
    epoch: () => epochValue,
    head: () => seq,
    /** Declare every row as costing nothing — the A1 primitive. */
    understateSizes: () => {
      lieAboutSize = true;
    },
    /** Answer `reanchor` to everything — the hostile-hub shape. */
    alwaysReanchor: () => {
      forceReanchor = true;
    },
    /** Answer `reanchor` for the next `n` requests only. */
    reanchorFor: (n: number) => {
      reanchorBudget = n;
    },
    /** A LEGITIMATE epoch rotation (a restore, DDR-226 §3). */
    rotateEpoch: () => {
      epochValue = `epoch-${Math.abs(seq) + 2}`;
    },
  };
}

const plane = (hub: ReturnType<typeof fakeHub>, over = {}) =>
  createFilePlane({
    designRoot: root,
    hubUrl: HUB,
    token: () => 'tok',
    ledger,
    allowCodeModules: false,
    label: 'laptop',
    fetchImpl: hub.fetchImpl,
    log: { log() {}, warn() {} },
    now: () => 1_700_000_000_000,
    ...over,
  });

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const write = (rel: string, body: string) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), body);
};

describe('scanning', () => {
  test('admits the plane and leaves plane A alone', () => {
    write('system/ds/brand.css', ':root{}');
    write('assets/a.png', 'PNG');
    write('ui/home.tsx', 'export default null');
    write('ui/home.meta.json', '{}');
    const found = scanLocalFiles(root, ledger, [{ path: 'system' }, { path: 'ui' }]);
    expect([...found.keys()].sort()).toEqual(['assets/a.png', 'system/ds/brand.css']);
  });

  test('a SETTLED file is answered from the stat cache, unread', () => {
    write('system/ds/brand.css', ':root{}');
    const first = scanLocalFiles(root, ledger);
    const found = first.get('system/ds/brand.css')!;
    // An old mtime is a trustworthy identity: nothing can have changed inside
    // the timestamp's resolution, because the timestamp is not recent.
    ledger.noteLocal('system/ds/brand.css', found.hash, found.size, Date.now() - 60_000);
    expect(ledger.cachedHash('system/ds/brand.css', found.size, Date.now() - 60_000)).toBe(
      found.hash
    );
  });

  test('a file written MOMENTS ago is re-read, whatever the stamp says', () => {
    // The mtime-granularity trap, and it is not hypothetical: `v1` → `v2` is a
    // same-length edit, and two writes inside the filesystem's timestamp
    // resolution are indistinguishable by `(size, mtime)`. Trusting the cache
    // there means a real edit is never noticed at all.
    write('system/ds/brand.css', 'v1');
    const first = scanLocalFiles(root, ledger);
    const found = first.get('system/ds/brand.css')!;
    expect(ledger.cachedHash('system/ds/brand.css', found.size, found.mtimeMs)).toBeNull();
  });

  test('and the watcher can invalidate a path outright', () => {
    write('system/ds/brand.css', ':root{}');
    const found = scanLocalFiles(root, ledger).get('system/ds/brand.css')!;
    ledger.noteLocal('system/ds/brand.css', found.hash, found.size, Date.now() - 60_000);
    ledger.noteChanged('system/ds/brand.css');
    expect(ledger.cachedHash('system/ds/brand.css', found.size, Date.now() - 60_000)).toBeNull();
  });

  test('never descends into runtime state', () => {
    mkdirSync(join(root, '_history/x'), { recursive: true });
    writeFileSync(join(root, '_history/x/old.css'), 'x');
    mkdirSync(join(root, '_trash'), { recursive: true });
    writeFileSync(join(root, '_trash/dead.css'), 'x');
    expect([...scanLocalFiles(root, ledger).keys()]).toEqual([]);
  });
});

describe('foldRemote', () => {
  test('the newest row per path wins', () => {
    const folded = foldRemote([
      { seq: 1, path: 'a', sha256: 'x', size: 1, mtimeMs: 0, class: '', deleted: false },
      { seq: 5, path: 'a', sha256: 'y', size: 1, mtimeMs: 0, class: '', deleted: false },
      { seq: 3, path: 'a', sha256: 'z', size: 1, mtimeMs: 0, class: '', deleted: false },
    ]);
    expect(folded.get('a')?.sha256).toBe('y');
  });
});

describe('down — the hub has something we do not', () => {
  test('it lands, verified, and the ancestor follows', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': ':root{--a:1}' });
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual(['system/ds/brand.css']);
    expect(read('system/ds/brand.css')).toBe(':root{--a:1}');
    expect(ledger.ancestorOf('system/ds/brand.css')).toBe(sha(':root{--a:1}'));
    expect(ledger.cursor()).toBe(hub.head());
  });

  test('a hub that serves the WRONG bytes lands nothing', async () => {
    // The hub may refuse to serve; it must never be able to substitute.
    const hub = fakeHub({ 'system/ds/brand.css': 'real' });
    hub.rows.set('system/ds/brand.css', {
      ...hub.rows.get('system/ds/brand.css')!,
      body: 'TAMPERED',
    });
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual([]);
    expect(existsSync(join(root, 'system/ds/brand.css'))).toBe(false);
    expect(res.failed[0]?.reason).toContain('hash mismatch');
    expect(ledger.ancestorOf('system/ds/brand.css')).toBeNull();
  });

  test('a code module is REFUSED unless this machine vouches for the hub', async () => {
    const hub = fakeHub({ 'system/ds/preview/_x.ts': 'export const a = 1' });
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual([]);
    expect(res.dropped[0]?.reason).toContain('owner-vouched');
  });

  test('…and lands when it does', async () => {
    const hub = fakeHub({ 'system/ds/preview/_x.ts': 'export const a = 1' });
    const res = await plane(hub, { allowCodeModules: true }).reconcile();
    expect(res.pulled).toEqual(['system/ds/preview/_x.ts']);
  });

  test('a refusal HOLDS on later passes, when the delta no longer mentions it', async () => {
    // The hole this closes had teeth. Admission used to run only for paths the
    // current page carried — but a cursor read is silent about everything that
    // did not just change. So a code module refused on the pass that
    // introduced it sailed through on the very next tick, sourced from the
    // remembered remote with no gate in front of it. Admission belongs to the
    // OFFER, not to the notification.
    const hub = fakeHub({ 'system/ds/preview/_x.ts': 'export const a = 1' });
    const first = await plane(hub).reconcile();
    expect(first.pulled).toEqual([]);
    expect(first.dropped.length).toBe(1);

    const second = await plane(hub).reconcile();
    expect(second.pulled).toEqual([]);
    expect(second.dropped.length).toBe(1);
    expect(existsSync(join(root, 'system/ds/preview/_x.ts'))).toBe(false);

    const third = await plane(hub).reconcile();
    expect(third.pulled).toEqual([]);
  });

  test('a path THIS peer classifies differently is dropped, not negotiated', async () => {
    // `config.json` is `never` here whatever the hub says about it.
    const hub = fakeHub({ 'config.json': '{"evil":true}' });
    const res = await plane(hub).reconcile();
    expect(res.dropped.some((d) => d.rel === 'config.json')).toBe(true);
    expect(read('config.json')).toContain('canvasGroups');
  });

  test('a refused path is reported but never becomes a stored row', async () => {
    // A hostile page used to cost two persistent writes per junk path — one
    // from `noteRemote` before any classifier ran, one from the `stuck` row
    // after — neither pruned by count, both surviving a restart, and both
    // re-walked in the union on every later pass.
    const hub = fakeHub();
    for (let i = 0; i < 200; i++) hub.add(`junk/payload-${i}.exe`, 'x');
    const p = plane(hub);
    const res = await p.reconcile();

    expect(res.dropped.length).toBeGreaterThan(0);
    const receipt = p.doruceka();
    const stored = Object.keys(receipt).filter((k) => k.startsWith('junk/'));
    expect(stored).toEqual([]);
  });
});

describe('up — we have something the hub does not', () => {
  test('it uploads with a "hub must hold nothing" precondition', async () => {
    const hub = fakeHub();
    write('system/ds/brand.css', 'mine');
    const res = await plane(hub).reconcile();
    expect(res.pushed).toEqual(['system/ds/brand.css']);
    expect(hub.puts[0]?.expect).toBe('none');
    expect(ledger.ancestorOf('system/ds/brand.css')).toBe(sha('mine'));
  });

  test('a local edit uploads with the hub state we decided FROM', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile(); // pull v1, ancestor = v1
    write('system/ds/brand.css', 'v2');
    const res = await plane(hub).reconcile();
    expect(res.pushed).toEqual(['system/ds/brand.css']);
    expect(hub.puts.at(-1)?.expect).toBe(sha('v1'));
  });

  test('a hub that LOST a file gets it back — absence is not authority', async () => {
    // The real shape of this, and the reason it needs a rewind rather than a
    // deletion: the journal is APPEND-ONLY, so a hub cannot quietly drop a
    // row. A file vanishes from its side only when the log itself rewinds —
    // a restore from an older generation whose tail could not be replayed.
    // That rewind is exactly what makes our cursor unhonourable, so the pass
    // re-anchors, reads the whole compaction, and only THEN is entitled to
    // conclude the hub no longer has the file.
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    expect(read('system/ds/brand.css')).toBe('v1');

    hub.rewindTo(0); // the generation predates the file entirely
    const res = await plane(hub).reconcile();

    expect(res.reanchored).toBe(true);
    expect(res.pushed).toEqual(['system/ds/brand.css']);
    expect(read('system/ds/brand.css')).toBe('v1');
  });

  test('a DELTA silence is never read as "the hub lost it"', async () => {
    // The counterpart, and the bug this guards: a cursor read returns only
    // what changed. If silence meant absence, every converged file would be
    // re-uploaded on every single pass.
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    const second = await plane(hub).reconcile();
    expect(second.pushed).toEqual([]);
    expect(second.pulled).toEqual([]);
  });
});

describe('the compare-and-swap is what makes concurrency safe', () => {
  test('a push against a moved hub is REFUSED and reported, not forced', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    // Both sides move: we edit, and someone else lands v2 on the hub.
    write('system/ds/brand.css', 'mine');
    hub.add('system/ds/brand.css', 'theirs');
    // Decide from the STALE view by pushing before re-reading.
    const p = plane(hub);
    // First pass sees theirs and conflicts (both moved).
    const res = await p.reconcile();
    expect(res.conflicts.length).toBe(1);
    // The local version is parked where a person can find it…
    const parked = readdirSync(join(root, 'system/ds')).find((n) => n.includes('maude-conflict'));
    expect(parked).toBeDefined();
    expect(readFileSync(join(root, 'system/ds', parked!), 'utf8')).toBe('mine');
    // …and the hub's version is what sits at the canonical path.
    expect(read('system/ds/brand.css')).toBe('theirs');
  });

  test('the conflict copy travels UP, so both ends see it', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    write('system/ds/brand.css', 'mine');
    hub.add('system/ds/brand.css', 'theirs');
    await plane(hub).reconcile();
    const uploaded = hub.puts.find((p) => p.rel.includes('maude-conflict'));
    expect(uploaded?.body).toBe('mine');
  });

  test('a conflict copy is NEVER named like Syncthing’s', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    write('system/ds/brand.css', 'mine');
    hub.add('system/ds/brand.css', 'theirs');
    await plane(hub).reconcile();
    const names = readdirSync(join(root, 'system/ds'));
    expect(names.some((n) => n.includes('maude-conflict'))).toBe(true);
    expect(names.some((n) => n.includes('sync-conflict'))).toBe(false);
  });
});

describe('the converged steady state is free', () => {
  test('a second pass moves nothing and reports agreement', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1', 'assets/a.png': 'PNG' });
    await plane(hub).reconcile();
    const second = await plane(hub).reconcile();
    expect(second.pulled).toEqual([]);
    expect(second.pushed).toEqual([]);
    expect(second.synced).toBeGreaterThan(0);
  });

  test('and it costs ONE journal read, from the cursor', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    const before = ledger.cursor();
    expect(before).toBe(hub.head());
    const asked: string[] = [];
    const counting = (async (url: string, init?: RequestInit) => {
      asked.push(String(url));
      return hub.fetchImpl(url as never, init as never);
    }) as unknown as typeof fetch;
    await plane(hub, { fetchImpl: counting }).reconcile();
    expect(asked.filter((u) => u.includes('/api/journal')).length).toBe(1);
    expect(asked.some((u) => u.includes('/_project-file/'))).toBe(false);
  });
});

describe('re-anchoring fails CLOSED', () => {
  test('a foreign epoch re-reads from zero rather than assuming quiet', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    // The hub's log restarted under a new epoch.
    ledger.setPosition('epoch-OLD', 99);
    const res = await plane(hub).reconcile();
    expect(res.reanchored).toBe(true);
    expect(ledger.epoch()).toBe('epoch-1');
  });

  test('a degraded epoch never overwrites local work — it parks theirs beside it', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    write('system/ds/brand.css', 'my unsent work');
    // Pretend our anchor belongs to a log the hub no longer has, WITHOUT
    // going through the reanchor path (the degraded-read case).
    ledger.setPosition('epoch-GONE', 0);
    hub.add('system/ds/brand.css', 'their newer');
    const res = await plane(hub, { fetchImpl: hub.fetchImpl }).reconcile();
    // Either way the local bytes survive; that is the invariant.
    expect(read('system/ds/brand.css')).not.toBe('their newer');
    expect(res.pulled).toEqual([]);
  });
});

describe('the doručenka answers "where is this file"', () => {
  test('a pulled file reads on-hub; an unsent one reads local-only', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    write('assets/local.png', 'only here');
    const p = plane(hub);
    await p.reconcile();
    const states = p.doruceka();
    expect(states['system/ds/brand.css']).toBe('on-hub');
    // It was pushed in the same pass, so it is on the hub too — the point is
    // that NOTHING reads as delivered without having got there.
    expect(['on-hub', 'local-only']).toContain(states['assets/local.png']);
  });

  test('a CONVERGED file reads on-hub, not local-only', async () => {
    // The lie this closes, seen live in a local run: a delta never mentions a
    // settled file, so reading the page instead of the remembered remote made
    // every converged file report `local-only` — a panel saying "not
    // delivered" about files that had been on the hub for hours.
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const p = plane(hub);
    await p.reconcile();
    await p.reconcile(); // the converged pass, where the delta is silent
    expect(p.doruceka()['system/ds/brand.css']).toBe('on-hub');
  });

  test('a REFUSED path says it is refused, not that it is merely local', async () => {
    // A refusal outranks everything (DDR-214). A code module this peer
    // declines is not "local-only" — it is not here, and will not be.
    const hub = fakeHub({ 'system/ds/preview/_x.ts': 'export const a = 1' });
    const p = plane(hub);
    await p.reconcile();
    expect(p.doruceka()['system/ds/preview/_x.ts']).toBe('stuck');
  });

  test('a failure is named, not swallowed', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const broken = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('/_project-file/')) return new Response('no', { status: 500 });
      return hub.fetchImpl(url as never, init as never);
    }) as unknown as typeof fetch;
    const p = plane(hub, { fetchImpl: broken });
    const res = await p.reconcile();
    expect(res.failed.length).toBe(1);
    expect(p.doruceka()['system/ds/brand.css']).toBe('stuck');
    expect(ledger.row('system/ds/brand.css')?.reason).toContain('500');
  });
});

describe('deletion stays OFF until its breakers ship', () => {
  test('a file deleted here is HELD — neither resurrected nor propagated', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    rmSync(join(root, 'system/ds/brand.css'));
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual([]); // not resurrected
    expect(hub.rows.has('system/ds/brand.css')).toBe(true); // not deleted upstream
    expect(existsSync(join(root, 'system/ds/brand.css'))).toBe(false);
  });

  test('but an EDIT still beats a delete', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    await plane(hub).reconcile();
    rmSync(join(root, 'system/ds/brand.css'));
    hub.add('system/ds/brand.css', 'somebody edited it');
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual(['system/ds/brand.css']);
    expect(read('system/ds/brand.css')).toBe('somebody edited it');
  });
});

describe('the F6 budget applies to this lane too', () => {
  test('a pass stops on bytes and resumes next time', async () => {
    const hub = fakeHub({
      'system/ds/a.css': 'x'.repeat(400),
      'system/ds/b.css': 'y'.repeat(400),
      'system/ds/c.css': 'z'.repeat(400),
    });
    const first = await plane(hub, { maxPassBytes: 900 }).reconcile();
    expect(first.pulled.length).toBe(2);
    expect(first.budgetExhausted).toBe(true);
    const second = await plane(hub, { maxPassBytes: 900 }).reconcile();
    expect(second.pulled.length).toBe(1);
  });

  // The budget caps a TRANSFER, not a claim. `size` is the hub's number, and
  // the hub is untrusted (DDR-054) — a row declaring 0 for a 512 MB body is
  // one field away from landing 100 GB in a pass against a budget that never
  // moved. So the wire is charged, not the row.
  test('an understated size does not buy a bigger transfer', async () => {
    const hub = fakeHub({
      'system/ds/a.css': 'x'.repeat(400),
      'system/ds/b.css': 'y'.repeat(400),
      'system/ds/c.css': 'z'.repeat(400),
    });
    hub.understateSizes();
    const pass = await plane(hub, { maxPassBytes: 900 }).reconcile();
    expect(pass.budgetExhausted).toBe(true);
    expect(pass.pulled.length).toBeLessThan(3);
  });

  test('a body larger than the whole budget is refused before it is buffered', async () => {
    const hub = fakeHub({ 'system/ds/a.css': 'x'.repeat(4000) });
    hub.understateSizes();
    const pass = await plane(hub, { maxPassBytes: 100 }).reconcile();
    expect(pass.pulled.length).toBe(0);
    expect(pass.failed.length + (pass.budgetExhausted ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe("the receiver defends its own root, not just the hub's", () => {
  test('a symlinked intermediate directory cannot land bytes outside the root', async () => {
    // Lexical traversal is refused upstream by the classifier's shape gate, so
    // this is the case that was genuinely uncovered: `writeFileSync` and
    // `renameSync` follow DIRECTORY symlinks happily, and the hub defends this
    // on its own write surfaces while the receiver did not.
    const outside = mkdtempSync(join(tmpdir(), 'plane-outside-'));
    mkdirSync(join(root, 'system'), { recursive: true });
    symlinkSync(outside, join(root, 'system/escaped'), 'dir');

    const hub = fakeHub({ 'system/escaped/stolen.css': 'PAYLOAD' });
    const res = await plane(hub).reconcile();

    expect(existsSync(join(outside, 'stolen.css'))).toBe(false);
    expect(res.pulled).toEqual([]);
    expect(res.failed.length + res.dropped.length).toBeGreaterThan(0);
  });

  test('a pull into directories that do not exist yet keeps its full path', async () => {
    // The fresh-link case, and the bug the containment fix introduced: the
    // deepest EXISTING ancestor of `system/deep/nested/a.css` in an empty tree
    // is the design root itself, so resolving to that and appending the
    // basename produced `<root>/a.css`. Every file in a first sync would have
    // landed flattened at the top level.
    const hub = fakeHub({ 'system/deep/nested/a.css': '.deep{}' });
    const res = await plane(hub).reconcile();

    expect(res.pulled).toEqual(['system/deep/nested/a.css']);
    expect(read('system/deep/nested/a.css')).toBe('.deep{}');
    expect(existsSync(join(root, 'a.css'))).toBe(false);
  });

  test('refuses to replace a directory sitting where a file belongs', async () => {
    mkdirSync(join(root, 'system/ds/brand.css'), { recursive: true });
    const hub = fakeHub({ 'system/ds/brand.css': ':root{}' });
    const res = await plane(hub).reconcile();
    expect(res.pulled).toEqual([]);
    expect(statSync(join(root, 'system/ds/brand.css')).isDirectory()).toBe(true);
  });
});

describe('a hub that re-anchors forever is not obeyed forever', () => {
  test('the storm limit holds the pass instead of parking a copy per tick', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'theirs' });
    write('system/ds/brand.css', 'mine');
    const p = plane(hub);

    // Every request answers `reanchor`, which is the shape a hostile hub uses
    // to keep `degraded` true and make every diverged path park a fresh copy.
    hub.alwaysReanchor();

    let held = false;
    for (let i = 0; i < REANCHOR_STORM_LIMIT + 3; i++) {
      const res = await p.reconcile();
      if (res.reanchorHeld) held = true;
    }
    expect(held).toBe(true);
    expect(read('system/ds/brand.css')).toBe('mine');
  });

  test('the degraded park happens once per remote hash, not once per pass', async () => {
    // Converge first, so there is a real ancestor to be degraded away from.
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const p = plane(hub);
    await p.reconcile();
    expect(read('system/ds/brand.css')).toBe('v1');

    // Now both sides move, and the hub's log restarts — a legitimate event
    // (DDR-226 §3), not only a hostile one. Under `degraded` the ancestor
    // stops being overwrite authority, so their copy is parked beside ours.
    write('system/ds/brand.css', 'mine');
    hub.add('system/ds/brand.css', 'theirs');
    hub.rotateEpoch();

    const first = await p.reconcile();
    expect(first.reanchored).toBe(true);
    expect(first.conflicts.length).toBe(1);
    const parkedHub = readdirSync(join(root, 'system/ds')).filter((f) => f.includes('-hub.css'));
    expect(parkedHub.length).toBe(1);

    // The bug was UNBOUNDED: the decision is `noop`, so the ancestor never
    // moves and the next pass finds the identical state — and the copy name
    // carries a millisecond stamp, so every pass wrote a NEW file, which was
    // then scanned as `create-up` and uploaded back. Settling is the property.
    for (let i = 0; i < 6; i++) await p.reconcile();
    const after = readdirSync(join(root, 'system/ds')).filter((f) => f.includes('-hub.css'));
    expect(after).toEqual(parkedHub);

    const last = await p.reconcile();
    expect(last.conflicts).toEqual([]);
  });

  test('a repeated degraded pass re-parks nothing — the remote hash is remembered', async () => {
    // The memo, exercised directly. `alwaysReanchor` would hit the storm
    // breaker after five, which would mask the thing under test; this stays
    // under it, so what stops the second park is the memo and only the memo.
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const p = plane(hub);
    await p.reconcile();

    write('system/ds/brand.css', 'mine');
    hub.add('system/ds/brand.css', 'theirs');

    hub.reanchorFor(1);
    const first = await p.reconcile();
    expect(first.conflicts.length).toBe(1);

    // Degraded again, same remote hash, still under the storm limit.
    hub.reanchorFor(1);
    const second = await p.reconcile();
    const copies = readdirSync(join(root, 'system/ds')).filter((f) => f.includes('-hub.css'));
    expect(copies.length).toBe(1);
    expect(second.conflicts.some((c) => c.copy?.includes('-hub.css'))).toBe(false);
  });
});

describe('F2/F3 — plane disjointness survives a fresh link', () => {
  // The synthesis line for this gate reads "empty-tree in-group `.css`
  // classifies canvas-owned by default". The shipped classifier does the
  // OPPOSITE on purpose, and the reason is an RCA: defaulting group css to
  // canvas-owned is what lost five real stylesheets (`brand.css`,
  // `_layout.css` — files with no sibling body at all, which would then travel
  // on no lane whatsoever). Defaulting to the flowing side is recoverable; the
  // other direction silently drops content.
  //
  // What has to be true for that choice to be safe is not the default but the
  // CONVERGENCE: the moment the body exists, the css must leave the file plane,
  // so the two lanes never both own it for longer than one pass.
  test('a sibling-less css flows, and the file plane releases it once the body lands', async () => {
    const hub = fakeHub({ 'ui/home.css': '.a{}' });
    const p = plane(hub);

    const first = await p.reconcile();
    expect(first.pulled).toEqual(['ui/home.css']);

    // Plane A delivers the body — the canvas doc lane, which this plane never
    // touches. From here the css is that canvas's Yjs lane, not a file.
    write('ui/home.tsx', 'export default null');

    const second = await p.reconcile();
    expect(second.pulled).toEqual([]);
    const scanned = scanLocalFiles(root, ledger, [{ path: 'system' }, { path: 'ui' }]);
    expect(scanned.has('ui/home.css')).toBe(false);
  });

  test('a design-system stylesheet with no body anywhere keeps flowing — the RCA case', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': ':root{}', 'system/ds/preview/_layout.css': 'x' });
    const res = await plane(hub).reconcile();
    expect(res.pulled.sort()).toEqual(['system/ds/brand.css', 'system/ds/preview/_layout.css']);
  });

  test('config.json is never a plane member in either direction', async () => {
    // The seed-before-first-pull half: a synced config is a hub rewriting the
    // hub URL and the canvas groups — its own trust anchors.
    write('config.json', '{"canvasGroups":[{"path":"system"},{"path":"ui"}],"mine":true}');
    const hub = fakeHub({ 'config.json': '{"evil":true}' });
    const res = await plane(hub).reconcile();
    expect(res.pushed).toEqual([]);
    expect(read('config.json')).toContain('"mine"');
  });
});

describe('deletion propagates — Increment 6', () => {
  const propagating = (hub: ReturnType<typeof fakeHub>) => plane(hub, { propagateDeletes: true });

  test('gone here, unchanged there ⇒ the hub is told, and the row is a tombstone', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': ':root{}' });
    const p = propagating(hub);
    await p.reconcile();
    expect(existsSync(join(root, 'system/ds/brand.css'))).toBe(true);

    rmSync(join(root, 'system/ds/brand.css'));
    const res = await p.reconcile();

    expect(res.deleted.map((d) => d.rel)).toEqual(['system/ds/brand.css']);
    expect(hub.deletes).toEqual(['system/ds/brand.css']);
  });

  test('gone here, but CHANGED there ⇒ an edit beats a delete and the file comes back', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const p = propagating(hub);
    await p.reconcile();

    rmSync(join(root, 'system/ds/brand.css'));
    hub.add('system/ds/brand.css', 'v2'); // somebody edited it meanwhile

    const res = await p.reconcile();
    expect(hub.deletes).toEqual([]);
    expect(read('system/ds/brand.css')).toBe('v2');
    expect(res.deleted).toEqual([]);
  });

  test('the hub deleted it and we never touched it ⇒ quarantined, never unlinked', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': ':root{}' });
    const p = propagating(hub);
    await p.reconcile();

    hub.tombstone('system/ds/brand.css');
    const res = await p.reconcile();

    expect(existsSync(join(root, 'system/ds/brand.css'))).toBe(false);
    const parked = res.deleted[0]?.parked;
    expect(parked?.startsWith('_trash/')).toBe(true);
    expect(read(parked as string)).toBe(':root{}');
  });

  test('the hub deleted it but WE changed it ⇒ kept and pushed back', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': 'v1' });
    const p = propagating(hub);
    await p.reconcile();

    write('system/ds/brand.css', 'mine');
    hub.tombstone('system/ds/brand.css');

    const res = await p.reconcile();
    expect(read('system/ds/brand.css')).toBe('mine');
    expect(res.deleted).toEqual([]);
    expect(hub.puts.some((x) => x.rel === 'system/ds/brand.css' && x.body === 'mine')).toBe(true);
  });

  test('off ⇒ an absence propagates nothing, which is the pre-Increment-6 posture', async () => {
    const hub = fakeHub({ 'system/ds/brand.css': ':root{}' });
    const p = plane(hub, { propagateDeletes: false });
    await p.reconcile();
    rmSync(join(root, 'system/ds/brand.css'));
    const res = await p.reconcile();
    expect(hub.deletes).toEqual([]);
    expect(res.deleted).toEqual([]);
  });
});

describe('the deletion breakers — the only protection now that this ships ON', () => {
  test("a branch switch does not become everyone else's deletion", async () => {
    const seeded: Record<string, string> = {};
    for (let i = 0; i < 20; i++) seeded[`system/ds/f${i}.css`] = `.a${i}{}`;
    const hub = fakeHub(seeded);
    const p = plane(hub, { propagateDeletes: true });
    await p.reconcile();

    // `git checkout other-branch` — the design folder empties.
    for (let i = 0; i < 20; i++) rmSync(join(root, `system/ds/f${i}.css`));

    const res = await p.reconcile();
    expect(hub.deletes).toEqual([]);
    expect(res.deleteHeld?.direction).toBe('out');
    expect(res.deleteHeld?.count).toBe(20);
  });

  test('a tombstone storm does not empty this disk either', async () => {
    const seeded: Record<string, string> = {};
    for (let i = 0; i < 20; i++) seeded[`system/ds/f${i}.css`] = `.a${i}{}`;
    const hub = fakeHub(seeded);
    const p = plane(hub, { propagateDeletes: true });
    await p.reconcile();

    for (let i = 0; i < 20; i++) hub.tombstone(`system/ds/f${i}.css`);

    const res = await p.reconcile();
    expect(res.deleteHeld?.direction).toBe('in');
    expect(existsSync(join(root, 'system/ds/f0.css'))).toBe(true);
    expect(res.deleted).toEqual([]);
  });

  test('a patient drain is caught too — the budget remembers across passes', async () => {
    // The finding this exists for: the first breaker counted ONE PASS and
    // reset. Two per pass was under every arm of it at every project size, so
    // a hub poking every 10s could remove a file every five seconds forever
    // and never trip anything. A rate limit is the wrong control for a
    // cumulative harm.
    const seeded: Record<string, string> = {};
    for (let i = 0; i < 60; i++) seeded[`system/ds/f${i}.css`] = `.a${i}{}`;
    const hub = fakeHub(seeded);
    const p = plane(hub, { propagateDeletes: true });
    await p.reconcile();

    let applied = 0;
    let held = false;
    // Two at a time — deliberately under the burst arm AND under the
    // proportion arm (2/60 is 3%), which is exactly the attacker's cadence.
    for (let round = 0; round < 20 && !held; round++) {
      hub.tombstone(`system/ds/f${round * 2}.css`);
      hub.tombstone(`system/ds/f${round * 2 + 1}.css`);
      const res = await p.reconcile();
      applied += res.deleted.length;
      if (res.deleteHeld) held = true;
    }

    expect(held).toBe(true);
    expect(applied).toBeLessThanOrEqual(DELETE_BUDGET_PER_WINDOW);
  });

  test('the budget survives a restart — a new plane over the same ledger still remembers', async () => {
    const seeded: Record<string, string> = {};
    for (let i = 0; i < 60; i++) seeded[`system/ds/f${i}.css`] = `.a${i}{}`;
    const hub = fakeHub(seeded);
    await plane(hub, { propagateDeletes: true }).reconcile();

    for (let round = 0; round < 20; round++) {
      hub.tombstone(`system/ds/f${round * 2}.css`);
      hub.tombstone(`system/ds/f${round * 2 + 1}.css`);
      // A FRESH plane each round, as a restarted dev-server would be. The
      // ledger is the same, and the budget lives there — otherwise "restart
      // the app" is the bypass.
      const res = await plane(hub, { propagateDeletes: true }).reconcile();
      if (res.deleteHeld) {
        expect(round).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error('the budget did not survive being reconstructed');
  });

  test('an ordinary single delete is not a storm', async () => {
    const seeded: Record<string, string> = {};
    for (let i = 0; i < 20; i++) seeded[`system/ds/f${i}.css`] = `.a${i}{}`;
    const hub = fakeHub(seeded);
    const p = plane(hub, { propagateDeletes: true });
    await p.reconcile();

    rmSync(join(root, 'system/ds/f3.css'));
    const res = await p.reconcile();
    expect(res.deleteHeld).toBeUndefined();
    expect(hub.deletes).toEqual(['system/ds/f3.css']);
  });
});
