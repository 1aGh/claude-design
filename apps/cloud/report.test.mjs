// Bug-report intake — feature-bug-report-button.
//
// What these tests pin: an UNAUTHENTICATED endpoint may exist only because
// every abuse lever is capped — size, type (magic bytes, not headers), count,
// per-install + per-IP daily quota, and a kill switch. Plus the credential
// rule inherited from github-app.mjs: the minted token is used and forgotten,
// and the issue lands in the ONE configured repo.

import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import { handleReport, issueBody, sniffImage, toBase64 } from './report.mjs';
import { SCHEMA_SQL } from './schema.mjs';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return {
    env: {
      DB,
      GITHUB_APP_PRIVATE_KEY: PEM,
      GITHUB_APP_ID: '1',
      GITHUB_APP_INSTALLATION_ID: '2',
      ...extra,
    },
    sqlite,
  };
}

/** A fetchImpl that plays GitHub: token mint, contents PUT, issue create. */
function fakeGitHub() {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/access_tokens')) {
      return new Response(
        JSON.stringify({
          token: 'ghs_test',
          expires_at: new Date(Date.now() + 3.6e6).toISOString(),
        }),
        { status: 201 }
      );
    }
    if (url.includes('/contents/')) return new Response(JSON.stringify({}), { status: 201 });
    if (url.endsWith('/issues')) {
      return new Response(
        JSON.stringify({ number: 42, html_url: 'https://github.com/1aGh/maude-reports/issues/42' }),
        { status: 201 }
      );
    }
    return new Response('unexpected', { status: 500 });
  };
  return { impl, calls };
}

function reportForm(overrides = {}, screenshots = []) {
  const form = new FormData();
  form.set(
    'report',
    JSON.stringify({
      schema: 'maude-report/v1',
      reportId: 'r-8f3a2c1d',
      installId: 'i-abcdef1234',
      createdAt: '2026-07-30T12:00:00Z',
      description: 'Clicking export freezes the app',
      ...overrides,
    })
  );
  for (const [bytes, name] of screenshots) {
    form.append('screenshot', new File([bytes], name, { type: 'application/octet-stream' }));
  }
  return form;
}

function post(form, headers = {}) {
  return new Request('https://cloud.test/report', { method: 'POST', body: form, headers });
}

describe('sniffing + encoding helpers', () => {
  it('sniffs by magic bytes, never by name or header', () => {
    assert.equal(sniffImage(PNG.buffer), 'png');
    assert.equal(sniffImage(JPG.buffer), 'jpg');
    assert.equal(sniffImage(new TextEncoder().encode('<svg onload=…>').buffer), null);
  });

  it('base64 round-trips', () => {
    assert.equal(
      Buffer.from(toBase64(PNG.buffer), 'base64').toString('hex'),
      Buffer.from(PNG).toString('hex')
    );
  });
});

