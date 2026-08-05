// generation/whisper-models.ts — managed local whisper.cpp GGML models (Task 2.7,
// approach A, DDR-164). The "one-click local subtitles" story WITHOUT a heavy
// WASM dependency: keep the fast native whisper.cpp engine, but remove the
// hand-fetch-a-ggml-from-Hugging-Face friction the owner hit in testing — a
// Settings button downloads a model into a Maude-managed, gitignored cache and
// `maude design transcribe --provider whisper` auto-resolves it (no --model).
//
// The whisper.cpp BINARY is still a soft dep (brew / build); this closes the
// MODEL half of the friction. Models live OUTSIDE any served project tree (a
// per-machine cache, re-downloadable), never in `.design/`, never committed.
//
// This module owns the model REGISTRY + dir + list/resolve (fs, server-side).
// The actual download (streamed, SSRF-hardened, progress-tracked) lives in the
// http route so the egress discipline sits next to the other provider egress.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cachedProbe, hasCommandCached, type SetupOption } from './runtime-probe.ts';

export interface WhisperModelDescriptor {
  /** Stable id used by the config + route (`base`, `base.en`, …). */
  id: string;
  /** The on-disk ggml filename. */
  file: string;
  label: string;
  /** Approximate download size, for the consent copy + the download size cap. */
  sizeMB: number;
  /** Multilingual vs English-only (the owner's Czech-footage gotcha: `.en`
   *  garbles non-English — surface this in the picker). */
  multilingual: boolean;
  note: string;
}

// The subset of ggerganov/whisper.cpp ggml models Maude offers. Kept small +
// curated (a fixed allowlist — the download URL is derived from `file`, never
// user input, so this is also the SSRF allowlist for the model host).
export const WHISPER_MODELS: readonly WhisperModelDescriptor[] = [
  {
    id: 'tiny',
    file: 'ggml-tiny.bin',
    label: 'Tiny (multilingual)',
    sizeMB: 75,
    multilingual: true,
    note: 'Fastest, lowest accuracy. Good for a quick draft in any language.',
  },
  {
    id: 'base',
    file: 'ggml-base.bin',
    label: 'Base (multilingual)',
    sizeMB: 142,
    multilingual: true,
    note: 'The recommended default — works in any language (incl. Czech). Modest accuracy.',
  },
  {
    id: 'base.en',
    file: 'ggml-base.en.bin',
    label: 'Base (English-only)',
    sizeMB: 142,
    multilingual: false,
    note: 'English audio only — do NOT use for other languages (it garbles them).',
  },
  {
    id: 'small',
    file: 'ggml-small.bin',
    label: 'Small (multilingual)',
    sizeMB: 466,
    multilingual: true,
    note: 'Noticeably more accurate than base, ~3× larger.',
  },
  {
    id: 'large-v3-turbo',
    file: 'ggml-large-v3-turbo.bin',
    label: 'Large v3 Turbo (multilingual)',
    sizeMB: 1560,
    multilingual: true,
    note: 'Best accuracy, ~1.5 GB. Slower and disk-heavy, but close to cloud quality.',
  },
];

const MODEL_HOST = 'https://huggingface.co';
const MODEL_REPO_PATH = '/ggerganov/whisper.cpp/resolve/main';

// Apex domains a model-download redirect is allowed to land on. `huggingface.co`
// is the classic Git-LFS CDN; `xethub.hf.co` is HF's newer Xet storage backend,
// which several repos (incl. ggerganov/whisper.cpp) have been migrated to — its
// edge nodes (e.g. `cas-bridge.xethub.hf.co`) are a different apex entirely, not
// a subdomain of huggingface.co. Anchored subdomain match only (never
// `includes()`), so `xethub.hf.co.evil.com` / `evilxethub.hf.co` still reject.
const ALLOWED_REDIRECT_APEXES = ['huggingface.co', 'xethub.hf.co'] as const;

