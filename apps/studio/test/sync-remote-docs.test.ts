// The gap between what a project HOLDS and what this machine carries.
//
// Regression cover for the reported "Open in Maude does nothing": the desktop
// synced 72/72 and was accurate about the wrong set — three canvases lived only
// on the hub and no local counter could ever show it.

import { describe, expect, test } from 'bun:test';

import {
  describeRemoteDiff,
  diffRemoteDocs,
  fetchRemoteDocs,
  pullTargets,
  slugFromDocName,
} from '../sync/remote-docs.ts';

const okFetch = (documents: unknown) =>
  (async () =>
    new Response(JSON.stringify({ documents }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

describe('fetchRemoteDocs', () => {
  test('reads the hub listing', async () => {
    const docs = await fetchRemoteDocs(
      'https://hub.example',
      't',
      okFetch([{ name: 'ui-welcome', bytes: 2931 }])
    );
    expect(docs).toEqual([{ name: 'ui-welcome', bytes: 2931 }]);
  });

  test('carries the token as a bearer, and strips a trailing slash', async () => {
    let seenUrl = '';
    let seenAuth = '';
    const spy = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenAuth = String((init.headers as Record<string, string>).authorization);
      return new Response(JSON.stringify({ documents: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchRemoteDocs('https://hub.example/', 'tok123', spy);
    expect(seenUrl).toBe('https://hub.example/api/documents');
    expect(seenAuth).toBe('Bearer tok123');
  });

  test('an unreachable or old hub yields null, never a throw', async () => {
    // Load-bearing: sync must proceed when the listing cannot be had. A hub
    // without the route (404) must not degrade into a failed sync.
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchRemoteDocs('https://h', 't', boom)).toBeNull();

    const notFound = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    expect(await fetchRemoteDocs('https://h', 't', notFound)).toBeNull();

    const junk = (async () =>
      new Response(JSON.stringify({ documents: 'not-an-array' }), {
        status: 200,
      })) as unknown as typeof fetch;
    expect(await fetchRemoteDocs('https://h', 't', junk)).toBeNull();
  });
});

describe('diffRemoteDocs', () => {
  test('names the canvases this machine can never receive', () => {
    // The reported case, in miniature.
    const diff = diffRemoteDocs(
      ['ui-home', 'ui-about'],
      [
        { name: 'ui-home', bytes: 1 },
        { name: 'ui-about', bytes: 1 },
        { name: 'ui-welcome', bytes: 2931 },
      ]
    );
    expect(diff.shared).toEqual(['ui-about', 'ui-home']);
    expect(diff.hubOnly.map((d) => d.name)).toEqual(['ui-welcome']);
    expect(diff.localOnly).toEqual([]);
    expect(diff.reachable).toBe(true);
  });

  test('a canvas created here but not yet pushed is localOnly, not a gap', () => {
    const diff = diffRemoteDocs(['ui-new'], []);
    expect(diff.localOnly).toEqual(['ui-new']);
    expect(diff.hubOnly).toEqual([]);
  });

  test('an unreachable hub reports NOT reachable rather than a false gap', () => {
    // Reporting every local canvas as "hub-only missing" would be worse than
    // saying nothing — it would invent an alarm out of a network blip.
    const diff = diffRemoteDocs(['ui-home'], null);
    expect(diff.reachable).toBe(false);
    expect(diff.hubOnly).toEqual([]);
  });

  test('compares WIRE names — a namespaced hub vs flat local is a real mismatch', () => {
    // If a caller passed raw slugs against a namespaced hub, everything would
    // look missing on both sides. The diff reports exactly that rather than
    // papering over it, because it IS the doc-identity bug (DDR-192 §5).
    const diff = diffRemoteDocs(['ui-home'], [{ name: 'ws/acme/main/ui-home', bytes: 1 }]);
    expect(diff.shared).toEqual([]);
    expect(diff.hubOnly.map((d) => d.name)).toEqual(['ws/acme/main/ui-home']);
    expect(diff.localOnly).toEqual(['ui-home']);
  });
});

describe('describeRemoteDiff', () => {
  test('says what is missing, with names', () => {
    const msg = describeRemoteDiff(
      diffRemoteDocs(
        [],
        [
          { name: 'ui-welcome', bytes: 1 },
          { name: 'ui-how_to_use_maude', bytes: 1 },
        ]
      )
    );
    expect(msg).toContain('2 canvases');
    expect(msg).toContain('ui-welcome');
  });

  test('stays quiet when there is nothing to report', () => {
    expect(describeRemoteDiff(diffRemoteDocs(['a'], [{ name: 'a', bytes: 1 }]))).toBeNull();
    expect(describeRemoteDiff(diffRemoteDocs(['a'], null))).toBeNull();
  });
});

describe('pulling hub-only documents down', () => {
  const join = (...p: string[]) => p.join('/');
  const resolve = (p: string) => p.replace(/\/\.\//g, '/');

  test('maps a flat and a namespaced doc name to the same slug', () => {
    expect(slugFromDocName('ui-welcome')).toBe('ui-welcome');
    expect(slugFromDocName('ws/acme/main/ui-welcome')).toBe('ui-welcome');
  });

  test('lands hub-only canvases flat under the design root', () => {
    const targets = pullTargets(
      [
        { name: 'ui-welcome', bytes: 1 },
        { name: 'ws/acme/main/ui-home', bytes: 1 },
      ],
      '/p/.design',
      join,
      resolve,
      '/'
    );
    expect(targets.map((t) => t.bodyAbs)).toEqual([
      '/p/.design/ui-welcome.tsx',
      '/p/.design/ui-home.tsx',
    ]);
    // The wire name is kept — the provider must open the document the HUB has,
    // not a name re-derived from the local path.
    expect(targets[1].docName).toBe('ws/acme/main/ui-home');
  });

  test('a document NAME can never write outside the design root', () => {
    // Hub-controlled input, last point before a create. Dots are refused
    // outright, so traversal cannot even form a candidate path.
    const evil = [
      { name: '../../etc/passwd', bytes: 1 },
      { name: '..', bytes: 1 },
      { name: 'ui/../../escape', bytes: 1 },
      { name: 'a b', bytes: 1 },
      { name: '', bytes: 1 },
      { name: 'x'.repeat(500), bytes: 1 },
    ];
    expect(pullTargets(evil, '/p/.design', join, resolve, '/')).toEqual([]);
  });
});
