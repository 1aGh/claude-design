// generation/gemma-models.ts — managed local Gemma-4 MLX models for the `gemma`
// tier of `maude design smart-frames` (feature-scene-aware-keyframes). The
// "one-click Gemma scout" story, mirroring whisper-models.ts — but with three
// real differences from whisper:
//
//   1. Apple-Silicon only. The scout runs through mlx-vlm (a Python package); the
//      model is useless without it. So the download is GATED on `mlxVlmAvailable`.
//   2. Multi-file HF snapshot, not a single .bin. mlx-vlm resolves a model from the
//      standard HuggingFace hub cache, so we download THERE (via huggingface_hub,
//      a transitive dep of mlx-vlm) rather than a Maude-private cache — otherwise
//      mlx-vlm wouldn't find it. "downloaded" = the snapshot is in the HF cache.
//   3. The RUNTIME (mlx-vlm itself) is a manual `pip install` the app can't do for
//      you — the Settings card says so and only the MODEL half is one click.
//
// This module owns the registry + availability probes + the HF-cache-aware
// downloaded check + resolve. The download SPAWN lives here (it shells the mlx
// Python's huggingface_hub); the http route wraps it with progress state, next to
// the other provider egress.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface GemmaModelDescriptor {
  /** Stable id used by the pref + route. */
  id: string;
  /** The mlx-community HF repo (also the `--model` mlx-vlm resolves). */
  repo: string;
  /** Pinned commit SHA — the download fetches THIS revision, never floating `main`,
   *  so a poisoned-main / namespace-reuse push can't land arbitrary model files
   *  (DDR-183 supply-chain finding; the whisper baseline pins exact file URLs). */
  revision: string;
  label: string;
  /** Approximate on-disk size (consent copy). */
  sizeMB: number;
  note: string;
}

// Curated allowlist of Gemma-4 MLX scout models. `repo` + `revision` are the frozen
// download target (never user input). e4b is the default (better beats); e2b is the
// small, fast option for lower-RAM Macs. Revisions pinned 2026-07-16.
export const GEMMA_MODELS: readonly GemmaModelDescriptor[] = [
  {
    id: 'gemma-4-e4b-it-4bit',
    repo: 'mlx-community/gemma-4-e4b-it-4bit',
    revision: '475b9088d29754a3379866cf5aeb6b41acd313c2',
    label: 'Gemma 4 E4B (4-bit)',
    sizeMB: 3300,
    note: 'The recommended scout — best semantic beats. ~3.3 GB. Needs an Apple-Silicon Mac + mlx-vlm.',
  },
  {
    id: 'gemma-4-e2b-it-4bit',
    repo: 'mlx-community/gemma-4-e2b-it-4bit',
    revision: '238767527555cb75a05732a84dff5d6ba0dd6809',
    label: 'Gemma 4 E2B (4-bit)',
    sizeMB: 1900,
    note: 'Smaller/faster, coarser beats. ~1.9 GB. Good for 16 GB Macs.',
  },
];

export function getGemmaModel(id: unknown): GemmaModelDescriptor | null {
  return GEMMA_MODELS.find((m) => m.id === id) ?? null;
}

/** The HuggingFace hub cache dir mlx-vlm resolves models from (HF_HOME-aware). */
export function hfHubDir(): string {
  const hfHome = process.env.HF_HOME;
  if (hfHome && hfHome.length > 0) return join(hfHome, 'hub');
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'huggingface', 'hub');
}

/** HF snapshot dir name for a repo: `models--<org>--<name>`. */
function repoCacheDir(repo: string): string {
  return join(hfHubDir(), `models--${repo.replace('/', '--')}`);
}

