// gemma-models.test.ts — the pure helpers behind the Gemma scout's two runtimes
// (feature-scene-aware-keyframes / DDR-183). The download spawn + the live probes
// are soft-dep gates covered by manual runs; this covers what a security review
// found load-bearing: the copy/paste install command the user pastes UNREAD, and
// the loopback pin that keeps the scout egress-free.

import { afterEach, describe, expect, test } from 'bun:test';
import {
  getOllamaModel,
  isLoopbackHostname,
  listScoutModels,
  mlxInstallCommand,
  mlxSetup,
  mlxVenvDir,
  ollamaHost,
  ollamaSetupOptions,
  pickOllamaGemmaTag,
} from '../generation/gemma-models.ts';

const ENV_KEYS = ['XDG_CACHE_HOME', 'OLLAMA_HOST', 'MAUDE_OLLAMA_MODEL'] as const;
const saved = new Map<string, string | undefined>();
function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
});

describe('mlxVenvDir / mlxInstallCommand', () => {
  test('honors XDG_CACHE_HOME, else ~/.maude', () => {
    setEnv('XDG_CACHE_HOME', '/tmp/xdg');
    expect(mlxVenvDir()).toBe('/tmp/xdg/maude/mlx-venv');
    setEnv('XDG_CACHE_HOME', undefined);
    expect(mlxVenvDir()).toMatch(/\/\.maude\/mlx-venv$/);
  });

  test('the shown command targets the SAME path the probe checks', () => {
    setEnv('XDG_CACHE_HOME', '/tmp/xdg');
    const cmd = mlxInstallCommand();
    expect(cmd).toContain(mlxVenvDir());
    expect(cmd).toContain('python3 -m venv');
    expect(cmd).toContain('install -U mlx-vlm');
  });

  test('single-quotes the path so shell metacharacters cannot execute', () => {
    setEnv('XDG_CACHE_HOME', '/tmp/$(touch /tmp/pwned)/`id`/"x"');
    const cmd = mlxInstallCommand() ?? '';
    // The dangerous characters are present only INSIDE single quotes — the shell
    // expands nothing there.
    expect(cmd).toContain('\'/tmp/$(touch /tmp/pwned)/`id`/"x"/maude/mlx-venv\'');
    expect(cmd).not.toMatch(/"\/tmp\/\$\(/); // never inside double quotes
  });

  test('escapes an embedded single quote by closing, escaping, reopening', () => {
    setEnv('XDG_CACHE_HOME', "/tmp/it's");
    const cmd = mlxInstallCommand() ?? '';
    expect(cmd).toContain(`'/tmp/it'\\''s/maude/mlx-venv'`);
  });

  test('refuses to build a command when the path holds a control char', () => {
    setEnv('XDG_CACHE_HOME', '/tmp/a\nrm -rf ~');
    expect(mlxInstallCommand()).toBe(null);
  });
});

describe('ollamaHost — loopback pin (DDR-183 egress-free)', () => {
  test('defaults to loopback and accepts loopback forms', () => {
    setEnv('OLLAMA_HOST', undefined);
    expect(ollamaHost()).toBe('http://127.0.0.1:11434');
    setEnv('OLLAMA_HOST', '127.0.0.1:11434');
    expect(ollamaHost()).toBe('http://127.0.0.1:11434');
    setEnv('OLLAMA_HOST', 'http://localhost:11434/');
    expect(ollamaHost()).toBe('http://localhost:11434');
  });

  test('refuses every non-loopback host rather than uploading frames to it', () => {
    for (const host of [
      '0.0.0.0:11434',
      '192.168.1.20:11434',
      'http://169.254.169.254',
      'http://ollama.example.com',
      'not a url',
    ]) {
      setEnv('OLLAMA_HOST', host);
      expect(ollamaHost()).toBe(null);
    }
  });

  test('isLoopbackHostname accepts only literal loopback', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('127.1.2.3')).toBe(true);
    expect(isLoopbackHostname('::1')).toBe(true);
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1.evil.com')).toBe(false);
    expect(isLoopbackHostname('10.0.0.1')).toBe(false);
  });
});

// The card must never show an instruction this machine can't follow — the whole
// point of probing brew/python3/curl rather than hardcoding an install line.
describe('ollamaSetupOptions', () => {
  const notInstalled = { available: false, model: null, tags: [], installed: false };

  test('installed but not running → start it, never "install it" again', () => {
    const opts = ollamaSetupOptions({ ...notInstalled, installed: true });
    expect(opts.map((o) => o.id)).toEqual(['start']);
    expect(opts[0].command).toBe('ollama serve');
  });

  test('running → the only thing missing is a model', () => {
    const opts = ollamaSetupOptions({ available: true, model: null, tags: [], installed: true });
    expect(opts.map((o) => o.id)).toEqual(['pull']);
    expect(opts[0].command).toContain('ollama pull');
  });

  test('not installed → always offers a route, and a download link as the floor', () => {
    const opts = ollamaSetupOptions(notInstalled);
    expect(opts.length).toBeGreaterThan(0);
    const download = opts.find((o) => o.id === 'download');
    expect(download?.kind).toBe('link');
    expect(download?.url).toBe('https://ollama.com/download');
    // Whatever routes are offered, each is actionable as-is.
    for (const o of opts) expect(o.kind === 'command' ? o.command : o.url).toBeTruthy();
  });

  test('on macOS/Linux the brew-free script route comes before brew', () => {
    if (process.platform !== 'darwin' && process.platform !== 'linux') return;
    const ids = ollamaSetupOptions(notInstalled).map((o) => o.id);
    if (ids.includes('script') && ids.includes('brew'))
      expect(ids.indexOf('script')).toBeLessThan(ids.indexOf('brew'));
  });
});

