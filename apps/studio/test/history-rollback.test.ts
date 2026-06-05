// Smoke: snapshot writer + rollback reader round-trip (history.ts directly,
// no server process).

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createContext } from '../context.ts';
import { createHistory } from '../history.ts';

function withSandbox<T>(fn: (ctx: ReturnType<typeof createContext>) => Promise<T>): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), 'mdcc-history-'));
  mkdirSync(join(root, '.design', 'ui'), { recursive: true });
  writeFileSync(join(root, '.design', 'config.json'), '{"name":"t"}');
  writeFileSync(join(root, '.design', 'ui', 'a.html'), '<doc>a</doc>');

  // createContext() reads --root from argv; spoof it.
  const origArgv = process.argv;
  process.argv = [...origArgv, '--root', root];
  try {
    const ctx = createContext();
    return fn(ctx);
  } finally {
    process.argv = origArgv;
  }
}

describe('history.ts', () => {
  test('writeSnapshot + readSnapshot round-trip', async () => {
    await withSandbox(async (ctx) => {
      const hist = createHistory(ctx);
      const wrote = await hist.writeSnapshot('.design/ui/a.html', '<doc>v1</doc>', 'pre-edit');
      expect(wrote.slug).toBe('ui-a');
      expect(wrote.reason).toBe('pre-edit');
      expect(wrote.size).toBeGreaterThan(0);

      const list = await hist.listSnapshots('.design/ui/a.html');
      expect(list.length).toBe(1);
      expect(list[0]?.ts).toBe(wrote.ts);

      const read = await hist.readSnapshot('.design/ui/a.html', wrote.ts);
      expect(read).not.toBeNull();
      expect(new TextDecoder().decode(read?.content)).toBe('<doc>v1</doc>');
    });
  });

  test('rollback overwrites the target file', async () => {
    await withSandbox(async (ctx) => {
      const hist = createHistory(ctx);
      const fp = '.design/ui/a.html';
      // Take a snapshot of the original content, mutate the file, then roll back.
      const original = await Bun.file(join(ctx.paths.repoRoot, fp)).text();
      const snap = await hist.writeSnapshot(fp, original, 'baseline');
      await Bun.write(join(ctx.paths.repoRoot, fp), '<doc>modified</doc>');
      const restored = await hist.rollback(fp, snap.ts);
      expect(restored).not.toBeNull();
      const after = await Bun.file(join(ctx.paths.repoRoot, fp)).text();
      expect(after).toBe(original);
    });
  });
});
