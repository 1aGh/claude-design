// Phase 27 Task 5 (E2) — live dirty-state broadcast.
//
// Unit: the `isVersionable` gate. Integration: boot a real server against a git
// sandbox, open the inspector WS, edit a canvas `.tsx`, and prove a `git-status`
// message with the changed file arrives — the "badge increments within 500 ms"
// acceptance (generous 2 s ceiling for fs.watch + debounce + git on CI).

import { describe, expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { __testing } from '../git/watch.ts';
import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

describe('git/watch — isVersionable', () => {
  const { isVersionable } = __testing;
  test('matches versionable design content', () => {
    for (const p of [
      'ui/Pricing.tsx',
      'ui/Pricing.css',
      'ui/Pricing.meta.json',
      'ui-pricing.annotations.svg',
      '_comments/ui-pricing.json',
      '_annotations/ui-pricing.svg',
    ]) {
      expect(isVersionable(p)).toBe(true);
    }
  });
  test('ignores non-versionable noise', () => {
    for (const p of ['ui/fixture.html', 'notes.txt', '_server.json', 'README.md']) {
      expect(isVersionable(p)).toBe(false);
    }
  });
});

function sh(dir: string, args: string[]) {
  Bun.spawnSync(['git', ...args], {
    cwd: dir,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
}

describe('git/watch — live broadcast', () => {
  test('editing a canvas .tsx broadcasts git-status with the changed file', async () => {
    const { root, designRoot } = makeSandbox();
    sh(root, ['init', '-q', '-b', 'main']);
    sh(root, ['config', 'user.email', 'tester@maude.local']);
    sh(root, ['config', 'user.name', 'Tester']);
    sh(root, ['config', 'commit.gpgsign', 'false']);
    sh(root, ['add', '-A']);
    sh(root, ['commit', '-qm', 'seed']);

    const port = nextPort();
    const proc = await bootServer(root, port);
    let socket: WebSocket | null = null;
    try {
      const messages: Array<{ type: string; payload?: { files?: Array<{ path: string }> } }> = [];
      const sock = new WebSocket(`ws://localhost:${port}/_ws`);
      socket = sock;
      await new Promise<void>((res, rej) => {
        sock.addEventListener('open', () => res());
        sock.addEventListener('error', () => rej(new Error('ws error')));
        setTimeout(() => rej(new Error('ws open timeout')), 2000);
      });
      sock.addEventListener('message', (ev) => {
        try {
          messages.push(JSON.parse(String(ev.data)));
        } catch {
          /* ignore non-JSON */
        }
      });

      // Edit a NEW canvas .tsx — triggers fs:any → gitWatch → git-status.
      writeFileSync(join(designRoot, 'ui', 'Live.tsx'), 'export default () => null\n');

      // Poll for the broadcast (debounce 300 ms + git status latency).
      const deadline = Date.now() + 2000;
      let hit: (typeof messages)[number] | undefined;
      while (Date.now() < deadline) {
        hit = messages.find(
          (m) =>
            m.type === 'git-status' && m.payload?.files?.some((f) => f.path.endsWith('Live.tsx'))
        );
        if (hit) break;
        await Bun.sleep(50);
      }
      expect(hit).toBeDefined();
    } finally {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
      await killProc(proc);
    }
  }, 10_000);
});
