// Cloud Phase 19, cell side — a mirror is a copy, and a copy must never be
// able to disturb the thing it copies, nor hold a credential worth stealing.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pushMirror, requestPushToken } from '../src/mirror-push.mjs';

const OK_TOKEN = (expiresIn = 3600_000) => ({
  fetchImpl: async () =>
    new Response(JSON.stringify({ token: 'ghs_secret', expiresAt: Date.now() + expiresIn }), {
      status: 200,
    }),
});
const silent = () => ({ log() {}, warn() {}, error() {} });

const BASE = {
  repoDir: '/repo',
  repository: '1aGh/alligators',
  branch: 'maude-workspace',
  controlPlaneUrl: 'https://c',
  tenantId: 't',
  cellSecret: 's',
};

describe('the push credential', () => {
  it('is asked for, never held', async () => {
    let seen = null;
    await requestPushToken(
      {
        controlPlaneUrl: 'https://cloud.maude.sh/',
        tenantId: 'alligators',
        cellSecret: 'derived-secret',
        repository: 'alligators',
      },
      {
        fetchImpl: async (url, init) => {
          seen = { url, auth: init.headers.authorization, body: JSON.parse(init.body) };
          return new Response(JSON.stringify({ token: 'ghs_x', expiresAt: Date.now() + 3600_000 }), {
            status: 200,
          });
        },
      }
    );
    assert.equal(seen.url, 'https://cloud.maude.sh/internal/mirror-token');
    assert.equal(seen.auth, 'Bearer derived-secret');
    assert.deepEqual(seen.body, { tenant: 'alligators', repository: 'alligators' });
  });

  it('refuses a credential that is about to expire', async () => {
    // It would fail mid-push and read as an auth problem the customer must go
    // fix, when in fact nothing of theirs is wrong.
    const r = await requestPushToken(
      { controlPlaneUrl: 'https://c', tenantId: 't', cellSecret: 's', repository: 'r' },
      OK_TOKEN(60_000)
    );
    assert.equal(r.ok, false);
    assert.match(r.message, /near expiry/);
  });
});

describe('the push itself', () => {
  it('never stores the credential as a remote', async () => {
    // `git remote add` would write a live token into .git/config, where the
    // tenant's own tooling reads it — and where the next backup copies it.
    const calls = [];
    await pushMirror(
      {
        ...BASE,
        log: silent(),
        run: async (args) => {
          calls.push(args);
          return { code: 0, stdout: '', stderr: '' };
        },
      },
      OK_TOKEN()
    );
    assert.equal(calls.length, 1, 'exactly one git invocation');
    assert.equal(calls[0][0], 'push');
    assert.ok(!calls.some((a) => a[0] === 'remote' || a[0] === 'config'));
  });

  it('never force-pushes, whatever the outcome', async () => {
    const calls = [];
    await pushMirror(
      {
        ...BASE,
        branch: 'main',
        log: silent(),
        run: async (args) => {
          calls.push(args);
          return { code: 1, stdout: '', stderr: 'rejected non-fast-forward' };
        },
      },
      OK_TOKEN()
    );
    const flat = calls.flat().join(' ');
    assert.ok(!/(^|\s)(-f|--force|\+refs)/.test(flat), `force reached git: ${flat}`);
  });

  it('a diverged mirror stops and says nothing was overwritten', async () => {
    const r = await pushMirror(
      {
        ...BASE,
        branch: 'main',
        log: silent(),
        run: async () => ({ code: 1, stdout: '', stderr: 'rejected: non-fast-forward, fetch first' }),
      },
      OK_TOKEN()
    );
    assert.equal(r.state, 'diverged');
    assert.match(r.message, /Nothing was overwritten/);
  });

  it('an invalid target never reaches git, and mints no token', async () => {
    let ran = false;
    let minted = false;
    const r = await pushMirror(
      {
        ...BASE,
        repository: 'https://github.com/evil/x',
        log: silent(),
        run: async () => {
          ran = true;
          return { code: 0, stdout: '', stderr: '' };
        },
      },
      {
        fetchImpl: async () => {
          minted = true;
          return new Response('{}', { status: 200 });
        },
      }
    );
    assert.equal(ran, false, 'a URL target must be refused before git');
    assert.equal(minted, false, 'and before any credential is issued');
    assert.equal(r.ok, false);
  });

  it('logs the outcome without the token in it', async () => {
    const lines = [];
    await pushMirror(
      {
        ...BASE,
        log: { log: (l) => lines.push(l) },
        run: async () => ({ code: 0, stdout: '', stderr: '' }),
      },
      OK_TOKEN()
    );
    assert.ok(lines.length > 0);
    assert.ok(
      !lines.join('\n').includes('ghs_secret'),
      'a token in a log is a token on disk forever'
    );
  });
});
