// figma/client.ts + types.ts — the properties DDR-216 relies on, with a stubbed
// `fetch`. Asserts: the base URL is never influenced by input, the token never
// reaches a thrown error or a log line, 429 backoff is bounded, the response
// byte cap trips on a body that does not declare its length, and the
// node-count / depth caps are hard refusals rather than truncations.

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FigmaApiError,
  fetchDocument,
  fetchImageUrls,
  fetchLocalVariables,
  fetchStyles,
  MAX_IMAGE_BATCH,
  retryAfterMs,
} from './client.ts';
import {
  FigmaCapError,
  MAX_NODE_COUNT,
  MAX_RESPONSE_BYTES,
  MAX_TREE_DEPTH,
  normalizeDocument,
  walkNodes,
} from './types.ts';

const TOKEN = 'figd_SUPERSECRETCANARY';
const KEY = 'dGNzRC2kmrmGnOxaBa0RI7';

let keysDir: string;
let realFetch: typeof fetch;
const calls: Array<{ url: string; headers: Record<string, string> }> = [];

/** Point `keys.ts` at a throwaway 0600 store instead of the user's real one. */
beforeEach(() => {
  keysDir = mkdtempSync(join(tmpdir(), 'maude-figma-keys-'));
  const keysPath = join(keysDir, 'keys.json');
  // 0600 like the real store — otherwise `keys.ts` correctly warns on every read.
  writeFileSync(keysPath, JSON.stringify({ keys: { figma: TOKEN } }), { mode: 0o600 });
  process.env.MAUDE_GEN_KEYS_PATH = keysPath;
  delete process.env.MAUDE_GEN_KEY_ENDPOINT;
  delete process.env.MAUDE_GEN_KEY_KEY;
  calls.length = 0;
  realFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rmSync(keysDir, { recursive: true, force: true });
  delete process.env.MAUDE_GEN_KEYS_PATH;
});

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return handler(url);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const MINIMAL_DOC = {
  document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [] },
};

describe('the base URL is never influenced by input (SSRF chokepoint 1)', () => {
  test('every request goes to api.figma.com regardless of the key given', async () => {
    stubFetch(() => jsonResponse(MINIMAL_DOC));
    await fetchDocument({ fileKey: KEY, surface: 'design' });
    await fetchStyles(KEY);
    await fetchImageUrls(KEY, ['1:2']);
    expect(calls.length).toBe(3);
    for (const call of calls) {
      expect(call.url.startsWith('https://api.figma.com/v1/')).toBe(true);
    }
  });

  test('a key-shaped string carrying a path is encoded, never spliced into the path', async () => {
    stubFetch(() => jsonResponse(MINIMAL_DOC));
    // `url.ts` would have rejected this long before here — belt-and-braces that
    // the client encodes rather than trusting an upstream validation.
    await fetchStyles('../../evil');
    const target = new URL(calls[0].url);
    expect(target.host).toBe('api.figma.com');
    expect(target.pathname).toBe('/v1/files/..%2F..%2Fevil/styles');
  });

  test('node ids are sent as a query value, not as a path segment', async () => {
    stubFetch(() => jsonResponse({ nodes: { '2:17': { document: MINIMAL_DOC.document } } }));
    await fetchDocument({ fileKey: KEY, surface: 'design', nodeId: '2:17' });
    const target = new URL(calls[0].url);
    expect(target.pathname).toBe(`/v1/files/${KEY}/nodes`);
    expect(target.searchParams.get('ids')).toBe('2:17');
  });

  test('a node-id present means /nodes, not the whole file', async () => {
    stubFetch(() => jsonResponse({ nodes: { '2:17': { document: MINIMAL_DOC.document } } }));
    await fetchDocument({ fileKey: KEY, surface: 'design', nodeId: '2:17' });
    expect(calls[0].url).toContain('/nodes');
  });
});

