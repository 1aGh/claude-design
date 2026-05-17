// Smoke: recursive fs.watch fires when a file is written under designRoot.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createContext } from '../context.ts';
import { createFsWatch } from '../fs-watch.ts';

describe('fs-watch.ts', () => {
  test('emits fs:html on recursive write', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mdcc-fswatch-'));
    mkdirSync(join(root, '.design', 'ui', 'nested'), { recursive: true });
    writeFileSync(join(root, '.design', 'config.json'), '{"name":"t"}');

    const origArgv = process.argv;
    process.argv = [...origArgv, '--root', root];
    let watch: ReturnType<typeof createFsWatch> | null = null;
    try {
      const ctx = createContext();
      watch = createFsWatch(ctx);

      const seen: string[] = [];
      ctx.bus.on('fs:html', (file) => seen.push(String(file)));

      watch.start();
      // give the watcher a moment to register.
      await Bun.sleep(80);

      const target = join(root, '.design', 'ui', 'nested', 'evt.html');
      writeFileSync(target, '<doc>1</doc>');
      await Bun.sleep(250);

      expect(seen.some((f) => f.endsWith('evt.html'))).toBe(true);
    } finally {
      watch?.stop();
      process.argv = origArgv;
    }
  });
});
