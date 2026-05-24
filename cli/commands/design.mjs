import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';

const SUBCOMMANDS = new Set(['serve', 'init', 'export', 'help']);

export async function run({ args, pkgRoot }) {
  const { positional } = parseArgs(args);
  const sub = positional[0];

  if (!sub || sub === 'help') {
    process.stdout.write(usage());
    return;
  }

  if (!SUBCOMMANDS.has(sub)) {
    process.stderr.write(`maude design: unknown subcommand "${sub}"\n${usage()}`);
    process.exit(2);
  }

  if (sub === 'serve') {
    return runServe({ args, pkgRoot });
  }
  if (sub === 'init') {
    return runInit({ args, pkgRoot });
  }
  if (sub === 'export') {
    return runExport({ args });
  }
}

function usage() {
  return `maude design <serve|init|export> [options]

  serve [--port N] [--root PATH]
        Start the design plugin's dev server in the current repo. Equivalent
        to invoking 'claude-design-server'. Forwards all remaining args.

  init  [--name <slug>] [--ds <name>] [--force] [--dry-run]
        [--no-discovery | --discovery-payload <path>]
        Non-interactive scaffold helper. Writes Core files from the
        design-system-inspiration library into .design/ in the current repo.
        Refuses to run without --no-discovery or --discovery-payload (interactive
        bootstrap requires Claude Code: use /design:setup-ds <name> there).

        --no-discovery scaffolds Core only (~10 files) with default tokens.
        --discovery-payload <path> reads a JSON file with answers + tokens and
        scaffolds Core + the derived specimens deterministically (this is the
        path skill 'design-system' uses when shelling out from Claude Code).

  export <format> [--scope selection|artboard|canvas-as-separate|project-raw]
         [--port N] [--out <path>] [--option key=value ...]
        Drive the same POST /_api/export endpoint the UI uses. Auto-detects
        port from .design/_server.json; requires a running dev server. The
        response body is written to --out (default: current dir, server-
        supplied filename). Formats: png pdf svg html pptx canva zip.
`;
}

async function runServe({ args, pkgRoot }) {
  const forwarded = args.slice(args.indexOf('serve') + 1);

  // Resolution order:
  //   1. Side-channel from postinstall (cli/.platform-binary-path) — direct
  //      native exec, zero Node startup tax. DDR-015.
  //   2. Bun + server.ts (local dev or postinstall-skipped install).
  //   3. Legacy server.mjs on Node — last-resort fallback for boxes without
  //      bun. Should only fire mid-migration; removed in v1.0.
  const sideChannel = resolve(pkgRoot, 'cli', '.platform-binary-path');
  let binPath = null;
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    if (existsSync(sideChannel)) {
      const candidate = readFileSync(sideChannel, 'utf8').trim();
      if (candidate && existsSync(candidate)) binPath = candidate;
    }
  } catch {
    /* fall through */
  }

  if (binPath) {
    const child = spawn(binPath, forwarded, { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => process.exit(code ?? 0));
    child.on('error', (err) => {
      process.stderr.write(`maude design serve (binary ${binPath}): ${err.message}\n`);
      process.exit(1);
    });
    return;
  }

  const tsEntry = resolve(pkgRoot, 'plugins', 'design', 'dev-server', 'server.ts');
  const mjsEntry = resolve(pkgRoot, 'plugins', 'design', 'dev-server', 'server.mjs');

  const hasBun = await new Promise((res) => {
    const probe = spawn('bun', ['--version'], { stdio: 'ignore' });
    probe.on('error', () => res(false));
    probe.on('exit', (code) => res(code === 0));
  });

  const child = hasBun
    ? spawn('bun', ['run', tsEntry, ...forwarded], { stdio: 'inherit', env: process.env })
    : spawn(process.execPath, [mjsEntry, ...forwarded], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    process.stderr.write(`maude design serve: ${err.message}\n`);
    process.exit(1);
  });
}

