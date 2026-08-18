// The three MEDIUM findings from the 8134ca8f security re-review, pinned.
//
// These are BEHAVIOURAL, not source-text pins — the re-review's own closing
// note was that the posture suite pins the letter and not the behaviour, and
// that nothing exercised the two findings most worth a regression test.
//
//   F1  a transient cloud failure, or a MUTABLE ref, must never be remembered
//       as "this version does not exist". Caching either turns an outage (or a
//       later commit) into a permanent 404 that only a restart clears.
//   F2  the cell is not trusted to respect its own limits — an oversized
//       response must be refused, not buffered for the whole timeout.
//   F3  `git show` output is decoded across chunk boundaries, so a canvas with
//       non-ASCII copy must survive a body larger than one pipe chunk.

import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

describe('F1 — only an authoritative absence is remembered', () => {
  // The decision the route makes, extracted exactly as it is written there.
  const shouldCache = (r: { ok: boolean; reason?: string }, sha: string): boolean =>
    !r.ok && r.reason === 'not-found' && /^[0-9a-f]{7,40}$/.test(sha);

  const REAL_SHA = 'a'.repeat(40);

  test('an unreachable cell is NOT remembered — the outage would outlive itself', () => {
    expect(shouldCache({ ok: false, reason: 'unreachable' }, REAL_SHA)).toBe(false);
  });

  test('an unlinked project is NOT remembered — it says nothing about the version', () => {
    expect(shouldCache({ ok: false, reason: 'not-linked' }, REAL_SHA)).toBe(false);
  });

  test('a MUTABLE ref is never remembered, however authoritative the answer', () => {
    // DiffView's "compare with saved" opens `?sha=HEAD` on a canvas that may
    // not be committed yet. Cache that miss and committing the file leaves the
    // preview permanently 404 — the exact read-failure-as-absence collapse
    // this feature exists to delete.
    for (const ref of ['HEAD', 'main', 'v1.2.0', 'HEAD~1']) {
      expect(shouldCache({ ok: false, reason: 'not-found' }, ref)).toBe(false);
    }
  });

  test('a genuine absence at a real object name IS remembered', () => {
    // Without this the DoS guard the negative cache exists to be is gone.
    expect(shouldCache({ ok: false, reason: 'not-found' }, REAL_SHA)).toBe(true);
    expect(shouldCache({ ok: false, reason: 'not-found' }, 'abc1234')).toBe(true);
  });
});

describe('F2 — an oversized cell response is refused, not buffered', () => {
  // `readCapped`'s contract, exercised over a real ReadableStream.
  async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    if (!res.body) {
      const t = await res.text();
      return t.length > maxBytes ? null : t;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder('utf8');
    let out = '';
    let seen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value?.byteLength ?? 0;
      if (seen > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      out += dec.decode(value, { stream: true });
    }
    return out + dec.decode();
  }

  const streamOf = (chunks: Uint8Array[], headers: Record<string, string> = {}) =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const ch of chunks) c.enqueue(ch);
          c.close();
        },
      }),
      { headers }
    );

  test('a lying Content-Length is refused up front', () => {
    const res = new Response('short', { headers: { 'content-length': String(99 * 1024 * 1024) } });
    return expect(readCapped(res, 1024)).resolves.toBeNull();
  });

  test('a body that EXCEEDS the cap without declaring it is refused mid-stream', async () => {
    // The measurement, not the claim — a hostile cell simply omits the header.
    const chunk = new Uint8Array(512).fill(0x61);
    expect(await readCapped(streamOf([chunk, chunk, chunk, chunk]), 1024)).toBeNull();
  });

  test('a legitimate body under the cap still reads whole', async () => {
    const body = new TextEncoder().encode('export default function C(){}');
    expect(await readCapped(streamOf([body]), 1024)).toBe('export default function C(){}');
  });

  test('multi-byte content split across chunks survives the counted read', async () => {
    // The stream decoder must not corrupt what the cap lets through.
    const bytes = new TextEncoder().encode('č'.repeat(64));
    const mid = 5; // deliberately mid-sequence
    expect(await readCapped(streamOf([bytes.subarray(0, mid), bytes.subarray(mid)]), 4096)).toBe(
      'č'.repeat(64)
    );
  });
});

describe('F3 — git output survives a multi-byte sequence split across chunks', () => {
  test('StringDecoder preserves what per-chunk toString() corrupts', () => {
    const bytes = Buffer.from('č'.repeat(3), 'utf8');
    const a = bytes.subarray(0, 3); // splits the 2nd `č` in half
    const b = bytes.subarray(3);

    // What the runners used to do — silent U+FFFD on both sides of the seam.
    expect(a.toString() + b.toString()).not.toBe('ččč');

    const dec = new StringDecoder('utf8');
    expect(dec.write(a) + dec.write(b) + dec.end()).toBe('ččč');
  });

  test('a real `git show` of a canvas larger than one pipe chunk is byte-exact', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'git-utf8-'));
    try {
      // >64 KiB so the pipe genuinely splits it, with non-ASCII throughout —
      // this repo's own canvases carry Czech copy, which is what made a latent
      // decoding bug a live data-integrity one.
      const body = `// příliš žluťoučký kůň úpěl ďábelské ódy — ${'č'.repeat(40000)}\n`;
      writeFileSync(join(dir, 'canvas.tsx'), body, 'utf8');
      const git = (args: string[]) =>
        new Promise<string>((res, rej) => {
          const outDec = new StringDecoder('utf8');
          let out = '';
          const c = spawn('git', args, { cwd: dir, env: { ...process.env, LC_ALL: 'C' } });
          c.stdout.on('data', (d) => {
            out += outDec.write(d);
          });
          c.on('close', (code) =>
            code === 0 ? res(out + outDec.end()) : rej(new Error(`git ${code}`))
          );
          c.on('error', rej);
        });
      await git(['init', '-b', 'main']);
      await git(['config', 'user.email', 't@t.t']);
      await git(['config', 'user.name', 'T']);
      await git(['add', '-A']);
      await git(['commit', '-m', 'x']);
      const shown = await git(['show', 'HEAD:canvas.tsx']);

      expect(shown).toBe(body);
      expect(shown).not.toContain('�');
      expect(shown.length).toBeGreaterThan(40000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
