// Shared Context object passed to each module's factory.
// Owns config + paths + a tiny pub-sub bus the modules use to talk without
// importing each other. Stateless beyond that — per-conn data lives on Bun's
// ws.data, per-request state on the Bun.serve context.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type ConfigSource = '.design/config.json' | 'defaults' | 'defaults (config invalid)';

export interface CanvasGroup {
  label: string;
  path: string;
}

export interface DesignSystemEntry {
  name: string;
  path: string;
  description?: string;
  tokensCssRel?: string;
  rootClass?: string;
  themeDefault?: 'dark' | 'light';
  themes?: string[];
  newCanvasDir?: string;
  newComponentDir?: string;
}

export interface DevServerConfig {
  name: string;
  projectLabel: string | null;
  designRoot: string;
  canvasGroups: CanvasGroup[];
  designSystems?: DesignSystemEntry[];
  rootClass: string;
  themeDefault: 'dark' | 'light';
  tokensCssRel: string;
  teamAccentDefault: string | null;
  handoffTargets: unknown[];
  newCanvasDir: string;
  newComponentDir: string;
  _source: ConfigSource;
}

const DEFAULT_CONFIG: Omit<DevServerConfig, '_source'> = {
  name: 'Design',
  projectLabel: null,
  designRoot: '.design',
  canvasGroups: [
    { label: 'Design system', path: 'system' },
    { label: 'Canvases', path: 'ui' },
  ],
  rootClass: 'app',
  themeDefault: 'dark',
  tokensCssRel: 'system/colors_and_type.css',
  teamAccentDefault: null,
  handoffTargets: [],
  newCanvasDir: 'ui',
  newComponentDir: 'ui/components',
};

export interface Paths {
  repoRoot: string;
  designRel: string;
  designRoot: string;
  serverInfoFile: string;
  activeFile: string;
  commentsDir: string;
  canvasStateDir: string;
  historyDir: string;
  tokensUrlRel: string;
  systemDirRel: string;
}

// Tiny pub-sub bus. Lazy — modules subscribe with on('selected', fn) and emit
// the matching event. Avoids cycling imports between inspect.ts <-> ws.ts.
export interface Bus {
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous pubsub — subscribers annotate their own payload shape.
  on(evt: string, fn: (payload: any) => void): () => void;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous pubsub — emitters supply their own payload shape.
  emit(evt: string, payload?: any): void;
}

export function createBus(): Bus {
  // biome-ignore lint/suspicious/noExplicitAny: subscribers are typed at the call site; the bus stores the erased type.
  const subs = new Map<string, Set<(p: any) => void>>();
  return {
    on(evt, fn) {
      const set = subs.get(evt) ?? new Set();
      set.add(fn);
      subs.set(evt, set);
      return () => set.delete(fn);
    },
    emit(evt, payload) {
      const set = subs.get(evt);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[bus] subscriber for ${evt} threw:`, err);
        }
      }
    },
  };
}

export interface Context {
  cfg: DevServerConfig;
  projectLabel: string;
  paths: Paths;
  bus: Bus;
}

function resolveRepoRoot(): string {
  const i = process.argv.indexOf('--root');
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return process.cwd();
}

function loadConfig(repoRoot: string): DevServerConfig {
  const configPath = path.join(repoRoot, '.design', 'config.json');
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return { ...DEFAULT_CONFIG, _source: 'defaults' };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, _source: '.design/config.json' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  warn: ${configPath} is not valid JSON: ${msg}. Using defaults.`);
    return { ...DEFAULT_CONFIG, _source: 'defaults (config invalid)' };
  }
}

export function createContext(): Context {
  const repoRoot = resolveRepoRoot();

  // Fail loud if launched from a directory that has no .design/ — preserves the
  // load-bearing diagnostic from server.mjs: silent fallback to defaults masks
  // "wrong project root" bugs.
  if (!existsSync(path.join(repoRoot, '.design'))) {
    console.error(`  error: no .design/ directory at ${repoRoot}`);
    console.error('  Run from your project root, set $CLAUDE_PROJECT_DIR, or pass --root <path>.');
    process.exit(1);
  }

  const cfg = loadConfig(repoRoot);
  const designRel = cfg.designRoot.replace(/^\/+|\/+$/g, '');
  const designRoot = path.join(repoRoot, designRel);
  const systemDirRel = cfg.canvasGroups.find((g) => /system/i.test(g.path))?.path ?? 'system';

  return {
    cfg,
    projectLabel: cfg.projectLabel || `${cfg.name} Design`,
    paths: {
      repoRoot,
      designRel,
      designRoot,
      serverInfoFile: path.join(designRoot, '_server.json'),
      activeFile: path.join(designRoot, '_active.json'),
      commentsDir: path.join(designRoot, '_comments'),
      canvasStateDir: path.join(designRoot, '_canvas-state'),
      historyDir: path.join(designRoot, '_history'),
      tokensUrlRel: path.posix.join(designRel, cfg.tokensCssRel.replace(/^\/+/, '')),
      systemDirRel,
    },
    bus: createBus(),
  };
}
