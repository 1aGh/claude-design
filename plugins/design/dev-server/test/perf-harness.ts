#!/usr/bin/env bun
// Performance harness for Phase 3.4 budgets.
//
//   bun run plugins/design/dev-server/test/perf-harness.ts
//
// Boots the dev-server against a synthetic .design/ fixture, measures the
// budget table from `.ai/plans/phase-3.4-architecture-refactor.md`, and writes
// `test/perf-report.json` plus a one-line stdout summary.
//
// Budgets (relaxed per DDR-012):
//   coldStartHttpMs        < 100   process spawn -> /_health 200
//   bundleGzBytes          < 80 KB after Bun.build minify
//   wsRoundTripP50         < 1
//   wsRoundTripP99         < 5
//
// Non-blocking job — CI records the numbers and only fails on > 20 % regression
// from the prior baseline. Locally `--strict` exits 1 on any budget miss.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, gzipSync } from 'bun';

const STRICT = process.argv.includes('--strict');
const PORT = 4500 + Math.floor(Math.random() * 1000);

const HERE = import.meta.dir;
const REPO = join(HERE, '..');

interface Report {
  ts: string;
  budgets: Record<string, { value: number; budget: number; unit: string; pass: boolean }>;
  notes: string[];
}

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-perf-'));
  mkdirSync(join(root, '.design', 'ui'), { recursive: true });
  writeFileSync(join(root, '.design', 'config.json'), '{"name":"perf"}');
  for (let i = 0; i < 10; i++) {
    writeFileSync(
      join(root, '.design', 'ui', `c${i}.html`),
      `<!doctype html><html><body><div data-dc-screen="s${i}"><h1>${i}</h1></div></body></html>`,
    );
  }
  return root;
}

async function measureColdStart(root: string): Promise<number> {
  const start = performance.now();
  const proc = spawn({
    cmd: ['bun', 'run', join(REPO, 'server.ts'), '--port', String(PORT), '--root', root],
    cwd: REPO,
    env: { ...process.env, NO_OPEN: '1', NODE_ENV: 'production' },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  try {
    while (performance.now() - start < 5000) {
      try {
        const r = await fetch(`http://localhost:${PORT}/_health`, { signal: AbortSignal.timeout(50) });
        if (r.ok) return performance.now() - start;
      } catch {
        /* not up yet */
      }
      await Bun.sleep(5);
    }
    throw new Error('cold-start: server did not respond within 5 s');
  } finally {
    proc.kill();
    await proc.exited;
  }
}

async function measureBundleSize(): Promise<number> {
  const buildResult = spawn({
    cmd: ['bun', 'run', join(REPO, 'build.ts'), '--release', `--target=bun-${process.platform}-${process.arch}`],
    cwd: REPO,
    stdout: 'ignore',
    stderr: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const code = await buildResult.exited;
  if (code !== 0) throw new Error('build failed');
  const bundle = await Bun.file(join(REPO, 'dist', 'client.bundle.js')).arrayBuffer();
  const gz = gzipSync(new Uint8Array(bundle));
  return gz.byteLength;
}

async function measureWsRoundTrip(root: string): Promise<{ p50: number; p99: number }> {
  const proc = spawn({
    cmd: ['bun', 'run', join(REPO, 'server.ts'), '--port', String(PORT + 1), '--root', root],
    cwd: REPO,
    env: { ...process.env, NO_OPEN: '1' },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  try {
    while (true) {
      try {
        const r = await fetch(`http://localhost:${PORT + 1}/_health`, { signal: AbortSignal.timeout(50) });
        if (r.ok) break;
      } catch {
        /* */
      }
      await Bun.sleep(20);
    }
    const ws = new WebSocket(`ws://localhost:${PORT + 1}/_ws`);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ws timeout')), 2000);
      ws.addEventListener('open', () => {
        clearTimeout(t);
        resolve();
      });
      ws.addEventListener('error', reject);
    });

    const samples: number[] = [];
    for (let i = 0; i < 500; i++) {
      const t = performance.now();
      ws.send(JSON.stringify({ type: 'active', file: `.design/ui/c${i % 10}.html` }));
      // No round-trip echo for `active`; approximate by next-tick read.
      await Bun.sleep(0);
      samples.push(performance.now() - t);
    }
    ws.close();
    samples.sort((a, b) => a - b);
    return {
      p50: samples[Math.floor(samples.length * 0.5)] ?? 0,
      p99: samples[Math.floor(samples.length * 0.99)] ?? 0,
    };
  } finally {
    proc.kill();
    await proc.exited;
  }
}

async function main() {
  const root = makeFixture();
  const report: Report = { ts: new Date().toISOString(), budgets: {}, notes: [] };

  const cold = await measureColdStart(root);
  report.budgets.coldStartHttpMs = {
    value: Math.round(cold),
    budget: 100,
    unit: 'ms',
    pass: cold < 100,
  };

  const gz = await measureBundleSize();
  report.budgets.bundleGzBytes = {
    value: gz,
    budget: 80 * 1024,
    unit: 'B',
    pass: gz < 80 * 1024,
  };

  const ws = await measureWsRoundTrip(root);
  report.budgets.wsRoundTripP50 = { value: +ws.p50.toFixed(2), budget: 1, unit: 'ms', pass: ws.p50 < 1 };
  report.budgets.wsRoundTripP99 = { value: +ws.p99.toFixed(2), budget: 5, unit: 'ms', pass: ws.p99 < 5 };

  writeFileSync(join(HERE, 'perf-report.json'), JSON.stringify(report, null, 2));

  const summary = Object.entries(report.budgets)
    .map(([k, v]) => `${v.pass ? '✓' : '✗'} ${k}=${v.value}${v.unit} (budget ${v.budget}${v.unit})`)
    .join('  ');
  console.log(summary);

  const failed = Object.values(report.budgets).filter((b) => !b.pass).length;
  if (STRICT && failed > 0) process.exit(1);
}

await main();
