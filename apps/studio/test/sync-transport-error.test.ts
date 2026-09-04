// A user-facing reason must be OURS, never the runtime's.
//
// The regression: 484 of 803 undelivered files in an 8.8 GB project carried
// Bun's own fetch wording as their delivery reason, so the Sync panel told a
// person to check their URL for a typo 135 times while the actual fault was a
// cell restarting in a loop. See `sync/transport-error.ts`.

import { describe, expect, it } from 'bun:test';

import { classifyTransportError, transportErrorText } from '../sync/transport-error.ts';

describe('classifyTransportError', () => {
  it("classifies Bun's real connect-failure wording as unreachable", () => {
    // Verbatim from `bun -e "try{await fetch('http://127.0.0.1:1/x')}catch(e){…}"`.
    const out = classifyTransportError(
      new Error('Unable to connect. Is the computer able to access the url?')
    );
    expect(out.class).toBe('unreachable');
    expect(out.text).toBe('Could not reach the workspace');
  });

  it("classifies Bun's second connect sentence too", () => {
    const out = classifyTransportError(new Error('Was there a typo in the url or port?'));
    expect(out.class).toBe('unreachable');
  });

  it('NEVER leaks the runtime wording into the user-facing text', () => {
    const bunStrings = [
      'Unable to connect. Is the computer able to access the url?',
      'Was there a typo in the url or port?',
      'ConnectionRefused',
      'getaddrinfo ENOTFOUND alligators.cloud.maude.sh',
      'The socket connection was closed unexpectedly',
      'some future wording nobody has written yet',
    ];
    for (const s of bunStrings) {
      const out = classifyTransportError(new Error(s));
      expect(out.text).not.toContain('typo');
      expect(out.text).not.toContain('url');
      expect(out.text).not.toBe(s);
      // …but the raw text survives for the console, which is where it belongs.
      expect(out.raw).toBe(s);
    }
  });

  it('separates a timeout from an unreachable host — different answers', () => {
    const timeout = classifyTransportError(
      Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' })
    );
    expect(timeout.class).toBe('timeout');

    const aborted = classifyTransportError(
      Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    );
    expect(aborted.class).toBe('aborted');
  });

  it('is total — a non-Error throw still gets a class and a sentence', () => {
    for (const thrown of [null, undefined, 42, 'a bare string', {}, Symbol.iterator]) {
      const out = classifyTransportError(thrown);
      expect(typeof out.text).toBe('string');
      expect(out.text.length).toBeGreaterThan(0);
      expect(['unreachable', 'timeout', 'aborted', 'other']).toContain(out.class);
    }
  });

  it('bounds the raw text — it reaches logs', () => {
    const out = classifyTransportError(new Error('x'.repeat(5_000)));
    expect(out.raw.length).toBeLessThanOrEqual(200);
  });

  it('transportErrorText is the sentence alone', () => {
    expect(
      transportErrorText(new Error('Unable to connect. Is the computer able to access the url?'))
    ).toBe('Could not reach the workspace');
  });
});
