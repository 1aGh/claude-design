// Background export job queue (feature-background-export-notification-center).
//
// Turns the previously-synchronous `POST /_api/export` into a backgroundable
// operation: `enqueue()` returns immediately with a job id + a Promise that
// resolves with the same `ExportResult` the old synchronous call produced, so
// `/_api/export` stays byte-for-byte contract-unchanged (it just awaits the
// Promise). `POST /_api/export-jobs` returns the id WITHOUT awaiting, and the
// job progresses queued → running → done|failed in the background, emitting
// `bus.emit('export:job', job)` on every transition so ws.ts can broadcast a
// live snapshot to the notification center.
//
// Concurrency is capped by a small hand-rolled counting semaphore (same
// "no new dependency" convention as `writeLocator()` in http.ts) so N
// Playwright/Chromium-heavy renders don't all launch at once — MAUDE_EXPORT_
// MAX_CONCURRENT (default 2) lets a quick PNG start while a slow PDF/video is
// still running, without letting an unbounded number of Chromiums spawn.
//
// History persistence: the in-memory `jobs` Map IS the source of truth. The
// on-disk `_export-history.json` ledger is re-derived from it (done/failed
// jobs, newest-first, capped) and overwritten in one shot on every
// completion — no read-modify-write, so concurrent completions can't drop
// entries (the race the old api.ts loadExportHistory/appendExportHistory
// pair had). The ledger is seeded from disk once at construction so history
// survives a server restart even though job state itself doesn't.

import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { Bus } from '../context.ts';
import {
  type ExportContext,
  type ExportOptions,
  type ExportResult,
  type Format,
  runExport,
  type Scope,
} from './index.ts';
import type { ResolveScopeArgs } from './scope.ts';

