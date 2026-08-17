// The single file write door — Sync v2 Increment 3/4 (DDR-226 §5).
//
// `PUT /api/file/<rel>` is where every peer write to the file plane lands. It
// exists now, beside the two older asset doors, because the journal engine
// needs two things they cannot give:
//
//   1. **COMPARE-AND-SWAP.** A push says which hub state it decided FROM
//      (`x-maude-expect-hash`). If the hub has moved since, the write is
//      refused with 409 and the current hash, and the peer re-decides. Without
//      it, two peers editing one file inside a poll round-trip resolve as
//      silent last-writer-wins AT THE DOOR — no conflict copy materializes
//      anywhere, and the design's "both ends SEE it" guarantee is false in
//      exactly the live-concurrent case it exists for.
//   2. **A RECEIPT.** The response carries `{ seq, sha256 }`, which is what
//      moves a file from `local-only` to `on-hub` in the doručenka. A push you
//      cannot name is a push you cannot report.
//
// ── What is new here beyond the old doors ───────────────────────────────────
//
// An OWNER-ROLE GATE on `code-module` writes. Until now the class was checked
// but the role was not: `handleCheckoutAssetRoute` admits any peer token that
// passes the classifier, and the only owner gate on code modules lived on the
// RECEIVER (`allowCodeModules` in the desktop pull). A gate that exists on one
// side of a two-sided lane is half a gate — so the door now asks too.
//
// ── What is deliberately unchanged ──────────────────────────────────────────
//
// Every cap, shape gate and containment rule from DDR-217's addendum applies
// verbatim, because they are the mitigations that make a binary write door
// safe at all: anchored path shape, classifier admission judged on the REAL
// (symlink-resolved) landing path, writes to the RESOLVED parent, per-file and
// per-session byte budgets, streaming with a mid-stream cap, tmp+rename. This
// door adds preconditions; it relaxes nothing.

import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

import { checkoutFileClass, resolveCheckoutFileWrite } from './file-manifest.mjs';
import { verifyToken } from './tokens.mjs';

/** `PUT /api/file/<rel>` — the single door. */
export const FILE_DOOR_PREFIX = '/api/file/';

/** Per-file ceiling. Kept BELOW the platform's own body limit on purpose. */
const MAX_FILE_BYTES = 95 * 1024 * 1024;

/** Per-process budget, so one token cannot write the disk full one file at a time. */
const SESSION_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
const defaultBudget = { cap: SESSION_BUDGET_BYTES, used: 0 };

/**
 * Parse `/api/file/<rel>` into a designRoot-relative path.
 *
 * Percent-decoded per segment (a path may contain characters a URL escapes),
 * then handed to the classifier — which is what actually decides admission.
 * Anything malformed is null rather than a guess.
 */
export function parseFileDoorPath(pathname) {
  if (!pathname.startsWith(FILE_DOOR_PREFIX)) return null;
  const raw = pathname.slice(FILE_DOOR_PREFIX.length);
  if (!raw) return null;
  let rel;
  try {
    rel = raw
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');
  } catch {
    return null;
  }
  if (rel.length === 0 || rel.length > 512) return null;
  if (rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) return null;
  if (rel.split('/').includes('..') || rel.split('/').includes('.')) return null;
  return rel;
}

function respond(response, status, message) {
  const body = JSON.stringify({ error: message });
  response
    .writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
      Connection: 'close',
    })
    .end(body);
}

function respondJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response
    .writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
      Connection: 'close',
    })
    .end(body);
}

/**
 * Stream the body to `abs` via temp + rename, hashing as it goes.
 *
 * The hash is computed FROM THE BYTES THAT LANDED, never from a header — a
 * declared hash is a claim, and this route's whole job is to turn claims into
 * facts. Over-cap aborts mid-stream and removes the partial rather than
 * buffering a 95 MB body to find out.
 */