// The model list has to be actionable on whatever runtime the machine has —
// a dead "Needs mlx-vlm" on an Ollama box was the bug this replaced.
describe('listScoutModels', () => {
  const offline = { available: false, model: null, tags: [], installed: false };
  const running = {
    available: true,
    model: 'gemma3:4b',
    tags: ['gemma3:4b', 'llama3:8b'],
    installed: true,
  };

  test('every model declares the runtime that can download it', () => {
    for (const m of listScoutModels(offline)) expect(['mlx', 'ollama']).toContain(m.runtime);
  });

  test('Ollama models sort first when Ollama is the runtime that can act', () => {
    expect(listScoutModels(running)[0].runtime).toBe('ollama');
    expect(listScoutModels(offline)[0].runtime).toBe('mlx');
  });

  test('an Ollama model counts as downloaded only on an EXACT tag match', () => {
    const rows = listScoutModels(running).filter((m) => m.runtime === 'ollama');
    expect(rows.find((m) => m.id === 'ollama:gemma3:4b')?.downloaded).toBe(true);
    expect(rows.find((m) => m.id === 'ollama:gemma3:12b')?.downloaded).toBe(false);
    // A near-miss tag is a different pull, not the same model.
    const nearMiss = listScoutModels({ ...running, tags: ['gemma3:4b-it-q4_K_M'] });
    expect(nearMiss.find((m) => m.id === 'ollama:gemma3:4b')?.downloaded).toBe(false);
  });

  test('getOllamaModel only resolves allowlisted ids (the pull target is frozen)', () => {
    expect(getOllamaModel('ollama:gemma3:4b')?.tag).toBe('gemma3:4b');
    expect(getOllamaModel('gemma-4-e4b-it-4bit')).toBe(null);
    expect(getOllamaModel('ollama:../../evil')).toBe(null);
    expect(getOllamaModel('ollama:llama3:8b')).toBe(null);
  });
});

describe('mlxSetup', () => {
  test('either a usable command or a stated reason — never a silent dead end', () => {
    const s = mlxSetup();
    if (s.supported) {
      expect(s.command).toContain('mlx-vlm');
      expect(s.reason).toBeUndefined();
    } else {
      expect(s.reason).toBeTruthy();
      expect(s.command).toBeUndefined();
    }
  });
});

// The CLI (bin/_smart-frames.mjs, pure JS — no .ts imports) deliberately carries
// its OWN copy of these helpers. That duplication is an accepted constraint, so
// the drift it invites needs a guard: a review already caught the two copies
// disagreeing about the bare `gemma3` tag.
describe('CLI ↔ server helper parity', () => {
  test('pickOllamaGemmaTag agrees on every tag shape', async () => {
    const cli = await import('../bin/_smart-frames.mjs');
    setEnv('MAUDE_OLLAMA_MODEL', undefined);
    for (const tags of [
      ['gemma3:4b'],
      ['gemma3'],
      ['gemma3:1b'],
      ['gemma3n:e4b'],
      ['llama3:8b', 'gemma3:12b'],
      [],
    ]) {
      expect(cli.pickOllamaGemmaTag(tags, {})).toBe(pickOllamaGemmaTag(tags));
    }
  });

  test('ollamaHost agrees on loopback acceptance and refusal', async () => {
    const cli = await import('../bin/_smart-frames.mjs');
    for (const host of [
      '127.0.0.1:11434',
      'http://localhost:11434/',
      '[::1]:11434',
      '0.0.0.0:11434',
      '192.168.1.20:11434',
      'http://ollama.example.com',
    ]) {
      setEnv('OLLAMA_HOST', host);
      expect(cli.ollamaHost({ OLLAMA_HOST: host })).toBe(ollamaHost());
    }
  });

  test('the venv path the CLI probes is the one the server installs into', async () => {
    const cli = await import('../bin/_smart-frames.mjs');
    setEnv('XDG_CACHE_HOME', '/tmp/xdg');
    expect(cli.mlxVenvPython({ XDG_CACHE_HOME: '/tmp/xdg' })).toBe(`${mlxVenvDir()}/bin/python3`);
  });
});

describe('pickOllamaGemmaTag', () => {
  test('picks a vision-capable gemma3 tag, skips text-only ones', () => {
    setEnv('MAUDE_OLLAMA_MODEL', undefined);
    expect(pickOllamaGemmaTag(['llama3:8b', 'gemma3:4b'])).toBe('gemma3:4b');
    expect(pickOllamaGemmaTag(['gemma3'])).toBe('gemma3');
    expect(pickOllamaGemmaTag(['gemma3:1b'])).toBe(null);
    expect(pickOllamaGemmaTag(['gemma3n:e4b'])).toBe(null);
  });

  test('$MAUDE_OLLAMA_MODEL wins verbatim', () => {
    setEnv('MAUDE_OLLAMA_MODEL', 'gemma3:27b');
    expect(pickOllamaGemmaTag(['gemma3:4b'])).toBe('gemma3:27b');
  });
});
