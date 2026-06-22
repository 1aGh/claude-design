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
import { resolveAdapterEntry, resolveAgentRuntime, resolveClaudePath } from './probe.ts';

export interface AcpBridgeOptions {
  /** Absolute repo root the ACP session runs in (where `.design/` + the CLI operate). */
  repoRoot: string;
  /** Streamed `session/update` notifications relayed to the browser. */
  onUpdate: (update: SessionUpdate) => void;
  /** Informational: a tool permission was auto-approved (transparency for the UI). */
  onPermission?: (req: RequestPermissionRequest) => void;
}

type Spawned = ReturnType<typeof Bun.spawn>;

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
  private session: string | null = null;
  private starting: Promise<void> | null = null;
  /** Per-canvas transcript file; mutable because the active canvas can change. */
  private transcriptPath: string | null = null;

  constructor(private readonly opts: AcpBridgeOptions) {}

  /** ACP session id once `newSession` has resolved, else null. */
  get sessionId(): string | null {
    return this.session;
  }

  get connected(): boolean {
    return this.session !== null;
  }

  setTranscriptPath(path: string | null): void {
    this.transcriptPath = path;
  }

  /** Spawn + handshake exactly once; concurrent callers share the same promise. */
  async ensureStarted(): Promise<void> {
    if (this.session) return;
    if (!this.starting) {
      this.starting = this.start().finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private async start(): Promise<void> {
    const adapterEntry = resolveAdapterEntry();
    if (!adapterEntry) {
      throw new Error('The Claude agent bridge is not installed in this build.');
    }
    if (!resolveClaudePath()) {
      throw new Error("Claude Code isn't connected — run `claude` in a terminal and `/login`.");
    }

    const proc = Bun.spawn([resolveAgentRuntime(), adapterEntry], {
      cwd: this.opts.repoRoot,
      // DDR-123 guardrail #1 — strip ANTHROPIC_API_KEY so the child stays on the
      // user's subscription. This is the whole compliance story; do not weaken it.
      env: scrubAgentEnv(process.env),
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
    const created = await conn.newSession({ cwd: this.opts.repoRoot, mcpServers: [] });
    this.session = created.sessionId;
  }

  /** Send a user turn and resolve when it completes. Spawns the agent on first call. */
  async prompt(text: string): Promise<{ stopReason: PromptResponse['stopReason'] }> {
    await this.ensureStarted();
    const conn = this.conn;
    const sessionId = this.session;
    if (!conn || !sessionId) throw new Error('ACP session not ready');

    await this.appendTranscript({ role: 'user', text });
    const response = await conn.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });
    await this.appendTranscript({ role: 'stop', stopReason: response.stopReason });
    return { stopReason: response.stopReason };
  }

  /** Cancel the in-flight turn (no-op if nothing is running). */
  async cancel(): Promise<void> {
    if (this.conn && this.session) {
      try {
        await this.conn.cancel({ sessionId: this.session });
      } catch {
        /* turn may already have finished */
      }
    }
  }

  /** Tear down: cancel, kill the subprocess, drop all handles. */
  async stop(): Promise<void> {
    await this.cancel();
    try {
      this.proc?.kill();
    } catch {
      /* already dead */
    }
    this.proc = null;
    this.conn = null;
    this.session = null;
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