function isAllowedRedirectHost(hostname: string): boolean {
  return ALLOWED_REDIRECT_APEXES.some((apex) => hostname === apex || hostname.endsWith(`.${apex}`));
}

/** The fixed, non-interpolated download URL for a model (SSRF-safe — the file
 *  comes from the frozen registry above, never from a request). */
export function whisperModelUrl(m: WhisperModelDescriptor): string {
  return `${MODEL_HOST}${MODEL_REPO_PATH}/${m.file}`;
}

export function getWhisperModel(id: unknown): WhisperModelDescriptor | null {
  return WHISPER_MODELS.find((m) => m.id === id) ?? null;
}

/** Maude-managed model cache dir — per-machine, gitignored, never in a project.
 *  XDG_CACHE_HOME-aware (falls back to ~/.cache), mirroring keys.ts's XDG logic
 *  but a CACHE location (large, re-downloadable) not a config one. */
export function whisperModelsDir(): string {
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.cache');
  return join(base, 'maude', 'whisper-models');
}

export interface WhisperModelStatus extends WhisperModelDescriptor {
  downloaded: boolean;
  /** Absolute path when downloaded. */
  path?: string;
  /** Actual on-disk bytes when downloaded (for the "Remove" affordance). */
  bytes?: number;
}

/** The absolute on-disk path a model WOULD live at (whether present or not). */
export function whisperModelPath(m: WhisperModelDescriptor): string {
  return join(whisperModelsDir(), m.file);
}

/** Every registered model + whether it's already downloaded. */
export function listWhisperModels(): WhisperModelStatus[] {
  return WHISPER_MODELS.map((m) => {
    const p = whisperModelPath(m);
    let downloaded = false;
    let bytes: number | undefined;
    try {
      const st = statSync(p);
      if (st.isFile() && st.size > 0) {
        downloaded = true;
        bytes = st.size;
      }
    } catch {
      /* not downloaded */
    }
    return { ...m, downloaded, ...(downloaded ? { path: p, bytes } : {}) };
  });
}

/**
 * Resolve a downloaded model's path for `maude design transcribe` (no --model
 * needed once one is downloaded). Preference order: the caller-preferred id
 * (from `generation.transcription.whisperModel`) → any downloaded MULTILINGUAL
 * model (safe for non-English) → any downloaded model → null.
 */
export function resolveWhisperModel(preferId?: string): string | null {
  const dir = whisperModelsDir();
  if (!existsSync(dir)) return null;
  let present: Set<string>;
  try {
    present = new Set(readdirSync(dir));
  } catch {
    return null;
  }
  const has = (m: WhisperModelDescriptor) => present.has(m.file);
  if (preferId) {
    const pref = getWhisperModel(preferId);
    if (pref && has(pref)) return join(dir, pref.file);
  }
  const multi = WHISPER_MODELS.find((m) => m.multilingual && has(m));
  if (multi) return join(dir, multi.file);
  const any = WHISPER_MODELS.find(has);
  return any ? join(dir, any.file) : null;
}

/**
 * Download one model into the managed cache, streamed with a progress callback
 * (Task 2.7). Egress discipline: the URL is derived from the FROZEN registry
 * (initial host is always huggingface.co, asserted https + fixed host); the
 * redirect the HF blob store issues is followed but the FINAL hop is re-asserted
 * https + a host on `ALLOWED_REDIRECT_APEXES` (`*.huggingface.co` for the
 * classic LFS CDN, `*.xethub.hf.co` for HF's newer Xet storage backend —
 * ethical-hacker Finding 2 plus the Xet-migration follow-up); the body is
 * size-capped per-chunk to the model's expected size (+20% margin) before it can
 * fill the disk; written to a `.part` temp and atomically renamed so a
 * partial/aborted download never looks complete. Pass an AbortSignal (a timeout)
 * so a stalled connection can't wedge the single download slot. Not a full
 * `_fetch-asset.mjs` (no resolved-IP private-range guard) — proportionate because
 * the host is pinned to HF and the route is loopback + same-origin only. Throws
 * on any failure (the temp file is cleaned up); the caller owns progress state.
 */
