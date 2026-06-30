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

// A neutral, token-free starter canvas seeded into `ui/` so a freshly-created project
// opens to a real artboard instead of an empty studio (the "empty-studio after Start a
// new project" onboarding gap). It depends ONLY on @maude/canvas-lib + inline styles —
// no design-system tokens — so it renders before /design:setup-ds exists. The button
// vocabulary mirrors the shipped GitPanel (Save version · Publish · Get latest).
const STARTER_CANVAS_TSX = `/**
 * @canvas   welcome · Your first canvas — seeded when a new Maude project is created.
 * @platform desktop
 * @stack    React 19 · TSX · Bun.build
 *
 * Neutral + token-free so it renders the moment the project is created — before
 * /design:setup-ds builds a design system. Edit it, replace it, or delete it once you
 * have your own canvases.
 */
import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

export default function Welcome() {
  return (
    <DesignCanvas>
      <DCSection id="welcome" title="Welcome to Maude" subtitle="START HERE">
        <DCArtboard id="welcome" label="WELCOME/01" width={680} height={440}>
          <div
            data-testid="welcome-artboard-content"
            style={{
              height: "100%",
              boxSizing: "border-box",
              padding: 48,
              display: "flex",
              flexDirection: "column",
              gap: 24,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color: "#16181d",
              background: "#fbfbfc",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a8f98" }}>
                Your first canvas
              </span>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 650 }}>
                You're in. This is a canvas.
              </h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#4a4f57", maxWidth: 460 }}>
                Everything you design lives on canvases like this one. Edit it, or start fresh —
                your work saves on its own, and you can version and share it without ever opening a terminal.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                ["Save version", "keep a checkpoint, just for you"],
                ["Publish", "share it with your team"],
                ["Get latest", "pull in everyone else's work"],
              ].map(([title, desc]) => (
                <div key={title} style={{ flex: 1, padding: 16, border: "1px solid #e6e7ea", borderRadius: 10, background: "#fff" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.4, color: "#6b7078" }}>{desc}</div>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#8a8f98" }}>
              Next: build a design system, or just start editing this canvas.
            </p>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
`;

const STARTER_CANVAS_META = {
  title: 'Welcome',
  subtitle: 'Your first canvas — seeded on project creation',
  brief:
    'Neutral, token-free welcome canvas written by scaffoldDesign() so a new project opens to a real artboard instead of an empty studio. Safe to edit or delete.',
  platform: 'desktop',
  sections: [
    {
      id: 'welcome',
      title: 'Welcome to Maude · START HERE',
      artboards: [{ id: 'welcome', label: 'WELCOME/01', width: 680, height: 440 }],
    },
  ],
  css_mode: 'inline',
  layout: { artboards: [{ id: 'welcome', x: 0, y: 0 }] },
};

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
    // Seed a starter canvas so the studio opens to a real artboard, not an empty list.
    writeFileSync(join(designDir, 'ui', 'Welcome.tsx'), STARTER_CANVAS_TSX, 'utf8');
    writeFileSync(
      join(designDir, 'ui', 'Welcome.meta.json'),
      `${JSON.stringify(STARTER_CANVAS_META, null, 2)}\n`,
      'utf8'
    );
    // `system/` is genuinely empty until /design:setup-ds — keep it in git.
    writeFileSync(join(designDir, 'system', '.gitkeep'), '', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not set up the project.' };
  }
}
