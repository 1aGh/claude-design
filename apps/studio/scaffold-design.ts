// scaffold-design.ts — write a minimal, BOOTABLE `.design/` into a folder (Phase 28).
//
// Used by two native-app flows: "New project" (create a GitHub repo → init a local
// project) and the "open a repo with no Maude design system" fallback ("set it up?").
// It deliberately scaffolds only the MINIMUM the dev-server needs to boot (per
// context.ts the only hard requirement is a `.design/` dir; config needs just
// `name` + `designRoot`). A real design system is still created by /design:setup-ds
// (agent-driven) — this just gets the project to open instead of crash-looping.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const CONFIG_SCHEMA =
  'https://raw.githubusercontent.com/1aGh/maude/main/apps/studio/config.schema.json';

/** Whether `dir` is already a Maude project (has `.design/config.json`). */
export function hasDesign(dir: string): boolean {
  return existsSync(join(dir, '.design', 'config.json'));
}

export interface ScaffoldResult {
  ok: boolean;
  error?: string;
}

/** Scaffold a minimal bootable `.design/` (no design system yet). Refuses to
 *  clobber an existing project. `name` is the human project label. */
export function scaffoldDesign(dir: string, name?: string): ScaffoldResult {
  const designDir = join(dir, '.design');
  const configPath = join(designDir, 'config.json');
  if (existsSync(configPath)) {
    return { ok: false, error: 'This folder is already a Maude project.' };
  }
  const projectName = (name && name.trim()) || basename(dir) || 'Untitled';
  try {
    mkdirSync(join(designDir, 'ui'), { recursive: true });
    mkdirSync(join(designDir, 'system'), { recursive: true });
    const config = {
      $schema: CONFIG_SCHEMA,
      name: projectName,
      designRoot: '.design',
      canvasGroups: [
        { label: 'Design system', path: 'system' },
        { label: 'UI kit', path: 'ui' },
      ],
      designSystems: [],
      completenessProfile: 'standard',
    };
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    // Keep the empty group dirs in git so a fresh clone still has the structure.
    writeFileSync(join(designDir, 'ui', '.gitkeep'), '', 'utf8');
    writeFileSync(join(designDir, 'system', '.gitkeep'), '', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not set up the project.' };
  }
}
