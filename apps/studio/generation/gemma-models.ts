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
import { cachedProbe, hasCommandCached, type SetupOption } from './runtime-probe.ts';

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
// The TTL cache + PATH probe live in runtime-probe.ts — shared with the whisper
// stack, which has the same "never print an impossible instruction" problem.
const PROBE_TTL_MS = 30_000;

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
  /** Every tag the local server has (drives the per-model "downloaded" state). */
  tags: string[];
  /** The `ollama` binary is on PATH. Installed-but-not-running is a DIFFERENT
   *  state from not-installed, and it needs the opposite advice ("start it",
   *  not "install it") — the card would otherwise tell you to reinstall
   *  software you already have. */
  installed: boolean;
}

// Curated allowlist of Ollama scout models, mirroring GEMMA_MODELS for the mlx
// runtime. The tag is the frozen pull target — NEVER user input, so the pull
// can't be steered at an arbitrary repo. Ids are namespaced so one route can
// serve both runtimes without ambiguity.
export const OLLAMA_MODELS = [
  {
    id: 'ollama:gemma3:4b',
    tag: 'gemma3:4b',
    label: 'Gemma 3 4B (Ollama)',
    sizeMB: 3300,
    note: 'The recommended Ollama scout. ~3.3 GB. Pulled and managed by Ollama.',
  },
  {
    id: 'ollama:gemma3:12b',
    tag: 'gemma3:12b',
    label: 'Gemma 3 12B (Ollama)',
    sizeMB: 8100,
    note: 'Sharper beats, needs more RAM. ~8.1 GB.',
  },
] as const;

export function getOllamaModel(id: unknown): (typeof OLLAMA_MODELS)[number] | null {
  return OLLAMA_MODELS.find((m) => m.id === id) ?? null;
}

/** The scout models offered for BOTH runtimes, each tagged with the runtime it
 *  belongs to and whether it's already on disk — so one Settings list can show
 *  "download" against whichever runtime the machine actually has. */
export function listScoutModels(status: OllamaStatus) {
  const mlx = listGemmaModels().map((m) => ({ ...m, runtime: 'mlx' as const }));
  const ollama = OLLAMA_MODELS.map((m) => ({
    ...m,
    runtime: 'ollama' as const,
    // An exact tag match; `gemma3:4b` and `gemma3:4b-it-q4_K_M` are different pulls.
    downloaded: status.tags.includes(m.tag),
  }));
  // Ollama first when it's the runtime that can actually act on a click.
  return status.available ? [...ollama, ...mlx] : [...mlx, ...ollama];
}

/**
 * Pull a model through the local Ollama server (`POST /api/pull`, NDJSON
 * progress stream). Same egress discipline as everything else here: the host is
 * loopback-pinned, redirects are refused, and the tag comes from the frozen
 * allowlist — never from the request body.
 */
export async function pullOllamaModel(
  id: string,
  onProgress: (received: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const m = getOllamaModel(id);
  if (!m) throw new Error(`unknown ollama model: ${id}`);
  const host = ollamaHost();
  if (!host) throw new Error('OLLAMA_HOST is not a loopback address — refusing to pull');

  const res = await fetch(`${host}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: m.tag, stream: true }),
    redirect: 'manual',
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`ollama pull failed (HTTP ${res.status})`);

  // NDJSON: {"status":"pulling …","total":N,"completed":M} … {"status":"success"}
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let ok = false;
  let lastErr = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as {
          status?: string;
          total?: number;
          completed?: number;
          error?: string;
        };
        if (ev.error) lastErr = ev.error;
        if (typeof ev.total === 'number' && ev.total > 0)
          onProgress(Math.min(ev.total, ev.completed ?? 0), ev.total);
        if (ev.status === 'success') ok = true;
      } catch {
        /* a partial/garbage line — the next read completes it */
      }
    }
  }
  if (!ok) throw new Error(lastErr || 'ollama pull did not report success');
}

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

/**
 * The install routes that actually work on THIS machine, best first.
 *
 * The point is to never show an impossible instruction: `brew install` is noise
 * without Homebrew, and the venv one-liner is noise without python3. The
 * universal fallback is Ollama's official install script, which handles macOS
 * AND Linux (on macOS it fetches Ollama-darwin.zip into /Applications) and needs
 * only curl — present on both by default, so it works where brew doesn't.
 */
export function ollamaSetupOptions(status: OllamaStatus): SetupOption[] {
  const opts: SetupOption[] = [];
  if (status.installed && !status.available) {
    opts.push({
      id: 'start',
      kind: 'command',
      label: 'Ollama is installed but not running — start it',
      command: 'ollama serve',
      note: 'Or just open the Ollama app; it runs in the menu bar.',
    });
    return opts;
  }
  if (status.available) {
    opts.push({
      id: 'pull',
      kind: 'command',
      label: 'Ollama is running — it just needs a vision model',
      command: `ollama pull ${OLLAMA_RECOMMENDED_MODEL}`,
    });
    return opts;
  }
  const plat = process.platform;
  if ((plat === 'darwin' || plat === 'linux') && hasCommandCached('curl'))
    opts.push({
      id: 'script',
      kind: 'command',
      label: 'Install Ollama (official script — no Homebrew needed)',
      command: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull ${OLLAMA_RECOMMENDED_MODEL}`,
      note: 'Works on macOS and Linux; needs only curl.',
    });
  if (plat === 'darwin' && hasCommandCached('brew'))
    opts.push({
      id: 'brew',
      kind: 'command',
      label: 'Install with Homebrew',
      command: `brew install ollama && brew services start ollama && ollama pull ${OLLAMA_RECOMMENDED_MODEL}`,
    });
  opts.push({
    id: 'download',
    kind: 'link',
    label: 'Download the Ollama app',
    url: OLLAMA_DOWNLOAD_URL,
    note: `Then run \`ollama pull ${OLLAMA_RECOMMENDED_MODEL}\` in a terminal.`,
  });
  return opts;
}

/** The mlx-vlm half, which only exists on Apple Silicon and only when a python3
 *  is around to build the venv with. Returns the reason when it can't run, so
 *  the card can say why instead of showing a command that would fail. */
export function mlxSetup(): { supported: boolean; reason?: string; command?: string } {
  if (process.platform !== 'darwin')
    return { supported: false, reason: 'mlx-vlm is Apple-Silicon only — use Ollama instead.' };
  if (process.arch !== 'arm64')
    return {
      supported: false,
      reason: 'mlx needs Apple Silicon (this Mac is Intel) — use Ollama instead.',
    };
  if (!hasCommandCached('python3'))
    return {
      supported: false,
      reason: 'No python3 on PATH — install Python 3, or just use Ollama (no Python needed).',
    };
  const command = mlxInstallCommand();
  if (!command)
    return {
      supported: false,
      reason: 'Can’t build a safe install command for this machine’s cache path — use Ollama.',
    };
  return { supported: true, command };
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
  let value: OllamaStatus = {
    available: false,
    model: null,
    tags: [],
    installed: hasCommandCached('ollama'),
  };
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
        value = { ...value, available: true, tags, model: pickOllamaGemmaTag(tags) };
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
