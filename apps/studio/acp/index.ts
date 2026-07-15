// ACP manager: owns one AcpBridge per `/_ws/acp` socket and translates the
// browser's JSON chat protocol to/from the ACP client. Wired into ws.ts (the
// `acp` socket kind) and server.ts (the main-origin, loopback-guarded upgrade).
// NEVER exposed on the canvas origin (DDR-054/DDR-123) — the untrusted iframe
// must not reach the agent bridge.

import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import type { AvailableCommand, SessionUpdate } from '@agentclientprotocol/sdk';
import type { ServerWebSocket } from 'bun';

import { isCanvasFile } from '../activity.ts';
import type { AiActivity } from '../collab/ai-activity.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';
import { buildStudioBrief } from './bootstrap-brief.ts';
import { AcpBridge, type BridgeUsage } from './bridge.ts';
import { isNativePluginContext, resolveSessionPlugins } from './plugin-bootstrap.ts';
import { probeAcpAvailability } from './probe.ts';

/**
 * Browser → server frames: `{ t: 'prompt', text, chat?, model?, effort?, mode? }`,
 * `{ t: 'cancel' }`, `{ t: 'warm', chat?, model?, effort?, mode? }` (spawn +
 * create the session so the agent publishes its slash-command catalogue — no
 * prompt sent), `{ t: 'set-mode', chat?, modeId }`, `{ t: 'set-config', chat?,
 * configId, value }` (live change on an already-established session —
 * feature-acp-panel-dynamic-claude-code-capabilities), `{ t: 'permission-response',
 * id, decision }` (Milestone B).
 * Server → browser frames: `ready` (availability on open), `connected` (session
 * live), `update` (each streamed session/update), `commands` (the agent's
 * `available_commands_update` catalogue — cached + replayed on open), `caps`
 * (the session's mode roster + config-option set — dynamic, never hardcoded),
 * `session-info` (agent-generated chat title), `permission-request` (Milestone B
 * approve/deny gate), `usage` (context-window + cost + rate-limit, Milestone D
 * — cached + replayed on open), `turn-end`, `permission`, `error`.
 */
export interface Acp {
  onOpen(ws: ServerWebSocket<WsData>): void;
  onMessage(ws: ServerWebSocket<WsData>, raw: string | Uint8Array): void;
  onClose(ws: ServerWebSocket<WsData>): void;
  /** Live bridge count — for diagnostics / teardown assertions. */
  size(): number;
}

// RC5 (rca/issue-canvas-hmr-optimistic-update-consistency) — the ACP chat agent
// edits canvases through its own tools, so unlike `/design:edit` (which curls
// /_api/ai/start|heartbeat|end around the edit) nothing announced it: no yellow
// banner, no DDR-078 agent presence, no colored rim. This tracker watches the
// streamed `tool_call` / `tool_call_update` notifications for edit-kind tools
// touching canvas files under <designRoot> and drives the same `ai-activity`
// registry the slash command uses. Keys are designRel-prefixed
// (`.design/ui/foo.tsx`) to match `window.__canvas_meta_file__` on the client.
const AGENT_AUTHOR = 'Claude (Maude chat)';
/** ACP ToolKinds that mutate files — read/search/think tools must not banner. */
const EDIT_KINDS = new Set(['edit', 'delete', 'move']);
/** Local re-beat throttle — well under ai-activity's 30 s grace, but sparse
 *  enough that a chatty turn doesn't broadcast a WS frame per stream chunk. */
const BEAT_MS = 4000;

interface AgentActivityTracker {
  onUpdate(update: SessionUpdate): void;
  /** Turn finished (normal, cancel, error) or socket closed — clear banners. */
  endTurn(): void;
}

