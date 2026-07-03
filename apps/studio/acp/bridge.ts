// Per-connection ACP bridge: spawns the user's Claude Code through the
// `claude-agent-acp` adapter and drives it as an ACP *client* (DDR-123).
//
//   browser ─/_ws/acp─► dev-server (this) ─stdio ndJSON─► claude-agent-acp ─► claude -p
//
// We never see or store an Anthropic credential — the spawned `claude` owns its
// own auth + billing. The single load-bearing guarantee is `scrubAgentEnv`
// (env.ts): the child inherits the environment MINUS `ANTHROPIC_API_KEY`, so
// auth precedence falls through to the user's Pro/Max subscription.

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  type AvailableCommand,
  type Client,
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type PromptResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type SessionUpdate,
} from '@agentclientprotocol/sdk';

import { scrubAgentEnv } from './env.ts';
import type { SdkPluginConfig } from './plugin-bootstrap.ts';
import { resolveAdapterEntry, resolveAgentRuntime, resolveClaudePath } from './probe.ts';

export interface AcpBridgeOptions {
  /** Absolute repo root the ACP session runs in (where `.design/` + the CLI operate). */
  repoRoot: string;
  /**
   * Static studio-environment brief appended to every new session's system
   * prompt (feature-acp-context-hardening; built by bootstrap-brief.ts).
   * Absent → no injection (tests / non-studio embedders).
   */
  studioBrief?: string;
  /**
   * Session-scoped local plugins auto-loaded into every new session via
   * `_meta.claudeCode.options.plugins` (DDR-143; resolved by
   * plugin-bootstrap.ts). Empty/absent → no injection (power-user no-op, web
   * serve). Carried on the readonly options so it survives an adapter re-spawn.
   */
  plugins?: SdkPluginConfig[];
  /** Streamed `session/update` notifications relayed to the browser. */
  onUpdate: (update: SessionUpdate) => void;
  /** Informational: a tool permission was auto-approved (transparency for the UI). */
  onPermission?: (req: RequestPermissionRequest) => void;
  /**
   * The agent's slash-command catalogue (`available_commands_update`) — drives
   * the composer autocomplete + inline command pill. Fires whenever the agent
   * (re)publishes the list; the manager caches the latest and pushes it to the UI.
   */
  onCommands?: (commands: AvailableCommand[]) => void;
}

type Spawned = ReturnType<typeof Bun.spawn>;

/**
 * Effort → extended-thinking budget, fed to the adapter as `MAX_THINKING_TOKENS`
 * (it maps 0 → thinking disabled, a positive int → an enabled budget). `balanced`
 * leaves it unset so the agent uses Claude Code's own default.
 */
const EFFORT_THINKING_TOKENS: Record<string, number | null> = {
  fast: 0,
  balanced: null,
  thorough: 31999,
};

export type AcpEffort = keyof typeof EFFORT_THINKING_TOKENS;

/**
 * Build the `session/new` params, carrying TWO adapter-internal `_meta` payloads
 * (both spread by the installed `claude-agent-acp@0.49.x` `newSession`):
 *
 *   • `_meta.systemPrompt.append` — the studio brief (feature-acp-context-
 *     hardening); the adapter spreads its object form over the `claude_code`
 *     preset (acp-agent.js:2282).
 *   • `_meta.claudeCode.options.plugins` — session-scoped local plugins (DDR-143);
 *     the adapter reads `_meta.claudeCode.options` (acp-agent.js:2302) and spreads
 *     the whole object into the SDK `query()` options (`...userProvidedOptions`,
 *     :2333 → :2455), so `plugins` reaches the SDK's `plugins?: SdkPluginConfig[]`
 *     (sdk.d.ts:1683) untouched — verified live (Task-1 spike).
 *
 * Both siblings coexist under one `_meta`. The SDK's `zNewSessionRequest` declares
 * `_meta` (zod.gen), so it rides the wire validated. These contracts are
 * adapter/SDK-INTERNAL and undocumented — an adapter/SDK bump that drops either
 * must fail the presence tests LOUDLY (acp-bootstrap-brief.test.ts +
 * acp-session-plugins.test.ts), not silently un-brief / un-plugin every session.
 * Exported for those tests.
 */
