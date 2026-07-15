// SECURITY (ethical-hacker finding, retroactive review of Milestone B) —
// pure unit tests for PermissionPrompt.jsx's default-option selection. The
// bridge-side backend logic (resolvePermission's optionId validation) was
// already correct and covered by test/acp-permission.test.ts; the bug this
// covers lived entirely in the CLIENT affordance — which option Enter/the
// visually-primary button resolves to — a seam no backend test could see.

import { describe, expect, test } from 'bun:test';

import { pickDefaultAllow, pickDefaultReject } from '../client/panels/PermissionPrompt.jsx';

describe('pickDefaultAllow', () => {
  test('prefers allow_once over allow_always, regardless of array order', () => {
    // Matches the REAL adapter's own ordering for a routine tool call —
    // allow_always listed BEFORE allow_once — the exact shape that made the
    // original `.find()` grab the wrong one.
    const options = [
      { optionId: 'allow-always', kind: 'allow_always', name: 'Allow always' },
      { optionId: 'allow-once', kind: 'allow_once', name: 'Allow once' },
      { optionId: 'reject-once', kind: 'reject_once', name: 'Reject' },
    ];
    expect(pickDefaultAllow(options)?.optionId).toBe('allow-once');
  });

  test('ExitPlanMode-shaped option set: prefers the once-only "manually approve edits" over auto/acceptEdits', () => {
    // Mirrors the REAL adapter's ExitPlanMode option ordering exactly (see
    // DDR-179 + the ethical-hacker finding): auto/acceptEdits (both
    // allow_always) listed BEFORE the once-only "default" option.
    const options = [
      { optionId: 'auto', kind: 'allow_always', name: 'Yes, and use auto mode' },
      { optionId: 'acceptEdits', kind: 'allow_always', name: 'Yes, and auto-accept edits' },
      { optionId: 'default', kind: 'allow_once', name: 'Yes, manually approve edits' },
      { optionId: 'plan', kind: 'reject_once', name: 'No, keep planning' },
    ];
    expect(pickDefaultAllow(options)?.optionId).toBe('default');
  });

  test('falls back to allow_always only when no once-only option exists', () => {
    const options = [
      { optionId: 'allow-always', kind: 'allow_always', name: 'Allow always' },
      { optionId: 'reject-once', kind: 'reject_once', name: 'Reject' },
    ];
    expect(pickDefaultAllow(options)?.optionId).toBe('allow-always');
  });

  test('no allow-shaped option at all → null, not a reject option', () => {
    const options = [{ optionId: 'reject-once', kind: 'reject_once', name: 'Reject' }];
    expect(pickDefaultAllow(options)).toBeNull();
  });

  test('tolerates missing/malformed input — never throws', () => {
    expect(pickDefaultAllow(undefined)).toBeNull();
    expect(pickDefaultAllow(null)).toBeNull();
    expect(
      pickDefaultAllow([null, undefined, { kind: 'allow_once', optionId: 'x' }])?.optionId
    ).toBe('x');
  });
});

describe('pickDefaultReject', () => {
  test('finds a reject_once/reject_always option regardless of position', () => {
    const options = [
      { optionId: 'allow-once', kind: 'allow_once', name: 'Allow once' },
      { optionId: 'reject-once', kind: 'reject_once', name: 'Reject' },
    ];
    expect(pickDefaultReject(options)?.optionId).toBe('reject-once');
  });

  test('no reject-shaped option → null', () => {
    expect(pickDefaultReject([{ optionId: 'allow-once', kind: 'allow_once' }])).toBeNull();
  });

  test('tolerates missing/malformed input — never throws', () => {
    expect(pickDefaultReject(undefined)).toBeNull();
    expect(pickDefaultReject(null)).toBeNull();
  });
});
