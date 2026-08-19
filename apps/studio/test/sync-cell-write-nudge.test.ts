// The nudge — the cell child's half of the doorbell (DDR-226 §4, Increment 3).
//
// This exists because Increment 3 shipped `POST /api/journal/report` with no
// caller, and nothing noticed for a release: the receiver's own tests were
// green, the route answered correctly, and the only symptom was that
// cloud → desktop took up to fifteen minutes while desktop → cloud took
// seconds. So the last describe block here is a REACHABILITY tripwire — it
// asserts the wiring exists, not just that the module is correct in isolation.
//
// What is pinned:
//
//   1. **It carries paths and nothing else.** A nudge that could state a hash
//      would be a nudge that could lie about content.
//   2. **The filter.** Runtime state (`_state/`, `_history/`, …) and
//      malformed paths never reach the wire — otherwise a single canvas save
//      would nudge about a dozen per-machine files nobody syncs.
//   3. **The mute.** A path the healer just announced is a fact the hub stated;
//      we do not bill it for hearing it back.
//   4. **Failure is latency, never loss.** A hub that refuses the nudge must
//      not throw, must not retry forever, and must say so once.

import { describe, expect, test } from 'bun:test';

import { createCellWriteNudge } from '../sync/cell-write-nudge.ts';

interface Call {
  url: string;
  body: { paths?: unknown };
  auth: string | null;
}