export function newSessionParams(
  repoRoot: string,
  studioBrief?: string,
  plugins?: SdkPluginConfig[]
): { cwd: string; mcpServers: never[]; _meta?: Record<string, unknown> } {
  const meta: Record<string, unknown> = {};
  if (studioBrief) meta.systemPrompt = { append: studioBrief };
  // SECURITY (DDR-144 attacker F2) — narrow settingSources to the user's OWN
  // ~/.claude only. The adapter defaults to ["user","project","local"] (acp-agent.js
  // :2331), which would read the SERVED (untrusted, DDR-054) project's
  // .claude/{settings.json,hooks} into the AUTO-APPROVING (DDR-125 F2) session: a
  // poisoned `env` block (e.g. AGENT_BROWSER_EXECUTABLE_PATH → a repo-shipped
  // binary the screenshot engine then executes), hook, or enabledPlugins would run
  // under auto-approve just by OPENING the repo. 'user'-only closes that confused-
  // deputy chain (the DDR-143 guard #6 follow-up). The project's CLAUDE.md is read
  // via a separate path and is unaffected. Always injected — every Maude bridge
  // session is auto-approving. `...plugins` (DDR-143) rides the same options object.
  const options: Record<string, unknown> = { settingSources: ['user'] };
  if (plugins && plugins.length > 0) options.plugins = plugins;
  meta.claudeCode = { options };
  return {
    cwd: repoRoot,
    mcpServers: [],
    _meta: meta,
  };
}

/** Pick the most-permissive allow option, or null if the agent offered none. */
function pickAllowOption(params: RequestPermissionRequest) {
  const options = params.options ?? [];
  return (
    options.find((o) => o.kind === 'allow_always') ??
    options.find((o) => o.kind === 'allow_once') ??
    options.find((o) => typeof o.kind === 'string' && o.kind.startsWith('allow')) ??
    null
  );
}

export class AcpBridge {
  private proc: Spawned | null = null;
  private conn: ClientSideConnection | null = null;
  // One ACP session per chat id (repo-level), so each chat keeps its own claude
  // context. The adapter (one subprocess) holds them all; switching chats reuses
  // the session, so claude remembers that chat while the app is open.
  private sessions = new Map<string, string>(); // chatId → sessionId
  private currentSession: string | null = null; // the in-flight prompt's session
  /** Sessions whose bootstrap brief already hit the transcript (audit record). */
  private briefLogged = new Set<string>();
  private starting: Promise<void> | null = null;
  /** Per-chat transcript file (`_chat/<id>.jsonl`); set per prompt. */
  private transcriptPath: string | null = null;
  // Model + effort are env-at-spawn (ANTHROPIC_MODEL / MAX_THINKING_TOKENS), so a
  // change re-spawns the adapter. `desired*` is what the UI asked for; `active*`
  // is what the running session was spawned with.
  private desiredModel: string | null = null;
  private desiredEffort: AcpEffort = 'balanced';
  private activeModel: string | null = null;
  private activeEffort: AcpEffort = 'balanced';

  constructor(private readonly opts: AcpBridgeOptions) {}

  /** The session id of the most recent prompt (for the `connected` frame). */
  get sessionId(): string | null {
    return this.currentSession;
  }

  get connected(): boolean {
    return this.conn !== null && this.proc !== null;
  }

  setTranscriptPath(path: string | null): void {
    this.transcriptPath = path;
  }

  /** Desired model (alias/id, or null for the user's default) + effort. Applied
   *  on the next prompt — re-spawning the adapter only if it actually changed. */
  setConfig(model: string | null, effort: AcpEffort): void {
    this.desiredModel = model;
    this.desiredEffort = effort in EFFORT_THINKING_TOKENS ? effort : 'balanced';
  }

  private configChanged(): boolean {
    return this.desiredModel !== this.activeModel || this.desiredEffort !== this.activeEffort;
  }

