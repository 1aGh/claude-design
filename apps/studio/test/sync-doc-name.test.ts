// DDR-192 §5 — the `ws/<workspace-id>/<branch>/<slug>` document namespace,
// client side: resolution (where the workspace id and branch come from), the
// opt-in rollout rule, conformance with the hub's independent implementation,
// and the DDR-076 fresh-doc case that makes changing doc identity safe.

import { describe, expect, test } from 'bun:test';

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The HUB's implementation, imported across the package boundary on purpose —
// this file is what pins the two grammars to each other (see doc-name.ts).
import * as hub from '../../hub/src/doc-namespace.mjs';
import { decideColdStart } from '../sync/cold-start.ts';
import {
  buildDocName,
  createDocNameResolver,
  isNamespaced,
  parseDocName,
  readBranch,
  readOriginUrl,
  resolveWorkspaceId,
  sanitizeComponent,
  workspaceIdFromRemote,
} from '../sync/doc-name.ts';

/** A throwaway repo skeleton: `.git/HEAD` + optionally `.git/config`. */
function makeRepo(opts: { head?: string; origin?: string } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'maude-docname-'));
  mkdirSync(path.join(root, '.git'), { recursive: true });
  writeFileSync(path.join(root, '.git', 'HEAD'), opts.head ?? 'ref: refs/heads/main\n');
  if (opts.origin) {
    writeFileSync(
      path.join(root, '.git', 'config'),
      `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${opts.origin}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n`
    );
  }
  return root;
}

