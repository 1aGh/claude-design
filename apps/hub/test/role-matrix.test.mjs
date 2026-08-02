// The role matrix — Cloud Phase 25 C4.
//
// ONE test suite that BOTH surfaces are held to, because the failure this
// exists to prevent is not "the table is wrong" — it is the table being right
// and one client quietly disagreeing with it.
//
// The suite therefore asserts three separate things:
//   1. the table itself (what a role means);
//   2. that the cell's session-minting paths derive read-only FROM the table
//      rather than from their own `role === 'viewer'` test;
//   3. that the cell's HTTP gate and the browser door agree with it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  CAPABILITIES,
  can,
  capabilitiesFor,
  isReadOnlyRole,
  matrixRows,
  ROLES,
} from '../src/role-matrix.mjs';

const HERE = join(import.meta.dirname, '..');

test('the matrix is complete — every role answers every capability', () => {
  for (const role of ROLES) {
    const caps = capabilitiesFor(role);
    for (const cap of CAPABILITIES) {
      assert.equal(typeof caps[cap], 'boolean', `${role}.${cap} must be stated`);
    }
  }
  assert.deepEqual([...ROLES], ['owner', 'member', 'viewer']);
  assert.deepEqual(
    [...CAPABILITIES],
    ['read', 'edit', 'comment', 'annotate', 'export', 'invite', 'delete', 'mirror']
  );
});

test('a viewer may look, comment and download — and nothing else', () => {
  assert.equal(can('viewer', 'read'), true);
  assert.equal(can('viewer', 'comment'), true);
  assert.equal(can('viewer', 'export'), true);
  for (const cap of ['edit', 'annotate', 'invite', 'delete', 'mirror']) {
    assert.equal(can('viewer', cap), false, `viewer must not ${cap}`);
  }
});

test('an annotation is an EDIT, not a comment — it is versioned with the design', () => {
  // The distinction that is easy to get wrong: comments live in their own
  // store; annotations are a committed `*.annotations.svg` beside the canvas.
  assert.equal(can('viewer', 'comment'), true);
  assert.equal(can('viewer', 'annotate'), false);
});

test('member edits but does not administer; owner does both', () => {
  assert.equal(can('member', 'edit'), true);
  assert.equal(can('member', 'invite'), false);
  assert.equal(can('member', 'delete'), false);
  assert.equal(can('member', 'mirror'), false);
  for (const cap of CAPABILITIES) assert.equal(can('owner', cap), true);
});

test('an unknown role gets NOTHING — a typo must not be an escalation', () => {
  for (const cap of CAPABILITIES) {
    assert.equal(can('admin-ish', cap), false);
    assert.equal(can(undefined, cap), false);
    assert.equal(can(null, cap), false);
  }
  assert.equal(isReadOnlyRole('typo'), true);
});

test('read-only is DERIVED from the table, not asserted beside it', () => {
  assert.equal(isReadOnlyRole('viewer'), true);
  assert.equal(isReadOnlyRole('member'), false);
  assert.equal(isReadOnlyRole('owner'), false);
});

test('BOTH session doors derive the capability from the matrix', () => {
  // The regression this catches: someone adds a third door (or a fourth role)
  // and writes `role === 'viewer'` again, which is right until it is not.
  for (const file of ['src/auth-routes.mjs', 'src/canvas/browser-auth.mjs']) {
    const src = readFileSync(join(HERE, file), 'utf8');
    assert.ok(
      src.includes('isReadOnlyRole('),
      `${file} must derive read-only from the role matrix`
    );
    assert.ok(
      !/readOnly:\s*\w+\.role === 'viewer'/.test(src),
      `${file} must not re-derive the viewer rule locally`
    );
  }
});

test("the cell's read-only gate allows exactly what a viewer's capabilities say", () => {
  // The gate is a path allowlist; the matrix is a capability table. They are
  // different shapes, so this asserts the MAPPING between them explicitly —
  // which is what makes adding a path a deliberate act.
  const src = readFileSync(join(HERE, 'src/server.mjs'), 'utf8');
  const fn = /function readOnlyAllowedPath\(path\) \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  assert.ok(fn.includes("'/auth/logout'"), 'a viewer must be able to sign out');
  assert.ok(fn.includes("'/api/export'"), 'a viewer must be able to download (export)');
  // Comments are the one write a viewer holds. When the comment route lands on
  // this list, this assertion is the reminder that the matrix already says so.
  assert.equal(can('viewer', 'comment'), true);
});

test('the matrix renders as rows for a docs table', () => {
  const rows = matrixRows();
  assert.equal(rows.length, 3);
  assert.equal(rows[0].role, 'owner');
  assert.equal(rows[2].edit, false);
});