  /** Spawn + handshake exactly once; concurrent callers share the same promise. */
  async ensureStarted(): Promise<void> {
    if (this.conn) return;
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  /** Get-or-create the ACP session for a chat id (one claude context per chat). */
  private async sessionFor(chatId: string): Promise<string> {
    const existing = this.sessions.get(chatId);
    if (existing) return existing;
    if (!this.conn) throw new Error('ACP adapter not started');
    const created = await this.conn.newSession(
      newSessionParams(this.opts.repoRoot, this.opts.studioBrief, this.opts.plugins)
    );
    this.sessions.set(chatId, created.sessionId);
    return created.sessionId;
  }

  private async start(): Promise<void> {
    const adapterEntry = resolveAdapterEntry();
    if (!adapterEntry) {
      throw new Error('The Claude agent bridge is not installed in this build.');
    }
    const claudePath = resolveClaudePath();
    if (!claudePath) {
      throw new Error("Claude Code isn't connected — run `claude` in a terminal and `/login`.");
    }

    // DDR-123 guardrail #1 — strip ANTHROPIC_API_KEY so the child stays on the
    // user's subscription. This is the whole compliance story; do not weaken it.
    const env = scrubAgentEnv(process.env);
    // DDR-123 guardrail #2 — pin the adapter to the user's OWN `claude` CLI.
    // `claude-agent-acp`'s `claudeCliPath()` honors CLAUDE_CODE_EXECUTABLE and
    // ONLY otherwise falls back to the ~210 MB native Claude binary shipped as a
    // platform-specific OPTIONAL dep of @anthropic-ai/claude-agent-sdk. The
    // desktop bundle deliberately stages just the adapter's JS closure (not that
    // native binary — see apps/desktop/scripts/stage-resources.mjs), so without
    // this pin the packaged adapter would throw "native binary not found". Driving
    // the user's installed CLI is also the documented intent: it keeps the turn on
    // their subscription rather than the SDK's embedded runtime.
    env.CLAUDE_CODE_EXECUTABLE = claudePath;
    // Least-privilege: the adapter child never talks to the dev-server's GitHub
    // token bridge (only apps/studio/github/token.ts does), so drop the loopback
    // keychain-bridge handle from its env. Keeps a hijacked-PATH `claude` (which
    // would require pre-existing RCE) from reading the user's GitHub token.
    // biome-ignore lint/performance/noDelete: security env-scrub — the key must be fully removed from the child's env, not set to `undefined` (which can leak through as `X=` on spawn).
    delete env.MAUDE_TOKEN_ENDPOINT;
    // biome-ignore lint/performance/noDelete: security env-scrub — see above; `delete` is the intentional primitive here.
    delete env.MAUDE_TOKEN_KEY;
    // Model + effort selection — config, NOT credentials, so they're added back.
    this.activeModel = this.desiredModel;
    this.activeEffort = this.desiredEffort;
    if (this.activeModel) env.ANTHROPIC_MODEL = this.activeModel;
    const thinking = EFFORT_THINKING_TOKENS[this.activeEffort];
    if (thinking !== null && thinking !== undefined) env.MAX_THINKING_TOKENS = String(thinking);

    const proc = Bun.spawn([resolveAgentRuntime(), adapterEntry], {
      cwd: this.opts.repoRoot,
      env,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    this.proc = proc;
    void this.drainStderr(proc.stderr);

    // Bun's `proc.stdin` is a FileSink, not a WritableStream — wrap it so
    // ndJsonStream can pipe encoded ACP frames into the child's stdin.
    const toChild = new WritableStream<Uint8Array>({
      write: (chunk) => {
        proc.stdin.write(chunk);
        proc.stdin.flush();
      },
      close: () => {
        try {
          proc.stdin.end();
        } catch {
          /* already gone */
        }
      },
      abort: () => {
        try {
          proc.stdin.end();
        } catch {
          /* already gone */
        }
      },
    });
    const stream = ndJsonStream(toChild, proc.stdout as ReadableStream<Uint8Array>);

    const client: Client = {
      sessionUpdate: (params: SessionNotification) => {
        // The command catalogue is chrome, not chat — surface it to the UI but
        // keep it out of the rendered turn + the persisted transcript.
        if (params.update.sessionUpdate === 'available_commands_update') {
          this.opts.onCommands?.(params.update.availableCommands ?? []);
          return;
        }
        this.opts.onUpdate(params.update);
        void this.appendTranscript({ role: 'agent', update: params.update });
      },
      requestPermission: (params: RequestPermissionRequest): RequestPermissionResponse => {
        // Auto-approve: the agent is the user's OWN local Claude editing their
        // OWN project over loopback — granting it is the feature, mirroring
        // Claude Code's trusted-session default. A manual approve/deny UI is a
        // Task-3 follow-up; we surface the request so the panel can show it.
        this.opts.onPermission?.(params);
        const option = pickAllowOption(params);
        if (!option) return { outcome: { outcome: 'cancelled' } };
        return { outcome: { outcome: 'selected', optionId: option.optionId } };
      },
    };

    const conn = new ClientSideConnection(() => client, stream);
    this.conn = conn;

    await conn.initialize({
      protocolVersion: PROTOCOL_VERSION,
      // We don't expose the project filesystem to the agent over ACP — the
      // spawned `claude` already has direct disk access to `cwd`, so advertising
      // fs capabilities here would only duplicate (and widen) that surface.
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
    });
    // Sessions are created lazily per chat (sessionFor) — not here.
  }

  /** Send a user turn for `chatId` and resolve when it completes. */
  async prompt(
    text: string,
    chatId: string
  ): Promise<{ stopReason: PromptResponse['stopReason'] }> {
    // Model/effort are env-at-spawn — if the user changed them, tear the adapter
    // down so ensureStarted re-spawns with the new env (sessions re-create lazily).
    if (this.conn && this.configChanged()) {
      await this.stop();
    }
    await this.ensureStarted();
    const conn = this.conn;
    if (!conn) throw new Error('ACP adapter not ready');
    const sessionId = await this.sessionFor(chatId);
    this.currentSession = sessionId;

    // Audit record (feature-acp-context-hardening, BREAKER guard): the brief
    // steers an auto-approving agent, so invisible-to-user must not mean
    // invisible-to-transcript. Logged on the session's FIRST real turn (the
    // first turn it could steer — warmUp has no transcript path yet); UI
    // renderers skip role:'bootstrap'.
    if (this.opts.studioBrief && !this.briefLogged.has(sessionId)) {
      this.briefLogged.add(sessionId);
      await this.appendTranscript({ role: 'bootstrap', text: this.opts.studioBrief });
      // DDR-143 — the session-scoped plugin auto-load silently changes the
      // available command/tool surface, so record exactly which plugins were
      // injected. Invisible-to-user must not mean invisible-to-audit for an
      // auto-approving (F2) agent — same discipline as the brief above.
      if (this.opts.plugins?.length) {
        await this.appendTranscript({
          role: 'bootstrap',
          kind: 'plugins-autoloaded',
          plugins: this.opts.plugins.map((p) => p.path),
        });
      }
    }
    await this.appendTranscript({ role: 'user', text });
    const response = await conn.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });
    await this.appendTranscript({ role: 'stop', stopReason: response.stopReason });
    return { stopReason: response.stopReason };
  }

  /**
   * Warm the adapter for a chat WITHOUT sending a prompt — spawns `claude`
   * (if not already up) and creates the session, so the agent publishes its
   * `available_commands_update` before the user's first message. Triggered when
   * the user starts typing a slash command (see ChatPanel), not on panel open,
   * so the "opening costs nothing" default holds until there's real intent.
   * Best-effort: callers swallow errors (autocomplete degrades to the static list).
   */
  async warmUp(chatId: string): Promise<void> {
    if (this.conn && this.configChanged()) await this.stop();
    await this.ensureStarted();
    await this.sessionFor(chatId);
  }

  /** Cancel the in-flight turn (no-op if nothing is running). */
  async cancel(): Promise<void> {
    if (this.conn && this.currentSession) {
      try {
        await this.conn.cancel({ sessionId: this.currentSession });
      } catch {
        /* turn may already have finished */
      }
    }
  }

  /** Tear down: cancel, kill the subprocess, drop all handles + sessions. */
  async stop(): Promise<void> {
    await this.cancel();
    try {
      this.proc?.kill();
    } catch {
      /* already dead */
    }
    this.proc = null;
    this.conn = null;
    this.sessions.clear();
    this.briefLogged.clear();
    this.currentSession = null;
  }

  private async drainStderr(stderr: ReadableStream<Uint8Array>): Promise<void> {
    try {
      const decoder = new TextDecoder();
      for await (const chunk of stderr) {
        const line = decoder.decode(chunk).trimEnd();
        if (line) console.error('[acp-adapter]', line);
      }
    } catch {
      /* stream closed on teardown */
    }
  }

  private async appendTranscript(entry: Record<string, unknown>): Promise<void> {
    const path = this.transcriptPath;
    if (!path) return;
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify({ ts: Date.now(), ...entry })}\n`);
    } catch {
      /* transcript is best-effort; never block the chat on disk errors */
    }
  }
}
