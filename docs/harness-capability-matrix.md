# Harness Capability Matrix

Reviewed: 2026-09-01

This document freezes the initial semantic contract for projecting a Claude Code and Maude environment into OpenCode and Codex. Claude remains the authoring source. A target status describes one representation only; it is not a claim of full parity.

## Tested Versions

| Harness | Version | Verification |
| --- | --- | --- |
| Claude Code | 2.1.241 | Installed CLI plus current settings, hooks, subagent, skill, plugin, and MCP documentation. |
| OpenCode | 1.18.25 | Installed CLI; `opencode debug config` run with isolated `HOME` and `XDG_CONFIG_HOME`. |
| Codex | 0.152.0 | Installed CLI; generated config passed `codex --strict-config doctor --json` in an isolated `CODEX_HOME`. |

Generated output is valid only for a target version accepted by the versioned capability registry. Unknown target versions fail `check` and do not mutate target state.

## Status Contract

- `native`: the target documents compatible representation and relevant semantics.
- `degraded`: Maude can emit a narrower or differently-invoked representation and reports the exact loss.
- `unsupported`: no safe equivalent exists; Maude emits no active behavior.
- Security-relevant `degraded` records fail strict mode unless an explicit target override acknowledges that exact degradation.
- Security-relevant `unsupported` records always fail strict mode.
- Unknown capabilities fail closed and cannot be promoted by an override.

## Capability Matrix

| Source category | OpenCode | Codex | Fail-closed behavior |
| --- | --- | --- | --- |
| Global and project `CLAUDE.md` instructions | `native` fallback, `degraded` when a target instruction file shadows it | `native` through `project_doc_fallback_filenames`, `degraded` when `AGENTS.md` shadows it | Report the shadowing file; never overwrite or adopt it implicitly. |
| Imported Claude instructions | `degraded` to explicit `instructions` paths/globs | `degraded` to the `AGENTS.md` chain or a generated reference | Preserve source order and report import-semantic differences. |
| `.claude/rules/**/*.md` | `degraded` to scoped instruction globs | `degraded` to generated skill/instruction references | Do not claim Claude path-condition semantics when the target cannot enforce them. |
| Scalar Claude settings | `degraded` per registered key | `degraded` per registered key and allowed scope | Unknown keys are reported and omitted. |
| Map/list setting precedence | `degraded`; lower into OpenCode's merge layers | `degraded`; lower into Codex's CLI/project/profile/user/system layers | Retain all contributing sources; refuse ambiguous security conflicts. |
| User/project marketplace plugin selection | `degraded`; lower individual compatible assets | `native` plugin lifecycle in the pre-launch bridge; `degraded` in static projection | Runtime mirrors preserve selected plugin identity; static projection never claims lifecycle parity. |
| Claude custom commands | `degraded` to OpenCode commands | `degraded` to Codex skills/plugins | Preserve body and description; report frontmatter, argument, and invocation differences. |
| Claude subagents | `degraded` to OpenCode agents | `unsupported`; Codex custom agents inherit the parent tool registry | Do not emit a role whose Claude tool restrictions cannot be enforced; remove previously managed roles and report them. |
| Claude skills | `native` for target-valid `SKILL.md` assets | `native` for target-valid skills/plugin assets | Validate frontmatter and references; malformed skills are invalid source, not skipped. |
| STDIO MCP | `native` local MCP | `native` STDIO MCP | Preserve command/args and environment references without spawning the server. |
| Streamable HTTP MCP | `native` remote MCP | `native` HTTP MCP | Validate URL and reference syntax; never make a discovery-time request. |
| Legacy SSE MCP | `degraded` to remote transport after compatibility validation | `degraded` to streamable HTTP after compatibility validation | Disabled unless endpoint compatibility is explicitly proven. |
| Disabled MCP | `native` with `enabled: false` | `native` with `enabled: false` | A disabled source can never become enabled implicitly. |
| MCP OAuth | `degraded`; target OAuth options differ | `degraded`; target OAuth options differ | Unsupported callback/client-secret fields remain disabled and reported. |
| MCP headers and environment | `native` for `{env:NAME}`-style references after syntax conversion | `native` for target environment-backed header fields | Never interpolate variables; reject credential-shaped literals. |
| Command hooks with equivalent event, input, output, blocking, timeout, and failure semantics | `degraded` through exact compatible plugin hooks | `native` only for proven Codex hook equivalents and persisted hook trust | Any failed equivalence dimension leaves the hook disabled. |
| HTTP hooks | `unsupported` without a separately reviewed target-native implementation | `unsupported` | Emit no active hook and fail strict mode. |
| Prompt hooks | `unsupported` | `unsupported` | Parse for inventory, emit no active hook, fail strict mode. |
| Agent hooks | `unsupported` | `unsupported` | Parse for inventory, emit no active hook, fail strict mode. |
| Unknown hook handlers | `unsupported` | `unsupported` | Preserve the source inventory record, emit no active hook, and fail strict mode. |
| Hook matchers, output, and blocking decisions | `degraded` only when all semantics match | `degraded` only when all semantics match | Never approximate lifecycle events or discard hook output/errors. |
| Permission allow rules | `degraded` per exactly expressible tool/path/command scope | `degraded` through approval, sandbox, and exec-policy intersections | A scoped rule can never become blanket allow. |
| Permission ask rules | `degraded` where the target has the same approval boundary | `degraded` through approval policy plus sandbox/exec policy | If exact scope is unavailable, retain deny/default posture and report loss. |
| Permission deny rules | `degraded` per exactly expressible scope | `degraded` through sandbox and exec-policy denial; runtime `Read(path)` rules become stricter filesystem denies | Deny wins; an unrepresentable deny blocks migration or keeps runtime bypass inert. |
| Claude permission modes | `unsupported` as direct mappings | `degraded` to narrower approval/sandbox combinations; trusted runtime `bypassPermissions` uses a no-prompt permission profile | Static projection stays narrow. Runtime bypass activates only when every ask/deny rule is conservatively representable. |
| Generic environment injection | `degraded` through a bounded thin plugin using references | `degraded` through shell environment policy and MCP-specific fields | Preserve names/references only; do not read current values. |
| Keychain identifiers | `degraded` reference-only | `degraded` reference-only | Never read, copy, log, or back up resolved credentials. |
| `.ai/` state | `degraded` reference/register in place | `degraded` reference/register in place | Never copy the state tree into target directories. |
| `.design/` state | `degraded` reference/register in place | `degraded` reference/register in place | Never copy the state tree into target directories. |
| kgai prompt integration | `degraded` through bounded target-native prompt/plugin wiring | `degraded` through bounded target-native instruction/hook wiring | Treat graph output as untrusted data; transcript-dependent behavior remains disabled. |
| Target config ownership | `native` managed JSON entries/files through Maude manifest | `native` managed TOML entries/files through Maude manifest | Existing state requires preview and explicit adoption; external edits stop all writes. |

