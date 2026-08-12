// The out-of-process asset sweep — the CHILD's half of the contract.
//
// These spawn the real worker against a real (local) hub, because the two
// properties that matter here cannot be observed from inside the process that
// would otherwise mock them: what actually reaches stdout, and what actually
// reaches the wire's Authorization header. The parent's half (line parsing,
// crash translation, cancel) is `sync-asset-sweep.test.ts`.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKER = join(import.meta.dir, '..', 'sync', 'asset-push-worker.ts');

/** A design root holding `n` DS assets — the class that pushes to `/_asset-file/`. */
function projectWith(n: number): string {
  const root = mkdtempSync(join(tmpdir(), 'sweep-worker-'));
  mkdirSync(join(root, 'system/ds/assets/logos'), { recursive: true });
  for (let i = 0; i < n; i++) {
    writeFileSync(join(root, `system/ds/assets/logos/mark-${i}.svg`), `<svg>${i}</svg>`);
  }
  return root;
}

/**
 * A hub that accepts everything, records every Authorization it saw, and lets a
 * test react to a request (that is how the renewal case rewrites the token file
 * mid-sweep).
 */
function hub(onRequest?: (req: Request, seen: number) => void) {
  const auths: string[] = [];
  let seen = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      auths.push(req.headers.get('authorization') ?? '');
      onRequest?.(req, seen++);
      // No batch probe here — answering 404 sends the sweep down the
      // per-file HEAD path, which is the wider of the two code paths.
      if (url.pathname === '/_asset-probe') return new Response('nope', { status: 404 });
      if (req.method === 'HEAD') return new Response(null, { status: 404 });
      await req.arrayBuffer(); // drain, or the socket desynchronizes
      return new Response('ok', { status: 200 });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    auths,
    stop: () => server.stop(true),
  };
}

/** Run the worker to completion; return its stdout lines, stderr and exit code. */
async function run(args: string[]): Promise<{
  lines: { t: string; [k: string]: unknown }[];
  raw: string;
  stderr: string;
  code: number | null;
}> {
  const child = Bun.spawn([process.execPath, WORKER, ...args], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [raw, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await child.exited;
  const lines = raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return { lines, raw, stderr, code: child.exitCode };
}

describe('the worker speaks NDJSON and nothing else', () => {
  test('progress lines, then exactly one result line, then a clean exit', async () => {
    const root = projectWith(3);
    const h = hub();
    const tokenFile = join(root, 'tok');
    writeFileSync(tokenFile, 'secret-a', { mode: 0o600 });
    try {
      const { lines, raw, code } = await run([root, h.url, tokenFile]);

      expect(code).toBe(0);
      // Every line parsed — nothing unstructured reached stdout.
      expect(raw.trimEnd().split('\n').length).toBe(lines.length);
      const results = lines.filter((l) => l.t === 'result');
      expect(results.length).toBe(1);
      expect(lines.filter((l) => l.t === 'progress').length).toBeGreaterThan(0);
      // …and the result is the LAST thing said.
      expect(lines[lines.length - 1].t).toBe('result');
      expect(results[0].pushed).toEqual([
        'system/ds/assets/logos/mark-0.svg',
        'system/ds/assets/logos/mark-1.svg',
        'system/ds/assets/logos/mark-2.svg',
      ]);
      expect(results[0].failed).toEqual([]);
    } finally {
      h.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the final progress line is `finished`, so a parent never waits forever', async () => {
    const root = projectWith(1);
    const h = hub();
    const tokenFile = join(root, 'tok');
    writeFileSync(tokenFile, 'secret-a', { mode: 0o600 });
    try {
      const { lines } = await run([root, h.url, tokenFile]);
      const progress = lines.filter((l) => l.t === 'progress');
      expect(progress[progress.length - 1].finished).toBe(true);
    } finally {
      h.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the credential travels in a file, not on the command line', () => {
  test('the token reaching the hub is the FILE contents', async () => {
    const root = projectWith(1);
    const h = hub();
    const tokenFile = join(root, 'tok');
    writeFileSync(tokenFile, 'secret-from-file\n', { mode: 0o600 });
    try {
      await run([root, h.url, tokenFile]);
      // Trimmed — a file written with a trailing newline must not send one.
      expect(h.auths).toContain('Bearer secret-from-file');
      expect(h.auths.every((a) => a === 'Bearer secret-from-file')).toBe(true);
    } finally {
      h.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a token rewritten mid-sweep is picked up (silent renewal keeps working)', async () => {
    const root = projectWith(4);
    const tokenFile = join(root, 'tok');
    writeFileSync(tokenFile, 'old', { mode: 0o600 });
    // Rotate after the hub has answered a couple of requests — exactly what
    // `scheduleRenewal` does to the parent's in-memory token today.
    const h = hub((_req, seen) => {
      if (seen === 2) writeFileSync(tokenFile, 'new', { mode: 0o600 });
    });
    try {
      await run([root, h.url, tokenFile]);
      expect(h.auths).toContain('Bearer old');
      expect(h.auths).toContain('Bearer new');
    } finally {
      h.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the worker refuses what it cannot do', () => {
  test('missing arguments is exit 2 and a structured error, not a stack trace', async () => {
    const { lines, code } = await run([]);
    expect(code).toBe(2);
    expect(lines[0].t).toBe('error');
    expect(String(lines[0].message)).toContain('usage:');
  });

  test('an unreachable hub is a finished sweep with failures — never a hang', async () => {
    const root = projectWith(1);
    const tokenFile = join(root, 'tok');
    writeFileSync(tokenFile, 'secret-a', { mode: 0o600 });
    try {
      // Port 1 is not listening; the sweep must still terminate and report.
      const { lines, code } = await run([root, 'http://127.0.0.1:1', tokenFile]);
      expect(code).toBe(0);
      const result = lines.find((l) => l.t === 'result') as { failed: unknown[] } | undefined;
      expect(result?.failed.length).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
