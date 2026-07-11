#!/usr/bin/env bun
// _transcribe.mjs — internal shim behind `maude design transcribe` (DDR-062).
// Local, no-key speech-to-text for automatic subtitles: spawn whisper.cpp
// (whisper-cli) on an audio/video file, parse its word-level JSON, and emit
// SRT/VTT through the SHARED captions.ts reflow (the same rules the cloud STT
// providers — ElevenLabs Scribe, Groq Whisper — run through, so local + cloud
// subtitles never drift on line-length / timing). Runs under Bun so it can
// import the `.ts` caption module directly (mirrors _svg-optimize.mjs).
//
// whisper.cpp is a SOFT dependency (plugins/design/dependencies.json): absent →
// this exits non-zero with an actionable message (install it, or use the cloud
// Scribe path). No dev server, no ffmpeg of our own — mirrors the footage-probe
// shim shape.
//
// Model + binary resolution (whisper.cpp ships neither a default model nor
// auto-download): `--model <path>` or $MAUDE_WHISPER_MODEL (a ggml .bin);
// `--whisper <path>` or $MAUDE_WHISPER_CLI, else whisper-cli / whisper / main.
//
// Stdout (last line): the produced .srt path. Stderr: progress/diagnostics.
// Exit: 0 ok / 1 dependency-or-input problem / 3 transcription failed.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

import { wordsToSrt, wordsToVtt } from '../generation/captions.ts';

/**
 * whisper.cpp `-oj` JSON → word timings. With `-ml 1` each `transcription[]`
 * entry is ~one word; `offsets.from/to` are milliseconds from the audio start.
 * Pure + exported so the parsing is unit-testable without whisper installed.
 */
export function whisperJsonToWords(jsonText) {
  let doc;
  try {
    doc = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const segs = Array.isArray(doc?.transcription) ? doc.transcription : [];
  const words = [];
  for (const s of segs) {
    const text = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!text) continue;
    const from = Number(s?.offsets?.from);
    const to = Number(s?.offsets?.to);
    words.push({
      text,
      start: Number.isFinite(from) ? from / 1000 : 0,
      end: Number.isFinite(to) ? to / 1000 : 0,
    });
  }
  return words;
}