describe('the token is sent, and never comes back out', () => {
  test('the PAT rides the X-Figma-Token header', async () => {
    stubFetch(() => jsonResponse(MINIMAL_DOC));
    await fetchDocument({ fileKey: KEY, surface: 'design' });
    expect(calls[0].headers['X-Figma-Token']).toBe(TOKEN);
  });

  test('no thrown error carries the token, for ANY failure status', async () => {
    for (const status of [400, 401, 403, 404, 418, 500, 502]) {
      stubFetch(() => jsonResponse({ err: `boom ${TOKEN}` }, status));
      let caught: unknown;
      try {
        await fetchDocument({ fileKey: KEY, surface: 'design' });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(FigmaApiError);
      const serialized = `${(caught as Error).message} ${(caught as Error).stack ?? ''} ${JSON.stringify(caught)}`;
      expect(serialized).not.toContain(TOKEN);
      expect(serialized).not.toContain('SUPERSECRETCANARY');
    }
  });

  test('an upstream error body is never echoed into the message (D10)', async () => {
    stubFetch(() => jsonResponse({ err: 'UPSTREAM_CANARY_STRING' }, 500));
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as Error).message).not.toContain('UPSTREAM_CANARY');
    }
  });

  test('a network-layer failure does not leak the URL or the cause', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error(`connect ECONNREFUSED ${TOKEN} https://api.figma.com/v1/files`);
    }) as unknown as typeof fetch;
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(FigmaApiError);
      expect((err as FigmaApiError).kind).toBe('network');
      expect((err as Error).message).not.toContain(TOKEN);
    }
  });

  test('no key configured is a typed refusal, not an unauthenticated call', async () => {
    writeFileSync(join(keysDir, 'keys.json'), JSON.stringify({ keys: {} }), { mode: 0o600 });
    stubFetch(() => jsonResponse(MINIMAL_DOC));
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as FigmaApiError).kind).toBe('not_configured');
    }
    expect(calls.length).toBe(0);
  });
});

describe('429 backoff is bounded', () => {
  test('retries, then gives up with a rate_limited error', async () => {
    stubFetch(() => jsonResponse({}, 429, { 'Retry-After': '0' }));
    const started = Date.now();
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as FigmaApiError).kind).toBe('rate_limited');
    }
    // 3 retries + the original = 4 calls, and it does not sleep for minutes.
    expect(calls.length).toBe(4);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  // Asserted arithmetically rather than by waiting: an upstream header is
  // untrusted input for SCHEDULING too, and the property under test is the
  // clamp itself, not how long a test process is willing to sit still.
  test.each([
    ['86400', 10_000, 'an absurd delay is clamped'],
    ['3600', 10_000, 'an hour is clamped'],
    ['5', 5_000, 'a sane delay is honoured'],
    ['0', 0, 'zero means retry now'],
    ['-1', 1_000, 'a negative falls back to the default'],
    ['not-a-number', 1_000, 'garbage falls back to the default'],
    [null, 1_000, 'an absent header falls back to the default'],
  ])('Retry-After %p → %ims (%s)', (header, expected) => {
    expect(retryAfterMs(header as string | null)).toBe(expected as number);
  });

  test('recovers when the retry succeeds', async () => {
    let seen = 0;
    stubFetch(() => {
      seen += 1;
      return seen === 1 ? jsonResponse({}, 429, { 'Retry-After': '0' }) : jsonResponse(MINIMAL_DOC);
    });
    const doc = await fetchDocument({ fileKey: KEY, surface: 'design' });
    expect(doc.root.id).toBe('0:0');
  });
});

describe('the response byte cap is a refusal', () => {
  test('trips on a declared Content-Length over the cap', async () => {
    stubFetch(() =>
      jsonResponse(MINIMAL_DOC, 200, { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) })
    );
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as FigmaApiError).kind).toBe('too_large');
    }
  });

  test('trips on an UNDECLARED oversized body — the header is not the control', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    stubFetch(
      () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(chunk); // never ends
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    try {
      await fetchDocument({ fileKey: KEY, surface: 'design' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as FigmaApiError).kind).toBe('too_large');
    }
  });
});

describe('the Variables endpoint degrades rather than failing', () => {
  test('403 (the common Pro-plan case) reports unavailable, not an error', async () => {
    stubFetch(() => jsonResponse({ err: 'plan' }, 403));
    const result = await fetchLocalVariables(KEY);
    expect(result.available).toBe(false);
  });

  test('a genuine failure still throws', async () => {
    stubFetch(() => jsonResponse({}, 500));
    await expect(fetchLocalVariables(KEY)).rejects.toBeInstanceOf(FigmaApiError);
  });
});

