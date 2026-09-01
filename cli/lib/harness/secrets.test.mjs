import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyCredential,
  sanitizeConfiguredEnvironmentValue,
  sanitizeUntrustedText,
  sanitizeUntrustedValue,
} from './secrets.mjs';

test('classifies canonical credential keys, headers, URLs, DSNs, and references', () => {
  const literals = [
    ['DATABASE_URL', 'postgres://app:password@db.invalid/studyfi'],
    ['REDIS_URL', 'redis://default:password@cache.invalid/0'],
    ['DSN', 'Server=db.invalid;User=app;Password=ordinary-secret'],
    ['Cookie', 'session=ordinary-secret'],
    ['Set-Cookie', 'session=ordinary-secret; HttpOnly'],
    ['Authorization', 'Basic ordinary-secret'],
    ['', 'https://literal-user@example.invalid/path'],
    ['', 'https://example.invalid/path?user=ordinary-user'],
    ['', 'https://example.invalid/path/password/ordinary-password'],
    ['', 'https://example.invalid/path;token=ordinary-token'],
    ['', 'https://example.invalid/hooks/4f8a7d93b6214c43bca231fe9b2db124'],
    ['', 'https://hooks.slack.com/services/T00000000/B00000000/SlackWebhookSecret'],
  ];
  for (const [key, value] of literals) {
    assert.notEqual(classifyCredential(value, { key }), null, `${key}: ${value}`);
  }

  for (const value of [
    '$' + '{DATABASE_URL}',
    '{env:REDIS_URL}',
    'keychain:maude/database',
    'postgres://$' + '{DATABASE_USER}@db.invalid/studyfi',
    'https://example.invalid/token/$' + '{WEBHOOK_TOKEN}',
    'https://hooks.slack.com/services/T00000000/B00000000/$' + '{SLACK_WEBHOOK_TOKEN}',
    'Server=db.invalid;Password={env:DATABASE_PASSWORD}',
  ]) {
    assert.equal(classifyCredential(value), null, value);
  }
});

test('removes literal credentials before values enter the IR', () => {
  const sentinel = 'sk-test-SENTINEL-DO-NOT-COPY';
  const result = sanitizeUntrustedValue({
    env: { API_TOKEN: sentinel, PUBLIC_MODE: 'compact', REFERENCED: '$' + '{SAFE_TOKEN}' },
    headers: { Authorization: `Bearer ${sentinel}`, 'X-Mode': 'safe' },
    oauth: { clientSecret: sentinel, clientId: 'public-client-id' },
  });

  assert.equal(JSON.stringify(result.value).includes(sentinel), false);
  assert.deepEqual(result.value.env.API_TOKEN, { $maudeSecret: 'literal-rejected' });
  assert.equal(result.value.env.PUBLIC_MODE, 'compact');
  assert.equal(result.value.env.REFERENCED, '$' + '{SAFE_TOKEN}');
  assert.deepEqual(result.value.headers.Authorization, { $maudeSecret: 'literal-rejected' });
  assert.deepEqual(result.value.oauth.clientSecret, { $maudeSecret: 'literal-rejected' });
  assert.deepEqual(
    result.findings.map((finding) => finding.path),
    ['env.API_TOKEN', 'headers.Authorization', 'oauth.clientSecret']
  );
});

test('rejects prototype keys and excessive structural depth', () => {
  const hostile = JSON.parse('{"safe":{"__proto__":{"polluted":true}}}');
  assert.throws(() => sanitizeUntrustedValue(hostile), /forbidden key.*__proto__/i);
  assert.throws(
    () => sanitizeUntrustedValue({ one: { two: { three: true } } }, { maxDepth: 2 }),
    /exceeds maximum depth 2/i
  );
});

test('a reference cannot mask an attached literal or default credential', () => {
  const mixed = sanitizeUntrustedValue({
    AUTH_TOKEN: '$' + '{SAFE_TOKEN} ghp_1234567890abcdef',
    API_TOKEN: '$' + '{SAFE_TOKEN:-ghp_1234567890abcdef}',
  });
  assert.equal(JSON.stringify(mixed.value).includes('ghp_1234567890abcdef'), false);
  assert.equal(mixed.findings.length, 2);
});

test('redacts key-aware Markdown assignments while preserving whole references', () => {
  const result = sanitizeUntrustedText(
    'api_key: ordinary-literal\nAuthorization = Basic dXNlcjpwYXNz\ntoken: $' + '{SAFE_TOKEN}\n'
  );
  assert.equal(result.value.includes('ordinary-literal'), false);
  assert.equal(result.value.includes('dXNlcjpwYXNz'), false);
  assert.equal(result.value.includes('$' + '{SAFE_TOKEN}'), true);
  assert.equal(result.findings.length, 2);
});

