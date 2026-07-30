// Pushing the workspace to the customer's GitHub — Cloud Phase 19, cell side.
//
// THE CELL HOLDS NO GITHUB CREDENTIAL. It asks the control plane, presenting
// its own derived secret, and gets back a token scoped to the one repository
// this tenant configured, valid for about an hour. The App private key — which
// could mint for every repository the App is installed on — never enters a
// container. A compromised cell is then worth exactly its own mirror.
//
// THE TOKEN IS NEVER WRITTEN DOWN. Not to a remote URL in `.git/config`, not
// to a log, not to disk. `git push <url> <refspec>` takes the URL as an
// argument, so the credential exists in one argv and in no file. A stored
// remote would put a live credential in a directory the tenant's own tooling
// reads.
//
// APPEND-ONLY, ALWAYS. The argv comes from the tested builder in
// apps/cloud/mirror.mjs — imported, never re-typed — and that module's tests
// assert the ABSENCE of any force flag. Absence is exactly what a later edit
// adds without anything noticing, which is why the assertion lives there and
// the argv is not constructed here.

import { classifyPushResult, mirrorPushArgs, validateTarget } from '../../cloud/mirror.mjs';

/** How long before expiry we stop trusting a minted token. */
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Ask the control plane for a push credential.
 *
 * @param {object} opts
 * @param {string} opts.controlPlaneUrl  e.g. https://cloud.maude.sh
 * @param {string} opts.tenantId
 * @param {string} opts.cellSecret       this cell's own derived secret
 * @param {string} opts.repository       owner/name, already validated
 */
export async function requestPushToken(
  { controlPlaneUrl, tenantId, cellSecret, repository },
  { fetchImpl = fetch, nowMs = Date.now() } = {}
) {
  const res = await fetchImpl(`${controlPlaneUrl.replace(/\/+$/, '')}/internal/mirror-token`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cellSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ tenant: tenantId, repository }),
  });
  if (!res.ok) {
    return {
      ok: false,
      state: 'unauthorized',
      message: `the control plane refused (HTTP ${res.status})`,
    };
  }
  const body = await res.json();
  if (!body?.token) return { ok: false, state: 'failed', message: 'no token was issued' };
  const expiresAt = Number(body.expiresAt) || nowMs;
  if (expiresAt - nowMs < TOKEN_SAFETY_MARGIN_MS) {
    // A token about to expire will fail mid-push and look like an auth
    // problem the customer must fix. Refusing early says the true thing.
    return { ok: false, state: 'failed', message: 'the issued credential was already near expiry' };
  }
  return { ok: true, token: body.token, expiresAt };
}

/**
 * Push the checkout to the configured mirror.
 *
 * Reports; never throws. A mirror is a COPY — the workspace has the data, so a
 * failed push must never be able to disturb the thing it is copying.
 *
 * @returns {Promise<{ok: boolean, state: string, message?: string}>}
 */
export async function pushMirror(
  { repoDir, repository, branch, controlPlaneUrl, tenantId, cellSecret, run, log = console },
  deps = {}
) {
  const checked = validateTarget({ repo: repository, branch });
  if (!checked.ok) {
    return { ok: false, state: 'failed', message: checked.errors.join('; ') };
  }
  const target = checked.target;

  const minted = await requestPushToken(
    { controlPlaneUrl, tenantId, cellSecret, repository: target.repo },
    deps
  );
  if (!minted.ok) return minted;

  // Built here and passed as one argv entry. Never `git remote add`, which
  // would persist the credential into .git/config where the tenant's own
  // tooling — and the next backup — would read it.
  const url = `https://x-access-token:${minted.token}@github.com/${target.full}.git`;
  const args = mirrorPushArgs({ branch: target.branch, remote: url });

  const result = await run(args, { cwd: repoDir });
  const verdict = classifyPushResult(result);
  log.log?.(
    `[mirror] ${target.full}#${target.branch}: ${verdict.state}${verdict.message ? ` — ${verdict.message}` : ''}`
  );
  return verdict;
}
