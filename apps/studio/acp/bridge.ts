// Per-connection ACP bridge: spawns the user's Claude Code through the
// `claude-agent-acp` adapter and drives it as an ACP *client* (DDR-123).
//
//   browser ─/_ws/acp─► dev-server (this) ─stdio ndJSON─► claude-agent-acp ─► claude -p
//
// We never see or store an Anthropic credential — the spawned `claude` owns its
// own auth + billing. The single load-bearing guarantee is `scrubAgentEnv`
// (env.ts): the child inherits the environment MINUS `ANTHROPIC_API_KEY`, so
// auth precedence falls through to the user's Pro/Max subscription.

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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

// Real sessionIds are adapter-generated `randomUUID()`s. A persisted value that
// doesn't look like one (corrupt sidecar, or a tracked file a cloned repo
// shipped despite `_chat/` being gitignored — DDR-115) is rejected rather than
// forwarded into the privileged `loadSession` ACP call.
const VALID_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

// `loadSession`'s replay can, in principle, never settle if the underlying
// transport dies mid-call (adapter crash, a concurrent `stop()` from another
// chat sharing this bridge). Bound it so `replaying` always resets and a
// resume attempt always falls back to `newSession` instead of wedging the
// bridge silent forever. Mirrors the `withTimeout`/`TIMED_OUT` pattern already
// used for network calls in `apps/studio/git/service.ts`.
const LOAD_SESSION_TIMEOUT_MS = 15_000;
// RCA-G1 — cap the ACP handshake so a mis-launched runtime that never speaks ACP
// surfaces an error instead of an infinite "Working…". Generous: covers a cold
// first-spawn of the compiled adapter runtime, but well short of "forever".
const INITIALIZE_TIMEOUT_MS = 30_000;
const TIMED_OUT = Symbol('maude-acp-load-session-timeout');
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  p.catch(() => {});
  let timer: ReturnType<typeof setTimeout>;
  const t = new Promise<typeof TIMED_OUT>((res) => {
    timer = setTimeout(() => res(TIMED_OUT), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/**
 * Build the `session/new` params, carrying THREE adapter-internal `_meta`
 * payloads (all spread by the installed `claude-agent-acp` `newSession`):
 *
 *   • `_meta.systemPrompt.append` — the studio brief (feature-acp-context-
 *     hardening); the adapter spreads its object form over the `claude_code`
 *     preset (acp-agent.js:2282).
 *   • `_meta.claudeCode.options.plugins` — session-scoped local plugins (DDR-143,
 *     unconditional injection DDR-168); the adapter reads
 *     `_meta.claudeCode.options` (acp-agent.js:2302) and spreads the whole
 *     object into the SDK `query()` options (`...userProvidedOptions`,
 *     :2333 → :2455), so `plugins` reaches the SDK's `plugins?: SdkPluginConfig[]`
 *     (sdk.d.ts:1683) untouched — verified live (Task-1 spike).
 *   • `_meta.claudeCode.options.settings.enabledPlugins` — DDR-168's structural
 *     double-registration guard: present ONLY alongside a non-empty `plugins`,
 *     forcing off any natively-loaded user-level copy of the same plugin id
 *     via the same `...userProvidedOptions` spread (`settings` rides untouched
 *     exactly like `plugins` does) into the SDK's documented "flag" settings
 *     layer (sdk.d.ts:1831, highest priority among user-controlled settings).
 *
 * All three siblings coexist under one `_meta`. The SDK's `zNewSessionRequest`
 * declares `_meta` (zod.gen), so it rides the wire validated. These contracts are
 * adapter/SDK-INTERNAL and undocumented — an adapter/SDK bump that drops any of
 * them must fail the presence tests LOUDLY (acp-bootstrap-brief.test.ts +
 * acp-session-plugins.test.ts), not silently un-brief / un-plugin every session.
 * Exported for those tests.
 *
 * `cwd`/`mcpServers`/`_meta` are also exactly the shared fields of a
 * `LoadSessionRequest` (schema/types.gen.d.ts) — `sessionFor`'s resume path
 * spreads this same object and adds `sessionId` rather than duplicating it.
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
  if (plugins && plugins.length > 0) {
    options.plugins = plugins;
    // DDR-168 — the bundled `design` plugin is now injected UNCONDITIONALLY
    // (plugin-bootstrap.ts no longer skips when it's also installed/enabled at
    // the user level), so a power user with `design@maude` enabled in their OWN
    // ~/.claude would otherwise get it loaded from TWO sources at once: this
    // `options.plugins` entry, AND natively via `settingSources: ['user']`
    // above (double-registration / duplicate MCP spawns / duplicate hooks).
    // Force the natively-loaded copy off via the SDK's documented "flag"
    // settings layer (sdk.d.ts:1831 — highest priority among user-controlled
    // settings, precedence user < project < local < flag < policy; :5193's
    // `Settings.enabledPlugins` doc comment gives this exact worked example).
    // Keyed to whichever plugin ids are actually being injected — currently
    // only `design@maude`. Absent (not merely false) whenever `plugins` is
    // empty, so the npm/web path (where `plugins` is always empty) is
    // completely unaffected.
    //
    // SECURITY LANDMINE (ethical-hacker finding, DDR-168 review round 2) — this
    // literal is NOT derived from `plugins`/`plugin-bootstrap.ts`'s injection
    // set; it's hand-maintained. `plugin-bootstrap.ts`'s own comment calls
    // re-enabling `flow@maude` injection "a one-line addition" — that one line
    // does NOT touch this object. If you flip that on, you MUST also add
    // `'flow@maude': false` here, or a user with `flow@maude` natively enabled
    // gets it double-loaded with zero suppression (the exact double-
    // registration risk this override exists to close). No test currently
    // catches this drift.
    options.settings = { enabledPlugins: { 'design@maude': false } };
  }
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
  // In-flight sessionFor() calls, keyed by chatId — lets a `warm` and a `prompt`
  // racing for the same chat share one resume/create attempt instead of each
  // running establishSession() and stomping the single shared `replaying` flag.
  private sessionPromises = new Map<string, Promise<string>>();
  private currentSession: string | null = null; // the in-flight prompt's session
  /** Sessions whose bootstrap brief already hit the transcript (audit record). */
  private briefLogged = new Set<string>();
  private starting: Promise<void> | null = null;
  /** Per-chat transcript file (`_chat/<id>.jsonl`); set per prompt. */
  private transcriptPath: string | null = null;
  /** Sidecar persisting this chat's ACP sessionId across restarts (`_chat/<id>.session.json`). */
  private sessionStorePath: string | null = null;
  /** True while `conn.loadSession()` is replaying a resumed session's history
   *  back through the `sessionUpdate` client callback — see the guard in `start()`. */
  private replaying = false;
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

  setSessionStorePath(path: string | null): void {
    this.sessionStorePath = path;
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

  /**
   * Get-or-create the ACP session for a chat id (one claude context per chat).
   * `warm` and `prompt` can both reach this for the same chat close together
   * (composer autocomplete warm-up racing the user hitting send) — a second
   * concurrent call for the same chatId shares the FIRST call's in-flight
   * promise (mirrors `ensureStarted`'s `this.starting` pattern) rather than
   * re-entering resume/create and stomping the single shared `replaying` flag.
   */
  private async sessionFor(chatId: string): Promise<string> {
    const existing = this.sessions.get(chatId);
    if (existing) return existing;
    const inFlight = this.sessionPromises.get(chatId);
    if (inFlight) return inFlight;

    const promise = this.establishSession(chatId).finally(() => {
      this.sessionPromises.delete(chatId);
    });
    this.sessionPromises.set(chatId, promise);
    return promise;
  }

  /**
   * Resumes a session persisted from a PRIOR app/dev-server lifetime (the
   * cross-restart memory gap tracked in DDR-125) via the adapter's `loadSession`
   * before falling back to a brand-new `newSession` — either because this chat
   * has never had a session, or because the resume attempt failed (e.g. the
   * underlying claude session was pruned, `claude` was reinstalled, or the
   * adapter's response never arrives — `loadSession` is time-boxed so a dead
   * transport can't wedge `replaying` true forever and silently black-hole
   * every future turn on this bridge).
   */
  private async establishSession(chatId: string): Promise<string> {
    if (!this.conn) throw new Error('ACP adapter not started');

    const params = newSessionParams(this.opts.repoRoot, this.opts.studioBrief, this.opts.plugins);
    const persistedId = await this.readPersistedSessionId();
    if (persistedId) {
      try {
        this.replaying = true;
        const result = await withTimeout(
          this.conn.loadSession({ ...params, sessionId: persistedId }),
          LOAD_SESSION_TIMEOUT_MS
        );
        if (result === TIMED_OUT) {
          throw new Error(`loadSession timed out after ${LOAD_SESSION_TIMEOUT_MS}ms`);
        }
        this.sessions.set(chatId, persistedId);
        return persistedId;
      } catch (err) {
        await this.appendTranscript({
          role: 'bootstrap',
          kind: 'resume-failed',
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        this.replaying = false;
      }
    }

    const created = await this.conn.newSession(params);
    this.sessions.set(chatId, created.sessionId);
    await this.writePersistedSessionId(created.sessionId);
    return created.sessionId;
  }

  /** Read the sessionId persisted for this chat by a prior bridge lifetime.
   *  Null when there's no sidecar wired (e.g. warm-up before any prompt), the
   *  file doesn't exist yet (first-ever turn), it's unreadable/corrupt, or its
   *  `sessionId` doesn't look like a real one (defense-in-depth — this file's
   *  directory is per-machine/gitignored per DDR-115, but a cloned repo could
   *  still ship a tracked file there, so bound what we'll forward into the
   *  privileged `loadSession` ACP call rather than trusting its shape blindly). */
  private async readPersistedSessionId(): Promise<string | null> {
    if (!this.sessionStorePath) return null;
    try {
      const raw = await readFile(this.sessionStorePath, 'utf8');
      const data = JSON.parse(raw) as { sessionId?: unknown };
      const id = data.sessionId;
      return typeof id === 'string' && VALID_SESSION_ID.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  /** Persist a freshly-created sessionId so the NEXT bridge lifetime (app
   *  restart, dev-server restart) can resume this chat instead of starting
   *  fresh. Best-effort, like `appendTranscript` — a failed write just means
   *  the next restart falls back to a new session. */
  private async writePersistedSessionId(sessionId: string): Promise<void> {
    if (!this.sessionStorePath) return;
    try {
      await mkdir(dirname(this.sessionStorePath), { recursive: true });
      await writeFile(this.sessionStorePath, JSON.stringify({ sessionId, updatedAt: Date.now() }));
    } catch {
      /* best-effort — see doc comment above */
    }
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

    // RCA-G1 — resolve a runnable JS runtime. On a node/bun-less machine this
    // falls back to our own compiled self, which must be spawned with
    // BUN_BE_BUN=1 to behave as `bun` (else it re-runs the embedded server and
    // the handshake below never completes → "Working…" forever). Set on `env`
    // AFTER scrubAgentEnv (which doesn't touch BUN_BE_BUN).
    const runtime = resolveAgentRuntime();
    if (runtime.bunBeBun) env.BUN_BE_BUN = '1';
    const proc = Bun.spawn([runtime.bin, adapterEntry], {
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
        // `loadSession` replays the resumed session's entire prior history back
        // through this SAME callback (claude-agent-acp's replaySessionHistory) to
        // prime its own in-adapter state. That history is already on disk in the
        // transcript and already rendered client-side, so forwarding/re-appending
        // it here would duplicate every message in the panel and the jsonl file.
        if (this.replaying) return;
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

    // RCA-G1 — bound the handshake. If the spawned "adapter" is actually a
    // mis-launched runtime that never speaks ACP (the exact node-less bug: a
    // compiled sidecar re-run as a server instead of `bun`, before the
    // BUN_BE_BUN fix, or any future runtime regression), `initialize()` never
    // resolves and the panel hangs at "Working…" forever with no error. Time it
    // out, tear down the dead child, and surface a real error the UI can show
    // instead of an infinite spinner. Mirrors the `withTimeout` guard already
    // used for `loadSession`.
    const initResult = await withTimeout(
      conn.initialize({
        protocolVersion: PROTOCOL_VERSION,
        // We don't expose the project filesystem to the agent over ACP — the
        // spawned `claude` already has direct disk access to `cwd`, so advertising
        // fs capabilities here would only duplicate (and widen) that surface.
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      }),
      INITIALIZE_TIMEOUT_MS
    );
    if (initResult === TIMED_OUT) {
      this.conn = null;
      try {
        proc.kill();
      } catch {
        /* already gone */
      }
      this.proc = null;
      throw new Error(
        `AI editing couldn't start: the agent runtime didn't respond within ${INITIALIZE_TIMEOUT_MS / 1000}s. ` +
          `Check that Claude Code is installed and signed in (Help ▸ Check AI editing readiness).`
      );
    }
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
    // Drop any in-flight sessionFor() promises too — they were bound to the
    // now-dead `conn`; a subsequent sessionFor() for the same chatId must
    // establish fresh against the respawned connection, not await a stale
    // reference (each entry's own .finally() would eventually clear it once its
    // bounded loadSession timeout fires, but a call landing before then would
    // otherwise get back a result tied to the connection we just tore down).
    this.sessionPromises.clear();
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