/** Extended shape of the old Phase 6.5 T10 history entry — additive fields only. */
export interface ExportHistoryEntry {
  format: string;
  scope: string;
  options?: Record<string, unknown>;
  filename: string;
  at: string;
  id?: string;
  status?: 'done' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export type ExportJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ExportJob {
  id: string;
  format: Format;
  scope: Scope;
  options: ExportOptions;
  status: ExportJobStatus;
  progress?: { current: number; total: number };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  filename?: string;
  contentType?: string;
  error?: string;
}

export interface EnqueueArgs {
  format: Format;
  scope: Scope;
  options: ExportOptions;
  resolve: Omit<ResolveScopeArgs, 'scope'>;
  ctx: ExportContext;
}

export type DownloadResult =
  | { ok: true; bytes: Uint8Array; filename: string; contentType: string }
  | { ok: false; reason: 'missing' | 'not-done' };

export interface ExportJobQueue {
  enqueue(args: EnqueueArgs): { id: string; result: Promise<ExportResult> };
  get(id: string): ExportJob | undefined;
  list(): ExportJob[];
  loadHistory(): ExportHistoryEntry[];
  getBytes(id: string): Promise<DownloadResult>;
}

const HISTORY_DEPTH = 20;
const MAX_JOB_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;

// Video/animation exports run a per-frame capture loop, so they legitimately
// take far longer than the 5-min default that's fine for image exports. The
// fast one-pass renderMediaOnWeb path is quick, but a comp that can't use it —
// e.g. it overflows @remotion/web-renderer's recursive precompositing (RCA
// issue-video-mp4-rendermediaonweb-stack-overflow) — degrades to frame-step
// screenshots at ~1.5–2 s/frame (2× scale). A 900-frame comp then runs 20–30
// min, so the image default would abort it mid-render (the "Target page closed
// at frame ~180/900" failure). Size the budget to the WORK — a generous
// per-frame estimate × the frame count — clamped to [5 min, 60 min]. The lower
// bound is deliberately the same 5 min as image exports (not a flat 30 min): a
// tiny clip that WEDGES shouldn't hold a scarce render slot for half an hour,
// and a security review flagged that a hostile comp which reliably overflows
// the renderer could otherwise turn a fast-fail into a long slot occupation.
// The upper bound is a runaway backstop. MAUDE_EXPORT_VIDEO_TIMEOUT_MS overrides
// end-to-end for renders bigger than the ceiling (e.g. if MAX_FRAMES is raised)
// — it DELIBERATELY bypasses the 60-min cap, since removing the backstop is the
// whole point of an operator escape hatch (trusted env, not attacker-reachable).
const VIDEO_FORMATS = new Set(['mp4', 'webm', 'gif']);
const VIDEO_TIMEOUT_MIN_MS = 5 * 60 * 1000; // 5 min — same baseline as image exports
const VIDEO_TIMEOUT_CEIL_MS = 60 * 60 * 1000; // 60 min hard ceiling (runaway backstop)
const VIDEO_PER_FRAME_BUDGET_MS = 2500; // ~2.5 s/frame — covers the slow frame-step path up to 3× scale
const VIDEO_SETUP_BUDGET_MS = 60 * 1000; // boot + goto + renderMediaOnWeb attempt before fallback

/** Wall-clock render budget for a job — sized to the frame count for video, 5 min otherwise. */
function jobTimeoutMs(args: EnqueueArgs): number {
  if (!VIDEO_FORMATS.has(args.format)) return DEFAULT_JOB_TIMEOUT_MS;
  // Operator escape hatch — intentionally uncapped (see note above).
  const envOverride = Number(process.env.MAUDE_EXPORT_VIDEO_TIMEOUT_MS);
  if (Number.isFinite(envOverride) && envOverride > 0) return envOverride;
  const o = args.options ?? {};
  const fps = Number(o.fps) || 30;
  const explicitFrames = Number(o.frames);
  const durationMs = Number(o.durationMs);
  const frames =
    Number.isFinite(explicitFrames) && explicitFrames > 0
      ? explicitFrames
      : Number.isFinite(durationMs) && durationMs > 0
        ? Math.round((durationMs / 1000) * fps)
        : 900; // no duration hint → assume the frame cap (worst case)
  const est = VIDEO_SETUP_BUDGET_MS + frames * VIDEO_PER_FRAME_BUDGET_MS;
  return Math.min(VIDEO_TIMEOUT_CEIL_MS, Math.max(VIDEO_TIMEOUT_MIN_MS, est));
}

/**
 * Security fan-out finding (defender, /flow:done) — MEDIUM: `enqueue()` had
 * no cap on queued/running jobs, so a flood of `POST /_api/export-jobs`
 * (unauthenticated same-origin-omitted-Origin callers pass `sameOriginWrite`)
 * could grow the in-memory Map and fill `_export-jobs/` on disk unbounded —
 * the old synchronous `/_api/export` had natural backpressure (one render at
 * a time from the client's own perspective) that the background queue
 * removed. `MAX_PENDING` bounds queued+running jobs; `enqueue()` throws
 * `ExportQueueFullError` past it and http.ts maps that to 429.
 */
const MAX_PENDING = Math.max(1, Number(process.env.MAUDE_EXPORT_MAX_QUEUED) || 20);

/** Thrown by `enqueue()` when `MAX_PENDING` queued/running jobs are already in flight. */
export class ExportQueueFullError extends Error {
  constructor() {
    super('export queue is full — too many pending exports, try again shortly');
    this.name = 'ExportQueueFullError';
  }
}

/** Small counting semaphore — no new dependency, mirrors writeLocator()'s style. */
class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}

function isFinished(job: ExportJob): boolean {
  return job.status === 'done' || job.status === 'failed';
}