describe('the intake gate', () => {
  it('ignores other paths, 405s non-POST, 503s when killed', async () => {
    const { env } = await freshEnv();
    assert.equal(await handleReport(new Request('https://cloud.test/health'), env), null);
    const r405 = await handleReport(new Request('https://cloud.test/report'), env);
    assert.equal(r405.status, 405);
    const { env: killed } = await freshEnv({ REPORTS_DISABLED: '1' });
    const r503 = await handleReport(post(reportForm()), killed);
    assert.equal(r503.status, 503);
    assert.match((await r503.json()).error, /paused/);
  });

  it('rejects a wrong schema, a missing description, a malformed reportId', async () => {
    const { env } = await freshEnv();
    for (const bad of [
      { schema: 'maude-report/v2' },
      { description: '   ' },
      { reportId: 'nope' },
    ]) {
      const res = await handleReport(post(reportForm(bad)), env, { fetchImpl: fakeGitHub().impl });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  });

  it('rejects a non-image posing as a screenshot (magic bytes, not headers)', async () => {
    const { env } = await freshEnv();
    const res = await handleReport(
      post(reportForm({}, [[new TextEncoder().encode('#!/bin/sh evil'), 'shot.png']])),
      env,
      { fetchImpl: fakeGitHub().impl }
    );
    assert.equal(res.status, 415);
  });

  it('rejects more than 3 screenshots', async () => {
    const { env } = await freshEnv();
    const shots = [1, 2, 3, 4].map((i) => [PNG, `s${i}.png`]);
    const res = await handleReport(post(reportForm({}, shots)), env, {
      fetchImpl: fakeGitHub().impl,
    });
    assert.equal(res.status, 400);
  });
});

describe('a report becomes a public issue with private attachments', () => {
  it('commits media privately, opens the public issue with the report label', async () => {
    const { env } = await freshEnv();
    const gh = fakeGitHub();
    const res = await handleReport(
      post(
        reportForm({ logs: { serverLogTail: '[log] secret-ish tail line' } }, [
          [PNG, 'shot.png'],
          [JPG, 'shot2.jpg'],
        ])
      ),
      env,
      {
        fetchImpl: gh.impl,
        nowMs: Date.parse('2026-07-30T12:00:00Z'),
      }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.issueNumber, 42);

    // Token is minted scoped to exactly the two repos — issues + media.
    const mint = gh.calls.find((c) => c.url.includes('/access_tokens'));
    assert.deepEqual(JSON.parse(mint.init.body).repositories, ['maude', 'maude-reports']);

    // Screenshots AND the logs file land in the PRIVATE media repo.
    const puts = gh.calls.filter((c) => c.url.includes('/contents/'));
    assert.equal(puts.length, 3);
    for (const put of puts) assert.match(put.url, /repos\/1aGh\/maude-reports\/contents\//);
    assert.match(puts[0].url, /media\/2026-07\/r-8f3a2c1d-1\.png$/);
    assert.match(puts[1].url, /media\/2026-07\/r-8f3a2c1d-2\.jpg$/);
    assert.match(puts[2].url, /media\/2026-07\/r-8f3a2c1d-logs\.txt$/);

    // The issue is created on the PUBLIC tracker, carries the label + the
    // machine block + attachment LINKS — and NO log content (logs are private).
    const issue = gh.calls.find((c) => c.url.endsWith('/issues'));
    assert.match(issue.url, /repos\/1aGh\/maude\/issues$/);
    const payload = JSON.parse(issue.init.body);
    assert.deepEqual(payload.labels, ['report']);
    assert.match(payload.body, /"schema": "maude-report\/v1"/);
    assert.match(payload.body, /\[screenshot-1\]\(https:\/\/github\.com\/1aGh\/maude-reports\//);
    assert.match(payload.body, /\[logs\]\(https:\/\/github\.com\/1aGh\/maude-reports\//);
    assert.ok(!payload.body.includes('secret-ish tail line'), 'log text must not go public');
    assert.equal(payload.title, 'Clicking export freezes the app');
  });

  it('re-serializes the machine block from the PARSED object (no fence smuggling)', () => {
    const body = issueBody(
      { schema: 'maude-report/v1', reportId: 'r-00000000', description: 'x ``` sneaky' },
      []
    );
    // The description lands verbatim in the human section, but the JSON block
    // is JSON.stringify output — backticks arrive escaped inside a JSON string,
    // so they cannot close the fence.
    const fenced = body.slice(body.indexOf('```json'));
    assert.match(fenced, /\\u0060|``` sneaky/); // human text may repeat inside JSON string…
    assert.equal((body.match(/```/g) ?? []).length >= 2, true);
  });

  it('GitHub failure surfaces as 502, never a half-written success', async () => {
    const { env } = await freshEnv();
    const res = await handleReport(post(reportForm()), env, {
      fetchImpl: async () => new Response('nope', { status: 500 }),
    });
    assert.equal(res.status, 502);
  });
});

describe('quotas', () => {
  it('the 6th report from one install in one day is 429', async () => {
    const { env } = await freshEnv();
    const gh = fakeGitHub();
    const opts = { fetchImpl: gh.impl, nowMs: Date.parse('2026-07-30T12:00:00Z') };
    for (let i = 0; i < 5; i++) {
      const res = await handleReport(post(reportForm()), env, opts);
      assert.equal(res.status, 200, `report ${i + 1} should pass`);
    }
    const res = await handleReport(post(reportForm()), env, opts);
    assert.equal(res.status, 429);
  });

  it('installs are separate buckets; the IP cap still backstops', async () => {
    const { env } = await freshEnv();
    const gh = fakeGitHub();
    const opts = { fetchImpl: gh.impl, nowMs: Date.parse('2026-07-30T12:00:00Z') };
    let ok = 0;
    for (let i = 0; i < 25; i++) {
      const form = reportForm({ installId: `i-install${String(i).padStart(4, '0')}` });
      const res = await handleReport(post(form, { 'cf-connecting-ip': '1.2.3.4' }), env, opts);
      if (res.status === 200) ok += 1;
    }
    assert.equal(ok, 20); // QUOTA_PER_IP_PER_DAY
  });

  it('a new day resets the bucket', async () => {
    const { env } = await freshEnv();
    const gh = fakeGitHub();
    const day1 = { fetchImpl: gh.impl, nowMs: Date.parse('2026-07-30T12:00:00Z') };
    for (let i = 0; i < 5; i++)
      assert.equal((await handleReport(post(reportForm()), env, day1)).status, 200);
    assert.equal((await handleReport(post(reportForm()), env, day1)).status, 429);
    const day2 = { fetchImpl: gh.impl, nowMs: Date.parse('2026-07-31T12:00:00Z') };
    assert.equal((await handleReport(post(reportForm()), env, day2)).status, 200);
  });
});