async function runExport({ args }) {
  // `maude design export <format> [--scope ...] [--port N] [--out <path>] [--option key=value]`
  const subArgs = args.slice(args.indexOf('export') + 1);
  const { positional, flags } = parseArgs(subArgs, {
    booleans: ['help'],
  });
  if (flags.help) {
    process.stdout.write(usage());
    return;
  }

  const format = positional[0];
  const VALID_FORMATS = new Set(['png', 'pdf', 'svg', 'html', 'pptx', 'canva', 'zip']);
  if (!format || !VALID_FORMATS.has(format)) {
    process.stderr.write(
      `maude design export: missing or unknown <format>. Try one of: ${Array.from(VALID_FORMATS).join(', ')}\n`
    );
    process.exit(2);
  }

  const scope = flags.scope ?? 'canvas-as-separate';
  const VALID_SCOPES = new Set(['selection', 'artboard', 'canvas-as-separate', 'project-raw']);
  if (!VALID_SCOPES.has(scope)) {
    process.stderr.write(`maude design export: unknown --scope "${scope}"\n`);
    process.exit(2);
  }

  // Resolve port: --port > .design/_server.json
  let port = flags.port ? Number(flags.port) : null;
  if (!port) {
    try {
      const raw = await readFile(resolve(process.cwd(), '.design', '_server.json'), 'utf8');
      port = JSON.parse(raw).port;
    } catch {
      /* no server.json — handled below */
    }
  }
  if (!port) {
    process.stderr.write(
      'maude design export: no --port given and .design/_server.json not found. Start the dev server first (`maude design serve`).\n'
    );
    process.exit(1);
  }

  // Collect `--option key=value` repeated flags into an object.
  const options = {};
  const repeated = collectRepeatedFlag(subArgs, '--option');
  for (const item of repeated) {
    const eq = item.indexOf('=');
    if (eq < 0) {
      process.stderr.write(
        `maude design export: invalid --option "${item}" (expected key=value)\n`
      );
      process.exit(2);
    }
    const key = item.slice(0, eq);
    const value = item.slice(eq + 1);
    // Coerce common JSON-ish values: true/false, numbers, arrays via comma.
    options[key] = value === 'true' ? true : value === 'false' ? false : value;
  }

  const url = `http://localhost:${port}/_api/export`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format, scope, options }),
  });
  if (!r.ok) {
    const text = await r.text();
    process.stderr.write(`maude design export: server returned ${r.status}: ${text}\n`);
    process.exit(1);
  }

  const disp = r.headers.get('content-disposition') ?? '';
  const serverFilename = /filename="([^"]+)"/.exec(disp)?.[1] ?? `export.${format}`;
  const outPath = flags.out
    ? resolve(process.cwd(), flags.out)
    : resolve(process.cwd(), serverFilename);
  const bytes = new Uint8Array(await r.arrayBuffer());
  await writeFile(outPath, bytes);
  process.stdout.write(`maude design export: wrote ${outPath} (${bytes.byteLength} bytes)\n`);
}

function collectRepeatedFlag(argv, name) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name && argv[i + 1] !== undefined) {
      out.push(argv[i + 1]);
      i += 1;
    } else if (argv[i].startsWith(`${name}=`)) {
      out.push(argv[i].slice(name.length + 1));
    }
  }
  return out;
}

