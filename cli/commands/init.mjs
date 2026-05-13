import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseArgs } from '../lib/argv.mjs';
import { copyTree } from '../lib/copy-tree.mjs';

const PLACEHOLDER = 'PROJECT_NAME';
// Files in the skeleton that contain the project-name placeholder and should
// be templated on copy.
const TEMPLATED = ['workflows.config.json', 'README.md', 'INDEX.md', 'release-guide.md'];

// Per-provider command substitutions for release-guide.md. Keys map to the
// `# CHANGELOG_PROVIDER_*_CMD` placeholders inside the skeleton's bash blocks.
// `null` = leave the placeholder + a "# TODO" comment in place.
const CHANGELOG_STUBS = {
  changesets: {
    VERSION:
      'pnpm changeset version   # bumps package.json versions + writes CHANGELOG.md from .changeset/*.md',
    TAG: 'git tag "v$(jq -r .version package.json)" && git push --follow-tags',
    PUBLISH:
      'pnpm changeset publish   # or: CI handles publish on tag — see .github/workflows/publish.yml',
  },
  'git-cliff': {
    VERSION: 'git cliff --bump --tag --output CHANGELOG.md',
    TAG: 'git push --follow-tags',
    PUBLISH: '# TODO: fill in your publish command (npm publish / cargo publish / …)',
  },
  conventional: {
    VERSION:
      'npm version <major|minor|patch>   # writes CHANGELOG.md if conventional-changelog wired',
    TAG: 'git push --follow-tags',
    PUBLISH: 'npm publish',
  },
  custom: null,
  none: null,
};

const VALID_PROVIDERS = new Set(['changesets', 'git-cliff', 'conventional', 'custom', 'none']);

export async function run({ args, pkgRoot }) {
  const { flags } = parseArgs(args, { booleans: ['force', 'dry-run', 'help'] });
  if (flags.help) {
    process.stdout.write(
      'mdcc init [--name <project>] [--provider <changesets|git-cliff|conventional|custom|none>] [--force] [--dry-run]\n'
    );
    return;
  }

  const cwd = process.cwd();
  const aiDir = resolve(cwd, '.ai');
  const skeleton = resolve(pkgRoot, 'plugins', 'flow', 'templates', 'ai-skeleton');
  const projectName = (flags.name || basename(cwd)).trim();
  if (!isValidName(projectName)) {
    throw new Error(`invalid --name "${projectName}" (must match [a-z0-9._-]+)`);
  }
  const provider = (flags.provider || 'none').trim();
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(
      `invalid --provider "${provider}" (must be one of: ${[...VALID_PROVIDERS].join(', ')})`
    );
  }

  const skeletonExists = await pathExists(skeleton);
  if (!skeletonExists) {
    throw new Error(`skeleton not found at ${skeleton}. Reinstall mdcc.`);
  }

  process.stdout.write('mdcc init\n');
  process.stdout.write(`  project name: ${projectName}\n`);
  process.stdout.write(`  scaffold target: ${aiDir}\n`);
  process.stdout.write(`  changelog provider: ${provider}\n`);
  if (flags['dry-run']) process.stdout.write('  mode: dry-run\n');
  if (flags.force) process.stdout.write('  mode: force (overwrites)\n');

  const result = await copyTree(skeleton, aiDir, {
    force: !!flags.force,
    dryRun: !!flags['dry-run'],
    transformMatch: (p) => TEMPLATED.some((t) => p.endsWith(t)),
    transform: ({ srcPath, contents }) => {
      let out = contents.replaceAll(PLACEHOLDER, projectName);
      // workflows.config.json — also rewrite the relative schema path,
      // since after install the schema lives in the published package's
      // plugins/flow/.claude-plugin/ rather than at a fixed relative path
      // from .ai/ in the user's repo.
      if (srcPath.endsWith('workflows.config.json')) {
        out = out.replace(
          '"$schema": "../../plugins/flow/.claude-plugin/config.schema.json"',
          '"$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/flow/.claude-plugin/config.schema.json"'
        );
        // Propagate --provider into integrations.changelog.provider so the
        // first /flow:init run doesn't have to ask for what the user
        // already told us at CLI time.
        if (provider !== 'none') {
          out = out.replace(
            '"changelog": { "provider": "none" }',
            `"changelog": { "provider": "${provider}" }`
          );
        }
      }
      // release-guide.md — swap in provider-specific bash for the version /
      // tag / publish steps. `custom` / `none` leave the placeholders + TODO
      // comments intact so the user fills them in by hand.
      if (srcPath.endsWith('release-guide.md')) {
        const stub = CHANGELOG_STUBS[provider];
        if (stub) {
          out = out
            .replace('# CHANGELOG_PROVIDER_VERSION_CMD', stub.VERSION)
            .replace('# CHANGELOG_PROVIDER_TAG_CMD', stub.TAG)
            .replace('# CHANGELOG_PROVIDER_PUBLISH_CMD', stub.PUBLISH);
        } else {
          // custom / none — keep placeholders, append explicit TODO
          out = out.replaceAll(
            /# CHANGELOG_PROVIDER_(\w+)_CMD/g,
            '# CHANGELOG_PROVIDER_$1_CMD\n# TODO: fill in for your project'
          );
        }
      }
      return out;
    },
  });

  // Note: we do NOT scaffold CLAUDE.md here. That's the job of Claude Code's
  // built-in `/init` command, which analyzes the codebase and writes a
  // <200-line CLAUDE.md tailored to the project. `mdcc init` only owns
  // .ai/ — the second-brain workspace.

  const claudeMdExists =
    (await pathExists(resolve(cwd, 'CLAUDE.md'))) ||
    (await pathExists(resolve(cwd, '.claude', 'CLAUDE.md')));

  printSummary(result);
  printNextSteps(projectName, claudeMdExists);
}

function isValidName(s) {
  return /^[a-z0-9._-]+$/i.test(s);
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
  if (process.env.MDCC_DEBUG) {
    for (const c of created) process.stdout.write(`    + ${c}\n`);
    for (const r of replaced) process.stdout.write(`    ~ ${r}\n`);
    for (const s of skipped) process.stdout.write(`    = ${s}\n`);
  }
}

function printNextSteps(name, claudeMdExists) {
  process.stdout.write('\nNext steps:\n');
  process.stdout.write('  1. In Claude Code: /plugin marketplace add 1aGh/md-claude\n');
  process.stdout.write('                     /plugin install flow@md-claude\n');
  if (!claudeMdExists) {
    process.stdout.write('  2. /init — generate a CLAUDE.md tailored to your codebase\n');
    process.stdout.write(
      `     (Anthropic's built-in command — analyzes stack, writes <200 lines).\n`
    );
    process.stdout.write(
      '  3. /flow:init — populates .ai/workflows.config.json with detected\n'
    );
    process.stdout.write('     stack (platforms, tracker, language, …).\n');
  } else {
    process.stdout.write(
      '  2. /flow:init — populates .ai/workflows.config.json with detected\n'
    );
    process.stdout.write(
      '     stack. CLAUDE.md already exists; /init would suggest improvements.\n'
    );
  }
  process.stdout.write(`  4. Create .ai/${name}-prd.md with your product brief.\n`);
  process.stdout.write('  5. /flow:status to see where you are; /flow:plan to start work.\n');
}
