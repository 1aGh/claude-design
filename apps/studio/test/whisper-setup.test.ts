// whisper-setup.test.ts — the subtitle stack's runtime detection and the `auto`
// engine choice. Both exist to close the same gap the scout card had: the card
// used to print `brew install whisper-cpp` unconditionally, never checked
// whether the engine was there, and never adapted to the keys you'd set.

import { describe, expect, test } from 'bun:test';
import { resolveAutoEngine, whisperSetup } from '../generation/whisper-models.ts';

describe('whisperSetup', () => {
  test('either installed with nothing to do, or a route to fix it', () => {
    const s = whisperSetup();
    if (s.installed) expect(s.options).toHaveLength(0);
    else expect(s.options.length).toBeGreaterThan(0);
  });

  test('every offered route is actionable as-is', () => {
    for (const o of whisperSetup().options)
      expect(o.kind === 'command' ? o.command : o.url).toBeTruthy();
  });

  test('a source-build route is always among the options when not installed', () => {
    const s = whisperSetup();
    if (!s.installed) expect(s.options.some((o) => o.id === 'source')).toBe(true);
  });
});

// DDR-164's rule is "no engine switch behind your back". `auto` keeps it by
// being a SELECTED mode whose resolution is stated — these tests pin the
// resolution itself, including the part that costs money.
describe('resolveAutoEngine', () => {
  test('no keys → local whisper, and it says nothing leaves the machine', () => {
    const r = resolveAutoEngine([], true);
    expect(r.engine).toBe('whisper');
    expect(r.cloud).toBe(false);
    expect(r.reason).toContain('No cloud key');
  });

  test('an ElevenLabs key wins — Scribe beats a local base model', () => {
    const r = resolveAutoEngine(['elevenlabs'], true);
    expect(r.engine).toBe('elevenlabs');
    expect(r.cloud).toBe(true);
  });

  test('Groq is used when it is the only key', () => {
    expect(resolveAutoEngine(['groq'], true).engine).toBe('groq');
  });

  test('ElevenLabs outranks Groq when both keys are set', () => {
    expect(resolveAutoEngine(['groq', 'elevenlabs'], true).engine).toBe('elevenlabs');
  });

  test('an unrelated provider key never routes audio to the cloud', () => {
    // A Google key is for image generation — it must not drag transcription
    // off-machine.
    const r = resolveAutoEngine(['google'], true);
    expect(r.engine).toBe('whisper');
    expect(r.cloud).toBe(false);
  });

  test('a cloud resolution is always flagged as cloud (the billing/egress tell)', () => {
    for (const keys of [['elevenlabs'], ['groq']])
      expect(resolveAutoEngine(keys, true).cloud).toBe(true);
  });

  test('without the whisper binary it still resolves local, but says "once installed"', () => {
    const r = resolveAutoEngine([], false);
    expect(r.engine).toBe('whisper');
    expect(r.reason).toContain('once its binary is installed');
  });
});

// The server-side probe and the transcriber's own resolution MUST agree, or the
// card claims an engine the CLI can't find. Same drift guard the scout has.
describe('server ↔ CLI whisper resolution parity', () => {
  test('the same candidate names, and `main` is excluded in both', async () => {
    const cli = await import('../bin/_transcribe.mjs');
    const src = await Bun.file(`${import.meta.dir}/../bin/_transcribe.mjs`).text();
    const serverSrc = await Bun.file(`${import.meta.dir}/../generation/whisper-models.ts`).text();
    // Both probe whisper-cli then whisper, and neither probes the bare `main`
    // (executing a seeded `main` from `.` on $PATH was a security finding).
    for (const s of [src, serverSrc]) {
      expect(s).toContain("'whisper-cli'");
      expect(s).toContain("'whisper'");
      expect(s).not.toContain("'main'");
    }
    expect(typeof cli.resolveProvider).toBe('function');
  });

  test('both accept the same engine vocabulary incl. auto', async () => {
    const cli = await import('../bin/_transcribe.mjs');
    const { TRANSCRIPTION_PROVIDERS } = await import('../generation/prefs.ts');
    // resolveProvider rejects anything outside the vocabulary, so a value the
    // UI can persist must survive it.
    for (const p of TRANSCRIPTION_PROVIDERS)
      expect(cli.resolveProvider(p, '/nonexistent').provider).toBe(p);
  });
});
