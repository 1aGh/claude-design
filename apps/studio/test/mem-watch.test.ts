// mem.ts — the memory watch must measure the counter that actually moves (#119).
//
// The watch originally polled `process.memoryUsage().heapTotal`, a V8 intuition
// that does not survive the move to Bun/JSC. Measured while the server read
// 554 MB of chat transcripts: rss peaked at 1.29 GB, heapTotal at 5 MB. Neither
// threshold was reachable, so the guard written for a runaway-memory failure
// never fired and never logged — and the bug it existed to catch shipped past
// it in silence, all the way to a user report.

import { afterEach, describe, expect, test } from 'bun:test';

import { startHeapWatch, stopHeapWatch } from '../mem.ts';

const MB = 1024 * 1024;
const realMemoryUsage = process.memoryUsage;
const realWarn = console.warn;

/** Stub `process.memoryUsage` with the given rss/heapTotal, keeping the rest
 *  of the shape intact. */
function stubMemory(rss: number, heapTotal: number) {
  const base = realMemoryUsage.call(process);
  const fake = () => ({ ...base, rss, heapTotal, heapUsed: Math.min(heapTotal, base.heapUsed) });
  (process as unknown as { memoryUsage: unknown }).memoryUsage = Object.assign(
    fake,
    realMemoryUsage
  );
}

/** Run the watch for a few ticks and collect what it logged. */
async function runWatch(ticks = 3): Promise<string[]> {
  const lines: string[] = [];
  console.warn = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  startHeapWatch(5);
  await Bun.sleep(5 * ticks + 40);
  stopHeapWatch();
  console.warn = realWarn;
  return lines;
}

afterEach(() => {
  stopHeapWatch();
  (process as unknown as { memoryUsage: unknown }).memoryUsage = realMemoryUsage;
  console.warn = realWarn;
});

describe('startHeapWatch — measures rss, not heapTotal', () => {
  test('THE #119 REGRESSION: a huge rss with a tiny heapTotal still warns', () => {
    // Exactly the shape measured under Bun. A watch reading heapTotal sees
    // 5 MB here and stays silent while the process holds 3 GB.
    stubMemory(3 * 1024 * MB, 5 * MB);
    return runWatch().then((lines) => {
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join('\n')).toContain('rss');
      expect(lines.join('\n')).toContain('panic threshold');
    });
  });

  test('a large rss below panic logs the warn line', async () => {
    stubMemory(1300 * MB, 5 * MB);
    const lines = await runWatch();
    expect(lines.join('\n')).toContain('warn threshold');
    expect(lines.join('\n')).not.toContain('panic threshold');
  });

  test('a healthy process logs nothing', async () => {
    stubMemory(200 * MB, 120 * MB);
    expect(await runWatch()).toEqual([]);
  });

  test('a huge heapTotal alone does NOT trigger — rss is the signal', async () => {
    // The inverse of the regression: the watch must not be re-anchored to
    // heapTotal "just in case", or it goes blind again on the platform we
    // actually ship.
    stubMemory(200 * MB, 4 * 1024 * MB);
    expect(await runWatch()).toEqual([]);
  });

  test('past panic it keeps LOGGING every tick but backs off forcing GC', async () => {
    // `Bun.gc(true)` is synchronous — it runs on the same single thread that
    // serves the ACP socket — so a permanently-crossed threshold must not
    // become a permanent stutter. The diagnostic line must NOT be suppressed
    // along with it: that line is what reaches a bug report.
    let gcCalls = 0;
    const g = globalThis as { Bun?: { gc?: (sync: boolean) => void } };
    const realGc = g.Bun?.gc;
    if (g.Bun)
      g.Bun.gc = () => {
        gcCalls++;
      };
    try {
      stubMemory(3 * 1024 * MB, 5 * MB);
      const lines = await runWatch(12);
      expect(lines.length).toBeGreaterThan(4);
      // Backoff means far fewer GCs than ticks.
      expect(gcCalls).toBeLessThan(lines.length);
      expect(gcCalls).toBeGreaterThan(0);
    } finally {
      if (g.Bun && realGc) g.Bun.gc = realGc;
    }
  });

  test('stopHeapWatch stops it; start is idempotent', async () => {
    stubMemory(3 * 1024 * MB, 5 * MB);
    startHeapWatch(5);
    startHeapWatch(5); // second call must not add a second timer
    stopHeapWatch();
    const lines: string[] = [];
    console.warn = (...a: unknown[]) => lines.push(a.map(String).join(' '));
    await Bun.sleep(60);
    console.warn = realWarn;
    expect(lines).toEqual([]);
  });
});
