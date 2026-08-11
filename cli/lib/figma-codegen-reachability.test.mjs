// DDR-219 D2 regression guard — the codegen channel is a CONTROL, not an intent.
//
// The first draft of DDR-219 routed Figma Dev Mode codegen through the REMOTE
// MCP (`https://mcp.figma.com/mcp`) and treated our own code's inability to
// reach it as the safety property. The design-stage review took that apart:
//
//   - the remote catalog "allowlist" is enforced on a self-reported OAuth
//     `client_name`, and a public bypass for it exists — so it is a waitlist,
//     not a boundary;
//   - the LOCAL Dev Mode server (`http://127.0.0.1:3845/mcp`) takes plain
//     loopback HTTP with NO credential and no catalog gate at all, so nothing
//     but intent stands between a future contributor and `fetch(...)` inside
//     `apps/studio/figma/`;
//   - DDR-185's `curl-local` *permits* that endpoint by construction (its rule
//     is "every resolved address is loopback", and 127.0.0.1 is), and an ACP
//     session auto-approves `Bash(maude:*)` — so the one egress control the
//     session trusts is, for this specific service, an allow rule.
//
// Reaching the remote endpoint from product code would put a third-party model's
// output into an ingestion path that DDR-216 D1 says is deterministic end to
// end. Reaching the local one from anywhere except the single designated client
// would make codegen a bulk ingestion route by accident — DDR-219 D1's table
// silently false, its fallback never firing, and nothing in CI noticing.
//
// So both halves are asserted here rather than described in a decision record.

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { test } from 'node:test';

/** The ONE module allowed to name the local Dev Mode endpoint (DDR-219 D2). */
const CODEGEN_CLIENT = 'apps/studio/figma/codegen-client.ts';

/** Trees that ship or execute. Prose (`.ai/`, `docs/`, `site/`) may name both. */
const RUNTIME_TREES = ['apps/studio', 'cli', 'plugins'];

/** Source only. `node_modules` vendors binaries that contain arbitrary strings
 *  (the bundled agent-sdk `claude` matched `mcp.figma.com` on the first run),
 *  and `dist/` is build output, not a code path anyone edits. `-I` drops binary
 *  files outright so a vendored blob can never turn this guard into noise —
 *  a guard that cries wolf gets deleted, which would be worse than not having it. */
function grep(pattern, trees) {
  // `|| true` because grep exits 1 on no-match, which is the passing case.
  const out = execSync(
    `grep -rlIE --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git ${JSON.stringify(pattern)} ${trees.join(' ')} 2>/dev/null || true`,
    { encoding: 'utf8', cwd: new URL('../../', import.meta.url).pathname }
  );
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.endsWith('figma-codegen-reachability.test.mjs'));
}

test('no runtime code names the REMOTE Figma MCP endpoint', () => {
  const offenders = grep('mcp\\.figma\\.com', RUNTIME_TREES);
  assert.deepEqual(
    offenders,
    [],
    `These files name the remote Figma MCP endpoint. It is banned from every runtime code path (DDR-219 D2, and \`feature-figma-import\` § Out of scope before it): it is reachable only by a catalog-listed agent client, so any use here means a model is in the ingestion path. Codegen goes over the LOCAL server, with apps/studio as the client:\n  ${offenders.join('\n  ')}`
  );
});

test('only the designated client names the LOCAL Dev Mode endpoint', () => {
  // Match the endpoint shape, not a bare `3845`, which could legitimately occur
  // as a byte count or a hash fragment.
  const offenders = grep('(localhost|127\\.0\\.0\\.1|:)3845', RUNTIME_TREES).filter(
    (f) => f !== CODEGEN_CLIENT
  );
  assert.deepEqual(
    offenders,
    [],
    `Only ${CODEGEN_CLIENT} may reach the local Figma Dev Mode MCP server (DDR-219 D2). A second caller makes codegen an ingestion route by accident — and the local server is UNAUTHENTICATED loopback, so there is no credential step to notice it. If codegen is genuinely needed elsewhere, route it through the client:\n  ${offenders.join('\n  ')}`
  );
});

test('no canvas-reachable codegen route exists', () => {
  // A canvas-origin codegen route would hand the untrusted iframe (DDR-054) a
  // primitive that reads the user's open Figma document. It belongs in NEITHER
  // allowlist — the same standing rule DDR-088 sets for every privileged route.
  const offenders = grep('CANVAS_SAFE_API[^\\n]*codegen|codegen[^\\n]*CANVAS_SAFE_API', [
    'apps/studio',
  ]);
  assert.deepEqual(
    offenders,
    [],
    `A codegen route appears near CANVAS_SAFE_API. Codegen is privileged-origin only (DDR-219 D2):\n  ${offenders.join('\n  ')}`
  );
});
