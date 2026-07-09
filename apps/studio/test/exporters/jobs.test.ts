// feature-background-export-notification-center — job queue concurrency,
// history persistence under concurrency, and byte retrieval/eviction.

import { describe, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from '../_helpers.ts';

interface JobShape {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  createdAt: string;
}

async function listJobs(port: number): Promise<JobShape[]> {
  const r = await fetch(`http://localhost:${port}/_api/export-jobs`);
  const body = (await r.json()) as { jobs: JobShape[] };
  return body.jobs;
}

/** A `project-raw` zip export takes real, measurable time when the sandbox is
 * large enough (DEFLATE-compressing several MB) — no browser/Playwright
 * needed, so this stays a fast, deterministic-enough integration test. */
function seedLargeSandbox(designRoot: string, fileCount = 5000): void {
  const dir = join(designRoot, 'ui', 'big');
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < fileCount; i += 1) {
    writeFileSync(join(dir, `f${i}.txt`), randomBytes(2000).toString('base64'));
  }
}

describe('exporters/jobs — concurrency gate', () => {
  test('caps concurrent render-heavy jobs at MAUDE_EXPORT_MAX_CONCURRENT', async () => {
    const { root, designRoot } = makeSandbox();
    seedLargeSandbox(designRoot);
    const port = nextPort();
    const proc = await bootServer(root, port, { MAUDE_EXPORT_MAX_CONCURRENT: '2' });
    try {
      const jobIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const r = await fetch(`http://localhost:${port}/_api/export-jobs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
        });
        expect(r.status).toBe(202);
        const { jobId } = (await r.json()) as { jobId: string };
        jobIds.push(jobId);
      }

      let sawThirdQueued = false;
      let maxRunningObserved = 0;
      let allDone = false;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline && !allDone) {
        const jobs = await listJobs(port);
        const byId = new Map(jobs.map((j) => [j.id, j]));
        const running = jobs.filter((j) => j.status === 'running').length;
        maxRunningObserved = Math.max(maxRunningObserved, running);
        if (byId.get(jobIds[2])?.status === 'queued') sawThirdQueued = true;
        allDone = jobIds.every((id) => byId.get(id)?.status === 'done');
        if (!allDone) await Bun.sleep(15);
      }

      expect(allDone).toBe(true);
      // Never more than the configured cap ran at once.
      expect(maxRunningObserved).toBeLessThanOrEqual(2);
      // The 3rd job was genuinely gated behind the semaphore at some point,
      // not just "coincidentally" always running — proves the queue, not just
      // that everything happened to finish fast.
      expect(sawThirdQueued).toBe(true);
    } finally {
      await killProc(proc);
    }
  });
});

describe('exporters/jobs — pending-queue cap (security fan-out, /flow:done)', () => {
  test('enqueue() 429s past MAUDE_EXPORT_MAX_QUEUED, then accepts more once jobs drain', async () => {
    const { root, designRoot } = makeSandbox();
    seedLargeSandbox(designRoot); // keeps jobs 'queued'/'running' long enough to observe
    const port = nextPort();
    const proc = await bootServer(root, port, {
      MAUDE_EXPORT_MAX_CONCURRENT: '1',
      MAUDE_EXPORT_MAX_QUEUED: '2',
    });
    try {
      const post = () =>
        fetch(`http://localhost:${port}/_api/export-jobs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
        });

      const r1 = await post();
      const r2 = await post();
      expect(r1.status).toBe(202);
      expect(r2.status).toBe(202);

      // A 3rd job while the first 2 are still queued/running must be rejected
      // with 429, not silently accepted (the DoS-protection cap).
      const r3 = await post();
      expect(r3.status).toBe(429);
      const text = await r3.text();
      expect(text.toLowerCase()).toContain('queue');

      // Once jobs drain below the cap, enqueue works again — this is a
      // capacity limit, not a permanent lockout.
      let drained = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !drained) {
        const jobs = await listJobs(port);
        drained = jobs.every((j) => j.status === 'done' || j.status === 'failed');
        if (!drained) await Bun.sleep(15);
      }
      expect(drained).toBe(true);
      const r4 = await post();
      expect(r4.status).toBe(202);
    } finally {
      await killProc(proc);
    }
  });
});

