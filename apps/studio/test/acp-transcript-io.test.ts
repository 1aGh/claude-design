// acp/transcript-io — the bounded transcript primitives (#119).
//
// These are the guards for a bug that made `maude-server` grow to ~16 GB and
// wedged the ACP chat: transcripts were read whole on hot paths, and inline
// base64 blobs made them enormous in the first place. The invariant each test
// pins is named in its describe block.

import { afterEach, describe, expect, test } from 'bun:test';
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  countTranscriptLinesAt,
  INLINE_BLOB_MAX_BYTES,
  readHeadLines,
  readTailLines,
  readTailWithSeq,
  stripInlineBlobs,
} from '../acp/transcript-io.ts';

let root: string;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function write(content: string): string {
  root = mkdtempSync(join(tmpdir(), 'tx-io-'));
  const f = join(root, 't.jsonl');
  writeFileSync(f, content);
  return f;
}

/** The exact string-based expression the streaming counter replaced. Every
 *  count assertion is made against THIS, not against a hand-written number, so
 *  the test pins equivalence to the old behaviour rather than my reading of
 *  it. */
function legacyCount(content: string): number {
  return content.split('\n').filter(Boolean).length;
}

describe('countTranscriptLinesAt — the re-attach seam counter', () => {
  // The seam desyncs permanently if this counter ever disagrees with the one
  // the bridge uses, so equivalence is asserted across every shape a
  // transcript file can actually take on disk.
  const shapes: Array<[string, string]> = [
    ['empty file', ''],
    ['one line, no trailing newline', '{"a":1}'],
    ['one line, trailing newline', '{"a":1}\n'],
    ['two lines', '{"a":1}\n{"b":2}'],
    ['two lines, trailing newline', '{"a":1}\n{"b":2}\n'],
    ['blank lines interspersed', '{"a":1}\n\n\n{"b":2}\n'],
    ['leading blank lines', '\n\n{"a":1}\n'],
    ['only newlines', '\n\n\n'],
    ['CRLF line endings', '{"a":1}\r\n{"b":2}\r\n'],
    ['malformed/truncated final line', '{"a":1}\n{"b":'],
    ['multi-byte UTF-8 content', '{"t":"příliš žluťoučký kůň 🐎"}\n{"t":"úpěl ďábelské ódy"}\n'],
  ];

  for (const [name, content] of shapes) {
    test(`matches split('\\n').filter(Boolean).length — ${name}`, () => {
      const f = write(content);
      expect(countTranscriptLinesAt(f)).toBe(legacyCount(content));
    });
  }

  test('counts across chunk boundaries (file >> 64 KB read buffer)', () => {
    // Lines deliberately sized so newlines land at varied offsets relative to
    // the 64 KB chunk boundary — a chunked counter that mishandles a boundary
    // fails here and nowhere else.
    const content = Array.from(
      { length: 5000 },
      (_, i) => `{"i":${i},"pad":"${'x'.repeat(i % 97)}"}`
    ).join('\n');
    const f = write(content);
    expect(countTranscriptLinesAt(f)).toBe(legacyCount(content));
    expect(countTranscriptLinesAt(f)).toBe(5000);
  });

  test('a lone CR is a non-empty segment and IS counted', () => {
    // filter(Boolean) keeps '\r'. A counter that treated CR as whitespace
    // would silently shift every seq in a CRLF transcript.
    const f = write('\r\n\r\n');
    expect(countTranscriptLinesAt(f)).toBe(2);
  });

  test('missing file → 0, never a throw', () => {
    root = mkdtempSync(join(tmpdir(), 'tx-io-'));
    expect(countTranscriptLinesAt(join(root, 'nope.jsonl'))).toBe(0);
  });
});

