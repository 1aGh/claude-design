// generation/prefs.ts — read/write the NON-SECRET generation preferences in
// `.design/config.json` (Task 2.6, DDR-164). The Settings panel's transcription-
// engine selector persists here so the choice survives restarts and the
// `maude design transcribe` CLI reads the same default.
//
// SECRET-FREE by construction: this module only ever touches the `generation`
// block's non-secret routing/UI keys (provider ids, model ids, toggles). Keys
// live in the OS keychain / ~/.config/maude/keys.json — NEVER here. The writer
// preserves every other config field verbatim (additive merge over the parsed
// JSON), so a hand-authored config is never clobbered.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The transcription engines the selector offers (mirrors the config schema enum). */
export const TRANSCRIPTION_PROVIDERS = ['whisper', 'elevenlabs', 'groq'] as const;
export type TranscriptionProvider = (typeof TRANSCRIPTION_PROVIDERS)[number];

export function isTranscriptionProvider(v: unknown): v is TranscriptionProvider {
  return typeof v === 'string' && (TRANSCRIPTION_PROVIDERS as readonly string[]).includes(v);
}

function configPath(repoRoot: string): string {
  return join(repoRoot, '.design', 'config.json');
}

/** Parse `.design/config.json` (or {} when missing / unreadable). */
function readConfig(repoRoot: string): Record<string, unknown> {
  const p = configPath(repoRoot);
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The current transcription-engine preference, or 'whisper' (the default). */
export function readTranscriptionProvider(repoRoot: string): TranscriptionProvider {
  const cfg = readConfig(repoRoot);
  const gen = cfg.generation as Record<string, unknown> | undefined;
  const t = gen?.transcription as Record<string, unknown> | undefined;
  return isTranscriptionProvider(t?.provider) ? (t?.provider as TranscriptionProvider) : 'whisper';
}

/**
 * Persist the transcription-engine choice into `.design/config.json`, preserving
 * every other field. Returns true on a successful write. Throws on an invalid
 * provider (the route validates first, so this is a defensive guard).
 */
export async function writeTranscriptionProvider(
  repoRoot: string,
  provider: string
): Promise<boolean> {
  if (!isTranscriptionProvider(provider))
    throw new Error(`invalid transcription provider: ${provider}`);
  // Fail CLOSED on an existing-but-unparseable config: never overwrite a corrupt
  // file with a generation-only block (that would silently drop the user's other
  // settings). A MISSING file is fine — we start from {}. (Defender note, 2026-07-11.)
  const p = configPath(repoRoot);
  if (existsSync(p)) {
    try {
      JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      throw new Error(
        '.design/config.json is present but not valid JSON — fix it before changing generation prefs (refusing to overwrite it)'
      );
    }
  }
  const cfg = readConfig(repoRoot);
  const gen = (cfg.generation as Record<string, unknown>) ?? {};
  const transcription = (gen.transcription as Record<string, unknown>) ?? {};
  const next = {
    ...cfg,
    generation: { ...gen, transcription: { ...transcription, provider } },
  };
  await Bun.write(configPath(repoRoot), `${JSON.stringify(next, null, 2)}\n`);
  return true;
}
