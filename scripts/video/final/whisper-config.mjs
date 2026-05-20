// Whisper.cpp config consumed by sub.mjs.
//
// Model choice rationale:
//   - medium.en (466 MB): English-only, token-level timestamps OK, ~10x real-time on Apple Silicon.
//     Best fit for maude marketing copy (English jargon: Claude, MCP, marketplace).
//   - large-v3 (2.9 GB): multilingual incl. Czech. Use when --lang=cs CLI flag is passed.
//
// WHISPER_PATH points at scripts/video/final/.whisper-cache/ which is gitignored.
// Model is downloaded lazily by sub.mjs on first run.

import path from 'node:path';

export const WHISPER_VERSION = '1.5.5';
export const WHISPER_PATH = path.join(process.cwd(), '.whisper-cache');

// Override via env: WHISPER_MODEL=large-v3 pnpm run caption
export const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium.en';

// Override via env: WHISPER_LANG=cs pnpm run caption
// 'en' is the safe default for the marketing demo's English copy.
export const WHISPER_LANG = process.env.WHISPER_LANG || 'en';
