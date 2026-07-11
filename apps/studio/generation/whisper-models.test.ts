// whisper-models.test.ts — managed local whisper.cpp model registry + resolution
// + download (Task 2.7, approach A). Uses a temp XDG_CACHE_HOME so the real
// user cache is never touched, and a stubbed fetch for the download path.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  downloadWhisperModel,
  getWhisperModel,
  listWhisperModels,
  removeWhisperModel,
  resolveWhisperModel,
  WHISPER_MODELS,
  whisperModelsDir,
  whisperModelUrl,
} from './whisper-models.ts';

const realFetch = globalThis.fetch;
let cacheRoot: string;
const prevXdg = process.env.XDG_CACHE_HOME;

beforeEach(() => {
  cacheRoot = mkdtempSync(join(tmpdir(), 'maude-wm-'));
  process.env.XDG_CACHE_HOME = cacheRoot;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (prevXdg === undefined) delete process.env.XDG_CACHE_HOME;
  else process.env.XDG_CACHE_HOME = prevXdg;
});

describe('registry', () => {
  test('carries base (multilingual) + base.en (English-only)', () => {
    expect(getWhisperModel('base')?.multilingual).toBe(true);
    expect(getWhisperModel('base.en')?.multilingual).toBe(false);
    expect(getWhisperModel('nope')).toBeNull();
  });
  test('whisperModelUrl derives the frozen ggerganov/whisper.cpp URL (SSRF-safe host)', () => {
    const url = whisperModelUrl(getWhisperModel('base'));
    expect(url).toBe('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin');
  });
  test('whisperModelsDir honors XDG_CACHE_HOME', () => {
    expect(whisperModelsDir()).toBe(join(cacheRoot, 'maude', 'whisper-models'));
  });
});

describe('resolveWhisperModel', () => {
  function fakeDownloaded(file: string) {
    const dir = whisperModelsDir();
    require('node:fs').mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), 'x');
  }

  test('returns null when nothing is downloaded', () => {
    expect(resolveWhisperModel()).toBeNull();
  });
  test('prefers the configured id when present', () => {
    fakeDownloaded('ggml-small.bin');
    fakeDownloaded('ggml-base.bin');
    expect(resolveWhisperModel('small')).toBe(join(whisperModelsDir(), 'ggml-small.bin'));
  });
  test('prefers a MULTILINGUAL model over an English-only one (Czech-footage safety)', () => {
    fakeDownloaded('ggml-base.en.bin'); // English-only
    fakeDownloaded('ggml-base.bin'); // multilingual
    expect(resolveWhisperModel()).toBe(join(whisperModelsDir(), 'ggml-base.bin'));
  });
  test('falls back to any model if only English-only is present', () => {
    fakeDownloaded('ggml-base.en.bin');
    expect(resolveWhisperModel()).toBe(join(whisperModelsDir(), 'ggml-base.en.bin'));
  });
});

describe('listWhisperModels', () => {
  test('flags a downloaded model', () => {
    const dir = whisperModelsDir();
    require('node:fs').mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ggml-tiny.bin'), 'abc');
    const tiny = listWhisperModels().find((m) => m.id === 'tiny');
    expect(tiny?.downloaded).toBe(true);
    expect(tiny?.bytes).toBe(3);
    expect(listWhisperModels().find((m) => m.id === 'base')?.downloaded).toBe(false);
  });
});

describe('downloadWhisperModel', () => {
  test('streams to the cache, reports progress, atomically lands the file', async () => {
    const bytes = new Uint8Array(1024);
    globalThis.fetch = (async () =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-length': String(bytes.byteLength) },
      })) as typeof fetch;
    const seen: number[] = [];
    const path = await downloadWhisperModel('tiny', (r) => seen.push(r));
    expect(path).toBe(join(whisperModelsDir(), 'ggml-tiny.bin'));
    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.part`)).toBe(false); // temp renamed away
    expect(seen.at(-1)).toBe(1024);
    expect(await removeWhisperModel('tiny')).toBe(true);
    expect(existsSync(path)).toBe(false);
  });

  test('rejects an over-cap body (declared content-length) without writing', async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(1), {
        status: 200,
        headers: { 'content-length': String(9999 * 1024 * 1024) }, // way over tiny's cap
      })) as typeof fetch;
    await expect(downloadWhisperModel('tiny', () => {})).rejects.toThrow(/larger than expected/);
    expect(existsSync(join(whisperModelsDir(), 'ggml-tiny.bin'))).toBe(false);
  });

  test('unknown model id throws', async () => {
    await expect(downloadWhisperModel('bogus', () => {})).rejects.toThrow(/unknown whisper model/);
  });

  test('rejects a redirect that lands off huggingface.co (Finding 2)', async () => {
    // Simulate the HF blob redirect resolving to an attacker/on-path host.
    globalThis.fetch = (async () => ({
      url: 'https://evil.example/ggml-tiny.bin',
      ok: true,
      headers: new Headers(),
      body: new Response(new Uint8Array(1)).body,
    })) as unknown as typeof fetch;
    await expect(downloadWhisperModel('tiny', () => {})).rejects.toThrow(/off huggingface\.co/);
    expect(existsSync(join(whisperModelsDir(), 'ggml-tiny.bin'))).toBe(false);
  });

  test('accepts a redirect that stays on a huggingface.co CDN host', async () => {
    const bytes = new Uint8Array(512);
    globalThis.fetch = (async () => ({
      url: 'https://cdn-lfs.huggingface.co/repos/x/ggml-tiny.bin',
      ok: true,
      headers: new Headers({ 'content-length': String(bytes.byteLength) }),
      body: new Response(bytes).body,
    })) as unknown as typeof fetch;
    const path = await downloadWhisperModel('tiny', () => {});
    expect(existsSync(path)).toBe(true);
  });
});

describe('registry integrity', () => {
  test('every model has a positive size and a ggml- file', () => {
    for (const m of WHISPER_MODELS) {
      expect(m.sizeMB).toBeGreaterThan(0);
      expect(m.file.startsWith('ggml-')).toBe(true);
    }
  });
});