async function streamAndHash(request, abs, { maxBytes, budget }) {
  if (budget.used >= budget.cap) {
    return { ok: false, status: 507, message: 'write budget for this session is exhausted' };
  }
  const tmp = `${abs}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  const hash = createHash('sha256');
  let total = 0;
  try {
    mkdirSync(dirname(abs), { recursive: true });
    const ws = createWriteStream(tmp);
    ws.on('error', () => {});
    const effectiveCap = Math.min(maxBytes, budget.cap - budget.used);
    try {
      for await (const chunk of request) {
        total += chunk.length;
        if (total > effectiveCap) {
          const err = new Error('too large');
          err.tooLarge = true;
          throw err;
        }
        hash.update(chunk);
        if (!ws.write(chunk)) await once(ws, 'drain');
      }
      await new Promise((res, rej) => {
        ws.end((err) => (err ? rej(err) : res()));
      });
    } catch (err) {
      ws.destroy();
      await once(ws, 'close');
      rmSync(tmp, { force: true });
      return err.tooLarge
        ? {
            ok: false,
            status: 413,
            message: `file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB cap`,
          }
        : { ok: false, status: 500, message: 'write failed' };
    }
    return { ok: true, total, sha256: hash.digest('hex'), tmp };
  } catch (err) {
    rmSync(tmp, { force: true });
    return { ok: false, status: 500, message: 'write failed', detail: err.message };
  }
}

/**
 * Handle `PUT /api/file/<rel>`. Returns true when it answered.
 *
 * @param {object} ctx
 * @param {string|null} ctx.designRoot   the checkout's design root, or null
 * @param {object|null} ctx.journal      the file journal, or null
 * @param {(info: {path: string}) => void} [ctx.onWritten]
 */
export async function handleFileDoor(ctx) {
  const { request, response, pathname, method, dataDir, secret } = ctx;
  const rel = parseFileDoorPath(pathname);
  if (rel === null) return false;

  if (method !== 'PUT') {
    respond(response, 405, 'method not allowed');
    return true;
  }

  const auth = request.headers?.authorization;
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const match = token ? verifyToken(dataDir, token, secret) : null;
  if (!match) {
    if (ctx.checkRateLimit && !ctx.checkRateLimit(request)) {
      respond(response, 429, 'too many requests');
      return true;
    }
    respond(response, 401, 'unauthorized');
    return true;
  }
  if (match.readOnly) {
    respond(response, 403, 'this token is read-only');
    return true;
  }
  if (!ctx.designRoot) {
    respond(response, 405, 'this hub does not accept file writes');
    return true;
  }
  if (ctx.checkWriteRateLimit && !ctx.checkWriteRateLimit(match.label)) {
    respond(response, 429, 'too many writes');
    return true;
  }

  // Admission: shape, containment through symlinks, and the class judged on the
  // REAL landing path. Same call the older checkout door makes.
  const target = resolveCheckoutFileWrite(ctx.designRoot, rel);
  if (!target.ok) {
    respond(response, 400, 'invalid path');
    return true;
  }

  // NEW — the owner gate on code modules, at the DOOR.
  //
  // The receiver has gated this since the file plane shipped; the door never
  // did. A gate on one side of a two-sided lane is half a gate: any peer token
  // could land executable modules in a project's `system/**`, and the only
  // thing stopping them was that the OTHER peers would refuse to pull them.
  const cls = checkoutFileClass(rel, ctx.designRoot);
  if (cls === 'code-module' && match.role !== 'owner') {
    // 403 rather than 400: the path is fine, the credential is not, and
    // saying so is what lets a peer report something a person can act on.
    respond(response, 403, 'code modules may only be written by an owner-scoped token');
    return true;
  }

  // COMPARE-AND-SWAP against what the peer decided from.
  //
  // `x-maude-expect-hash: <sha256>` — the hub must currently hold this.
  // `x-maude-expect-hash: none`     — the hub must currently hold NOTHING.
  // absent                          — no precondition (a first push, or an
  //                                    older client; the compat matrix keeps
  //                                    those working).
  const expect = String(request.headers?.['x-maude-expect-hash'] ?? '').trim();
  if (expect) {
    const current = ctx.journal ? currentHashFor(ctx.journal, rel) : null;
    const wantsAbsent = expect === 'none';
    const matches = wantsAbsent ? current === null : current === expect;
    if (!matches) {
      // 409 with the CURRENT state, so the peer can re-decide immediately
      // instead of polling to discover what it collided with.
      respondJson(response, 409, {
        error: 'the hub moved since you decided',
        path: rel,
        current,
      });
      return true;
    }
  }

  const r = await streamAndHash(request, target.abs, {
    maxBytes: ctx.maxFileBytes ?? MAX_FILE_BYTES,
    budget: ctx.budget ?? defaultBudget,
  });
  if (!r.ok) {
    if (r.detail) console.error(`[hub] file door ${rel} failed: ${r.detail}`);
    respond(response, r.status, r.message);
    return true;
  }

  // The declared content hash is checked AGAINST WHAT LANDED. A mismatch is a
  // truncated or tampered upload; the bytes are discarded rather than kept.
  const declared = String(request.headers?.['x-maude-content-sha256'] ?? '').trim();
  if (declared && declared !== r.sha256) {
    rmSync(r.tmp, { force: true });
    respond(response, 400, 'content hash does not match the bytes sent');
    return true;
  }

  try {
    renameSync(r.tmp, target.abs);
  } catch (err) {
    rmSync(r.tmp, { force: true });
    console.error(`[hub] file door ${rel} rename failed: ${err.message}`);
    respond(response, 500, 'write failed');
    return true;
  }
  (ctx.budget ?? defaultBudget).used += r.total;

  // The journal append + the bucket mirror, through the one notifier. The row
  // it produces is the receipt below.
  ctx.onWritten?.({ path: rel, bytes: r.total });

  const seq = ctx.journal ? seqFor(ctx.journal, rel) : null;
  respondJson(response, 200, { ok: true, path: rel, bytes: r.total, sha256: r.sha256, seq });
  return true;
}

/** The hash the hub currently holds for `rel`, or null (absent or tombstoned). */
function currentHashFor(journal, rel) {
  const row = journal.latestFor(rel);
  if (!row || row.deleted) return null;
  return row.sha256 ?? null;
}

/** The seq of the hub's latest row for `rel`, or null. */
function seqFor(journal, rel) {
  return journal.latestFor(rel)?.seq ?? null;
}
