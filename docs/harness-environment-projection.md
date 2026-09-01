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

Real-workspace conformance can keep sources and generated target files physically
separate: set `MAUDE_HARNESS_SOURCE_HOME` to the read-only Claude source home and
`MAUDE_HARNESS_PROJECT_TARGET_ROOT` to a temporary project target root. These are
diagnostic/operator controls; normal migration should leave both unset. A temporary
source mirror may set the path-delimited `MAUDE_HARNESS_ALLOWED_PLUGIN_ROOTS` to
explicit read-only plugin cache roots referenced by its installation index.

The npm package contains the harness command, lowerers, capability/compatibility registry,
and OpenCode runtime template. Test fixtures, tests, backups, machine-local manifests,
logs, workspace metadata, and secrets are not part of that published harness surface.

Harness output is version-locked to the target versions listed by the capability registry
and to the machine-local manifest schema. `check` refuses an unsupported target or schema
before writing anything and prints two recovery choices: upgrade Maude for a newer registry,
or install the target version supported by the current Maude release. Never delete an
incompatible manifest or its backups as an upgrade shortcut.