async function runInit({ args, pkgRoot }) {
  const subArgs = args.slice(args.indexOf('init') + 1);
  const { flags } = parseArgs(subArgs, {
    booleans: ['force', 'dry-run', 'help', 'no-discovery'],
  });

  if (flags.help) {
    process.stdout.write(usage());
    return;
  }

  const cwd = process.cwd();
  const designDir = resolve(cwd, '.design');
  const inspirationRoot = resolve(
    pkgRoot,
    'plugins',
    'design',
    'templates',
    'design-system-inspiration'
  );

  if (!(await pathExists(inspirationRoot))) {
    throw new Error(`inspiration library not found at ${inspirationRoot}. Reinstall maude.`);
  }

  if (!flags['no-discovery'] && !flags['discovery-payload']) {
    process.stderr.write(
      `maude design init: interactive bootstrap requires Claude Code.

  Inside Claude Code:
    /design:setup-ds <name>           — full discovery + scaffold (recommended)
    /design:init             — just prepare the env (no DS yet)

  From the CLI (non-interactive only):
    maude design init --no-discovery [--name <slug>]
        scaffold Core only with default tokens

    maude design init --discovery-payload <path>
        read JSON answers + tokens, scaffold Core + derived specimens
`
    );
    process.exit(2);
  }

  const dsName = (flags.ds || 'project').trim();
  if (!isValidSlug(dsName)) {
    throw new Error(`invalid --ds "${dsName}" (must match ^[a-z][a-z0-9-]*$)`);
  }
  const projectName = (flags.name || basename(cwd)).trim();
  if (!isValidName(projectName)) {
    throw new Error(`invalid --name "${projectName}" (must match [a-z0-9._-]+)`);
  }

  // Refuse to scaffold over an existing DS unless --force.
  const dsDir = resolve(designDir, 'system', dsName);
  if ((await pathExists(dsDir)) && !flags.force) {
    process.stderr.write(
      `maude design init: ${dsDir} already exists. Pass --force to overwrite, or use a different --ds.\n`
    );
    process.exit(2);
  }

  // Resolve the discovery payload.
  const payload = flags['discovery-payload']
    ? await readPayload(flags['discovery-payload'])
    : defaultPayload({ projectName, dsName });

  process.stdout.write('maude design init\n');
  process.stdout.write(`  project name: ${projectName}\n`);
  process.stdout.write(`  ds name:      ${dsName}\n`);
  process.stdout.write(`  scaffold target: ${designDir}\n`);
  process.stdout.write(
    `  mode: ${flags['discovery-payload'] ? `--discovery-payload ${flags['discovery-payload']}` : '--no-discovery (Recommended defaults, Core only)'}\n`
  );
  if (flags['dry-run']) process.stdout.write('  mode: dry-run\n');
  if (flags.force) process.stdout.write('  mode: force (overwrites)\n');

  // Build explicit copy plan: [srcPath, destPath, transform?]
  const plan = buildCorePlan({ inspirationRoot, designDir, dsName });
  const previewFiles = await readdir(join(inspirationRoot, 'core', 'preview'));
  for (const f of previewFiles) {
    plan.push({
      src: resolve(inspirationRoot, 'core', 'preview', f),
      dest: resolve(designDir, 'system', dsName, 'preview', f),
      transform: f.endsWith('.tpl') ? 'placeholder' : null,
      stripTpl: f.endsWith('.tpl'),
    });
  }

  const stats = { created: [], replaced: [], skipped: [] };
  for (const item of plan) {
    let destPath = item.dest;
    if (item.stripTpl && destPath.endsWith('.tpl')) {
      destPath = destPath.slice(0, -4);
    }
    const exists = await pathExists(destPath);
    if (exists && !flags.force) {
      stats.skipped.push(rel(designDir, destPath));
      continue;
    }
    const contents = await readFile(item.src, 'utf8');
    const out =
      item.transform === 'placeholder' ? substitutePlaceholders(contents, payload) : contents;
    if (!flags['dry-run']) {
      await mkdir(resolve(destPath, '..'), { recursive: true });
      await writeFile(destPath, out);
    }
    if (exists) stats.replaced.push(rel(designDir, destPath));
    else stats.created.push(rel(designDir, destPath));
  }

  printSummary(stats);
  printNextSteps({ dsName, payloadProvided: !!flags['discovery-payload'] });
}

function buildCorePlan({ inspirationRoot, designDir, dsName }) {
  const src = (p) => resolve(inspirationRoot, 'core', p);
  const dsRoot = resolve(designDir, 'system', dsName);
  return [
    {
      src: src('README.orchestration.md.tpl'),
      dest: resolve(designDir, 'README.md'),
      transform: 'placeholder',
    },
    { src: src('INDEX.md.tpl'), dest: resolve(designDir, 'INDEX.md'), transform: 'placeholder' },
    {
      src: src('config.json.tpl'),
      dest: resolve(designDir, 'config.json'),
      transform: 'placeholder',
    },
    {
      src: src('README.philosophy.md.tpl'),
      dest: resolve(dsRoot, 'README.md'),
      transform: 'placeholder',
    },
    { src: src('SKILL.md.tpl'), dest: resolve(dsRoot, 'SKILL.md'), transform: 'placeholder' },
    {
      src: src('colors_and_type.css.tpl'),
      dest: resolve(dsRoot, 'colors_and_type.css'),
      transform: 'placeholder',
    },
  ];
}

