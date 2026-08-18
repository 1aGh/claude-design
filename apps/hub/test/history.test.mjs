// The cell's two history routes — feature-cloud-managed-git-posture.
//
// What matters here is what they REFUSE, and that every refusal past the token
// check is the SAME answer. A history reader holding a project token must not
// be able to turn these into a probe for what exists in the checkout, and the
// blob route must not be able to walk the object graph:
//
//   - `sha` is an OBJECT NAME. `HEAD~1`, `a..b`, `x:y`, `--upload-pack=…` are
//     all refused before git is spawned at all.
//   - `path` is containment- AND membership-checked, so a traversal, a
//     DDR-115 runtime-state path and `config.json` answer exactly like an
//     absent file.
//   - a scoped token cannot read the repo-wide log (nothing could filter it).
//   - the rate limiter sits immediately after auth, so every git spawn below
//     it is budgeted.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { createGitRunner } from '../src/git-runner.mjs';
import { HISTORY_FILE_PATH, HISTORY_PATH, handleHistoryRoutes } from '../src/history.mjs';

let repoDir;
let designRoot;
let firstSha;

const CANVAS_REL = 'ui/Card.tsx';

function git(args) {
  execFileSync('git', args, {
    cwd: repoDir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    stdio: 'pipe',
  });
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'hub-history-repo-'));
  designRoot = join(repoDir, '.design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, '_history'), { recursive: true });
  writeFileSync(join(designRoot, 'config.json'), '{"canvasGroups":[{"path":"ui"}]}');
  writeFileSync(join(designRoot, CANVAS_REL), 'export default function Card(){return null}\n');
  writeFileSync(join(designRoot, '_history', 'note.md'), 'runtime state\n');

  git(['init', '-b', 'main']);
  git(['config', 'user.name', 'Cell']);
  git(['config', 'user.email', 'cell@maude.sh']);
  git(['add', '-A']);
  git(['-c', 'user.name=Ada', '-c', 'user.email=ada@example.com', 'commit', '-m', 'first version']);
  firstSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

/** Collect one respondJson call, and one raw text response. */
function collector() {
  const out = { status: null, payload: null, headers: null, body: null, calls: 0 };
  return {
    out,
    respondJson: (status, payload) => {
      out.status = status;
      out.payload = payload;
      out.calls += 1;
    },
    response: {
      writeHead(status, headers) {
        out.status = status;
        out.headers = headers;
        return this;
      },
      end(buf) {
        out.body = buf ? String(buf) : '';
        out.calls += 1;
      },
    },
  };
}

function ctxFor(path, query = {}, overrides = {}) {
  const c = collector();
  return {
    ctx: {
      path,
      method: 'GET',
      query,
      bearer: 'tok',
      verify: () => ({ label: 'laptop', scope: '*' }),
      matchesScope: (scope, name) =>
        !scope || scope === '*' || name === scope || name.startsWith(`${scope}/`),
      repoDir,
      designRoot,
      run: createGitRunner({ maxCapture: 4 * 1024 * 1024 }),
      projectName: 'demo-project',
      respondJson: c.respondJson,
      response: c.response,
      ...overrides,
    },
    out: c.out,
  };
}

describe('GET /api/history', () => {
  it('is not this handler’s business for another path', async () => {
    const { ctx } = ctxFor('/api/files');
    assert.equal(await handleHistoryRoutes(ctx), false);
  });

  it('refuses a write method', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH, {}, { method: 'POST' });
    assert.equal(await handleHistoryRoutes(ctx), true);
    assert.equal(out.status, 405);
  });

  it('401s without a token', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH, {}, { bearer: null });
    assert.equal(await handleHistoryRoutes(ctx), true);
    assert.equal(out.status, 401);
  });

  it('returns the cell’s commits, with the branch and project name', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH);
    assert.equal(await handleHistoryRoutes(ctx), true);
    assert.equal(out.status, 200);
    assert.equal(out.payload.entries.length, 1);
    assert.equal(out.payload.entries[0].message, 'first version');
    assert.equal(out.payload.entries[0].author, 'Ada');
    assert.match(out.payload.entries[0].sha, /^[0-9a-f]{40}$/);
    assert.equal(out.payload.branch, 'main');
    assert.equal(out.payload.project, 'demo-project');
  });

  it('never carries the author’s email — the row renderer does not draw one', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH);
    await handleHistoryRoutes(ctx);
    assert.equal('email' in out.payload.entries[0], false);
    assert.equal(JSON.stringify(out.payload).includes('ada@example.com'), false);
  });

  it('scopes to one canvas', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH, { path: CANVAS_REL });
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 200);
    assert.equal(out.payload.entries.length, 1);
  });

  it('clamps limit to 1–100', async () => {
    for (const raw of ['0', '-5', '9999', 'abc']) {
      const { ctx, out } = ctxFor(HISTORY_PATH, { limit: raw });
      await handleHistoryRoutes(ctx);
      assert.equal(out.status, 200, `limit=${raw}`);
    }
  });

  it('404s a traversal path, a runtime-state path and config.json alike', async () => {
    for (const p of ['../../etc/passwd', '_history/note.md', 'config.json', '/etc/passwd']) {
      const { ctx, out } = ctxFor(HISTORY_PATH, { path: p });
      assert.equal(await handleHistoryRoutes(ctx), true);
      assert.equal(out.status, 404, `path=${p}`);
    }
  });

  it('refuses the repo-wide log to a SCOPED token — nothing could filter it', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH, {}, { verify: () => ({ label: 'a', scope: 'ui' }) });
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 404);
  });

  it('still serves an in-scope per-file log to that same scoped token', async () => {
    const { ctx, out } = ctxFor(
      HISTORY_PATH,
      { path: CANVAS_REL },
      { verify: () => ({ label: 'a', scope: 'ui' }) }
    );
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 200);
    assert.equal(out.payload.entries.length, 1);
  });

  it('answers an empty history on a hub with no checkout, never an error', async () => {
    const { ctx, out } = ctxFor(HISTORY_PATH, {}, { repoDir: null, run: null });
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 200);
    assert.deepEqual(out.payload, { entries: [], branch: null, project: null });
  });

  it('the rate limiter fires, before any git runs', async () => {
    let ran = 0;
    const { ctx, out } = ctxFor(
      HISTORY_PATH,
      {},
      {
        checkRateLimit: () => false,
        run: (...a) => {
          ran += 1;
          return createGitRunner()(...a);
        },
      }
    );
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 429);
    assert.equal(ran, 0);
  });
});