export function createExportJobQueue(bus: Bus, designRoot: string): ExportJobQueue {
  const jobsDir = path.join(designRoot, '_export-jobs');
  const historyPath = path.join(designRoot, '_export-history.json');
  const maxConcurrent = Math.max(1, Number(process.env.MAUDE_EXPORT_MAX_CONCURRENT) || 2);
  const semaphore = new Semaphore(maxConcurrent);
  const jobs = new Map<string, ExportJob>();

  // Seed the ledger from disk ONCE — the only read of the history file. Every
  // later persist derives fresh from `jobs` and overwrites; there is no
  // subsequent read-then-write step, which is what eliminates the race.
  try {
    const raw = readFileSync(historyPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        const id = typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID();
        const finishedAt =
          typeof e.finishedAt === 'string'
            ? e.finishedAt
            : typeof e.at === 'string'
              ? e.at
              : undefined;
        jobs.set(id, {
          id,
          format: e.format as Format,
          scope: e.scope as Scope,
          options: (e.options as ExportOptions) ?? {},
          status: e.status === 'failed' ? 'failed' : 'done',
          createdAt: (e.startedAt as string) ?? finishedAt ?? new Date().toISOString(),
          startedAt: e.startedAt as string | undefined,
          finishedAt,
          filename: e.filename as string | undefined,
          error: e.error as string | undefined,
        });
      }
    }
  } catch {
    /* no ledger yet, or unreadable — start empty */
  }

  // Orphaned `_export-jobs/*` dirs from a process that died mid-export — job
  // state is in-memory only and doesn't survive a restart, so anything on
  // disk from a prior run is stale. Best-effort, never blocks boot.
  void rm(jobsDir, { recursive: true, force: true })
    .catch(() => {})
    .then(() => mkdir(jobsDir, { recursive: true }).catch(() => {}));

  function emit(job: ExportJob): void {
    bus.emit('export:job', { ...job });
  }

  function deriveHistory(): ExportHistoryEntry[] {
    return Array.from(jobs.values())
      .filter(isFinished)
      .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
      .slice(0, HISTORY_DEPTH)
      .map((j) => ({
        id: j.id,
        format: j.format,
        scope: j.scope,
        options: j.options,
        filename: j.filename ?? '',
        at: j.finishedAt ?? j.createdAt,
        status: j.status as 'done' | 'failed',
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        error: j.error,
      }));
  }

  async function persistAndEvict(): Promise<void> {
    const history = deriveHistory();
    await Bun.write(historyPath, JSON.stringify(history, null, 2));

    // Evict bytes (+ the in-memory record) for anything that rolled past the
    // cap, or aged out, whichever comes first.
    const finished = Array.from(jobs.values())
      .filter(isFinished)
      .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    const now = Date.now();
    const stale = finished.filter((j, i) => {
      if (i >= HISTORY_DEPTH) return true;
      const finishedAt = j.finishedAt ? Date.parse(j.finishedAt) : Number.NaN;
      return Number.isFinite(finishedAt) && now - finishedAt > MAX_JOB_AGE_MS;
    });
    for (const job of stale) {
      jobs.delete(job.id);
      await rm(path.join(jobsDir, job.id), { recursive: true, force: true }).catch(() => {});
    }
  }

  function enqueue(args: EnqueueArgs): { id: string; result: Promise<ExportResult> } {
    let pending = 0;
    for (const job of jobs.values()) {
      if (job.status === 'queued' || job.status === 'running') pending += 1;
    }
    if (pending >= MAX_PENDING) throw new ExportQueueFullError();

    const id = crypto.randomUUID();
    const job: ExportJob = {
      id,
      format: args.format,
      scope: args.scope,
      options: args.options,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    jobs.set(id, job);
    emit(job);

    const controller = new AbortController();

    const result = (async (): Promise<ExportResult> => {
      const release = await semaphore.acquire();
      // Started here, not at enqueue — the timeout bounds RENDER time (the
      // intent), not queue-wait time. A job can legitimately sit `queued`
      // behind MAUDE_EXPORT_MAX_CONCURRENT other jobs for longer than its
      // render budget; arming the timer before the semaphore resolves would
      // abort it before it ever ran (code-review finding, /flow:done).
      const timer = setTimeout(() => controller.abort(), jobTimeoutMs(args));
      try {
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        emit(job);

        const res = await runExport({
          format: args.format,
          scope: args.scope,
          options: args.options,
          resolve: args.resolve,
          ctx: args.ctx,
          hooks: {
            signal: controller.signal,
            onProgress: (update) => {
              job.progress = update;
              emit(job);
            },
          },
        });

        job.status = 'done';
        job.finishedAt = new Date().toISOString();
        job.filename = res.filename;
        job.contentType = res.contentType;
        if (res.body.byteLength) {
          const dir = path.join(jobsDir, id);
          await mkdir(dir, { recursive: true });
          await Bun.write(path.join(dir, res.filename), res.body);
        }
        emit(job);
        await persistAndEvict();
        return res;
      } catch (err) {
        job.status = 'failed';
        job.finishedAt = new Date().toISOString();
        job.error = err instanceof Error ? err.message : String(err);
        emit(job);
        await persistAndEvict();
        throw err;
      } finally {
        clearTimeout(timer);
        release();
      }
    })();

    return { id, result };
  }

  return {
    enqueue,
    get: (id) => jobs.get(id),
    list: () => Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    loadHistory: deriveHistory,
    async getBytes(id) {
      const job = jobs.get(id);
      if (!job) return { ok: false, reason: 'missing' };
      if (job.status !== 'done') return { ok: false, reason: 'not-done' };
      if (!job.filename) return { ok: false, reason: 'missing' };
      const file = Bun.file(path.join(jobsDir, id, job.filename));
      if (!(await file.exists())) return { ok: false, reason: 'missing' };
      return {
        ok: true,
        bytes: new Uint8Array(await file.arrayBuffer()),
        filename: job.filename,
        contentType: job.contentType ?? 'application/octet-stream',
      };
    },
  };
}
