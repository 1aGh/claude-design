// Phase 31 (DDR-123) — client glue between assistant-ui's local runtime and the
// dev-server ACP bridge (`/_ws/acp`). One persistent socket per ChatPanel mount;
// the bridge lazy-spawns the user's `claude` on the first prompt, so just opening
// the panel costs nothing. A custom `ChatModelAdapter` translates the bridge's
// JSON frames into the streamed assistant message parts assistant-ui renders.

const WS_PATH = '/_ws/acp';

/** Connection wrapper around the loopback `/_ws/acp` socket. */
export function createAcpConnection() {
  let ws = null;
  let openPromise = null;
  let turnHandler = null; // the in-flight run()'s frame sink
  const statusListeners = new Set();
  const status = { available: null, reason: undefined, ready: false };

  // Live "what's running now" — in-flight tool calls (a tool_call with no
  // completed/failed tool_call_update yet). Surfaced as the activity bar so
  // background work is visible at a glance, not only buried in the text.
  const activityListeners = new Set();
  const activeTools = new Map(); // toolCallId → { title, kind }

  function emitStatus() {
    for (const fn of statusListeners) fn({ ...status });
  }

  function emitActivity() {
    const snapshot = [...activeTools.values()];
    for (const fn of activityListeners) fn(snapshot);
  }

  function trackActivity(frame) {
    if (frame.t === 'update') {
      const u = frame.update;
      if (u.sessionUpdate === 'tool_call') {
        activeTools.set(u.toolCallId, { title: u.title || u.kind || 'tool', kind: u.kind });
        emitActivity();
      } else if (
        u.sessionUpdate === 'tool_call_update' &&
        (u.status === 'completed' || u.status === 'failed')
      ) {
        if (activeTools.delete(u.toolCallId)) emitActivity();
      }
    } else if (frame.t === 'turn-end' || frame.t === 'error') {
      if (activeTools.size) {
        activeTools.clear();
        emitActivity();
      }
    }
  }

  function onFrame(frame) {
    if (frame.t === 'ready') {
      status.ready = true;
      status.available = frame.available;
      status.reason = frame.reason;
      emitStatus();
      return;
    }
    // Everything else belongs to the active prompt turn.
    trackActivity(frame);
    if (turnHandler) turnHandler(frame);
  }

  function ensureOpen() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return openPromise;
    }
    openPromise = new Promise((resolve, reject) => {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const sock = new WebSocket(`${scheme}://${location.host}${WS_PATH}`);
      ws = sock;
      sock.onopen = () => resolve();
      sock.onerror = () => reject(new Error('Could not reach the Claude bridge.'));
      sock.onclose = () => {
        ws = null;
        status.ready = false;
        emitStatus();
      };
      sock.onmessage = (e) => {
        try {
          onFrame(JSON.parse(e.data));
        } catch {
          /* ignore malformed frame */
        }
      };
    });
    return openPromise;
  }

  return {
    onStatus(fn) {
      statusListeners.add(fn);
      fn({ ...status });
      return () => statusListeners.delete(fn);
    },

    onActivity(fn) {
      activityListeners.add(fn);
      fn([...activeTools.values()]);
      return () => activityListeners.delete(fn);
    },

    /**
     * Drive one prompt turn. Async-generates the bridge's `update` frames until
     * `turn-end`; throws on `error`; sends `cancel` when `abortSignal` aborts.
     */
    async *prompt(text, canvas, abortSignal, model, effort) {
      await ensureOpen();
      const queue = [];
      let wake = null;
      let ended = false;
      let failure = null;
      turnHandler = (frame) => {
        if (frame.t === 'turn-end') ended = true;
        else if (frame.t === 'error') failure = frame.message || 'The Claude bridge errored.';
        else queue.push(frame); // update / connected / permission
        if (wake) {
          const w = wake;
          wake = null;
          w();
        }
      };
      const cancel = () => {
        try {
          ws?.send(JSON.stringify({ t: 'cancel' }));
        } catch {
          /* socket already gone */
        }
      };
      abortSignal?.addEventListener('abort', cancel, { once: true });
      try {
        ws.send(
          JSON.stringify({
            t: 'prompt',
            text,
            canvas: canvas || undefined,
            model: model || undefined,
            effort: effort || undefined,
          })
        );
        for (;;) {
          while (queue.length) yield queue.shift();
          if (failure) throw new Error(failure);
          if (ended) return;
          await new Promise((r) => {
            wake = r;
          });
        }
      } finally {
        turnHandler = null;
        abortSignal?.removeEventListener('abort', cancel);
      }
    },

    close() {
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      ws = null;
    },
  };
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    return (m.content || [])
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
      .trim();
  }
  return '';
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

/**
 * assistant-ui `ChatModelAdapter` over the ACP bridge. Streams text + tool-call
 * parts, preserving the order in which the agent emits them. `available_commands_update`
 * and `usage_update` are intentionally dropped (chrome noise, not chat content).
 */
export function makeAcpAdapter(conn, getCanvas, getModel, getEffort) {
  return {
    async *run({ messages, abortSignal }) {
      const text = lastUserText(messages);
      if (!text) return;

      const parts = [];
      const toolIndex = new Map();

      for await (const frame of conn.prompt(
        text,
        getCanvas(),
        abortSignal,
        getModel?.(),
        getEffort?.()
      )) {
        if (frame.t !== 'update') continue;
        const u = frame.update;
        switch (u.sessionUpdate) {
          case 'agent_message_chunk': {
            if (u.content?.type !== 'text') break;
            const last = parts[parts.length - 1];
            if (last && last.type === 'text') {
              parts[parts.length - 1] = { ...last, text: last.text + u.content.text };
            } else {
              parts.push({ type: 'text', text: u.content.text });
            }
            break;
          }
          case 'tool_call': {
            toolIndex.set(u.toolCallId, parts.length);
            parts.push({
              type: 'tool-call',
              toolCallId: u.toolCallId,
              toolName: u.title || u.kind || 'tool',
              args: u.rawInput ?? {},
              argsText: safeJson(u.rawInput),
              result: undefined,
            });
            break;
          }
          case 'tool_call_update': {
            const idx = toolIndex.get(u.toolCallId);
            if (idx == null) break;
            parts[idx] = {
              ...parts[idx],
              result: u.rawOutput ?? parts[idx].result,
              isError: u.status === 'failed',
            };
            break;
          }
          default:
            break; // plan / thought / commands / usage — not rendered in v1
        }
        yield { content: parts.slice() };
      }
    },
  };
}
