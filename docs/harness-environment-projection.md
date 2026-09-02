# Harness environment projection

Claude Code and Maude remain the authoring source. `maude harness` generates managed,
target-native OpenCode and Codex files without resolving secret references or copying
`.ai` and `.design` state.

Every command requires exactly one scope: `--global` or `--project <root>`. Projection
verbs require `--targets opencode,codex`; `adopt` and `remove` require one `--target`.

```sh
maude harness migrate --from claude --targets opencode,codex --project .
maude harness migrate --from claude --targets opencode,codex --project . --yes
maude harness sync --targets opencode,codex --project .
maude harness check --targets opencode,codex --project . --strict --json
maude harness status --project . --json
```

`migrate`, `diff`, and `adopt` preview by default. Mutations run only after complete
target-specific validation and confirmation or `--yes`. Confirmation never overrides
literal-secret rejection, unsupported security semantics, invalid sources or targets,
or ownership conflicts. `sync` commits all requested targets in one managed transaction.

Machine-local ownership, backups, recovery material, and manifests live below
`~/.config/maude/harness/`. `remove` touches manifest-owned output only and restores an
adopted backup when present. Generated reports contain references and hashes, not secret
values.

Exit codes are stable: `0` clean/success, `1` drift or declined preview, `2` usage,
`3` strict/unsupported security failure, `4` ownership conflict, `5` invalid source,
`6` invalid target/config/version, and `7` interrupted transaction or required recovery.

No postinstall, startup, plugin hook, or `maude init` path invokes harness mutation.

## Codex pre-launch bridge

`maude codex [args...]` is a separate machine-local bridge for daily Codex use. Before
launching the real Codex executable it reads the effective Claude plugin selection for
the current project when Codex marks that project trusted (otherwise only global Claude
selection applies), materializes owner-only runtime marketplace mirrors below
`~/.config/maude/harness/codex-runtime/`, and reconciles those plugins through Codex's
native `plugin marketplace` and `plugin add/remove` commands. `maude codex sync --json`
performs the same reconciliation without starting a session.

For a Codex-trusted project whose effective Claude settings select
`permissions.defaultMode: "bypassPermissions"`, the bridge adds a launch-only Codex
permission profile with `approval_policy="never"`, root filesystem write access, and
full network access. Claude `Read(path)` deny rules become stricter Codex filesystem
denies. Any Claude ask rule or unrepresentable deny keeps runtime bypass inert. These
overrides are passed on the command line and are not persisted. A pre-existing
`sandbox_mode`, an explicit sandbox/permission-profile override, a remote target, or an
ambiguous working-directory override keeps the launch fail-closed so the deny profile
cannot be silently disabled. Any `-C`/`--cd` path is authorized first and then forwarded
only in canonical form; path identity and trust are checked again immediately before
launch. Runtime-only defaults such as the skill context budget are also passed as CLI
overrides instead of rewriting user-owned Codex config.

`-C` and `--cd` are resolved before project trust and settings discovery, so authority
cannot be borrowed from one project and applied to another. Remote and Codex Cloud
sessions are rejected before runtime reconciliation, so local plugins, MCP state, and
permissions are never mutated for a remote launch. Runtime reconciliation is serialized
by the same crash-safe scope-lock primitive used by transactional harness writes.

Claude commands are exposed as namespaced Codex skills. Claude agents are reported but
not installed: Codex custom agents inherit the parent's tool registry, so a read-only
sandbox cannot enforce Claude agent tool restrictions. The bridge removes role files it
managed before this limitation was proven. Standalone Claude MCP servers are merged with
plugin MCP servers. Bearer credentials must reference an environment variable or exactly
match one already present in the launch environment; credential values are never pooled
into bridge state or persisted config. The current Codex CLI cannot write pass-through
environment names for STDIO MCP servers without materializing values, so the runtime bridge
rejects those entries; the transactional `maude harness` lowerer remains the supported path.

The bridge never writes into the current repository and does not copy `.ai` or `.design`.
A `CODEX_HOME` inside the current project is rejected rather than weakening that boundary.
A shell launcher may safely shadow the real Codex binary when it sets
`MAUDE_CODEX_REAL` to that binary before executing `maude codex`. This runtime path
complements the explicit, transactional `maude harness` migration workflow; it does not
adopt repository files or retire existing adapters by itself.

Real-workspace conformance can keep sources and generated target files physically
separate: set `MAUDE_HARNESS_SOURCE_HOME` to the read-only Claude source home and
`MAUDE_HARNESS_PROJECT_TARGET_ROOT` to a temporary project target root. These are
diagnostic/operator controls; normal migration should leave both unset. A temporary
source mirror may set the path-delimited `MAUDE_HARNESS_ALLOWED_PLUGIN_ROOTS` to
explicit read-only plugin cache roots referenced by its installation index.

The npm package contains the harness command, lowerers, capability/compatibility registry,
OpenCode runtime template, and Codex pre-launch bridge. Test fixtures, tests, backups, machine-local manifests,
logs, workspace metadata, and secrets are not part of that published harness surface.

Harness output is version-locked to the target versions listed by the capability registry
and to the machine-local manifest schema. `check` refuses an unsupported target or schema
before writing anything and prints two recovery choices: upgrade Maude for a newer registry,
or install the target version supported by the current Maude release. Never delete an
incompatible manifest or its backups as an upgrade shortcut.