describe('doc-name — resolution inputs', () => {
  test('readBranch reads a branch, a slash-branch, and a detached HEAD', () => {
    const a = makeRepo({ head: 'ref: refs/heads/main\n' });
    const b = makeRepo({ head: 'ref: refs/heads/feature/cloud-arc\n' });
    const c = makeRepo({ head: '9f1c0a2b3c4d5e6f708192a3b4c5d6e7f8091a2b\n' });
    const none = mkdtempSync(path.join(tmpdir(), 'maude-nogit-'));
    try {
      expect(readBranch(a)).toBe('main');
      expect(readBranch(b)).toBe('feature/cloud-arc');
      // A detached HEAD gets a STABLE name for that commit, so two peers
      // detached at the same commit meet and neither joins a branch's doc.
      expect(readBranch(c)).toBe('detached-9f1c0a2');
      expect(readBranch(none)).toBe(null);
    } finally {
      for (const d of [a, b, c, none]) rmSync(d, { recursive: true, force: true });
    }
  });

  test('readOriginUrl picks origin out of .git/config, ignoring other remotes', () => {
    const root = makeRepo({ origin: 'git@github.com:1aGh/maude.git' });
    try {
      expect(readOriginUrl(root)).toBe('git@github.com:1aGh/maude.git');
      writeFileSync(
        path.join(root, '.git', 'config'),
        '[remote "upstream"]\n\turl = https://example.com/x/y.git\n'
      );
      expect(readOriginUrl(root)).toBe(null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the same project cloned different ways yields the SAME workspace id', () => {
    // This is the property that decides whether two peers meet at all. If SSH
    // and HTTPS clones of one repo derived different ids, each peer would see
    // the other's documents as simply absent.
    const forms = [
      'git@github.com:1aGh/maude.git',
      'https://github.com/1aGh/maude.git',
      'https://github.com/1aGh/maude',
      'ssh://git@github.com/1aGh/maude.git',
      'https://user:tok@github.com/1aGh/maude.git',
    ];
    const ids = new Set(forms.map(workspaceIdFromRemote));
    expect([...ids]).toEqual(['1agh-maude']);
  });

  test('different projects yield different workspace ids', () => {
    expect(workspaceIdFromRemote('git@github.com:1aGh/maude.git')).not.toBe(
      workspaceIdFromRemote('git@github.com:1aGh/dugmate.git')
    );
    expect(workspaceIdFromRemote('git@github.com:acme/site.git')).not.toBe(
      workspaceIdFromRemote('git@gitlab.com:other/site.git')
    );
  });

  test('resolveWorkspaceId prefers explicit config, then origin, then nothing', () => {
    const withOrigin = makeRepo({ origin: 'git@github.com:acme/site.git' });
    const noOrigin = makeRepo();
    try {
      expect(resolveWorkspaceId({ explicit: 'cloud-abc123', repoRoot: withOrigin })).toBe(
        'cloud-abc123'
      );
      expect(resolveWorkspaceId({ repoRoot: withOrigin })).toBe('acme-site');
      // No origin and no config: null. NOT a directory-name fallback — a local
      // path differs per machine, so deriving from it would split peers apart.
      expect(resolveWorkspaceId({ repoRoot: noOrigin })).toBe(null);
    } finally {
      rmSync(withOrigin, { recursive: true, force: true });
      rmSync(noOrigin, { recursive: true, force: true });
    }
  });
});

describe('doc-name — the rollout rule', () => {
  test('unset flag + no explicit workspace id ⇒ flat (an upgrade changes nothing)', () => {
    const root = makeRepo({ origin: 'git@github.com:acme/site.git' });
    try {
      const resolve = createDocNameResolver({ repoRoot: root });
      expect(resolve('ui-screen')).toBe('ui-screen');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('an explicitly declared workspace id opts in', () => {
    const root = makeRepo({ origin: 'git@github.com:acme/site.git' });
    try {
      const resolve = createDocNameResolver({ repoRoot: root, explicitWorkspaceId: 'acme-site' });
      expect(resolve('ui-screen')).toBe('ws/acme-site/main/ui-screen');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('MAUDE_HUB_NAMESPACED=0 forces flat even with an explicit id', () => {
    const root = makeRepo({ origin: 'git@github.com:acme/site.git' });
    try {
      const resolve = createDocNameResolver({
        repoRoot: root,
        explicitWorkspaceId: 'acme-site',
        flag: '0',
      });
      expect(resolve('ui-screen')).toBe('ui-screen');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('MAUDE_HUB_NAMESPACED=1 namespaces from the origin remote', () => {
    const root = makeRepo({
      origin: 'git@github.com:acme/site.git',
      head: 'ref: refs/heads/dev\n',
    });
    try {
      const resolve = createDocNameResolver({ repoRoot: root, flag: '1' });
      expect(resolve('ui-screen')).toBe('ws/acme-site/dev/ui-screen');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('MAUDE_HUB_NAMESPACED=1 with nothing to derive from THROWS, never falls back', () => {
    // A silent fallback here would put a project the operator asked to isolate
    // into the shared flat namespace — the failure mode is worse than a crash.
    const noOrigin = makeRepo();
    const noGit = mkdtempSync(path.join(tmpdir(), 'maude-nogit-'));
    try {
      expect(() => createDocNameResolver({ repoRoot: noOrigin, flag: '1' })).toThrow(
        /workspace id/i
      );
      expect(() =>
        createDocNameResolver({ repoRoot: noGit, flag: '1', explicitWorkspaceId: 'acme' })
      ).toThrow(/branch/i);
    } finally {
      rmSync(noOrigin, { recursive: true, force: true });
      rmSync(noGit, { recursive: true, force: true });
    }
  });

  test('a branch with a slash is normalized, not rejected', () => {
    const root = makeRepo({ head: 'ref: refs/heads/feature/cloud-arc\n' });
    try {
      const resolve = createDocNameResolver({ repoRoot: root, explicitWorkspaceId: 'acme' });
      expect(resolve('ui-screen')).toBe('ws/acme/feature-cloud-arc/ui-screen');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('doc-name — conformance with the hub implementation', () => {
  const components = [
    'main',
    'feature/cloud-arc',
    'Release/2026.07',
    '  --weird--  ',
    '...',
    '',
    'x'.repeat(200),
    'ui-screen',
    'a/b/c',
  ];

  test('sanitizeComponent agrees byte-for-byte', () => {
    for (const c of components) {
      expect(sanitizeComponent(c)).toBe(hub.sanitizeComponent(c));
    }
  });

  test('buildDocName agrees, including which inputs throw', () => {
    for (const w of components) {
      for (const b of ['main', '...']) {
        const args = { workspaceId: w, branch: b, slug: 'ui-screen' };
        let mine: string | Error;
        let theirs: string | Error;
        try {
          mine = buildDocName(args);
        } catch (e) {
          mine = e as Error;
        }
        try {
          theirs = hub.buildDocName(args);
        } catch (e) {
          theirs = e as Error;
        }
        if (mine instanceof Error || theirs instanceof Error) {
          expect(mine instanceof Error).toBe(theirs instanceof Error);
        } else {
          expect(mine).toBe(theirs);
        }
      }
    }
  });

  test('parseDocName agrees over namespaced, legacy, and malformed names', () => {
    const names = [
      'ws/acme/main/ui-screen',
      'ui-screen',
      '',
      'ws/acme/main',
      'ws/acme/main/a/b',
      'x/acme/main/ui',
      'ws//main/ui',
      'ws/acme//ui',
    ];
    for (const n of names) {
      expect(parseDocName(n)).toEqual(hub.parseDocName(n));
      expect(isNamespaced(n)).toBe(hub.isNamespaced(n));
    }
  });
});

describe('doc-name — changing identity is safe (DDR-076)', () => {
  test('a freshly namespaced doc is EMPTY, and empty never clobbers local files', () => {
    const root = makeRepo({ origin: 'git@github.com:acme/site.git' });
    try {
      // The rename itself: the same canvas addressed under a new identity.
      const flat = createDocNameResolver({ repoRoot: root });
      const namespaced = createDocNameResolver({ repoRoot: root, flag: '1' });
      expect(flat('ui-screen')).toBe('ui-screen');
      expect(namespaced('ui-screen')).toBe('ws/acme-site/main/ui-screen');
      expect(namespaced('ui-screen')).not.toBe(flat('ui-screen'));

      // Consequence: on first connect the hub has nothing under the new name.
      // DDR-076 — that means "not seeded yet", never "authoritatively blank".
      const decision = decideColdStart({
        localBody: '<main>real local work</main>',
        docBody: '',
        journalHash: null,
        localMtimeMs: Date.now(),
        docBodyEditAtMs: null,
      });
      expect(decision.action).toBe('seed-local-up');
      expect(decision.winner).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