function parseArgs(argv) {
  const out = { format: 'srt', words: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--source') out.source = next();
    else if (a === '--root') out.root = next();
    else if (a === '--out') out.out = next();
    else if (a === '--format') out.format = next(); // srt | vtt | both
    else if (a === '--model') out.model = next();
    else if (a === '--whisper') out.whisper = next();
    else if (a === '--lang') out.lang = next();
    else if (a === '--segments') out.words = false; // segment-level, not per-word
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function resolveWhisper(explicit) {
  // Security (Phase-2 ethical-hacker): do NOT include the bare name `main`
  // (whisper.cpp's legacy binary) in the fallback chain — it is one of the most
  // common executable names in the wild, and the probe below EXECUTES each
  // candidate (`--help`). A user running this inside an untrusted repo with `.`
  // on $PATH could otherwise auto-run a seeded `main`. Only the explicit
  // --whisper / $MAUDE_WHISPER_CLI (owner's own choice) and the specific
  // whisper-cli / whisper names are probed.
  const candidates = [explicit, process.env.MAUDE_WHISPER_CLI, 'whisper-cli', 'whisper'].filter(
    Boolean
  );
  for (const c of candidates) {
    const probe = spawnSync(c, ['--help'], { stdio: 'ignore' });
    if (!probe.error) return c;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stderr.write(
      'usage: maude design transcribe --source <assets/x.mp4|file> [--root <repo>]\n' +
        '  [--format srt|vtt|both] [--model <ggml.bin>] [--whisper <bin>] [--lang <code>] [--segments]\n'
    );
    process.exit(0);
  }
  if (!args.source) {
    process.stderr.write('transcribe: --source is required\n');
    process.exit(1);
  }

  const repo = args.root || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  // Resolve the input: an `assets/<name>` under the design root, or a plain path.
  // For the assets/ form, reject `..` so the content-addressed branch can't be
  // used to climb out of <designRoot>/assets/ (parity with api.readAssetBytes —
  // the network Scribe path is fully contained; keep this local path close). The
  // plain-path branch intentionally accepts an owner-named file (transcribing an
  // arbitrary local clip is a legitimate CLI use; there is no untrusted caller).
  if (args.source.startsWith('assets/') && args.source.includes('..')) {
    process.stderr.write('transcribe: invalid assets/ path (no "..")\n');
    process.exit(1);
  }
  const input = args.source.startsWith('assets/')
    ? join(repo, '.design', args.source)
    : resolve(repo, args.source);
  if (!existsSync(input)) {
    process.stderr.write(`transcribe: input not found: ${input}\n`);
    process.exit(1);
  }

  const whisper = resolveWhisper(args.whisper);
  if (!whisper) {
    process.stderr.write(
      'transcribe: whisper.cpp not found (whisper-cli / whisper / main).\n' +
        '  Install: brew install whisper-cpp  (or build https://github.com/ggml-org/whisper.cpp)\n' +
        '  Or set $MAUDE_WHISPER_CLI. For cloud STT instead, use ElevenLabs Scribe / Groq Whisper.\n'
    );
    process.exit(1);
  }

  const model = args.model || process.env.MAUDE_WHISPER_MODEL;
  if (!model || !existsSync(model)) {
    process.stderr.write(
      'transcribe: a whisper.cpp model is required (whisper.cpp has no default / auto-download).\n' +
        '  Pass --model <ggml-large-v3-turbo.bin> or set $MAUDE_WHISPER_MODEL.\n' +
        '  Download: https://huggingface.co/ggerganov/whisper.cpp (e.g. ggml-large-v3-turbo.bin)\n'
    );
    process.exit(1);
  }

  const outBase = args.out
    ? args.out.replace(/\.(srt|vtt|json)$/i, '')
    : join(dirname(input), basename(input, extname(input)));

  // whisper.cpp: JSON output for the shared reflow, `-ml 1` for word-level timings.
  const flags = ['-m', model, '-f', input, '-oj', '-of', outBase];
  if (args.words) flags.push('-ml', '1');
  if (args.lang) flags.push('-l', args.lang);

  process.stderr.write(`transcribe: running ${whisper} (${basename(model)})…\n`);
  const run = spawnSync(whisper, flags, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.status !== 0) {
    process.stderr.write(
      `transcribe: whisper.cpp exited ${run.status ?? '?'} — a non-WAV input may need an ffmpeg-enabled build (convert to 16kHz WAV first).\n`
    );
    process.exit(3);
  }

  const jsonPath = `${outBase}.json`;
  if (!existsSync(jsonPath)) {
    process.stderr.write(`transcribe: whisper produced no JSON at ${jsonPath}\n`);
    process.exit(3);
  }
  const words = whisperJsonToWords(readFileSync(jsonPath, 'utf8'));
  if (words.length === 0) {
    process.stderr.write('transcribe: no words recognized (silent or unsupported audio?)\n');
    process.exit(3);
  }

  const written = [];
  if (args.format === 'srt' || args.format === 'both') {
    const p = `${outBase}.srt`;
    writeFileSync(p, wordsToSrt(words));
    written.push(p);
  }
  if (args.format === 'vtt' || args.format === 'both') {
    const p = `${outBase}.vtt`;
    writeFileSync(p, wordsToVtt(words));
    written.push(p);
  }
  // Last stdout line = the primary (SRT-preferred) caption path, for $(…) capture.
  process.stdout.write(`${written[0]}\n`);
}

// Only run main when invoked directly (import.meta.main) so the parser can be
// imported by the test without spawning whisper (mirrors the F3 CLI-guard fix).
if (import.meta.main) main();