## Precedence Findings

Claude inputs are normalized from least to most specific while preserving every contributor: global instructions/settings/assets/MCP, user-enabled plugin assets, project instructions/settings/assets/MCP, project-enabled plugin assets, then `.claude/settings.local.json`. Claude settings lists generally accumulate, scalar/map conflicts prefer the higher-precedence layer, hooks accumulate, and permissions resolve deny before ask before allow.

OpenCode merges remote, global, custom-config, project, `.opencode`, inline, managed, and MDM configuration layers. Later conflicting values win; the projector therefore owns individual entries and one thin plugin registration rather than replacing a complete `opencode.json`.

Codex resolves CLI overrides, trusted project layers from root to current directory, the selected profile, user config, system config, and defaults, while managed requirements constrain the result. Project config cannot own provider/authentication, notification, profile-selection, or telemetry-routing settings.

## TOML Writer Decision

Codex managed merge will use exact-pinned `@decimalturn/toml-patch@3.0.5` under Node 20. It is dependency-free, supports TOML 1.1, and preserves comments, whitespace, formatting, and existing order. The writer must parse the complete existing document, mutate only manifest-owned keys in the parsed object, and patch the complete object back. Passing a partial object is forbidden because omitted user keys may be removed. Tests must cover comments, unknown keys, arrays of tables, idempotence, and malformed input.

## Active Adapter Audit

`~/Dotfiles/opencode/claude-parity.ts` is prior art, not a correctness oracle. The current adapter:

- widens any scoped `Bash(...)` allow to blanket Bash access;
- broadens `auto` and `bypassPermissions` to unrestricted read/edit/Bash/web/external-directory access;
- drops ask rules, most deny rules, MCP permission rules, and unknown tools;
- resolves `${NAME}` header references to live values;
- silently ignores malformed JSON/frontmatter and unsupported agent fields;
- approximates Claude `SessionStart`/`Stop`, runs discovered commands detached, and discards output/errors/timeouts/blocking behavior;
- injects a Codex MCP with independent `approval_policy="never"` and `sandbox_mode="workspace-write"`;
- has no ownership manifest, adoption, conflict detection, atomic transaction, rollback, or exhaustive inventory assertion.

None of these behaviors may be carried into the projector.

## Contract Transcript

The T0 spike used isolated homes and did not load user secrets:

```text
$ claude --version
2.1.241 (Claude Code)

$ opencode --version
1.18.25

$ HOME=<isolated> XDG_CONFIG_HOME=<isolated> opencode debug config
{ "$schema": "https://opencode.ai/config.json", "agent": {}, "plugin": [], "command": {} ... }

$ codex --version
codex-cli 0.152.0

$ pnpm view @decimalturn/toml-patch version time.modified engines dependencies
3.0.5; updated 2026-08-30; Node >=16; no dependencies
```

Executable conformance in later gates must use isolated `HOME`, `XDG_CONFIG_HOME`, and `CODEX_HOME`, committed safe fixtures, and no arbitrary discovered hooks.

## Sources

- [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Claude Code subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills)
- [OpenCode configuration](https://opencode.ai/docs/config/)
- [OpenCode plugins](https://opencode.ai/docs/plugins/)
- [OpenCode configuration source](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/config.ts)
- [Codex configuration reference](https://developers.openai.com/codex/config-file/config-reference)
- [Codex AGENTS.md discovery](https://developers.openai.com/codex/agent-configuration/agents-md)
- [Codex hooks](https://developers.openai.com/codex/hooks)
- [Codex skills](https://developers.openai.com/codex/build-skills)
- [`@decimalturn/toml-patch`](https://www.npmjs.com/package/@decimalturn/toml-patch)