function rel(root, p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

function substitutePlaceholders(contents, payload) {
  let out = contents;
  for (const [key, value] of Object.entries(payload)) {
    const token = new RegExp(`\\{\\{${escapeReg(key)}\\}\\}`, 'g');
    out = out.replace(token, value);
  }
  return out;
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultPayload({ projectName, dsName }) {
  return {
    project_name: projectName,
    project_label: titleCase(projectName),
    ds_dirname: dsName,
    ds_skill_name: `${dsName}-design`,
    ds_description: `Default design system for ${projectName}.`,
    root_class: 'app',
    theme_default: 'dark',
    theme_extra: '',
    handoff_targets: '[]',
    active_families: JSON.stringify(['accent']),
    active_families_csv: 'accent',
    active_families_block: '- **accent** — the single accent family used for primary actions.',
    purpose_one_liner: `${titleCase(projectName)} — design system.`,
    audience_summary: 'general',
    platforms_summary: 'desktop',
    platforms_first: 'desktop',
    platform_hard_rules: '',
    content_tone: 'direct-terse',
    mood_references_block: '_(not specified — extend during the next /design:setup-ds run)_',
    type_scale_summary: '8-step ladder, 12–36px.',
    voice_tone_block: 'Direct, terse. Action verbs. No marketing puffery.',
    voice_tone_summary: 'direct-terse',
    iconography_summary: 'Lucide, 1.5px stroke.',
    hard_rules_from_system_readme: '_(see system/<ds>/README.md Hard rules section)_',
    hard_rules_block:
      '- WCAG 2.1 AA contrast\n- No off-token colors / radii / spacings\n- Real product strings only — no placeholder copy',
    iso_timestamp: new Date().toISOString(),
    // Token defaults (dark theme, neutral indigo accent)
    bg_0_oklch: 'oklch(16% 0.012 245)',
    bg_1_oklch: 'oklch(20% 0.014 245)',
    bg_2_oklch: 'oklch(24% 0.014 245)',
    bg_3_oklch: 'oklch(28% 0.013 245)',
    bg_4_oklch: 'oklch(33% 0.013 245)',
    fg_0_oklch: 'oklch(96% 0.008 245)',
    fg_1_oklch: 'oklch(78% 0.012 245)',
    fg_2_oklch: 'oklch(60% 0.012 245)',
    fg_3_oklch: 'oklch(42% 0.010 245)',
    accent_oklch: 'oklch(64% 0.18 264)',
    accent_fg_oklch: 'oklch(98% 0.008 264)',
    radius_xs: '4px',
    radius_sm: '6px',
    radius_md: '8px',
    radius_lg: '12px',
    radius_xl: '16px',
    font_display: '"Inter", system-ui, sans-serif',
    font_body: '"Inter", system-ui, sans-serif',
    font_mono: '"JetBrains Mono", ui-monospace, monospace',
    dur_flip: '140ms',
    dur_panel: '220ms',
    dur_route: '260ms',
    dur_soft: '320ms',
    // Empty-state template fields
    empty_subject: 'items',
    empty_supporting: "When you create your first one, it'll show up here.",
    empty_cta: 'Create',
  };
}

async function readPayload(p) {
  const abs = resolve(process.cwd(), p);
  try {
    const raw = await readFile(abs, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`could not read --discovery-payload ${abs}: ${err.message}`);
  }
}

function titleCase(s) {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function isValidName(s) {
  return /^[a-z0-9._-]+$/i.test(s);
}
function isValidSlug(s) {
  return /^[a-z][a-z0-9-]*$/.test(s);
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function printSummary({ created, replaced, skipped }) {
  process.stdout.write(`\n  ${created.length} created`);
  if (replaced.length) process.stdout.write(`, ${replaced.length} replaced`);
  if (skipped.length) process.stdout.write(`, ${skipped.length} skipped`);
  process.stdout.write('\n');
  if (process.env.MAUDE_DEBUG || process.env.MDCC_DEBUG) {
    for (const c of created) process.stdout.write(`    + ${c}\n`);
    for (const r of replaced) process.stdout.write(`    ~ ${r}\n`);
    for (const s of skipped) process.stdout.write(`    = ${s}\n`);
  }
}

function printNextSteps({ dsName, payloadProvided }) {
  process.stdout.write('\nNext steps:\n');
  if (!payloadProvided) {
    process.stdout.write(
      '  This is the Core-only scaffold (~10 files) using Recommended defaults.\n'
    );
    process.stdout.write('  For audience-specific specimens, use Claude Code:\n');
    process.stdout.write(`    cd ${process.cwd()} && claude\n`);
    process.stdout.write(
      `    /design:setup-ds ${dsName} "<one-line product brief>"   — full 8-question discovery\n`
    );
  } else {
    process.stdout.write('  Scaffold complete from --discovery-payload.\n');
  }
  process.stdout.write(
    `  Then: /design:edit "<feedback>" to iterate on a specimen, or /design:new "<Name>" "<brief>" --ds=${dsName} for a canvas.\n`
  );
  process.stdout.write('  Browse: maude design serve\n');
}
