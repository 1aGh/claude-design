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

import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
 * https + a `*.huggingface.co` host (ethical-hacker Finding 2); the body is
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
  // huggingface.co 302-redirects model blobs to its own LFS CDN, so we must
  // follow — but re-assert the FINAL hop is still https + a huggingface.co host
  // (ethical-hacker Finding 2): an open-redirect/on-path must not land the fetch
  // on an arbitrary host. A wall-clock timeout is layered by the caller's signal.
  const res = await fetch(url, { signal, redirect: 'follow' });
  try {
    const finalUrl = new URL(res.url || url);
    if (finalUrl.protocol !== 'https:' || !/(^|\.)huggingface\.co$/.test(finalUrl.hostname))
      throw new Error(`model download redirected off huggingface.co (${finalUrl.hostname})`);
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