describe('exporters/jobs — list() + history under concurrency', () => {
  test('list() returns newest-first', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    const proc = await bootServer(root, port);
    try {
      // `canvas-as-separate` against an empty sandbox (`active: null`)
      // resolves to zero targets → the adapter's empty-input branch, no
      // Playwright spawn — fast + deterministic (mirrors endpoint.test.ts).
      for (let i = 0; i < 3; i += 1) {
        const r = await fetch(`http://localhost:${port}/_api/export-jobs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'png', scope: 'canvas-as-separate' }),
        });
        expect(r.status).toBe(202);
      }
      // Give the fire-and-forget jobs a moment to land.
      await Bun.sleep(200);
      const jobs = await listJobs(port);
      expect(jobs.length).toBeGreaterThanOrEqual(3);
      const createdAts = jobs.map((j) => j.createdAt);
      const sorted = [...createdAts].sort((a, b) => b.localeCompare(a));
      expect(createdAts).toEqual(sorted);
    } finally {
      await killProc(proc);
    }
  });

  test('history ledger caps at 20 without dropping entries under concurrent completions', async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    // MAUDE_EXPORT_MAX_QUEUED override — this test deliberately fires 25 jobs
    // in one burst (the concurrent-completion race itself), well above the
    // production default's DoS-protection cap; a real flood is hundreds of
    // requests, not a legitimate test burst.
    const proc = await bootServer(root, port, { MAUDE_EXPORT_MAX_QUEUED: '30' });
    try {
      // Fire 25 jobs concurrently (not sequentially) — the exact race the old
      // read-modify-write appendExportHistory had.
      await Promise.all(
        Array.from({ length: 25 }, () =>
          fetch(`http://localhost:${port}/_api/export-jobs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ format: 'png', scope: 'canvas-as-separate' }),
          }).then((r) => expect(r.status).toBe(202))
        )
      );
      // Poll until the ledger settles at the cap.
      let historyLen = 0;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline && historyLen < 20) {
        const r = await fetch(`http://localhost:${port}/_api/export-history`);
        const body = (await r.json()) as { history: unknown[] };
        historyLen = body.history.length;
        if (historyLen < 20) await Bun.sleep(20);
      }
      expect(historyLen).toBe(20);
    } finally {
      await killProc(proc);
    }
  });
});

describe('exporters/jobs — byte retrieval + eviction', () => {
  test("a finished job's bytes are downloadable, then gone once evicted past the cap", async () => {
    const { root } = makeSandbox();
    const port = nextPort();
    // MAUDE_EXPORT_MAX_QUEUED override — this test pushes 26 jobs through in
    // one burst (deliberately, to force eviction), above the production
    // default's DoS-protection cap.
    const proc = await bootServer(root, port, { MAUDE_EXPORT_MAX_QUEUED: '30' });
    try {
      const enqueue = async () => {
        const r = await fetch(`http://localhost:${port}/_api/export-jobs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'zip', scope: 'project-raw' }),
        });
        expect(r.status).toBe(202);
        const { jobId } = (await r.json()) as { jobId: string };
        return jobId;
      };

      const firstId = await enqueue();
      // Wait for it to finish.
      let done = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && !done) {
        const jobs = await listJobs(port);
        done = jobs.find((j) => j.id === firstId)?.status === 'done';
        if (!done) await Bun.sleep(15);
      }
      expect(done).toBe(true);

      const dl = await fetch(`http://localhost:${port}/_api/export-jobs/download?id=${firstId}`);
      expect(dl.status).toBe(200);
      expect(dl.headers.get('Content-Type')).toBe('application/zip');
      const bytes = await dl.arrayBuffer();
      expect(bytes.byteLength).toBeGreaterThan(0);

      // 404 for an unknown id.
      const missing = await fetch(`http://localhost:${port}/_api/export-jobs/download?id=nope`);
      expect(missing.status).toBe(404);

      // Push 25 more jobs through so the first one rolls past the 20-cap and
      // gets evicted (bytes removed from disk + dropped from the in-memory
      // map). Eviction runs on EVERY completion, so the oldest jobs drop out
      // of list() entirely well before the last of the 25 finishes — poll for
      // "nothing left pending" rather than tracking specific (possibly
      // already-evicted) ids.
      for (let i = 0; i < 25; i += 1) {
        await enqueue();
      }
      let settled = false;
      const deadline2 = Date.now() + 4000;
      while (Date.now() < deadline2 && !settled) {
        const jobs = await listJobs(port);
        settled = jobs.every((j) => j.status === 'done' || j.status === 'failed');
        if (!settled) await Bun.sleep(15);
      }
      expect(settled).toBe(true);

      const r = await fetch(`http://localhost:${port}/_api/export-history`);
      const body = (await r.json()) as { history: unknown[] };
      expect(body.history.length).toBe(20);

      const evicted = await fetch(
        `http://localhost:${port}/_api/export-jobs/download?id=${firstId}`
      );
      expect(evicted.status).toBe(404);
    } finally {
      await killProc(proc);
    }
  });
});
