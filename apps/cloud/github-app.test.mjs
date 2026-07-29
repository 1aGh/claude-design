// Cloud Phase 19 — the credential boundary.
//
// Everything here is about one question: what can somebody do with what they
// stole? The App key mints for every installed repo; a scoped installation
// token mints for one, for an hour. These tests pin the difference.

import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';

import { appJwt, mintInstallationToken, pushUrl, redactPushUrl } from './github-app.mjs';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

describe('the App JWT', () => {
  it('is RS256, short-lived, and issued by the App', async () => {
    const now = 1_700_000_000_000;
    const [h, p] = (await appJwt(PEM, '4425366', now)).split('.');
    assert.deepEqual(decodeSegment(h), { alg: 'RS256', typ: 'JWT' });
    const claims = decodeSegment(p);
    assert.equal(claims.iss, '4425366');
    assert.equal(claims.exp - claims.iat, 600, 'ten minutes, not a session');
  });

  it('backdates iat, because two clocks are never the same', async () => {
    // GitHub rejects a token whose iat is in the future. A Worker's clock and
    // GitHub's differ by more than zero, and the failure looks like a bad key.
    const now = 1_700_000_000_000;
    const claims = decodeSegment((await appJwt(PEM, '1', now)).split('.')[1]);
    assert.equal(claims.iat, Math.floor(now / 1000) - 60);
  });
});

describe('an installation token is scoped to ONE repository', () => {
  it('names the repository in the request', async () => {
    // Without this, the token can write to every repo the installation covers.
    // A tenant mirroring to their own repo would then hold a credential for
    // every other repo the owner installed the App on.
    let seen = null;
    await mintInstallationToken(
      { privateKeyPem: PEM, appId: '1', installationId: '99', repository: 'alligators' },
      {
        fetchImpl: async (url, init) => {
          seen = { url, body: JSON.parse(init.body) };
          return new Response(JSON.stringify({ token: 'ghs_x', expires_at: new Date().toISOString() }), {
            status: 200,
          });
        },
      }
    );
    assert.match(seen.url, /\/app\/installations\/99\/access_tokens$/);
    assert.deepEqual(seen.body, { repositories: ['alligators'] });
  });

  it('refuses to run when the App is not configured', async () => {
    await assert.rejects(
      () => mintInstallationToken({ appId: '1', installationId: '2' }),
      /not configured/
    );
  });

  it('does not leak GitHub\'s response body into the error', async () => {
    // The body names the App and the installation. Neither belongs in a
    // message a tenant might end up reading.
    await assert.rejects(
      () =>
        mintInstallationToken(
          { privateKeyPem: PEM, appId: '1', installationId: '2' },
          {
            fetchImpl: async () =>
              new Response('{"message":"Integration maude-mirror not installed for org secret-corp"}', {
                status: 404,
              }),
          }
        ),
      (err) => {
        assert.match(err.message, /HTTP 404/);
        assert.ok(!/secret-corp/.test(err.message), 'the body must not cross back');
        return true;
      }
    );
  });
});

describe('the token never survives a log line', () => {
  it('redacts the credential out of a push URL', () => {
    const url = pushUrl('1aGh/alligators', 'ghs_supersecret');
    assert.match(url, /^https:\/\/x-access-token:ghs_supersecret@github\.com\/1aGh\/alligators\.git$/);
    const safe = redactPushUrl(url);
    assert.ok(!safe.includes('ghs_supersecret'), 'a token in a log is a token on disk forever');
    assert.equal(safe, 'https://***@github.com/1aGh/alligators.git');
  });

  it('redacting a URL with no credential leaves it alone', () => {
    assert.equal(
      redactPushUrl('https://github.com/1aGh/alligators.git'),
      'https://github.com/1aGh/alligators.git'
    );
  });
});