describe('GET /api/history/file', () => {
  it('serves the blob at a sha', async () => {
    const { ctx, out } = ctxFor(HISTORY_FILE_PATH, { sha: firstSha, path: CANVAS_REL });
    assert.equal(await handleHistoryRoutes(ctx), true);
    assert.equal(out.status, 200);
    assert.match(out.body, /export default function Card/);
    assert.equal(out.headers['X-Content-Type-Options'], 'nosniff');
  });

  it('accepts an abbreviated sha', async () => {
    const { ctx, out } = ctxFor(HISTORY_FILE_PATH, {
      sha: firstSha.slice(0, 10),
      path: CANVAS_REL,
    });
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 200);
  });

  it('refuses every REF EXPRESSION — only an object name reaches git', async () => {
    for (const sha of [
      'HEAD',
      'HEAD~1',
      'main',
      `${firstSha}..${firstSha}`,
      `${firstSha}:x`,
      '--upload-pack=x',
      '',
    ]) {
      const { ctx, out } = ctxFor(HISTORY_FILE_PATH, { sha, path: CANVAS_REL });
      assert.equal(await handleHistoryRoutes(ctx), true);
      assert.equal(out.status, 404, `sha=${sha}`);
    }
  });

  it('404s a traversal, a runtime-state path and config.json alike', async () => {
    for (const p of ['../../etc/passwd', '_history/note.md', 'config.json', 'ui/../config.json']) {
      const { ctx, out } = ctxFor(HISTORY_FILE_PATH, { sha: firstSha, path: p });
      assert.equal(await handleHistoryRoutes(ctx), true);
      assert.equal(out.status, 404, `path=${p}`);
    }
  });

  it('404s a path that is out of the token’s scope', async () => {
    const { ctx, out } = ctxFor(
      HISTORY_FILE_PATH,
      { sha: firstSha, path: CANVAS_REL },
      { verify: () => ({ label: 'a', scope: 'system' }) }
    );
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 404);
  });

  it('404s a file that simply is not in that commit — same answer as a refusal', async () => {
    const { ctx, out } = ctxFor(HISTORY_FILE_PATH, { sha: firstSha, path: 'ui/Absent.tsx' });
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 404);
  });

  it('401s without a token', async () => {
    const { ctx, out } = ctxFor(
      HISTORY_FILE_PATH,
      { sha: firstSha, path: CANVAS_REL },
      { bearer: null }
    );
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 401);
  });

  it('is read-only by construction', async () => {
    const { ctx, out } = ctxFor(
      HISTORY_FILE_PATH,
      { sha: firstSha, path: CANVAS_REL },
      { method: 'DELETE' }
    );
    await handleHistoryRoutes(ctx);
    assert.equal(out.status, 405);
  });
});
