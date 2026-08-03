// Cloud Phase 27 — the sandbox child's environment.
//
// Diagnosed against a real cell: the canvas module 422'd with "Cannot find
// native binding" while running the identical worker command by hand with a
// clean environment worked. The difference was one inherited variable.

import { describe, expect, test } from 'bun:test';

import { workerEnv } from '../canvas-build-sandbox.ts';

describe('workerEnv', () => {
  test('a compiled binary’s VIRTUAL binding path is not handed to a child', () => {
    const env = workerEnv({
      PATH: '/bin',
      NAPI_RS_NATIVE_LIBRARY_PATH: '/$bunfs/root/parser.linux-arm64-gnu.node',
    } as NodeJS.ProcessEnv);
    expect(env.NAPI_RS_NATIVE_LIBRARY_PATH).toBeUndefined();
  });

  test('a REAL binding path still is', () => {
    const env = workerEnv({
      PATH: '/bin',
      NAPI_RS_NATIVE_LIBRARY_PATH: '/maude/node_modules/@oxc-parser/binding-linux-arm64-gnu',
    } as NodeJS.ProcessEnv);
    expect(env.NAPI_RS_NATIVE_LIBRARY_PATH).toBe(
      '/maude/node_modules/@oxc-parser/binding-linux-arm64-gnu'
    );
  });

  test('the child environment carries no secret — it parses tenant source', () => {
    const env = workerEnv({
      PATH: '/bin',
      HUB_SECRET: 'nope',
      AWS_SECRET_ACCESS_KEY: 'also-nope',
      MAUDE_PROJECT_TOKEN_KEY: 'definitely-nope',
    } as NodeJS.ProcessEnv);
    expect(env.HUB_SECRET).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.MAUDE_PROJECT_TOKEN_KEY).toBeUndefined();
  });
});

// Cloud Phase 27 B2 — content-addressed media is immutable; everything else
// revalidates. `no-store` is right on a laptop and is a re-download of every
// photograph on every pan over the internet.
import { cacheControlFor } from '../http.ts';

describe('cacheControlFor', () => {
  test('a content-addressed name is immutable — the name IS the content', () => {
    for (const p of ['/x/assets/deadbeef.png', '/a/b/0123456789abcdef.mp4']) {
      expect(cacheControlFor(p).cacheControl).toBe('public, max-age=31536000, immutable');
      expect(cacheControlFor(p).addEtag).toBe(false);
    }
  });

  test('an AUTHORED name revalidates — a designer edits hero.png in place', () => {
    for (const p of ['/x/assets/hero.png', '/x/system/ds/colors_and_type.css', '/x/logos.svg']) {
      expect(cacheControlFor(p).cacheControl).toBe('no-cache');
      expect(cacheControlFor(p).addEtag).toBe(true);
    }
  });

  test('a name that merely LOOKS hex-ish is not treated as content-addressed', () => {
    // `deadbee` is 7 chars; `deadbeefs` has a non-hex char. Getting either
    // wrong caches a mutable file for a year.
    expect(cacheControlFor('/x/deadbee.png').cacheControl).toBe('no-cache');
    expect(cacheControlFor('/x/deadbeefs.png').cacheControl).toBe('no-cache');
  });
});