export async function downloadWhisperModel(
  id: string,
  onProgress: (received: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const m = getWhisperModel(id);
  if (!m) throw new Error(`unknown whisper model: ${id}`);
  const url = whisperModelUrl(m);
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('model URL must be https');
  if (u.hostname !== 'huggingface.co') throw new Error('model host not allowlisted');

  const dir = whisperModelsDir();
  await mkdir(dir, { recursive: true });
  const finalPath = join(dir, m.file);
  const tmpPath = `${finalPath}.part`;

  const cap = Math.ceil(m.sizeMB * 1.2) * 1024 * 1024; // expected size + 20% margin
  // huggingface.co 302-redirects model blobs to its own LFS/Xet CDN, so we must
  // follow — but re-assert the FINAL hop is still https + a host on
  // ALLOWED_REDIRECT_APEXES (ethical-hacker Finding 2): an open-redirect/on-path
  // must not land the fetch on an arbitrary host. A wall-clock timeout is
  // layered by the caller's signal.
  const res = await fetch(url, { signal, redirect: 'follow' });
  try {
    const finalUrl = new URL(res.url || url);
    if (finalUrl.protocol !== 'https:' || !isAllowedRedirectHost(finalUrl.hostname))
      throw new Error(`model download redirected off the allowed HF hosts (${finalUrl.hostname})`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('model download redirected')) throw err;
    throw new Error('model download resolved to an invalid URL');
  }
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap)
    throw new Error(`model larger than expected (${declared} > ${cap} bytes)`);
  const total = Number.isFinite(declared) && declared > 0 ? declared : m.sizeMB * 1024 * 1024;

  const body = res.body;
  if (!body) throw new Error('empty model response');
  const reader = body.getReader();
  const writer = Bun.file(tmpPath).writer();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > cap) throw new Error(`model exceeded ${cap} bytes`);
        writer.write(value);
        onProgress(received, total);
      }
    }
    await writer.end();
    if (received === 0) throw new Error('model download was empty');
    await rename(tmpPath, finalPath);
    return finalPath;
  } catch (err) {
    try {
      await writer.end();
    } catch {
      /* ignore */
    }
    await rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

/** Remove a downloaded model (reclaim disk). Returns true if a file was removed. */
export async function removeWhisperModel(id: string): Promise<boolean> {
  const m = getWhisperModel(id);
  if (!m) return false;
  const p = whisperModelPath(m);
  if (!existsSync(p)) return false;
  await rm(p, { force: true });
  return true;
}

// ─── Runtime detection + setup routes ────────────────────────────────────────
// The card used to print `brew install whisper-cpp` unconditionally and never
// checked whether the binary was actually there — so a machine without Homebrew
// got an instruction it couldn't follow, and nobody learned the engine was
// missing until a transcription failed.
//
// Unlike Ollama there is NO universal one-liner here: whisper.cpp's releases
// ship prebuilt binaries for Ubuntu and Windows but NOT macOS (the xcframework
// is an Xcode library, not a CLI), so on a Mac without brew the honest routes
// are a cloud engine (already supported, needs only a key) or a source build.

/** Resolve the whisper.cpp CLI, or null.
 *
 *  MUST stay byte-identical to `bin/_transcribe.mjs` `resolveWhisper()` — the
 *  card would otherwise claim an engine the transcriber can't find. That
 *  includes the security rule it documents: the bare name `main` is
 *  DELIBERATELY not probed (it's a common executable name and the probe
 *  EXECUTES each candidate, so `.` on $PATH inside an untrusted repo could
 *  auto-run a seeded `main`). */
export function resolveWhisperCli(): string | null {
  const candidates = [process.env.MAUDE_WHISPER_CLI, 'whisper-cli', 'whisper'].filter(
    Boolean
  ) as string[];
  for (const c of candidates) {
    const probe = spawnSync(c, ['--help'], { stdio: 'ignore' });
    if (!probe.error) return c;
  }
  return null;
}

export function whisperCliAvailable(): boolean {
  return cachedProbe('whisper-cli', () => resolveWhisperCli() !== null);
}

export interface WhisperSetup {
  /** The binary resolves — local transcription can actually run. */
  installed: boolean;
  /** Routes to get it, best first. Empty when it's already installed. */
  options: SetupOption[];
}

export function whisperSetup(): WhisperSetup {
  if (whisperCliAvailable()) return { installed: true, options: [] };
  const options: SetupOption[] = [];
  if (hasCommandCached('brew'))
    options.push({
      id: 'brew',
      kind: 'command',
      label: 'Install whisper.cpp with Homebrew',
      command: 'brew install whisper-cpp',
    });
  else
    options.push({
      id: 'cloud',
      kind: 'link',
      label: 'No Homebrew — a cloud engine needs no install at all',
      url: 'https://elevenlabs.io/app/settings/api-keys',
      note: 'Pick ElevenLabs Scribe or Groq above and paste a key. Audio is uploaded to that provider and billed to your account.',
    });
  options.push({
    id: 'source',
    kind: 'link',
    label: 'Build from source',
    url: 'https://github.com/ggml-org/whisper.cpp',
    note: 'whisper.cpp ships prebuilt binaries for Linux and Windows, but not macOS — a Mac build needs cmake + Xcode command-line tools.',
  });
  return { installed: false, options };
}

// ─── Automatic engine choice ─────────────────────────────────────────────────
// Task 2.6 / DDR-164 made the engine an EXPLICIT choice because a silent
// fallback to a cloud engine has two consequences the user never asked for:
// their audio leaves the machine, and their account is billed. That rule is
// kept — what changes is that "auto" becomes a choice the user can MAKE, and
// one that always SAYS what it currently resolves to (in this card and in the
// transcriber's own output). Nothing switches behind your back; `auto` is a
// selected mode, not a hidden default override.
//
// The bite worth knowing: one ElevenLabs key covers audio generation AND
// Scribe, so a key added for music/TTS is enough to make `auto` route
// transcription to the cloud. That's why the card states the resolution
// out loud and pinning `whisper` stays one click away.

export type TranscriptionEngine = 'auto' | 'whisper' | 'elevenlabs' | 'groq';

export interface AutoEngineResolution {
  /** What `auto` picks right now. */
  engine: Exclude<TranscriptionEngine, 'auto'>;
  /** Why — rendered verbatim so the choice is never a mystery. */
  reason: string;
  /** True when the resolved engine uploads audio and bills a provider. */
  cloud: boolean;
}

/**
 * Resolve `auto`: prefer the cloud engine whose key is present (ElevenLabs
 * Scribe first — better accuracy than a local base model), else local
 * whisper.cpp. `configured` is the set of providers holding a key, passed in so
 * this stays a pure function (the keychain read is the caller's).
 */
export function resolveAutoEngine(
  configured: Iterable<string>,
  whisperInstalled: boolean
): AutoEngineResolution {
  const keys = new Set(configured);
  if (keys.has('elevenlabs'))
    return {
      engine: 'elevenlabs',
      reason: 'ElevenLabs key is set — Scribe is more accurate than a local base model.',
      cloud: true,
    };
  if (keys.has('groq'))
    return { engine: 'groq', reason: 'Groq key is set — fast cloud transcription.', cloud: true };
  return {
    engine: 'whisper',
    reason: whisperInstalled
      ? 'No cloud key set — using local whisper.cpp (free, offline, nothing leaves this machine).'
      : 'No cloud key set — will use local whisper.cpp once its binary is installed.',
    cloud: false,
  };
}
