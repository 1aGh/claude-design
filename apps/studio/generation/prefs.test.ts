// prefs.test.ts — non-secret generation preferences (Task 2.6). The transcription
// engine choice must round-trip through `.design/config.json`, default to whisper
// when unset, reject an invalid engine, and NEVER clobber other config fields.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isTranscriptionProvider,
  readTranscriptionProvider,
  writeTranscriptionProvider,
} from './prefs.ts';

function tmpRepo(config?: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'maude-prefs-'));
  mkdirSync(join(root, '.design'), { recursive: true });
  if (config !== undefined)
    writeFileSync(join(root, '.design', 'config.json'), JSON.stringify(config, null, 2));
  return root;
}

describe('isTranscriptionProvider', () => {
  test('accepts the three engines, rejects anything else', () => {
    expect(isTranscriptionProvider('whisper')).toBe(true);
    expect(isTranscriptionProvider('elevenlabs')).toBe(true);
    expect(isTranscriptionProvider('groq')).toBe(true);
    expect(isTranscriptionProvider('openai')).toBe(false);
    expect(isTranscriptionProvider('')).toBe(false);
    expect(isTranscriptionProvider(null)).toBe(false);
  });
});

describe('readTranscriptionProvider', () => {
  test('defaults to whisper when no config exists', () => {
    expect(readTranscriptionProvider(tmpRepo())).toBe('whisper');
  });

  test('defaults to whisper when the block is absent', () => {
    expect(readTranscriptionProvider(tmpRepo({ name: 'x' }))).toBe('whisper');
  });

  test('reads a configured engine', () => {
    const repo = tmpRepo({ generation: { transcription: { provider: 'groq' } } });
    expect(readTranscriptionProvider(repo)).toBe('groq');
  });

  test('ignores a malformed engine value', () => {
    const repo = tmpRepo({ generation: { transcription: { provider: 'bogus' } } });
    expect(readTranscriptionProvider(repo)).toBe('whisper');
  });
});

describe('writeTranscriptionProvider', () => {
  test('round-trips the choice', async () => {
    const repo = tmpRepo({ name: 'x' });
    await writeTranscriptionProvider(repo, 'elevenlabs');
    expect(readTranscriptionProvider(repo)).toBe('elevenlabs');
  });

  test('preserves other config fields and other generation keys', async () => {
    const repo = tmpRepo({
      name: 'proj',
      generation: { defaultImageProvider: 'gemini', transcription: { model: 'scribe_v1' } },
    });
    await writeTranscriptionProvider(repo, 'groq');
    const cfg = JSON.parse(readFileSync(join(repo, '.design', 'config.json'), 'utf8'));
    expect(cfg.name).toBe('proj');
    expect(cfg.generation.defaultImageProvider).toBe('gemini');
    expect(cfg.generation.transcription.model).toBe('scribe_v1'); // sibling key kept
    expect(cfg.generation.transcription.provider).toBe('groq');
  });

  test('creates the generation block when absent', async () => {
    const repo = tmpRepo(); // no config file at all
    await writeTranscriptionProvider(repo, 'whisper');
    expect(readTranscriptionProvider(repo)).toBe('whisper');
  });

  test('rejects an invalid engine', async () => {
    const repo = tmpRepo();
    await expect(writeTranscriptionProvider(repo, 'openai')).rejects.toThrow(/invalid/);
  });

  test('fails closed on an existing-but-corrupt config (never clobbers it)', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'maude-prefs-'));
    mkdirSync(join(repo, '.design'), { recursive: true });
    const corrupt = '{ this is not json ';
    writeFileSync(join(repo, '.design', 'config.json'), corrupt);
    await expect(writeTranscriptionProvider(repo, 'groq')).rejects.toThrow(/valid JSON/);
    // The corrupt file is left untouched, not overwritten with a partial config.
    expect(readFileSync(join(repo, '.design', 'config.json'), 'utf8')).toBe(corrupt);
  });
});
