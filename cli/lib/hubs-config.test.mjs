import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  addHub,
  getHub,
  hubsConfigPath,
  loadHubsConfig,
  normalizeUrl,
  removeHub,
  saveHubsConfig,
} from './hubs-config.mjs';

function withTmpConfig(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-hubs-cfg-'));
  const path = join(dir, 'hubs.json');
  const prior = process.env.HUBS_CONFIG_PATH;
  process.env.HUBS_CONFIG_PATH = path;
  try {
    return fn(path);
  } finally {
    if (prior === undefined) delete process.env.HUBS_CONFIG_PATH;
    else process.env.HUBS_CONFIG_PATH = prior;
    rmSync(dir, { recursive: true, force: true });
  }
}

test('hubsConfigPath honors HUBS_CONFIG_PATH override', () => {
  withTmpConfig((path) => {
    assert.equal(hubsConfigPath(), path);
  });
});

test('loadHubsConfig returns empty when file missing', () => {
  withTmpConfig(() => {
    assert.deepEqual(loadHubsConfig(), { hubs: {} });
  });
});

test('saveHubsConfig writes file at 0600 with parent dir creation', () => {
  withTmpConfig((path) => {
    saveHubsConfig({ hubs: { 'https://h.example': { token: 'mau_x', linkedAt: 1 } } });
    assert.ok(existsSync(path));
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(parsed.hubs['https://h.example'].token, 'mau_x');
  });
});

test('addHub upserts the same URL', () => {
  withTmpConfig(() => {
    addHub('https://h.example', 'mau_first');
    addHub('https://h.example', 'mau_second');
    const { hubs } = loadHubsConfig();
    assert.equal(Object.keys(hubs).length, 1);
    assert.equal(hubs['https://h.example'].token, 'mau_second');
  });
});

test('removeHub returns false when entry absent, true when removed', () => {
  withTmpConfig(() => {
    assert.equal(removeHub('https://nope.example'), false);
    addHub('https://h.example', 'mau_x');
    assert.equal(removeHub('https://h.example'), true);
    assert.equal(getHub('https://h.example'), null);
  });
});

test('getHub returns the record when present', () => {
  withTmpConfig(() => {
    addHub('https://h.example', 'mau_x');
    const rec = getHub('https://h.example');
    assert.ok(rec);
    assert.equal(rec.token, 'mau_x');
    assert.equal(typeof rec.linkedAt, 'number');
  });
});

test('normalizeUrl lowercases scheme + host, strips trailing slash', () => {
  assert.equal(normalizeUrl('HTTPS://Foo.Example.com/'), 'https://foo.example.com');
  assert.equal(normalizeUrl('http://localhost:1234'), 'http://localhost:1234');
  assert.equal(normalizeUrl('https://foo.example.com/path'), 'https://foo.example.com/path');
});

test('normalizeUrl throws on bad input', () => {
  assert.throws(() => normalizeUrl(''), /url must be a non-empty string/);
  assert.throws(() => normalizeUrl('not a url'), /invalid url/);
});

test('addHub keys URLs case-insensitively (same hub after host normalization)', () => {
  withTmpConfig(() => {
    addHub('https://HUB.example.com', 'mau_first');
    addHub('https://hub.example.com/', 'mau_second');
    const { hubs } = loadHubsConfig();
    assert.equal(Object.keys(hubs).length, 1);
    assert.equal(hubs['https://hub.example.com'].token, 'mau_second');
  });
});