test('redacts camelCase structured keys and quoted or list-prefixed Markdown assignments', () => {
  const structured = sanitizeUntrustedValue({ apiKey: 'ordinary-literal' });
  assert.deepEqual(structured.value.apiKey, { $maudeSecret: 'literal-rejected' });

  const text = sanitizeUntrustedText(
    '- token: ordinary-list-value\n> authorization: Basic dXNlcjpwYXNz\n"X-Api-Key": ordinary-header\n'
  );
  assert.equal(text.value.includes('ordinary-list-value'), false);
  assert.equal(text.value.includes('dXNlcjpwYXNz'), false);
  assert.equal(text.value.includes('ordinary-header'), false);
  assert.equal(text.findings.length, 3);
});

test('redacts YAML block secrets and MCP argument literals before they enter the IR', () => {
  const text = sanitizeUntrustedText('apiKey: |\n  first line\n  second line\npublic: kept\n');
  assert.equal(text.value.includes('first line'), false);
  assert.equal(text.value.includes('second line'), false);
  assert.equal(text.value.includes('public: kept'), true);

  const structured = sanitizeUntrustedValue({
    args: ['serve', '--api-key', 'ordinary-secret', '--token=another-secret'],
  });
  assert.deepEqual(structured.value.args[2], { $maudeSecret: 'literal-rejected' });
  assert.deepEqual(structured.value.args[3], { $maudeSecret: 'literal-rejected' });
});

test('redacts PEM private-key blocks from text and structured values', () => {
  const privateKey = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ==',
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');

  const text = sanitizeUntrustedText(`before\n${privateKey}\nafter\n`);
  assert.equal(text.value.includes('OPENSSH PRIVATE KEY'), false);
  assert.equal(text.value.includes('b3BlbnNzaC1rZX'), false);
  assert.match(text.value, /REDACTED_LITERAL_SECRET/);
  assert.equal(
    text.findings.some((finding) => finding.reason === 'pem-private-key'),
    true
  );

  const structured = sanitizeUntrustedValue({ documentation: privateKey });
  assert.deepEqual(structured.value.documentation, { $maudeSecret: 'literal-rejected' });
  assert.equal(structured.findings[0].reason, 'pem-private-key');
});

test('configured environment literals are reference-only outside the public runtime allowlist', () => {
  for (const [name, value] of [
    ['NODE_ENV', 'production'],
    ['AGENT_BROWSER_PROFILE', '/Users/fixture/.agent-browser/work-profile'],
    ['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', '1'],
    ['CI', 'true'],
    ['FORCE_COLOR', '3'],
    ['LANG', 'en_US.UTF-8'],
    ['TZ', 'Europe/Prague'],
    ['POSTHOG_MCP_EXEC_GATE_ALLOW', '*'],
  ]) {
    assert.deepEqual(sanitizeConfiguredEnvironmentValue(name, value), {
      rejected: false,
      value,
    });
  }

  for (const [name, value] of [
    ['NODE_ENV', 'production --inspect'],
    ['CI', 'sometimes'],
    ['LANG', 'en_US.UTF-8;token'],
    ['TZ', '../../private'],
    ['TZ', 'OpaqueCapability123456789'],
    ['PUBLIC_ENDPOINT', 'https://user:password@example.invalid/project/dsn-value'],
  ]) {
    assert.deepEqual(sanitizeConfiguredEnvironmentValue(name, value), {
      rejected: true,
      value: { $maudeSecret: 'literal-rejected' },
    });
  }
});

test('configured environment values preserve complete typed references', () => {
  for (const value of ['$' + '{DATABASE_URL}', '{env:REDIS_URL}', 'keychain:maude/database']) {
    assert.deepEqual(sanitizeConfiguredEnvironmentValue('NON_OBVIOUS_NAME', value), {
      rejected: false,
      value,
    });
  }
});

test('redacts credential-bearing URI and DSN strings under arbitrary structured keys', () => {
  const sentinels = [
    'STRUCTURED_POSTGRES_PASSWORD',
    'STRUCTURED_REDIS_PASSWORD',
    'STRUCTURED_JDBC_PASSWORD',
    'STRUCTURED_QUERY_TOKEN',
  ];
  const result = sanitizeUntrustedValue({
    alpha: `postgresql://app:${sentinels[0]}@db.invalid/studyfi`,
    beta: `redis://default:${sentinels[1]}@cache.invalid:6379/0`,
    gamma: `jdbc:postgresql://db.invalid/studyfi?user=app&password=${sentinels[2]}`,
    harmlessName: `https://example.invalid/ingest?token=${sentinels[3]}`,
    safeReference:
      'postgresql://$' + '{DATABASE_USER}:$' + '{DATABASE_PASSWORD}@db.invalid/studyfi',
  });

  const serialized = JSON.stringify(result.value);
  for (const sentinel of sentinels) assert.equal(serialized.includes(sentinel), false);
  for (const key of ['alpha', 'beta', 'gamma', 'harmlessName']) {
    assert.deepEqual(result.value[key], { $maudeSecret: 'literal-rejected' });
  }
  assert.equal(result.value.safeReference.includes('$' + '{DATABASE_PASSWORD}'), true);
});