/** Exported for tests (acp-ai-activity.test.ts); not part of the Acp surface. */
export function createAgentActivityTracker(ctx: Context, ai: AiActivity): AgentActivityTracker {
  const kindByToolCall = new Map<string, string>(); // toolCallId → kind
  const lastBeat = new Map<string, number>(); // ai-activity key → last beat ms

  function keyFor(p: unknown): string | null {
    if (typeof p !== 'string' || !p) return null;
    const abs = isAbsolute(p) ? p : resolve(ctx.paths.repoRoot, p);
    const rel = relative(ctx.paths.designRoot, abs);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
    const posix = rel.split(sep).join('/');
    if (!isCanvasFile(posix)) return null;
    return `${ctx.paths.designRel}/${posix}`;
  }

  function onUpdate(update: SessionUpdate): void {
    const u = update as {
      sessionUpdate?: string;
      toolCallId?: string;
      kind?: string;
      locations?: Array<{ path?: string } | null> | null;
      rawInput?: unknown;
    };
    if (u.sessionUpdate !== 'tool_call' && u.sessionUpdate !== 'tool_call_update') return;
    if (typeof u.kind === 'string' && u.toolCallId) kindByToolCall.set(u.toolCallId, u.kind);
    const kind =
      (typeof u.kind === 'string' ? u.kind : u.toolCallId && kindByToolCall.get(u.toolCallId)) ||
      '';
    if (!EDIT_KINDS.has(kind)) return;
    const candidates: unknown[] = [];
    if (Array.isArray(u.locations)) for (const l of u.locations) candidates.push(l?.path);
    const raw = u.rawInput as
      | { file_path?: unknown; abs_path?: unknown; path?: unknown }
      | null
      | undefined;
    if (raw && typeof raw === 'object') candidates.push(raw.file_path, raw.abs_path, raw.path);
    const now = Date.now();
    for (const p of candidates) {
      const key = keyFor(p);
      if (!key) continue;
      const last = lastBeat.get(key);
      if (last == null) {
        ai.start(key, AGENT_AUTHOR);
        lastBeat.set(key, now);
      } else if (now - last > BEAT_MS) {
        ai.heartbeat(key);
        lastBeat.set(key, now);
      }
    }
  }

  function endTurn(): void {
    for (const key of lastBeat.keys()) ai.end(key);
    lastBeat.clear();
    kindByToolCall.clear();
  }

  return { onUpdate, endTurn };
}