describe('readHeadLines — bounded prefix read', () => {
  test('whole file when it fits; complete = true', () => {
    const f = write('{"a":1}\n{"b":2}\n');
    const { lines, complete } = readHeadLines(f, 1024);
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(complete).toBe(true);
  });

  test('drops the truncated trailing line and reports complete = false', () => {
    const f = write('{"a":1}\n{"b":2}\n{"c":3}\n');
    // 12 bytes lands mid-second-line.
    const { lines, complete } = readHeadLines(f, 12);
    expect(complete).toBe(false);
    expect(lines).toEqual(['{"a":1}']);
    // Every returned line must be parseable — that is the point of dropping
    // the partial one.
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });

  test('cap smaller than the first line → no lines, not a fragment', () => {
    const f = write('{"a":"aaaaaaaaaaaaaaaaaaaa"}\n');
    const { lines, complete } = readHeadLines(f, 5);
    expect(lines).toEqual([]);
    expect(complete).toBe(false);
  });

  test('cost is bounded by the cap, not the file size', () => {
    // A 4 MB file read under a 1 KB cap must not return 4 MB of lines.
    const big = Array.from(
      { length: 40_000 },
      (_, i) => `{"i":${i},"pad":"${'x'.repeat(80)}"}`
    ).join('\n');
    const f = write(big);
    const { lines } = readHeadLines(f, 1024);
    expect(lines.join('\n').length).toBeLessThanOrEqual(1024);
  });
});

describe('readTailLines — bounded suffix read', () => {
  test('whole file when it fits; truncated = false', () => {
    const content = '{"a":1}\n{"b":2}\n';
    const f = write(content);
    const { lines, truncated } = readTailLines(f, 1024);
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(truncated).toBe(false);
  });

  test('keeps the NEWEST lines and drops the leading partial one', () => {
    const f = write('{"a":1}\n{"b":2}\n{"c":3}\n');
    const { lines, truncated } = readTailLines(f, 12);
    expect(truncated).toBe(true);
    expect(lines).toEqual(['{"c":3}']);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });

  test('returns an exact whole-line suffix at every cap, multi-byte included', () => {
    // The real invariant: whatever comes back is a SUFFIX of the original line
    // list, with every line whole. Multi-byte content is in the fixture because
    // a byte-offset cut that ignored line boundaries would corrupt it — but the
    // assertion is exact equality against the expected suffix, so ANY
    // misalignment fails, not just one that happens to produce a bad character.
    const all = Array.from({ length: 40 }, (_, i) => `{"i":${i},"e":"🐎🦌🐘"}`);
    const content = `${all.join('\n')}\n`;
    const f = write(content);
    for (let cap = 20; cap < 400; cap++) {
      const { lines } = readTailLines(f, cap);
      expect(lines).toEqual(all.slice(all.length - lines.length));
      for (const l of lines) {
        expect(l).not.toContain('\uFFFD'); // replacement char = a split character
        expect(() => JSON.parse(l)).not.toThrow();
      }
    }
  });

  test('one absurd line with no newline in the window → nothing, not a fragment', () => {
    const f = write(`{"data":"${'A'.repeat(5000)}"}`);
    const { lines, truncated } = readTailLines(f, 100);
    expect(lines).toEqual([]);
    expect(truncated).toBe(true);
  });
});

