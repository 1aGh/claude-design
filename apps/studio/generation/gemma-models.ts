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

/** Maude-managed venv for the mlx-vlm runtime. Lives next to the identity cache
 *  (`$XDG_CACHE_HOME/maude` else `~/.maude`) — re-creatable with one command, so
 *  cache-tier is fine. The install stays USER-RUN in a terminal (DDR-183: the
 *  runtime is a manual step), but pointing the command at a dedicated venv makes
 *  it PEP 668-proof (a bare `pip install` is refused by Homebrew/system Pythons)
 *  and gives the probe a well-known place to look, so the app picks the install
 *  up automatically. */
export function mlxVenvDir(): string {
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg && xdg.length > 0 ? join(xdg, 'maude') : join(homedir(), '.maude');
  return join(base, 'mlx-venv');
}

/** POSIX single-quote a path for a command the USER will paste into a shell.
 *  Double quotes would let `$(…)`, backticks and `"` inside $XDG_CACHE_HOME /
 *  $HOME survive into a command run unread; single quotes disarm everything but
 *  `'` itself, which is closed-escaped-reopened. */
function shellQuote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

/** The copy/paste one-liner the Settings card shows. Computed from the SAME path
 *  the probe checks, so the two can never drift. Returns null when the resolved
 *  path holds a newline or control char — no quoting makes a multi-line paste
 *  safe, so the card shows no command rather than a dangerous one. */
export function mlxInstallCommand(): string | null {
  const dir = mlxVenvDir();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing control chars is the point.
  if (/[\x00-\x1f\x7f]/.test(dir)) return null;
  return `python3 -m venv ${shellQuote(dir)} && ${shellQuote(join(dir, 'bin', 'pip'))} install -U mlx-vlm`;
}

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

/** Resolve a Python that can `import mlx_vlm`, or null. Order: explicit
 *  $MAUDE_MLX_PYTHON → the Maude-managed venv → PATH pythons. */
export function resolveMlxPython(): string | null {
  const venvPy = join(mlxVenvDir(), 'bin', 'python3');
  const candidates = [
    process.env.MAUDE_MLX_PYTHON,
    existsSync(venvPy) ? venvPy : null,
    'python3',
    'python',
  ].filter(Boolean) as string[];
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

// ─── Ollama alternative runtime ──────────────────────────────────────────────
// The scout can also run through a local Ollama server (gemma3 vision) — a far
// simpler install story than mlx-vlm for most people: one app, `ollama pull`,
// no Python. mlx stays preferred when both are present (it's the benchmarked
// path, DDR-183); Ollama is the accessible alternative.

/** The model the install/pull commands recommend (vision-capable, ~3.3 GB). */
export const OLLAMA_RECOMMENDED_MODEL = 'gemma3:4b';

/** Loopback-only literal hosts (mirrors the DDR-185 curl-local posture). No DNS
 *  names besides `localhost` — a resolvable name could point anywhere. */
export function isLoopbackHostname(hostname: string): boolean {
  const h = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127(\.\d{1,3}){3}$/.test(h);
}

/** Local Ollama endpoint. Honors $OLLAMA_HOST (with or without scheme) but pins
 *  it to loopback — the scout is egress-free by design (DDR-183): a remote/LAN
 *  Ollama would silently upload the user's video frames, and on the server side
 *  an unvalidated host would turn the probe route into an SSRF emitter. Returns
 *  null when the value isn't loopback. */
export function ollamaHost(): string | null {
  const raw = (process.env.OLLAMA_HOST || '').trim();
  if (!raw) return 'http://127.0.0.1:11434';
  const url = /^https?:\/\//.test(raw) ? raw.replace(/\/$/, '') : `http://${raw}`;
  try {
    return isLoopbackHostname(new URL(url).hostname) ? url : null;
  } catch {
    return null;
  }
}

export interface OllamaStatus {
  /** The server answered /api/tags. */
  available: boolean;
  /** A usable vision-capable gemma tag ($MAUDE_OLLAMA_MODEL wins), or null. */
  model: string | null;
}

/** Pick a vision-capable gemma tag from an /api/tags listing. gemma3:1b is
 *  text-only and gemma3n is not multimodal in Ollama — exclude both. */
export function pickOllamaGemmaTag(tags: string[]): string | null {
  const explicit = process.env.MAUDE_OLLAMA_MODEL;
  if (explicit && explicit.length > 0) return explicit;
  return tags.find((t) => /^gemma3:(?!1b)/.test(t) || t === 'gemma3') ?? null;
}

const ollamaCache = { at: 0, value: null as OllamaStatus | null };

export async function ollamaStatus(): Promise<OllamaStatus> {
  const now = Date.now();
  if (ollamaCache.value && now - ollamaCache.at < PROBE_TTL_MS) return ollamaCache.value;
  let value: OllamaStatus = { available: false, model: null };
  const host = ollamaHost(); // null = $OLLAMA_HOST steered off loopback — refused
  if (host) {
    try {
      // redirect: 'manual' — never follow a redirect off the pinned loopback host.
      const res = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(1500),
        redirect: 'manual',
      });
      if (res.ok && Number(res.headers.get('content-length') || 0) <= 1024 * 1024) {
        const body = (await res.json()) as { models?: Array<{ name?: string }> };
        const tags = (body.models ?? []).map((m) => m.name).filter(Boolean) as string[];
        value = { available: true, model: pickOllamaGemmaTag(tags) };
      }
    } catch {
      /* not running / not installed */
    }
  }
  ollamaCache.at = now;
  ollamaCache.value = value;
  return value;
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
