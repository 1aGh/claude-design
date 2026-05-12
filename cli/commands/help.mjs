export function run() {
  const text = `mdcc — md-claude CLI

USAGE
  mdcc <command> [options]

COMMANDS
  init [--name <project>] [--force] [--dry-run]
        Scaffold .ai/ workspace into the current repo from the flow plugin
        skeleton. Idempotent — never overwrites existing files unless --force.
        --name sets the project name in workflows.config.json (defaults to
        the current directory basename).

  config show
  config get <dotted.key>
  config set <dotted.key> <value>
        Read or write keys in .ai/workflows.config.json. Validates known keys
        against the flow plugin's config.schema.json. Values that parse as
        JSON (numbers, booleans, arrays, objects) are stored typed.

  design serve [--port N] [--root PATH]
        Start the design plugin's dev server in the current repo. Equivalent
        to invoking 'claude-design-server'. Forwards all remaining args.

  help              Print this help.
  version           Print the installed version.

EXAMPLES
  mdcc init --name acme-app
  mdcc config set platforms '["web-desktop","web-mobile"]'
  mdcc config get motion.complex
  mdcc design serve --port 4399

DOCS
  https://github.com/1aGh/md-claude
`;
  process.stdout.write(text);
}
