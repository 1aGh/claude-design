// Shared test scaffolding. Bun-test only.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Subprocess, spawn } from 'bun';

export interface Sandbox {
  root: string;
  designRoot: string;
}

export function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-test-'));
  const designRoot = join(root, '.design');
  mkdirSync(designRoot, { recursive: true });
  writeFileSync(
    join(designRoot, 'config.json'),
    JSON.stringify(
      {
        name: 'test',
        designRoot: '.design',
        canvasGroups: [
          { label: 'System', path: 'system' },
          { label: 'UI', path: 'ui' },
        ],
      },
      null,
      2
    )
  );
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(
    join(designRoot, 'ui', 'fixture.html'),
    '<!doctype html><html><head><title>fix</title></head><body><h1>fixture</h1></body></html>'
  );
  return { root, designRoot };
}

let portCounter = 4500;
export function nextPort(): number {
  // Bump on every call so parallel tests don't collide. Bun.serve will throw
  // EADDRINUSE if the host happened to bind one — caller retries with nextPort().
  portCounter += 1;
  return portCounter;
}

export async function bootServer(root: string, port: number): Promise<Subprocess> {
  const serverPath = join(import.meta.dir, '..', 'server.ts');
  const proc = spawn({
    cmd: ['bun', 'run', serverPath, '--port', String(port), '--root', root],
    cwd: join(import.meta.dir, '..'),
    env: { ...process.env, NO_OPEN: '1', NODE_ENV: 'test' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  // Wait up to 3 s for the server to bind.
  const start = Date.now();
  while (Date.now() - start < 3000) {
    try {
      const r = await fetch(`http://localhost:${port}/_health`, {
        signal: AbortSignal.timeout(200),
      });
      if (r.ok) return proc;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(50);
  }
  proc.kill();
  throw new Error(`server did not start on port ${port} within 3 s`);
}

export async function killProc(proc: Subprocess) {
  proc.kill();
  try {
    await proc.exited;
  } catch {
    /* ignore */
  }
}