test('redacts credential-bearing URI and DSN strings from Markdown text', () => {
  const sentinels = [
    'MARKDOWN_POSTGRES_PASSWORD',
    'MARKDOWN_JDBC_PASSWORD',
    'MARKDOWN_QUERY_TOKEN',
  ];
  const text = sanitizeUntrustedText(
    [
      `Database: postgres://app:${sentinels[0]}@db.invalid/studyfi`,
      `JDBC: jdbc:postgresql://db.invalid/studyfi?password=${sentinels[1]}`,
      `Telemetry: https://example.invalid/ingest?access_token=${sentinels[2]}`,
      'Reference: redis://$' + '{REDIS_USER}:$' + '{REDIS_PASSWORD}@cache.invalid:6379',
    ].join('\n')
  );

  for (const sentinel of sentinels) assert.equal(text.value.includes(sentinel), false);
  assert.equal(text.value.includes('$' + '{REDIS_PASSWORD}'), true);
  assert.equal(text.findings.filter((finding) => finding.reason === 'credential-uri').length, 3);
});

test('redacts userinfo, URI parameters, token paths, webhook paths, and auth headers from text', () => {
  const sentinels = [
    'TEXT_USERNAME_SENTINEL',
    'TEXT_QUERY_USER_SENTINEL',
    'TEXT_PATH_PASSWORD_SENTINEL',
    'TEXT_SEMICOLON_TOKEN_SENTINEL',
    'TEXT_SLACK_WEBHOOK_SENTINEL',
    'TEXT_COOKIE_SENTINEL',
    'TEXT_SET_COOKIE_SENTINEL',
  ];
  const result = sanitizeUntrustedText(
    [
      `Remote: https://${sentinels[0]}@example.invalid/path`,
      `Query: https://example.invalid/path?user=${sentinels[1]}`,
      `Path: https://example.invalid/password/${sentinels[2]}`,
      `DSN: jdbc:sqlserver://db.invalid;token=${sentinels[3]}`,
      `Webhook: https://hooks.slack.com/services/T00000000/B00000000/${sentinels[4]}`,
      `Cookie: session=${sentinels[5]}`,
      `Set-Cookie: session=${sentinels[6]}; HttpOnly`,
    ].join('\n')
  );

  for (const sentinel of sentinels) assert.equal(result.value.includes(sentinel), false);
  assert.ok(result.findings.length >= sentinels.length);
});

test('redacts embedded Basic and opaque custom Authorization headers without touching ordinary prose or code', () => {
  const basic = 'QmFzaWNVc2VyOlNlY3JldDEyMzQ1Njc4OTA=';
  const custom = 'mF9Qv7L2xR4nK8pT6wY3cD5sH1jB0zA';
  const prose = 'The Authorization header uses a custom scheme in this example.';
  const code = "const digest = '9d86c2a7f1454e60a82bd9410f7607ac';";
  const result = sanitizeUntrustedText(
    [
      `curl -H "Authorization: Basic ${basic}" https://example.invalid`,
      `curl -H 'Authorization: Maude ${custom}' https://example.invalid`,
      `curl -H Authorization:Basic ${basic} https://example.invalid`,
      prose,
      code,
    ].join('\n')
  );

  assert.equal(result.value.includes(basic), false);
  assert.equal(result.value.includes(custom), false);
  assert.equal(result.value.includes(prose), true);
  assert.equal(result.value.includes(code), true);
});

test('detects opaque credentials only when inline shell assignments provide sensitive context', () => {
  const credential = 'pK7vN2xQ9mR4tY8cD6sH3jL1wF5bZ0a';
  const checksum = '9d86c2a7f1454e60a82bd9410f7607ac';
  const result = sanitizeUntrustedText(
    `env API_TOKEN=${credential} run-tool\nchecksum=${checksum}\nconst token = getToken();\n`
  );

  assert.equal(result.value.includes(credential), false);
  assert.equal(result.value.includes(`checksum=${checksum}`), true);
  assert.equal(result.value.includes('const token = getToken();'), true);
});
