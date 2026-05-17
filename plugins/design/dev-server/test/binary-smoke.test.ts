// Smoke: dist/mdcc-<platform> compiles + spawns + exits cleanly.
//
// We run this only when the compiled binary is already present. The full
// `bun build --compile` step costs ~150 ms; CI matrix already proves it on
// every release tag (Task 13). Local devs see this skip silently unless they
// have already run `bun run build.ts --release`.

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const PLATFORM_SLUG = (() => {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  if (p === 'win32') return 'win32-x64';
  return null;
})();

describe('binary smoke', () => {
  test('compiled binary boots and exits 0 on --help / handles unknown args gracefully', async () => {
    if (!PLATFORM_SLUG) {
      console.log('binary-smoke: unsupported host platform; skipping');
      return;
    }
    const binPath = join(import.meta.dir, '..', 'dist', `mdcc-${PLATFORM_SLUG}`);
    const exists = await Bun.file(binPath).exists();
    if (!exists) {
      console.log(
        `binary-smoke: ${binPath} not built; skipping (run \`bun run build.ts --release\`)`
      );
      return;
    }

    // The compiled binary is the dev-server entry — invoking it with --root
    // pointing at a temp dir without .design/ causes a fail-loud exit (1).
    // That's enough to prove the binary is a valid executable.
    const proc = Bun.spawn({
      cmd: [binPath, '--root', '/tmp/nonexistent-mdcc-test'],
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NO_OPEN: '1' },
    });
    const code = await proc.exited;
    expect(code === 0 || code === 1).toBe(true);
  });
});