describe('readTailWithSeq — offset and count come from ONE snapshot (F4)', () => {
  test('a small file: offset 0, total = line count, lines = every line', () => {
    const f = write('{"a":1}\n{"b":2}\n{"c":3}\n');
    const r = readTailWithSeq(f, 1024);
    expect(r.total).toBe(3);
    expect(r.offset).toBe(0);
    expect(r.lines.length).toBe(3);
  });

  test('a windowed file: offset + lines.length === total, exactly', () => {
    const all = Array.from({ length: 200 }, (_, i) => `{"i":${i},"pad":"${'z'.repeat(200)}"}`);
    const f = write(`${all.join('\n')}\n`);
    for (const cap of [500, 2000, 8000, 30_000]) {
      const r = readTailWithSeq(f, cap);
      expect(r.total).toBe(200);
      // The seam invariant: the skipped prefix plus the window is the whole file.
      expect(r.offset + r.lines.length).toBe(r.total);
      // And the window really is the newest lines.
      expect(r.lines).toEqual(all.slice(all.length - r.lines.length));
    }
  });

  test('a growing file yields a self-consistent snapshot on every call', () => {
    // WHAT THIS COVERS, AND WHAT IT CANNOT. The F4 hazard is a file appended to
    // BETWEEN the count pass and the read pass. That interleaving cannot be
    // forced deterministically from a single-threaded test, so this grows the
    // file between CALLS and asserts each call's snapshot is internally
    // consistent — which does catch a wrong offset (mutation-verified: an
    // off-by-one and a dropped window line both fail here), but does NOT
    // reproduce the race itself. The actual defence is structural: one
    // descriptor, one `fstatSync`, both passes bounded by that same size.
    const line = (i: number) => `{"i":${i},"pad":"${'q'.repeat(300)}"}`;
    root = mkdtempSync(join(tmpdir(), 'tx-io-'));
    const f = join(root, 'grow.jsonl');
    writeFileSync(f, `${Array.from({ length: 100 }, (_, i) => line(i)).join('\n')}\n`);
    for (let round = 0; round < 25; round++) {
      const r = readTailWithSeq(f, 4000);
      // Whatever the file size at this instant, the arithmetic is self-consistent.
      expect(r.offset + r.lines.length).toBe(r.total);
      expect(r.offset).toBeGreaterThanOrEqual(0);
      // Every returned line parses and the LAST one is the newest whole line
      // in the snapshot this call took.
      for (const l of r.lines) expect(() => JSON.parse(l)).not.toThrow();
      appendFileSync(f, `${line(1000 + round)}\n`);
    }
  });

  test('offset can never go negative', () => {
    const f = write('{"a":1}\n');
    expect(readTailWithSeq(f, 4).offset).toBeGreaterThanOrEqual(0);
    expect(readTailWithSeq(f, 1).offset).toBeGreaterThanOrEqual(0);
  });

  test('missing file → zeroed, never a throw', () => {
    root = mkdtempSync(join(tmpdir(), 'tx-io-'));
    expect(readTailWithSeq(join(root, 'nope.jsonl'))).toEqual({ lines: [], offset: 0, total: 0 });
  });
});

describe('Buffer.allocUnsafe never leaks uninitialized memory', () => {
  // Both bounded readers allocate with `allocUnsafe` (uninitialized heap) and
  // then decode only the bytes `readSync` actually filled. If a decode were
  // ever bounded by the REQUESTED length instead of the FILLED length, stale
  // heap contents would be served straight into an HTTP response.

  test('a cap far larger than the file returns only the file', () => {
    const f = write('{"a":1}\n');
    expect(readHeadLines(f, 10 * 1024 * 1024).lines).toEqual(['{"a":1}']);
    expect(readTailLines(f, 10 * 1024 * 1024).lines).toEqual(['{"a":1}']);
  });

  test('a truncated file yields exactly its remaining bytes', () => {
    // NOTE ON WHAT THIS DOES AND DOES NOT COVER. The genuine hazard is a file
    // that shrinks BETWEEN `statSync` and `readSync`, leaving `filled < want`;
    // that race cannot be produced deterministically from a test, so this
    // covers only the reachable half (a short file read under a large cap).
    // The real defence stays structural: every decode is bounded by `filled`,
    // the count `readSync` actually returned, never by the requested length.
    // If you change those subarray bounds, this test will NOT catch you —
    // read the invariant in transcript-io.ts instead.
    const f = write('x'.repeat(500_000));
    truncateSync(f, 10);
    const joined = readHeadLines(f, 400_000).lines.join('');
    expect(joined.length).toBe(10);
    expect(/^x*$/.test(joined)).toBe(true);
    expect(countTranscriptLinesAt(f)).toBe(1);
  });

  test('an empty file yields nothing from either reader', () => {
    const f = write('');
    expect(readHeadLines(f, 4096).lines).toEqual([]);
    expect(readTailLines(f, 4096).lines).toEqual([]);
    expect(countTranscriptLinesAt(f)).toBe(0);
  });
});

