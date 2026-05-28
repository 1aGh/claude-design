// End-to-end CLI tests for `maude design link|unlink|status|adopt` via async spawn.
//
// /health is faked with a plain node:http server — we don't need a real
// Hocuspocus instance. spawnSync would block the parent's event loop and
// prevent the mock from responding; async spawn keeps the loop ticking.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

const PORT = Number.parseInt(process.env.HUB_TEST_PORT_DESIGN ?? '14396', 10);
const URL = `http://127.0.0.1:${PORT}`;

let mockServer;
let workspace;
let hubsConfigPath;

before(async () => {
  mockServer = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/health' || req.url.startsWith('/health?'))) {
      const body = JSON.stringify({
        ok: true,
        version: '0.0.0-mock',
        uptimeMs: 1234,
        port: PORT,
        dataDir: '/tmp/mock',
        tokenCount: 0,
        authMode: 'dev',
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolveLi) => mockServer.listen(PORT, '127.0.0.1', resolveLi));
});

after(async () => {
  if (mockServer) await new Promise((r) => mockServer.close(r));
});

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'maude-design-link-ws-'));
  mkdirSync(join(workspace, '.design'), { recursive: true });
  writeFileSync(
    join(workspace, '.design/config.json'),
    JSON.stringify({ name: 'test', ds: 'default' }, null, 2),
    'utf8'
  );
  hubsConfigPath = join(workspace, 'hubs.json');
});

function runCli(args) {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: workspace,
      env: { ...process.env, HUBS_CONFIG_PATH: hubsConfigPath },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 8000);
    child.on('exit', (status, signal) => {
      clearTimeout(timer);
      resolveResult({ status, signal, stdout, stderr });
    });
  });
}

function cleanup() {
  if (workspace) rmSync(workspace, { recursive: true, force: true });
}

test('link without --token exits 2', async () => {
  const res = await runCli(['design', 'link', URL]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /--token <value> is required/);
  cleanup();
});

test('link without positional url exits 2', async () => {
  const res = await runCli(['design', 'link', '--token', 'mau_x']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /<url> positional argument is required/);
  cleanup();
});

test('link writes linkedHub + hubs.json + prints reachability', async () => {
  const res = await runCli(['design', 'link', URL, '--token', 'mau_test']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /linked .* to http:\/\/127\.0\.0\.1:/);
  assert.match(res.stdout, /hub:\s+v[0-9.]/);

  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub.url, URL);
  assert.equal(typeof cfg.linkedHub.linkedAt, 'number');
  assert.equal(cfg.linkedHub.adopt, undefined);

  const hubs = JSON.parse(readFileSync(hubsConfigPath, 'utf8'));
  assert.equal(hubs.hubs[URL].token, 'mau_test');
  cleanup();
});

test('link --adopt records adopt:true in linkedHub', async () => {
  const res = await runCli(['design', 'link', URL, '--token', 'mau_test', '--adopt']);
  assert.equal(res.status, 0, res.stderr);
  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub.adopt, true);
  cleanup();
});

test('adopt subcommand is an alias of link --adopt', async () => {
  const res = await runCli(['design', 'adopt', URL, '--token', 'mau_test']);
  assert.equal(res.status, 0, res.stderr);
  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub.adopt, true);
  cleanup();
});

test('link against unreachable URL exits 1 unless --force', async () => {
  const dead = 'http://127.0.0.1:1';
  const fail = await runCli(['design', 'link', dead, '--token', 'mau_test']);
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /cannot reach/);

  const forced = await runCli(['design', 'link', dead, '--token', 'mau_test', '--force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /NOT REACHED/);
  cleanup();
});

test('unlink drops linkedHub + token; idempotent on solo repo', async () => {
  await runCli(['design', 'link', URL, '--token', 'mau_test']);

  const res = await runCli(['design', 'unlink']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /dropped link/);

  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub, undefined);

  const hubs = JSON.parse(readFileSync(hubsConfigPath, 'utf8'));
  assert.equal(URL in hubs.hubs, false);

  const second = await runCli(['design', 'unlink']);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /already in solo mode/);
  cleanup();
});