/** A model counts as downloaded when its HF snapshot dir has a non-empty snapshot. */
export function gemmaModelDownloaded(m: GemmaModelDescriptor): boolean {
  const snaps = join(repoCacheDir(m.repo), 'snapshots');
  try {
    if (!existsSync(snaps)) return false;
    for (const rev of readdirSync(snaps)) {
      const revDir = join(snaps, rev);
      try {
        if (statSync(revDir).isDirectory() && readdirSync(revDir).length > 0) return true;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* not downloaded */
  }
  return false;
}

export interface GemmaModelStatus extends GemmaModelDescriptor {
  downloaded: boolean;
}

export function listGemmaModels(): GemmaModelStatus[] {
  return GEMMA_MODELS.map((m) => ({ ...m, downloaded: gemmaModelDownloaded(m) }));
}

/** Resolve a Python that can `import mlx_vlm` (honors $MAUDE_MLX_PYTHON), or null. */
export function resolveMlxPython(): string | null {
  const candidates = [process.env.MAUDE_MLX_PYTHON, 'python3', 'python'].filter(
    Boolean
  ) as string[];
  for (const py of candidates) {
    const r = spawnSync(py, ['-c', 'import mlx_vlm'], { stdio: 'ignore' });
    if (r.status === 0) return py;
  }
  return null;
}

// Availability probes spawn subprocesses (importing mlx_vlm can take hundreds of ms
// to seconds). The GET /_api/generate/keyframe-model route is un-CSRF-gated (correct
// for a read), so a cross-origin drive-by could hammer it and stall the single-
// threaded Bun event loop on synchronous spawns (security-auditor DDR-183 finding).
// Memoize with a short TTL: DoS-bounded to at most one probe per PROBE_TTL_MS
// regardless of request rate, while still picking up a mid-session `pip install` /
// PATH change within the TTL.
const PROBE_TTL_MS = 30_000;
const probeCache = new Map<string, { at: number; value: boolean }>();

function cachedProbe(key: string, compute: () => boolean): boolean {
  const now = Date.now();
  const hit = probeCache.get(key);
  if (hit && now - hit.at < PROBE_TTL_MS) return hit.value;
  const value = compute();
  probeCache.set(key, { at: now, value });
  return value;
}

export function mlxVlmAvailable(): boolean {
  return cachedProbe('mlx', () => resolveMlxPython() !== null);
}

export function ffmpegAvailable(): boolean {
  return cachedProbe('ffmpeg', () => {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    return (
      spawnSync(finder, ['ffmpeg'], { stdio: 'ignore' }).status === 0 &&
      spawnSync(finder, ['ffprobe'], { stdio: 'ignore' }).status === 0
    );
  });
}

/**
 * Download a Gemma model into the HF hub cache via huggingface_hub (a transitive
 * dep of mlx-vlm, so it's present whenever the scout can actually run). We delegate
 * to Python rather than reimplement multi-file HF snapshot download + LFS/Xet
 * redirect handling in TS — the repo id is frozen (never user input), the runtime
 * is pinned to the mlx Python, and the route is loopback + same-origin only.
 * Progress is coarse (tqdm on stderr → a heartbeat), which the route surfaces as an
 * in-flight state. Rejects if mlx-vlm/Python is absent (you couldn't run the model
 * anyway) or the process exits non-zero.
 */
export function downloadGemmaModel(
  id: string,
  onProgress: (received: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const m = getGemmaModel(id);
  if (!m) return Promise.reject(new Error(`unknown gemma model: ${id}`));
  const py = resolveMlxPython();
  if (!py)
    return Promise.reject(
      new Error(
        'mlx-vlm not installed — the Gemma scout needs an Apple-Silicon Mac + `pip install mlx-vlm`.'
      )
    );

  // Refuse a steered HF endpoint (mirror/redirect) — the whisper path pins the host;
  // huggingface_hub otherwise honors HF_ENDPOINT/HF_HUB_ENDPOINT. Keep the pull on
  // the canonical hub (DDR-183 supply-chain finding).
  const endpoint = process.env.HF_ENDPOINT || process.env.HF_HUB_ENDPOINT;
  if (endpoint && !/^https:\/\/huggingface\.co\/?$/.test(endpoint))
    return Promise.reject(new Error(`refusing model download: HF endpoint steered to ${endpoint}`));

  const total = m.sizeMB * 1024 * 1024;
  return new Promise((resolve, reject) => {
    // snapshot_download(repo, revision=<pinned sha>) — repo AND revision are from the
    // frozen registry (never user input), passed as argv (not interpolated into -c).
    const child = spawn(
      py,
      [
        '-c',
        'import sys; from huggingface_hub import snapshot_download; snapshot_download(sys.argv[1], revision=sys.argv[2])',
        m.repo,
        m.revision,
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, HF_HUB_DISABLE_TELEMETRY: '1' },
      }
    );
    let received = 0;
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort, { once: true });
    // tqdm writes percentage lines to stderr; use them as a coarse heartbeat.
    child.stderr?.on('data', (buf: Buffer) => {
      const s = buf.toString();
      const pct = /(\d{1,3})%/.exec(s);
      if (pct) received = Math.min(total, Math.round((Number(pct[1]) / 100) * total));
      onProgress(received, total);
    });
    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === 0 && gemmaModelDownloaded(m)) {
        onProgress(total, total);
        resolve();
      } else {
        reject(new Error(`gemma model download failed (exit ${code})`));
      }
    });
  });
}