export function createAcp(ctx: Context, aiActivity?: AiActivity): Acp {
  const bridges = new Map<string, AcpBridge>();
  // RC5 — per-socket agent-activity tracker (see createAgentActivityTracker).
  const trackers = new Map<string, AgentActivityTracker>();
  // Latest slash-command catalogue seen from ANY bridge this process lifetime.
  // Replayed to a freshly-opened socket so the composer autocomplete is instant
  // on the second panel-open without re-warming. Not persisted (static list in
  // the client covers a cold process); avoids DDR-115 runtime-state churn.
  let latestCommands: AvailableCommand[] = [];
  // Milestone D — same replay-on-open treatment for the last-seen usage
  // snapshot, so a freshly-opened socket shows SOMETHING immediately instead
  // of waiting for the chat's first turn to complete.
  let latestUsage: BridgeUsage | null = null;

  function send(ws: ServerWebSocket<WsData>, payload: unknown): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* dead socket — close handler cleans up */
    }
  }

  /** Get-or-create the per-socket bridge, wiring its update/permission/command sinks. */
  function getOrCreateBridge(ws: ServerWebSocket<WsData>): AcpBridge {
    let bridge = bridges.get(ws.data.id);
    if (!bridge) {
      const tracker = aiActivity ? createAgentActivityTracker(ctx, aiActivity) : null;
      if (tracker) trackers.set(ws.data.id, tracker);
      bridge = new AcpBridge({
        repoRoot: ctx.paths.repoRoot,
        // Static, config-derived environment brief for every new session
        // (feature-acp-context-hardening; see bootstrap-brief.ts guardrails).
        studioBrief: buildStudioBrief({
          designRel: ctx.paths.designRel,
          projectLabel: ctx.projectLabel,
          // DDR-143 — on the native/desktop path the `/design:*` commands are
          // present in the session (auto-loaded or installed), so the brief states
          // that plainly instead of hedging. (`/flow:*` is intentionally excluded
          // from the chat for now — 2026-07-03.)
          commandsAvailable: isNativePluginContext(),
        }),
        // DDR-143 — session-scoped `design` auto-load for the zero-install desktop
        // path (`/flow` auto-load disabled for now — 2026-07-03). Empty on the
        // power-user (already-installed) + web-serve no-op paths. Computed once
        // here; carried on the readonly bridge options so it survives an adapter
        // re-spawn (model/effort change).
        plugins: resolveSessionPlugins(),
        onUpdate: (update) => {
          tracker?.onUpdate(update);
          send(ws, { t: 'update', update });
        },
        onPermission: (req) => send(ws, { t: 'permission', toolCall: req.toolCall }),
        onPermissionRequest: (id, req) =>
          send(ws, { t: 'permission-request', id, toolCall: req.toolCall, options: req.options }),
        onCommands: (commands) => {
          latestCommands = commands;
          send(ws, { t: 'commands', commands });
        },
        onCaps: (modes, configOptions) => send(ws, { t: 'caps', modes, configOptions }),
        onSessionInfo: (info) => send(ws, { t: 'session-info', ...info }),
        onUsage: (usage) => {
          latestUsage = usage;
          send(ws, { t: 'usage', usage });
        },
      });
      bridges.set(ws.data.id, bridge);
    }
    return bridge;
  }

  // Chats are repo-level (NOT per-canvas) — `_chat/<chatId>.jsonl`. The id is
  // client-generated; sanitize it to a safe filename.
  function sanitizeChatId(id: string): string {
    const safe = id.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
    return safe || 'default';
  }
  function chatFilePathFor(chatId: string, suffix: string): string {
    return join(ctx.paths.designRoot, '_chat', `${sanitizeChatId(chatId)}${suffix}`);
  }
  function transcriptPathFor(chatId: string): string {
    return chatFilePathFor(chatId, '.jsonl');
  }
  // Sidecar persisting this chat's ACP sessionId across restarts (bridge.ts
  // sessionFor's resume path) — the cross-restart memory gap tracked in DDR-125.
  function sessionStorePathFor(chatId: string): string {
    return chatFilePathFor(chatId, '.session.json');
  }

  async function handlePrompt(
    ws: ServerWebSocket<WsData>,
    text: string,
    chatId: string,
    model: string | null,
    effort: string | null,
    modeId: string | null
  ): Promise<void> {
    const bridge = getOrCreateBridge(ws);
    bridge.setTranscriptPath(transcriptPathFor(chatId));
    bridge.setSessionStorePath(sessionStorePathFor(chatId));
    bridge.setConfig(model, effort, modeId);
    try {
      await bridge.ensureStarted();
      const { stopReason } = await bridge.prompt(text, sanitizeChatId(chatId));
      send(ws, { t: 'connected', sessionId: bridge.sessionId });
      send(ws, { t: 'turn-end', stopReason });
    } catch (err) {
      send(ws, { t: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      // RC5 — the turn is over (success, error, or cancel-induced stop): clear
      // every "Claude is editing …" banner this turn raised. The 30 s heartbeat
      // grace still covers a crashed dev-server round-trip.
      trackers.get(ws.data.id)?.endTurn();
    }
  }

  /**
   * Warm-up: spawn + create the session (no prompt) so the agent publishes its
   * command catalogue. Best-effort — a failure just means the composer falls back
   * to the static command list until the first real turn.
   */
  async function handleWarm(
    ws: ServerWebSocket<WsData>,
    chatId: string,
    model: string | null,
    effort: string | null,
    modeId: string | null
  ): Promise<void> {
    const bridge = getOrCreateBridge(ws);
    bridge.setSessionStorePath(sessionStorePathFor(chatId));
    bridge.setConfig(model, effort, modeId);
    try {
      await bridge.warmUp(sanitizeChatId(chatId));
    } catch {
      /* best-effort — no error frame; autocomplete degrades gracefully */
    }
  }

  /** True when `value` is currently offered for the select-type option `configId`
   *  on `bridge`'s last-advertised set — the dynamic replacement for the old
   *  hardcoded VALID_MODELS/VALID_EFFORT allowlists (DDR-125 F1: a loopback
   *  frame still can't pin an arbitrary value onto a live session). */
  function optionOffers(bridge: AcpBridge, configId: string, value: string): boolean {
    const opt = bridge.configOptions.find((o) => o.id === configId);
    if (opt?.type !== 'select') return false;
    const list = Array.isArray(opt.options) ? opt.options : [];
    for (const o of list) {
      if (o && typeof o === 'object' && 'options' in o && Array.isArray(o.options)) {
        if (o.options.some((leaf) => leaf.value === value)) return true;
      } else if (o && typeof o === 'object' && 'value' in o && o.value === value) {
        return true;
      }
    }
    return false;
  }

  /** Live mode change on an already-established session (Task A2/A4). */
  async function handleSetMode(
    ws: ServerWebSocket<WsData>,
    chatId: string,
    modeId: string
  ): Promise<void> {
    const bridge = bridges.get(ws.data.id);
    if (!bridge) return;
    if (!bridge.modes?.availableModes.some((m) => m.id === modeId)) return; // not advertised — reject silently
    try {
      await bridge.setMode(sanitizeChatId(chatId), modeId);
    } catch {
      /* best-effort — the picker just keeps showing the last-confirmed caps frame */
    }
  }

  /** Live config-option change (model/effort/fast/…) on an already-established session. */
  async function handleSetConfig(
    ws: ServerWebSocket<WsData>,
    chatId: string,
    configId: string,
    value: string
  ): Promise<void> {
    const bridge = bridges.get(ws.data.id);
    if (!bridge) return;
    if (!optionOffers(bridge, configId, value)) return; // not advertised — reject silently
    try {
      await bridge.setConfigOption(sanitizeChatId(chatId), configId, value);
    } catch {
      /* best-effort — see handleSetMode */
    }
  }

  return {
    onOpen(ws) {
      const probe = probeAcpAvailability();
      send(ws, { t: 'ready', available: probe.available, reason: probe.reason });
      // Replay the last-known command catalogue so autocomplete is instant on a
      // re-open (no re-warm needed within a dev-server lifetime).
      if (latestCommands.length) send(ws, { t: 'commands', commands: latestCommands });
      // Same treatment for usage (Milestone D) — a stale cross-chat snapshot
      // briefly, corrected by the new chat's own first usage_update.
      if (latestUsage) send(ws, { t: 'usage', usage: latestUsage });
    },

    onMessage(ws, raw) {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      const frame = msg as {
        t?: unknown;
        text?: unknown;
        chat?: unknown;
        model?: unknown;
        effort?: unknown;
        mode?: unknown;
        modeId?: unknown;
        configId?: unknown;
        value?: unknown;
        id?: unknown;
        decision?: unknown;
      };

      const chatId = typeof frame.chat === 'string' && frame.chat ? frame.chat : 'default';
      // Model/effort/mode are opaque, dynamic option ids/values now (no
      // hardcoded allowlist) — a persisted pick that isn't actually offered by
      // the resolved session is silently skipped by the bridge's own
      // `optionOffers` check (`applyDesiredConfigOnce`), never forwarded blind
      // to the adapter. Live mid-session changes (`set-mode`/`set-config`
      // below) DO get validated against the bridge's last-advertised set —
      // that is the DDR-125 F1 boundary that matters (pinning a value onto an
      // ALREADY-running session).
      const model = typeof frame.model === 'string' && frame.model ? frame.model : null;
      const effort = typeof frame.effort === 'string' && frame.effort ? frame.effort : null;
      const modeId = typeof frame.mode === 'string' && frame.mode ? frame.mode : null;

      if (frame.t === 'prompt' && typeof frame.text === 'string') {
        void handlePrompt(ws, frame.text, chatId, model, effort, modeId);
      } else if (frame.t === 'warm') {
        void handleWarm(ws, chatId, model, effort, modeId);
      } else if (frame.t === 'cancel') {
        // RC5 — a cancelled turn may never resolve prompt(); clear banners now.
        trackers.get(ws.data.id)?.endTurn();
        void bridges.get(ws.data.id)?.cancel();
      } else if (frame.t === 'set-mode' && typeof frame.modeId === 'string' && frame.modeId) {
        void handleSetMode(ws, chatId, frame.modeId);
      } else if (
        frame.t === 'set-config' &&
        typeof frame.configId === 'string' &&
        frame.configId &&
        typeof frame.value === 'string'
      ) {
        void handleSetConfig(ws, chatId, frame.configId, frame.value);
      } else if (frame.t === 'permission-response' && typeof frame.id === 'string' && frame.id) {
        // Milestone B — the human's approve/deny decision for a pending
        // `permission-request`. `decision` is either an offered `optionId` or
        // the literal 'cancelled'; anything else collapses to 'cancelled'
        // (deny) rather than forwarding an unvalidated string as an optionId
        // — resolvePermission itself is a no-op on an unknown/already-settled
        // id, so a malformed decision here just denies, never allows blind.
        const decision =
          typeof frame.decision === 'string' && frame.decision ? frame.decision : 'cancelled';
        bridges.get(ws.data.id)?.resolvePermission(frame.id, decision);
      }
    },

    onClose(ws) {
      trackers.get(ws.data.id)?.endTurn();
      trackers.delete(ws.data.id);
      const bridge = bridges.get(ws.data.id);
      if (bridge) {
        bridges.delete(ws.data.id);
        void bridge.stop();
      }
    },

    size() {
      return bridges.size;
    },
  };
}