test('unlink --keep-token leaves hubs.json entry intact', async () => {
  await runCli(['design', 'link', URL, '--token', 'mau_test']);
  await runCli(['design', 'unlink', '--keep-token']);

  const hubs = JSON.parse(readFileSync(hubsConfigPath, 'utf8'));
  assert.equal(hubs.hubs[URL].token, 'mau_test');
  cleanup();
});

test('status on solo repo reports solo mode', async () => {
  const res = await runCli(['design', 'status']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /solo mode/);
  cleanup();
});

test('status on linked repo reports hub URL + reachability + token presence', async () => {
  await runCli(['design', 'link', URL, '--token', 'mau_test']);
  const res = await runCli(['design', 'status']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /linked mode/);
  assert.match(res.stdout, /token stored:\s+yes/);
  assert.match(res.stdout, /hub status:\s+up/);
  cleanup();
});

test('status --json emits structured payload', async () => {
  await runCli(['design', 'link', URL, '--token', 'mau_test']);
  const res = await runCli(['design', 'status', '--json']);
  assert.equal(res.status, 0, res.stderr);
  const payload = JSON.parse(res.stdout);
  assert.equal(payload.mode, 'linked');
  assert.equal(payload.url, URL);
  assert.equal(payload.tokenStored, true);
  assert.equal(payload.hub.reachable, true);
  assert.equal(payload.sync.agent, 'not-implemented');
  cleanup();
});

// --------------------------------------------------- DDR-054 F2/F4 trust gate

const REMOTE_URL = 'http://hub.invalid:9999'; // .invalid never resolves (RFC 6761)

test('linking a non-loopback hub without --yes (non-TTY) refuses', async () => {
  // The spawned child has no TTY on stdin, so the gate must refuse rather
  // than silently link a remote hub in a script.
  const res = await runCli(['design', 'link', REMOTE_URL, '--token', 'mau_x', '--force']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /requires confirmation/);
  // No link written.
  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub, undefined);
  cleanup();
});

test('linking a non-loopback hub with --yes records trust + links', async () => {
  const res = await runCli(['design', 'link', REMOTE_URL, '--token', 'mau_x', '--yes', '--force']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /confirmed via --yes/);
  assert.match(res.stderr, /experimental v1\.1 preview/); // F3 banner

  const cfg = JSON.parse(readFileSync(join(workspace, '.design/config.json'), 'utf8'));
  assert.equal(cfg.linkedHub.url, REMOTE_URL);

  // Trust is recorded PER-MACHINE (hubs.json), never in a committable repo file.
  const hubs = JSON.parse(readFileSync(hubsConfigPath, 'utf8'));
  assert.ok(hubs.trusted.includes(REMOTE_URL), 'hub should be trusted on this machine');
  assert.equal(
    existsSync(join(workspace, '.maude/trusted-hubs')),
    false,
    'no committable trust file'
  );

  // Re-linking the now-trusted hub no longer needs --yes.
  const second = await runCli(['design', 'link', REMOTE_URL, '--token', 'mau_y', '--force']);
  assert.equal(second.status, 0, second.stderr);
  cleanup();
});

test('--adopt against a non-loopback hub lists the upload manifest in the gate', async () => {
  writeFileSync(join(workspace, '.design/screen.html'), '<button>hi</button>', 'utf8');
  const res = await runCli(['design', 'adopt', REMOTE_URL, '--token', 'mau_x', '--yes', '--force']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /will UPLOAD 1 local file/);
  assert.match(res.stderr, /\.design\/screen\.html/);

  const hubs = JSON.parse(readFileSync(hubsConfigPath, 'utf8'));
  assert.equal(typeof hubs.hubs[REMOTE_URL].adoptedAt, 'number'); // F4 attestation
  cleanup();
});