/** A fetch double that records calls and answers with whatever `ok` says. */
function recorder(ok: (n: number) => boolean = () => true) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const i = init as { headers?: Record<string, string>; body?: string };
    calls.push({
      url: String(url),
      body: JSON.parse(i?.body ?? '{}'),
      auth: i?.headers?.authorization ?? null,
    });
    const good = ok(calls.length);
    return {
      ok: good,
      status: good ? 200 : 503,
      json: async () => ({ noted: 0 }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

/** The `paths` array a recorded call carried — the only field a nudge may state. */
const pathsOf = (call: Call | undefined) => (call?.body.paths ?? []) as string[];

function nudger(over: Record<string, unknown> = {}) {
  const { calls, fetchImpl } = (over.rec as ReturnType<typeof recorder>) ?? recorder();
  return {
    calls,
    n: createCellWriteNudge({
      hubUrl: 'http://127.0.0.1:4599',
      token: 'tok',
      fetchImpl,
      coalesceMs: 0,
      log: { warn() {}, error() {}, log() {} },
      ...over,
    }),
  };
}

describe('the wire — paths only, to the loopback hub, with the bearer', () => {
  test('a noted path becomes one POST naming exactly it', async () => {
    const { n, calls } = nudger();
    n.note('assets/photo.png');
    await n.flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/api/journal/report');
    expect(calls[0]?.auth).toBe('Bearer tok');
    expect(calls[0]?.body).toEqual({ paths: ['assets/photo.png'] });
  });

  test('the body has NO field through which content could be stated', async () => {
    const { n, calls } = nudger();
    n.note('system/ds/brand.css');
    await n.flush();

    // The hub re-stats and re-hashes its own disk for every path it is handed.
    // If this body ever grows a `sha256`/`size`/`deleted`, that property is
    // gone and a supervised-but-untrusted process can speak about bytes.
    expect(Object.keys(calls[0]?.body ?? {})).toEqual(['paths']);
  });

  test('a trailing slash on the hub URL does not produce a double slash', async () => {
    const { n, calls } = nudger({ hubUrl: 'http://127.0.0.1:4599/' });
    n.note('a.css');
    await n.flush();
    expect(calls[0]?.url).toBe('http://127.0.0.1:4599/api/journal/report');
  });

  test('a burst coalesces into one request, deduped', async () => {
    const { n, calls } = nudger();
    n.note('a.css');
    n.note('b.css');
    n.note('a.css');
    await n.flush();

    expect(calls).toHaveLength(1);
    expect(pathsOf(calls[0]).sort()).toEqual(['a.css', 'b.css']);
  });

  test('more than the route ceiling splits into several requests', async () => {
    const { n, calls } = nudger();
    for (let i = 0; i < 70; i++) n.note(`assets/f${i}.png`);
    await n.flush();

    expect(calls).toHaveLength(2);
    expect(pathsOf(calls[0]).length).toBe(64);
    expect(pathsOf(calls[1]).length).toBe(6);
    expect(n.named()).toBe(70);
  });

  test('nothing pending sends nothing', async () => {
    const { n, calls } = nudger();
    await n.flush();
    expect(calls).toHaveLength(0);
    expect(n.sent()).toBe(0);
  });
});

describe('the filter — the obvious noise never reaches the wire', () => {
  const dropped = [
    '_state/file-ledger/hub.json',
    '_history/ui-home/1234.tsx',
    '_canvas-state/home.view.json',
    '_chat/c-abc.session.json',
    '_server.json',
    '_active.json',
    '_sync.json',
    '_untrusted/INDEX.json',
    '_trash/old.tsx',
    'ui/_server.json',
  ];

  for (const rel of dropped) {
    test(`runtime state is not sync's business: ${rel}`, async () => {
      const { n, calls } = nudger();
      n.note(rel);
      await n.flush();
      expect(calls).toHaveLength(0);
    });
  }

  const malformed = ['', '/abs/path.css', '../escape.css', 'a\\b.css', 'node_modules/x/i.js'];

  for (const rel of malformed) {
    test(`refused by shape: ${JSON.stringify(rel)}`, async () => {
      const { n, calls } = nudger();
      n.note(rel);
      await n.flush();
      expect(calls).toHaveLength(0);
    });
  }

  test('a real design file gets through', async () => {
    const { n, calls } = nudger();
    n.note('system/smoke/preview/logo.svg');
    await n.flush();
    expect(calls).toHaveLength(1);
  });

  test('separators are judged, not rewritten', async () => {
    // Every `fs:any` producer already emits forward slashes, so a backslash
    // reaching here is not a Windows separator to be repaired — on POSIX it is
    // a legal character in one filename, and rewriting it would nudge about a
    // DIFFERENT file. The classifier refuses it, same as the hub would.
    const { n, calls } = nudger();
    n.note('system\\smoke\\brand.css');
    await n.flush();
    expect(calls).toHaveLength(0);
  });

  test('the client filter is a noise gate, NOT the membership decision', async () => {
    // `ui/home.tsx` is canvas-owned — it travels as a CRDT doc, not on the file
    // plane. We still nudge: the hub's classifier is the single membership
    // oracle (DDR-226 §1) and answers `null` for it. Deciding membership here
    // too would be a second oracle, and second oracles drift.
    const { n, calls } = nudger();
    n.note('ui/home.tsx');
    await n.flush();
    expect(calls).toHaveLength(1);
  });
});

describe('the mute — we do not bill the hub for hearing its own facts back', () => {
  test('a muted path is dropped once, then nudges normally', async () => {
    const { n, calls } = nudger();

    n.mute('assets/pulled.png');
    n.note('assets/pulled.png'); // the healer's own fs:any echo
    await n.flush();
    expect(calls).toHaveLength(0);
    expect(n.muted()).toBe(1);

    // The mute is consumed, not sticky: a genuine local edit to a file we just
    // pulled must still reach the hub.
    n.note('assets/pulled.png');
    await n.flush();
    expect(calls).toHaveLength(1);
  });

  test('a mute expires', async () => {
    let clock = 1_000;
    const { n, calls } = nudger({ muteMs: 500, now: () => clock });

    n.mute('assets/x.png');
    clock += 600;
    n.note('assets/x.png');
    await n.flush();

    expect(calls).toHaveLength(1);
    expect(n.muted()).toBe(0);
  });

  test('muting one path does not mute another', async () => {
    const { n, calls } = nudger();
    n.mute('a.css');
    n.note('a.css');
    n.note('b.css');
    await n.flush();
    expect(calls[0]?.body.paths).toEqual(['b.css']);
  });
});

describe('failure is latency, never loss', () => {
  test('an unreachable hub does not throw and does not lose the process', async () => {
    const throwing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const n = createCellWriteNudge({
      hubUrl: 'http://127.0.0.1:4599',
      token: 'tok',
      fetchImpl: throwing,
      coalesceMs: 0,
      log: { warn() {}, error() {}, log() {} },
    });

    n.note('a.css');
    await n.flush(); // must resolve, not reject
    expect(n.failures()).toBe(1);
    expect(n.sent()).toBe(0);
  });

  test('a refused batch is dropped, not retried forever — walk-import is the backstop', async () => {
    const rec = recorder(() => false);
    const { n, calls } = nudger({ rec });

    n.note('a.css');
    await n.flush();
    await n.flush();
    await n.flush();

    // One attempt per note. Re-queueing would turn a hub restart into an
    // unbounded storm against a rate-limited route, and buy nothing the
    // reconciler does not already guarantee.
    expect(calls).toHaveLength(1);
  });

  test('it says so once, not once per path', async () => {
    const warnings: string[] = [];
    const rec = recorder(() => false);
    const { n } = nudger({
      rec,
      log: { warn: (m: string) => warnings.push(m), error() {}, log() {} },
    });

    n.note('a.css');
    await n.flush();
    n.note('b.css');
    await n.flush();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/walk-import/);
  });

  test('recovery clears the failure count and re-arms the warning', async () => {
    const warnings: string[] = [];
    let healthy = false;
    const rec = recorder(() => healthy);
    const { n } = nudger({
      rec,
      log: { warn: (m: string) => warnings.push(m), error() {}, log() {} },
    });

    n.note('a.css');
    await n.flush();
    expect(n.failures()).toBe(1);

    healthy = true;
    n.note('b.css');
    await n.flush();
    expect(n.failures()).toBe(0);

    healthy = false;
    n.note('c.css');
    await n.flush();
    expect(warnings).toHaveLength(2); // a NEW outage is worth a NEW line
  });

  test('stop() silences it — a torn-down child does not keep talking', async () => {
    const { n, calls } = nudger();
    n.stop();
    n.note('a.css');
    n.mute('b.css');
    await n.flush();
    expect(calls).toHaveLength(0);
  });
});

describe('REACHABILITY — the bug this module was written to close', () => {
  test('the route has a caller in the shipped runtime', async () => {
    // Increment 3 shipped `POST /api/journal/report` and nothing that calls it.
    // Every unit test passed. The hub answered correctly. The only symptom was
    // that one sync direction was 300× slower than the other, which reads to a
    // user as "cloud → desktop is broken".
    //
    // Grep, not import: the point is that the WIRING exists in the file that
    // boots the cell child, which no amount of testing this module in isolation
    // can establish.
    const wiring = await Bun.file(new URL('../sync/cell-file-events.ts', import.meta.url)).text();

    expect(wiring).toContain('createCellWriteNudge');
    // Subscribed to the bus event both synthetic-write sources converge on.
    expect(wiring).toMatch(/bus\.on\(\s*'fs:any'/);
    // And the healer mutes what it announces, so the echo is not billed.
    expect(wiring).toContain('nudge.mute');
  });

  test('the sender names the exact route the hub receiver serves', async () => {
    const hubJournal = await Bun.file(new URL('../../hub/src/journal.mjs', import.meta.url)).text();
    const sender = await Bun.file(new URL('../sync/cell-write-nudge.ts', import.meta.url)).text();

    // The hub's constant is the authority; this pins the twin.
    expect(hubJournal).toContain("JOURNAL_REPORT_PATH = '/api/journal/report'");
    expect(sender).toContain('/api/journal/report');
  });
});