describe('image batching', () => {
  test('refuses a batch over the ceiling rather than splitting silently', async () => {
    stubFetch(() => jsonResponse({ images: {} }));
    const ids = Array.from({ length: MAX_IMAGE_BATCH + 1 }, (_, i) => `1:${i}`);
    await expect(fetchImageUrls(KEY, ids)).rejects.toBeInstanceOf(FigmaCapError);
  });

  test('an empty batch makes no request at all', async () => {
    stubFetch(() => jsonResponse({ images: {} }));
    const result = await fetchImageUrls(KEY, []);
    expect(result.images).toEqual({});
    expect(calls.length).toBe(0);
  });

  test('svg format omits scale (Figma rejects it there)', async () => {
    stubFetch(() => jsonResponse({ images: {} }));
    await fetchImageUrls(KEY, ['1:2'], 'svg');
    expect(new URL(calls[0].url).searchParams.get('scale')).toBeNull();
  });

  test("returns URLs but never fetches one — downloading is fetch-asset's job", async () => {
    stubFetch(() => jsonResponse({ images: { '1:2': 'https://evil.example/x.png' } }));
    const result = await fetchImageUrls(KEY, ['1:2']);
    expect(result.images['1:2']).toBe('https://evil.example/x.png');
    // Exactly one call — the images endpoint. No follow-on download.
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain('api.figma.com');
  });
});

describe('normalizeDocument — caps are refusals, and untrusted strings survive verbatim', () => {
  function deepDoc(depth: number): unknown {
    let node: Record<string, unknown> = { id: `0:${depth}`, name: 'leaf', type: 'FRAME' };
    for (let i = depth - 1; i >= 0; i--) {
      node = { id: `0:${i}`, name: 'wrap', type: 'FRAME', children: [node] };
    }
    return node;
  }

  test('depth over the cap is a hard refusal', () => {
    expect(() =>
      normalizeDocument(deepDoc(MAX_TREE_DEPTH + 5), { fileKey: KEY, surface: 'design' })
    ).toThrow(FigmaCapError);
  });

  test('depth under the cap normalizes and records maxDepth', () => {
    const doc = normalizeDocument(deepDoc(10), { fileKey: KEY, surface: 'design' });
    expect(doc.maxDepth).toBe(10);
    expect(doc.nodeCount).toBe(11);
  });

  test('node count over the cap is a hard refusal, not a truncation', () => {
    const children = Array.from({ length: MAX_NODE_COUNT + 10 }, (_, i) => ({
      id: `1:${i}`,
      name: 'n',
      type: 'RECTANGLE',
    }));
    expect(() =>
      normalizeDocument(
        { id: '0:0', name: 'root', type: 'CANVAS', children },
        {
          fileKey: KEY,
          surface: 'design',
        }
      )
    ).toThrow(FigmaCapError);
  });

  test("hostile layer names and text pass through UNCHANGED — sanitizing is the emitter's job", () => {
    const hostile = 'Příliš žluťoučký — "test" / <b> & \'x\'';
    const doc = normalizeDocument(
      {
        id: '0:0',
        name: 'root',
        type: 'CANVAS',
        children: [
          { id: '2:17', name: hostile, type: 'TEXT', characters: '<script>alert(1)</script>' },
        ],
      },
      { fileKey: KEY, surface: 'board' }
    );
    const text = doc.root.children?.[0];
    expect(text?.name).toBe(hostile);
    expect(text?.characters).toBe('<script>alert(1)</script>');
  });

  test('prototype-polluting keys in the input do not reach Object.prototype', () => {
    normalizeDocument(
      JSON.parse('{"id":"0:0","name":"r","type":"CANVAS","__proto__":{"polluted":"yes"}}'),
      { fileKey: KEY, surface: 'design' }
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('a free-floating connector endpoint yields no host id', () => {
    const doc = normalizeDocument(
      {
        id: '0:0',
        name: 'r',
        type: 'CANVAS',
        children: [
          {
            id: '2:67',
            name: 'c',
            type: 'CONNECTOR',
            connectorStart: { endpointNodeId: '2:17', magnet: 'AUTO' },
            connectorEnd: { position: { x: 10, y: 20 } },
          },
        ],
      },
      { fileKey: KEY, surface: 'board' }
    );
    const connector = doc.root.children?.[0];
    expect(connector?.connectorStart).toBe('2:17');
    expect(connector?.connectorEnd).toBeUndefined();
  });

  test('an unknown node type normalizes to UNKNOWN rather than being dropped', () => {
    const doc = normalizeDocument(
      { id: '0:0', name: 'r', type: 'SOME_FUTURE_THING' },
      { fileKey: KEY, surface: 'board' }
    );
    expect(doc.root.type).toBe('UNKNOWN');
  });

  test('walkNodes visits every node without recursion', () => {
    const doc = normalizeDocument(deepDoc(200 > MAX_TREE_DEPTH ? 20 : 20), {
      fileKey: KEY,
      surface: 'design',
    });
    const seen: string[] = [];
    walkNodes(doc.root, (n) => seen.push(n.id));
    expect(seen.length).toBe(doc.nodeCount);
  });
});