describe('stripInlineBlobs — the write-path guard', () => {
  const blob = 'A'.repeat(INLINE_BLOB_MAX_BYTES);

  test('elides a large base64 `data` payload, recording its size', () => {
    const entry = {
      role: 'agent',
      update: { toolCallId: 't1', content: [{ content: { type: 'image', data: blob } }] },
    };
    const out = stripInlineBlobs(entry) as typeof entry;
    const got = out.update.content[0].content as unknown as {
      type: string;
      data: { _maudeElided: string; bytes: number };
    };
    expect(got.data).toEqual({ _maudeElided: 'inline-blob', bytes: blob.length });
    // Structure around the payload survives — the marker replaces the bytes,
    // it does not prune the record.
    expect(got.type).toBe('image');
    expect(out.update.toolCallId).toBe('t1');
  });

  test('elides a large `data:` URI', () => {
    const out = stripInlineBlobs({ uri: `data:image/png;base64,${blob}` }) as {
      uri: { _maudeElided: string };
    };
    expect(out.uri._maudeElided).toBe('inline-blob');
  });

  test('leaves prose, arguments and file contents untouched', () => {
    // The transcript is the audit record of what steered an auto-approving
    // agent; only binary payloads may be dropped.
    const entry = {
      role: 'agent',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'here is a long explanation '.repeat(500) },
        rawInput: { file_path: '/x/y.tsx', old_string: 'a'.repeat(9000) },
      },
    };
    expect(stripInlineBlobs(entry)).toEqual(entry);
  });

  test('leaves a SHORT data field untouched', () => {
    const entry = { data: 'x'.repeat(INLINE_BLOB_MAX_BYTES - 1) };
    expect(stripInlineBlobs(entry)).toEqual(entry);
  });

  test('preserves a `__proto__` key in the audit record without polluting', () => {
    // `JSON.parse` yields `__proto__` as an own property; naive assignment
    // would swap the clone's prototype and drop the field from the persisted
    // line (security review F6).
    const entry = JSON.parse('{"role":"agent","__proto__":{"polluted":true}}');
    const out = stripInlineBlobs(entry);
    expect(JSON.parse(JSON.stringify(out)).__proto__).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });

  test('does not mutate its input', () => {
    const entry = { update: { content: [{ content: { data: blob } }] } };
    const snapshot = JSON.stringify(entry);
    stripInlineBlobs(entry);
    expect(JSON.stringify(entry)).toBe(snapshot);
  });

  test('handles arrays, nesting, null and primitives', () => {
    const entry = { a: [1, 'x', null, { data: blob }], b: null, c: false, d: 0 };
    const out = stripInlineBlobs(entry) as { a: unknown[]; b: null; c: boolean; d: number };
    expect((out.a[3] as { data: { _maudeElided: string } }).data._maudeElided).toBe('inline-blob');
    expect(out.b).toBe(null);
    expect(out.c).toBe(false);
    expect(out.d).toBe(0);
  });

  test('shrinks a screenshot-shaped line by orders of magnitude', () => {
    // The reporting case: a 1.36 MB line, 66–76% of which was base64.
    const line = {
      ts: 1,
      role: 'agent',
      update: {
        toolCallId: 'toolu_x',
        status: 'completed',
        content: [
          { content: { type: 'image', mimeType: 'image/png', data: 'A'.repeat(1_300_000) } },
        ],
      },
    };
    const before = JSON.stringify(line).length;
    const after = JSON.stringify(stripInlineBlobs(line)).length;
    expect(before).toBeGreaterThan(1_000_000);
    expect(after).toBeLessThan(1000);
  });
});

describe('the file that written transcripts produce stays parseable', () => {
  test('stripped entries round-trip through the counter and the readers', () => {
    const lines = [
      { ts: 1, role: 'user', text: 'make me a pricing page' },
      {
        ts: 2,
        role: 'agent',
        update: { toolCallId: 't', content: [{ content: { data: 'A'.repeat(200_000) } }] },
      },
      { ts: 3, role: 'stop', stopReason: 'end_turn' },
    ].map((l) => JSON.stringify(stripInlineBlobs(l)));
    const content = `${lines.join('\n')}\n`;
    const f = write(content);
    expect(countTranscriptLinesAt(f)).toBe(3);
    expect(readFileSync(f, 'utf8').length).toBeLessThan(1000);
    const tail = readTailLines(f, 1024 * 1024);
    expect(tail.lines.length).toBe(3);
    for (const l of tail.lines) expect(() => JSON.parse(l)).not.toThrow();
  });
});
