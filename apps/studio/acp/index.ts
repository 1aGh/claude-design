// ACP manager: owns one AcpBridge per `/_ws/acp` socket and translates the
// browser's JSON chat protocol to/from the ACP client. Wired into ws.ts (the
// `acp` socket kind) and server.ts (the main-origin, loopback-guarded upgrade).
// NEVER exposed on the canvas origin (DDR-054/DDR-123) — the untrusted iframe
// must not reach the agent bridge.

import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';
import { AcpBridge, type AcpEffort } from './bridge.ts';
import { probeAcpAvailability } from './probe.ts';

const VALID_EFFORT = new Set(['fast', 'balanced', 'thorough']);
// Model is set as ANTHROPIC_MODEL on the spawned child — allowlist it server-side
// (security review F1) so the loopback WS frame can't pin an arbitrary value.
const VALID_MODELS = new Set(['opus', 'sonnet', 'haiku']);

/**
 * Browser → server frames: `{ t: 'prompt', text, canvas? }`, `{ t: 'cancel' }`.
 * Server → browser frames: `ready` (availability on open), `connected` (session
 * live), `update` (each streamed session/update), `turn-end`, `permission`,
 * `error`.
 */
export interface Acp {
  onOpen(ws: ServerWebSocket<WsData>): void;
  onMessage(ws: ServerWebSocket<WsData>, raw: string | Uint8Array): void;
  onClose(ws: ServerWebSocket<WsData>): void;
  /** Live bridge count — for diagnostics / teardown assertions. */
  size(): number;
}

export function createAcp(ctx: Context): Acp {
  const bridges = new Map<string, AcpBridge>();

  function send(ws: ServerWebSocket<WsData>, payload: unknown): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* dead socket — close handler cleans up */
    }
  }

  // Chats are repo-level (NOT per-canvas) — `_chat/<chatId>.jsonl`. The id is
  // client-generated; sanitize it to a safe filename.
  function sanitizeChatId(id: string): string {
    const safe = id.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
    return safe || 'default';
  }
  function transcriptPathFor(chatId: string): string {
    return join(ctx.paths.designRoot, '_chat', `${sanitizeChatId(chatId)}.jsonl`);
  }

  async function handlePrompt(
    ws: ServerWebSocket<WsData>,
    text: string,
    chatId: string,
    model: string | null,
    effort: AcpEffort
  ): Promise<void> {
    let bridge = bridges.get(ws.data.id);
    if (!bridge) {
      bridge = new AcpBridge({
        repoRoot: ctx.paths.repoRoot,
        onUpdate: (update) => send(ws, { t: 'update', update }),
        onPermission: (req) => send(ws, { t: 'permission', toolCall: req.toolCall }),
      });
      bridges.set(ws.data.id, bridge);
    }
    bridge.setTranscriptPath(transcriptPathFor(chatId));
    bridge.setConfig(model, effort);
    try {
      await bridge.ensureStarted();
      const { stopReason } = await bridge.prompt(text, sanitizeChatId(chatId));
      send(ws, { t: 'connected', sessionId: bridge.sessionId });
      send(ws, { t: 'turn-end', stopReason });
    } catch (err) {
      send(ws, { t: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    onOpen(ws) {
      const probe = probeAcpAvailability();
      send(ws, { t: 'ready', available: probe.available, reason: probe.reason });
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
      };

      if (frame.t === 'prompt' && typeof frame.text === 'string') {
        const chatId = typeof frame.chat === 'string' && frame.chat ? frame.chat : 'default';
        const model =
          typeof frame.model === 'string' && VALID_MODELS.has(frame.model) ? frame.model : null;
        const effort: AcpEffort =
          typeof frame.effort === 'string' && VALID_EFFORT.has(frame.effort)
            ? (frame.effort as AcpEffort)
            : 'balanced';
        void handlePrompt(ws, frame.text, chatId, model, effort);
      } else if (frame.t === 'cancel') {
        void bridges.get(ws.data.id)?.cancel();
      }
    },

    onClose(ws) {
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
