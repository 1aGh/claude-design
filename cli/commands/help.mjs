export function run() {
  const text = `maude — Maude CLI (legacy alias: mdcc)

USAGE
  maude <command> [options]

COMMANDS
  init [--name <project>] [--force] [--dry-run]
        Scaffold the .ai/ second-brain workspace into the current repo from
        the flow plugin skeleton. Idempotent — never overwrites existing
        files unless --force. --name sets the project name in
        workflows.config.json (defaults to the current directory basename).
        Does NOT write CLAUDE.md — use Claude Code's built-in /init for that.

  config show
  config get <dotted.key>
  config set <dotted.key> <value>
        Read or write keys in .ai/workflows.config.json. Validates known keys
        against the flow plugin's config.schema.json. Values that parse as
        JSON (numbers, booleans, arrays, objects) are stored typed.

  design serve [--port N] [--root PATH]
        Start the design plugin's dev server in the current repo. Equivalent
        to invoking 'claude-design-server'. Forwards all remaining args.

  design init [--name <slug>] [--ds <name>] [--force] [--dry-run]
              [--no-discovery | --discovery-payload <path>]
        Non-interactive scaffold helper for the design plugin. Writes Core
        files into .design/ using the design-system-inspiration library.
        Refuses to run interactively — use Claude Code's /design:setup-ds for
        full discovery. --no-discovery uses Recommended defaults; --discovery-
        payload reads pre-computed answers from JSON.

  help              Print this help.
  version           Print the installed version.

EXAMPLES
  maude init --name acme-app
  maude config set platforms '["web-desktop","web-mobile"]'
  maude config get motion.complex
  maude design serve --port 4399
  maude design init --no-discovery --name acme-app

NOTES
  'maude init' does mechanical scaffolding of .ai/ only.
  For interactive stack detection and workflows.config.json population,
  run '/flow:init' inside Claude Code — it calls 'maude init' as
  its first step. For CLAUDE.md, run Anthropic's built-in '/init'.

  The legacy 'mdcc' alias still works (prints a deprecation warning).
  It will be removed in v0.17.x.

DOCS
  https://github.com/1aGh/maude
`;
  process.stdout.write(text);
}
