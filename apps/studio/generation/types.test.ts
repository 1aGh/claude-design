// generation/types.test.ts — type-level invariants proven through a fake
// adapter + the request validator (the security surface behind
// /_api/generate-jobs). Mirrors photo/schema.test.ts's dependency-free style.

import { describe, expect, test } from 'bun:test';

import {
  type AdapterContext,
  type GenAsset,
  type GenResult,
  type Job,
  type ProviderAdapter,
  validateGenRequest,
} from './types.ts';

// A minimal sync fake — returns an already-`done` Job, proving the contract is
// implementable without branching on sync/async.
function fakeAdapter(_ctx: AdapterContext): ProviderAdapter {
  return {
    descriptor: {
      id: 'fake',
      label: 'Fake',
      kind: 'cloud',
      auth: 'api-key',
      keychainService: 'com.maude.app.fake',
      modalities: ['image'],
    },
    async submit() {
      const result: GenResult = {
        assets: [{ kind: 'image', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) }],
        usage: { ms: 1 },
      };
      const job: Job = {
        id: 'job_1',
        status: () => 'done',
        async *events() {
          yield { status: 'done' as const };
        },
        result: async () => result,
        cancel: () => {},
      };
      return job;
    },
  };
}

describe('generation contract', () => {
  test('a sync adapter returns an already-done Job whose result localizes', async () => {
    const localized: GenAsset[] = [];
    const ctx: AdapterContext = {
      apiKey: 'k',
      localize: async (a) => {
        localized.push(a);
        return 'assets/deadbeef.png';
      },
    };
    const adapter = fakeAdapter(ctx);
    const job = await adapter.submit({ modality: 'image', provider: 'fake', prompt: 'a circle' });
    expect(job.status()).toBe('done');
    const res = await job.result();
    expect(res.assets).toHaveLength(1);
    const rel = await ctx.localize(res.assets[0]);
    expect(rel).toBe('assets/deadbeef.png');
    expect(localized).toHaveLength(1);
  });
});

describe('validateGenRequest', () => {
  test('accepts a well-formed image request', () => {
    const r = validateGenRequest({ modality: 'image', provider: 'gemini', prompt: 'a red circle' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('accepts a source-only edit request (no prompt)', () => {
    const r = validateGenRequest({
      modality: 'transcription',
      provider: 'whisper',
      sourceAsset: 'assets/abcd1234.mp4',
    });
    expect(r.ok).toBe(true);
  });

  test('rejects a non-object', () => {
    expect(validateGenRequest(null).ok).toBe(false);
    expect(validateGenRequest('x').ok).toBe(false);
  });

  test('rejects unknown modality + malformed provider', () => {
    const r = validateGenRequest({ modality: 'hologram', provider: '../etc' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('modality'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('provider'))).toBe(true);
  });

  test('rejects a traversing sourceAsset', () => {
    const r = validateGenRequest({
      modality: 'image',
      provider: 'gemini',
      sourceAsset: '../../etc/passwd',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('sourceAsset'))).toBe(true);
  });

  test('rejects a bad aspect ratio + an over-long prompt', () => {
    const r = validateGenRequest({
      modality: 'image',
      provider: 'gemini',
      prompt: 'x'.repeat(9000),
      aspectRatio: 'wide',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('prompt'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('aspectRatio'))).toBe(true);
  });

  test('rejects a request with neither prompt nor sourceAsset', () => {
    const r = validateGenRequest({ modality: 'image', provider: 'gemini' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('prompt or a sourceAsset'))).toBe(true);
  });
});
