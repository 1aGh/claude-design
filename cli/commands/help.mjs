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

  hub serve [--port N] [--data PATH] [--secret HEX] [--insecure-http] [--dev]
        Start the self-hostable Yjs sync hub (Phase 9). Defaults to port 1234,
        data dir ./data. --dev mints a mau_dev_<hex> token + prints the
        connect command before booting. Local-dev-tree only in v1.1 Task 2.

  hub token generate --label NAME [--data PATH] [--dev]
        Mint a new mau_<32hex> token in <data>/tokens.json. Prints the raw
        token ONCE plus the ready-to-paste 'maude design link' command.

  hub status [URL] [--json]
        Probe a hub's /health endpoint. URL defaults to http://localhost:1234.

  doctor [--plugin <name>] [--fix] [--json]
        Unified workspace health check. Reports missing dependencies, config
        schema errors, stack drift, and missing quality-gate declarations in
        one shot. --fix applies safe auto-fixes (prompts per dep install;
        never overwrites existing config values). --json for programmatic
        consumers.

  help              Print this help.
  version           Print the installed version.

EXAMPLES
  maude init --name acme-app
  maude config set platforms '["web-desktop","web-mobile"]'
  maude config get motion.complex
  maude design serve --port 4399
  maude design init --no-discovery --name acme-app
  maude hub serve --dev
  maude hub token generate --label alice
  maude hub status http://localhost:1234
  maude doctor
  maude doctor --fix

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
