// generation/jobs.test.ts — the generation job queue: enqueue → done/failed
// transitions, history ledger, backpressure. Uses a tiny fake Bus + a tmp
// designRoot so no real server or provider is involved.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createGenerationJobQueue, GenerationQueueFullError } from './jobs.ts';

interface FakeBus {
  emit(evt: string, payload?: unknown): void;
  on(evt: string, fn: (p: unknown) => void): void;
}

function fakeBus(): { bus: FakeBus; events: Array<{ evt: string; payload: unknown }> } {
  const events: Array<{ evt: string; payload: unknown }> = [];
  return {
    events,
    bus: { emit: (evt, payload) => events.push({ evt, payload }), on: () => {} },
  };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'maude-genq-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('generation job queue', () => {
  test('a successful job transitions queued→running→done and records assets', async () => {
    const { bus, events } = fakeBus();
    const q = createGenerationJobQueue(bus as never, dir);
    const { id, result } = q.enqueue({
      provider: 'gemini',
      modality: 'image',
      model: 'gemini-2.5-flash-image',
      run: async () => ({ assets: ['assets/abc12345.png'], usage: { ms: 5 } }),
    });
    const job = await result;
    expect(job.id).toBe(id);
    expect(job.status).toBe('done');
    expect(job.assets).toEqual(['assets/abc12345.png']);
    const statuses = events
      .filter((e) => e.evt === 'generate:job')
      .map((e) => (e.payload as { status: string }).status);
    expect(statuses).toContain('queued');
    expect(statuses).toContain('running');
    expect(statuses).toContain('done');
  });

  test('a failing run marks the job failed and captures the error', async () => {
    const { bus } = fakeBus();
    const q = createGenerationJobQueue(bus as never, dir);
    const { result } = q.enqueue({
      provider: 'gemini',
      modality: 'image',
      run: async () => {
        throw new Error('provider exploded');
      },
    });
    await expect(result).rejects.toThrow(/provider exploded/);
    const job = q.list()[0];
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/provider exploded/);
  });

  test('finished jobs persist to the _generate-history.json ledger', async () => {
    const { bus } = fakeBus();
    const q = createGenerationJobQueue(bus as never, dir);
    await q.enqueue({
      provider: 'gemini',
      modality: 'image',
      run: async () => ({ assets: ['assets/deadbeef.png'] }),
    }).result;
    const ledger = JSON.parse(readFileSync(join(dir, '_generate-history.json'), 'utf8'));
    expect(Array.isArray(ledger)).toBe(true);
    expect(ledger[0].assets).toEqual(['assets/deadbeef.png']);
    expect(ledger[0].status).toBe('done');
  });

  test('the ledger is re-seeded on a fresh queue (survives restart)', async () => {
    const { bus } = fakeBus();
    const q1 = createGenerationJobQueue(bus as never, dir);
    await q1.enqueue({
      provider: 'gemini',
      modality: 'image',
      run: async () => ({ assets: ['assets/seed0001.png'] }),
    }).result;
    const q2 = createGenerationJobQueue(bus as never, dir);
    expect(q2.loadHistory().some((h) => h.assets?.includes('assets/seed0001.png'))).toBe(true);
  });

  test('backpressure — a flood past MAX_PENDING throws GenerationQueueFullError', async () => {
    const prev = process.env.MAUDE_GENERATE_MAX_QUEUED;
    const prevConc = process.env.MAUDE_GENERATE_MAX_CONCURRENT;
    process.env.MAUDE_GENERATE_MAX_QUEUED = '2';
    process.env.MAUDE_GENERATE_MAX_CONCURRENT = '1';
    try {
      const { bus } = fakeBus();
      const q = createGenerationJobQueue(bus as never, dir);
      // A run that never resolves until we let it, so jobs stay pending.
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const mk = () =>
        q.enqueue({
          provider: 'gemini',
          modality: 'image',
          run: async () => {
            await gate;
            return { assets: [] };
          },
        });
      mk(); // running (holds the single concurrency slot)
      mk(); // queued
      expect(() => mk()).toThrow(GenerationQueueFullError); // over the cap
      release();
    } finally {
      if (prev === undefined) delete process.env.MAUDE_GENERATE_MAX_QUEUED;
      else process.env.MAUDE_GENERATE_MAX_QUEUED = prev;
      if (prevConc === undefined) delete process.env.MAUDE_GENERATE_MAX_CONCURRENT;
      else process.env.MAUDE_GENERATE_MAX_CONCURRENT = prevConc;
    }
  });
});
