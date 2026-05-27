// Pure detection of project stack + quality-gate hints.
//
// Read-only. Never throws. Returns "unknown" / null when nothing matches.
//
// Port of /flow:init Step 2 bash (plugins/flow/commands/init.md lines 71–181)
// with one extension: when the root lacks a marker (tsconfig.json, next.config.*,
// …) AND pnpm-workspace.yaml exists, glance one level into workspace packages.
// Without that, a monorepo where every workspace is TypeScript still reports
// `language: javascript` because the root only has a JS package.json.
//
// Consumers: cli/commands/doctor.mjs and the drift-aware /flow:init re-run.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function anyExists(repoRoot, names) {
  for (const n of names) {
    // eslint-disable-next-line no-await-in-loop
    if (await fileExists(join(repoRoot, n))) return n;
  }
  return null;
}

async function listWorkspaceDirs(repoRoot) {
  // Cheap depth-1 scan triggered only when pnpm-workspace.yaml exists.
  // We do not parse the YAML — common monorepo layouts (`packages/*`,
  // `apps/*`, `plugins/*`, `site/`) cover ~all cases. Returns absolute paths.
  if (!(await fileExists(join(repoRoot, 'pnpm-workspace.yaml')))) return [];
  const out = [];
  // Candidate directories that, depending on layout, are either
  //   (a) the workspace member itself (e.g. ./site)
  //   (b) a container of members (e.g. ./packages/foo, ./plugins/design)
  // We include BOTH the candidate path and its first-level subdirs in the
  // scan target list, so layouts like this repo's `site/tsconfig.json` are
  // reached even though `site/` is itself the member.
  const candidates = ['packages', 'apps', 'plugins', 'site', 'scripts', 'examples'];
  for (const c of candidates) {
    const dir = join(repoRoot, c);
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(dir))) continue;
    out.push(dir);
    try {
      // eslint-disable-next-line no-await-in-loop
      const ents = await readdir(dir, { withFileTypes: true });
      for (const e of ents) {
        if (e.isDirectory()) out.push(join(dir, e.name));
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

async function anyExistsDeep(repoRoot, names, workspaceDirs) {
  // First check root, then one level into each workspace dir.
  const root = await anyExists(repoRoot, names);
  if (root) return root;
  for (const wd of workspaceDirs) {
    for (const n of names) {
      // eslint-disable-next-line no-await-in-loop
      if (await fileExists(join(wd, n))) return `${wd.slice(repoRoot.length + 1)}/${n}`;
    }
  }
  return null;
}

async function readPkgJson(repoRoot) {
  try {
    const raw = await readFile(join(repoRoot, 'package.json'), 'utf8');
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    return { raw: '', parsed: null };
  }
}

export async function detectStack(repoRoot) {
  const ws = await listWorkspaceDirs(repoRoot);
  const { raw: pkgRaw, parsed: pkg } = await readPkgJson(repoRoot);

  // Package manager — lock files at root.
  let packageManager = 'unknown';
  if (await fileExists(join(repoRoot, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (await fileExists(join(repoRoot, 'yarn.lock'))) packageManager = 'yarn';
  else if (await fileExists(join(repoRoot, 'package-lock.json'))) packageManager = 'npm';
  else if (await fileExists(join(repoRoot, 'bun.lockb'))) packageManager = 'bun';
  else if (await fileExists(join(repoRoot, 'Cargo.toml'))) packageManager = 'cargo';
  else if (await fileExists(join(repoRoot, 'go.mod'))) packageManager = 'go';
  else if (
    (await fileExists(join(repoRoot, 'pyproject.toml'))) ||
    (await fileExists(join(repoRoot, 'requirements.txt')))
  )
    packageManager = 'pip';
  else if (await fileExists(join(repoRoot, 'pom.xml'))) packageManager = 'maven';
  else if (
    (await fileExists(join(repoRoot, 'build.gradle'))) ||
    (await fileExists(join(repoRoot, 'build.gradle.kts')))
  )
    packageManager = 'gradle';

  // Language — deep-scan tsconfig before falling back to package.json → js.
  let language = 'unknown';
  if (await anyExistsDeep(repoRoot, ['tsconfig.json'], ws)) language = 'typescript';
  else if (await fileExists(join(repoRoot, 'Cargo.toml'))) language = 'rust';
  else if (await fileExists(join(repoRoot, 'go.mod'))) language = 'go';
  else if (
    (await fileExists(join(repoRoot, 'pyproject.toml'))) ||
    (await fileExists(join(repoRoot, 'requirements.txt')))
  )
    language = 'python';
  else if (
    (await fileExists(join(repoRoot, 'pom.xml'))) ||
    (await fileExists(join(repoRoot, 'build.gradle'))) ||
    (await fileExists(join(repoRoot, 'build.gradle.kts')))
  )
    language = 'java';
  else if (await fileExists(join(repoRoot, 'package.json'))) language = 'javascript';

  // Framework — root first, then workspace.
  let framework = 'unknown';
  if (await anyExistsDeep(repoRoot, ['next.config.js', 'next.config.ts', 'next.config.mjs'], ws))
    framework = 'next.js';
  else if (await anyExistsDeep(repoRoot, ['vite.config.js', 'vite.config.ts'], ws))
    framework = 'vite';
  else if (await anyExistsDeep(repoRoot, ['app.json', 'app.config.js', 'app.config.ts'], ws))
    framework = 'expo';
  else if (await anyExistsDeep(repoRoot, ['svelte.config.js'], ws)) framework = 'sveltekit';
  else if (await anyExistsDeep(repoRoot, ['remix.config.js'], ws)) framework = 'remix';
  else if (await anyExistsDeep(repoRoot, ['astro.config.mjs'], ws)) framework = 'astro';
  else if (await anyExistsDeep(repoRoot, ['nuxt.config.ts', 'nuxt.config.js'], ws))
    framework = 'nuxt';

  // Monorepo + build tool.
  let monorepo = false;
  let buildTool = 'none';
  if (await fileExists(join(repoRoot, 'turbo.json'))) {
    monorepo = true;
    buildTool = 'turbo';
  } else if (await fileExists(join(repoRoot, 'nx.json'))) {
    monorepo = true;
    buildTool = 'nx';
  } else if (await fileExists(join(repoRoot, 'lerna.json'))) {
    monorepo = true;
    buildTool = 'lerna';
  } else if (await fileExists(join(repoRoot, 'rush.json'))) {
    monorepo = true;
    buildTool = 'rush';
  } else if (await fileExists(join(repoRoot, 'pnpm-workspace.yaml'))) {
    monorepo = true;
  } else if (await fileExists(join(repoRoot, 'Makefile'))) {
    buildTool = 'make';
  } else if (
    (await fileExists(join(repoRoot, 'BUILD.bazel'))) ||
    (await fileExists(join(repoRoot, 'WORKSPACE')))
  ) {
    buildTool = 'bazel';
  }

  // CI.
  let ci = 'unknown';
  if (await fileExists(join(repoRoot, '.github/workflows'))) ci = 'github-actions';
  else if (await fileExists(join(repoRoot, '.gitlab-ci.yml'))) ci = 'gitlab-ci';
  else if (await fileExists(join(repoRoot, 'Jenkinsfile'))) ci = 'jenkins';
  else if (await fileExists(join(repoRoot, 'azure-pipelines.yml'))) ci = 'azure-devops';
  else if (await fileExists(join(repoRoot, '.circleci/config.yml'))) ci = 'circleci';
  else if (await fileExists(join(repoRoot, 'bitbucket-pipelines.yml'))) ci = 'bitbucket';

  // Tests — substring match on raw package.json so it picks up references in
  // scripts (`"vitest run"`) as well as devDependencies (matches the bash port).
  let tests = 'unknown';
  if (pkgRaw) {
    if (pkgRaw.includes('"vitest"')) tests = 'vitest';
    else if (pkgRaw.includes('"jest"')) tests = 'jest';
    else if (pkgRaw.includes('"@playwright/test"')) tests = 'playwright';
    else if (pkgRaw.includes('"cypress"')) tests = 'cypress';
  }
  if (await fileExists(join(repoRoot, 'go.mod'))) tests = 'go-test';
  if (await fileExists(join(repoRoot, 'Cargo.toml'))) tests = 'cargo-test';
  if (await fileExists(join(repoRoot, 'pytest.ini'))) tests = 'pytest';
  else if (await fileExists(join(repoRoot, 'pyproject.toml'))) {
    try {
      const py = await readFile(join(repoRoot, 'pyproject.toml'), 'utf8');
      if (py.includes('pytest')) tests = 'pytest';
    } catch {
      /* ignore */
    }
  }

  // CSS approach.
  let css = 'unknown';
  if (pkgRaw) {
    if (pkgRaw.includes('"tailwindcss"')) css = 'tailwind';
    else if (pkgRaw.includes('"styled-components"')) css = 'styled-components';
    else if (pkgRaw.includes('"@emotion/')) css = 'emotion';
    else if (pkgRaw.includes('"@vanilla-extract/')) css = 'vanilla-extract';
    else if (
      (await fileExists(join(repoRoot, 'postcss.config.js'))) ||
      (await fileExists(join(repoRoot, 'postcss.config.cjs')))
    )
      css = 'css-modules';
  }

  // Router — framework-dependent.
  let router = 'unknown';
  switch (framework) {
    case 'next.js': {
      const appAtRoot =
        (await fileExists(join(repoRoot, 'app'))) || (await fileExists(join(repoRoot, 'src/app')));
      if (appAtRoot) {
        router = 'next-app';
      } else {
        // Workspace pass — first member with an `app/` or `src/app/` wins.
        for (const wd of ws) {
          if (
            // eslint-disable-next-line no-await-in-loop
            (await fileExists(join(wd, 'app'))) ||
            // eslint-disable-next-line no-await-in-loop
            (await fileExists(join(wd, 'src/app')))
          ) {
            router = 'next-app';
            break;
          }
        }
        if (router === 'unknown') router = 'next-pages';
      }
      break;
    }
    case 'remix':
      router = 'react-router';
      break;
    case 'sveltekit':
      router = 'sveltekit-router';
      break;
    case 'expo':
      router = 'expo-router';
      break;
    default:
      if (pkgRaw?.includes('"@tanstack/router')) router = 'tanstack-router';
      else if (pkgRaw?.includes('"react-router')) router = 'react-router';
  }

  // _ avoids unused-warning for `pkg` (kept around in case future detectors
  // need parsed access).
  void pkg;

  return {
    language,
    framework,
    packageManager,
    buildTool,
    monorepo,
    ci,
    tests,
    css,
    router,
  };
}

// ─── Quality-gate detection ────────────────────────────────────────────────
//
// detectQualityGates(repoRoot) → { lint, format, typecheck, tests, build } | null
//
// Strategy: prefer the user's declared `scripts.<name>` (they know how their
// project is wired) over inferring from tool presence. Only fall back to tool
// presence when no script is declared. Always emits the package-manager
// prefix so the command can be eval'd directly.

function pmPrefix(packageManager) {
  if (packageManager === 'pnpm') return 'pnpm';
  if (packageManager === 'yarn') return 'yarn';
  if (packageManager === 'bun') return 'bun';
  return 'npm run'; // default — works for npm and unknown package managers
}

export async function detectQualityGates(repoRoot) {
  const { parsed: pkg } = await readPkgJson(repoRoot);
  if (!pkg) return null;
  const scripts = pkg.scripts || {};

  // Pick the package manager from lockfile (same logic as detectStack but
  // standalone — this function is composable and may be called separately).
  let pm = 'npm';
  if (await fileExists(join(repoRoot, 'pnpm-lock.yaml'))) pm = 'pnpm';
  else if (await fileExists(join(repoRoot, 'yarn.lock'))) pm = 'yarn';
  else if (await fileExists(join(repoRoot, 'bun.lockb'))) pm = 'bun';
  const prefix = pmPrefix(pm);

  const out = {};

  // lint.
  if (scripts.lint) out.lint = `${prefix} lint`;
  else if (
    (await fileExists(join(repoRoot, 'biome.json'))) ||
    (await fileExists(join(repoRoot, 'biome.jsonc')))
  )
    out.lint = `${prefix === 'npm run' ? 'npx' : prefix} biome check .`;
  else if (
    (await fileExists(join(repoRoot, 'eslint.config.js'))) ||
    (await fileExists(join(repoRoot, 'eslint.config.mjs'))) ||
    (await fileExists(join(repoRoot, '.eslintrc.cjs'))) ||
    (await fileExists(join(repoRoot, '.eslintrc.js'))) ||
    (await fileExists(join(repoRoot, '.eslintrc.json')))
  )
    out.lint = `${prefix === 'npm run' ? 'npx' : prefix} eslint .`;

  // format.
  if (scripts.format) out.format = `${prefix} format`;
  else if (
    (await fileExists(join(repoRoot, 'biome.json'))) ||
    (await fileExists(join(repoRoot, 'biome.jsonc')))
  )
    out.format = `${prefix === 'npm run' ? 'npx' : prefix} biome format --write .`;
  else if (
    (await fileExists(join(repoRoot, '.prettierrc'))) ||
    (await fileExists(join(repoRoot, '.prettierrc.json'))) ||
    (await fileExists(join(repoRoot, '.prettierrc.js'))) ||
    (await fileExists(join(repoRoot, 'prettier.config.js'))) ||
    (await fileExists(join(repoRoot, 'prettier.config.mjs')))
  )
    out.format = `${prefix === 'npm run' ? 'npx' : prefix} prettier --write .`;

  // typecheck.
  if (scripts.typecheck) out.typecheck = `${prefix} typecheck`;
  else if (await fileExists(join(repoRoot, 'tsconfig.json')))
    out.typecheck = `${prefix === 'npm run' ? 'npx' : prefix === 'pnpm' ? 'pnpm exec' : prefix} tsc --noEmit`;

  // tests.
  if (scripts.test) out.tests = `${prefix} test`;

  // build.
  if (scripts.build) out.build = `${prefix} build`;

  if (Object.keys(out).length === 0) return null;
  return out;
}
