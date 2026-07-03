// Phase 31 (DDR-123) — client glue between assistant-ui's local runtime and the
// dev-server ACP bridge (`/_ws/acp`). One persistent socket per ChatPanel mount;
// the bridge lazy-spawns the user's `claude` on the first prompt (or the first
// `warm()` — sent when the user starts typing a slash command), so just opening
// the panel costs nothing. A custom `ChatModelAdapter` translates the bridge's
// JSON frames into the streamed assistant message parts assistant-ui renders.

const WS_PATH = '/_ws/acp';

/**
 * Pure reducer for the live "what's running now" map (exported for tests).
 * Returns true when the map changed. `turn-end` deliberately does NOT clear it:
 * the ACP adapter settles the prompt at the main agent's `result` while
 * background subagents keep running (claude-agent-acp #773 — see RCA
 * issue-acp-subagent-activity-invisible), so clearing on turn-end made that
 * still-running work vanish. Background tool_calls now drain on their own
 * completed/failed updates; only a hard `error` (teardown) wipes the map.
 */
export function reduceActivity(map, frame) {
  if (frame.t === 'update') {
    const u = frame.update;
    if (u.sessionUpdate === 'tool_call') {
      // `_meta.claudeCode.toolName` is the concrete Claude Code tool name — the
      // ONLY reliable subagent signal, since the adapter maps Task/Agent →
      // kind:"think" + title=description (which collide with a plain think tool).
      map.set(u.toolCallId, {
        title: u.title || u.kind || 'tool',
        kind: u.kind,
        toolName: u._meta?.claudeCode?.toolName,
      });
      return true;
    }
    if (
      u.sessionUpdate === 'tool_call_update' &&
      (u.status === 'completed' || u.status === 'failed')
    ) {
      return map.delete(u.toolCallId);
    }
    return false;
  }
  if (frame.t === 'error') {
    if (map.size) {
      map.clear();
      return true;
    }
  }
  return false;
}

/** A Task/Agent tool_call is how the ACP adapter surfaces a subagent. */
export function isSubagentTool(t) {
  return t.toolName === 'Task' || t.toolName === 'Agent';
}

/** Label for the "still working" indicator — names subagents explicitly. */
export function activityLabel(tools) {
  const subs = tools.filter(isSubagentTool);
  if (subs.length) return `${subs.length} subagent${subs.length > 1 ? 's' : ''} running`;
  if (tools.length === 1) return tools[0].title;
  if (tools.length > 1) return `${tools.length} tasks running`;
  return 'Working…';
}

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

  // Turn-busy signal — true while a prompt turn is in flight. Drives the
  // menubar Assistant badge + the "finished" notification.
  const busyListeners = new Set();
  let busy = false;

  // Slash-command catalogue (`available_commands_update`, cached server-side and
  // pushed as a `commands` frame) — drives the composer autocomplete + inline
  // command pill. Arrives on open (replay) and/or after warm()/first turn.
  const commandListeners = new Set();
  let commands = [];

  function emitStatus() {
    for (const fn of statusListeners) fn({ ...status });
  }

  function setBusy(next) {
    if (busy === next) return;
    busy = next;
    for (const fn of busyListeners) fn(busy);
  }

  function emitActivity() {
    const snapshot = [...activeTools.values()];
    for (const fn of activityListeners) fn(snapshot);
  }

  function trackActivity(frame) {
    if (reduceActivity(activeTools, frame)) emitActivity();
  }

  function onFrame(frame) {
    if (frame.t === 'ready') {
      status.ready = true;
      status.available = frame.available;
      status.reason = frame.reason;
      emitStatus();
      return;
    }
    // The command catalogue arrives outside any turn (on open / warm-up) — surface
    // it independently of the prompt-turn handler.
    if (frame.t === 'commands') {
      commands = Array.isArray(frame.commands) ? frame.commands : [];
      for (const fn of commandListeners) fn(commands);
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

    /** Subscribe to the slash-command catalogue; replays the current list. */
    onCommands(fn) {
      commandListeners.add(fn);
      fn(commands);
      return () => commandListeners.delete(fn);
    },

    /**
     * Warm the adapter WITHOUT prompting so the agent publishes its command
     * catalogue. Fired when the user starts typing a slash command. Best-effort;
     * a dead socket just leaves autocomplete on the static list.
     */
    async warm(chatId, model, effort) {
      try {
        await ensureOpen();
        ws?.send(
          JSON.stringify({
            t: 'warm',
            chat: chatId || undefined,
            model: model || undefined,
            effort: effort || undefined,
          })
        );
      } catch {
        /* socket unavailable — non-fatal */
      }
    },

    /**
     * Drive one prompt turn. Async-generates the bridge's `update` frames until
     * `turn-end`; throws on `error`; sends `cancel` when `abortSignal` aborts.
     */
    async *prompt(text, chatId, abortSignal, model, effort) {
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
      setBusy(true);
      // Fresh user turn — drop any orphaned activity from a prior turn whose
      // background work never resolved (defensive; the common path drains via
      // completed updates). setBusy(true) fires FIRST so the finished-ping
      // deferral (ChatPanel) sees busy before this reset's empty activity emit.
      if (activeTools.size) {
        activeTools.clear();
        emitActivity();
      }
      try {
        ws.send(
          JSON.stringify({
            t: 'prompt',
            text,
            chat: chatId || undefined,
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
        setBusy(false);
        abortSignal?.removeEventListener('abort', cancel);
      }
    },

    onBusy(fn) {
      busyListeners.add(fn);
      fn(busy);
      return () => busyListeners.delete(fn);
    },

    get busy() {
      return busy;
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

// Expand collapsed paste chips ([image-1]/[file-1]/[link-1]) back to the real
// path/URL the user pasted, so Claude receives the actual value while the chat
// bubble keeps the compact badge. Unknown tokens (e.g. a stale one the user typed
// by hand) are left untouched.
function expandPasteChips(text, map) {
  if (!map || !map.size) return text;
  return text.replace(/\[(?:image|file|link)-\d+\]/g, (tok) => map.get(tok) ?? tok);
}

/**
 * assistant-ui `ChatModelAdapter` over the ACP bridge. Streams text + tool-call
 * parts, preserving the order in which the agent emits them. `available_commands_update`
 * and `usage_update` are intentionally dropped (chrome noise, not chat content).
 */
export function makeAcpAdapter(conn, getChatId, getModel, getEffort, getAttachments, getContext) {
  return {
    async *run({ messages, abortSignal }) {
      // Let any in-flight clipboard-image upload finish so its chip expands to a
      // real path instead of the literal [image-N] (race when the user pastes an
      // image and hits Enter immediately).
      const att = getAttachments?.();
      if (att?.pending?.size) await Promise.allSettled([...att.pending]);
      const typed = expandPasteChips(lastUserText(messages), att?.map);
      if (!typed) return;
      // Freeze the canvas/selection context AT SEND (feature-acp-context-
      // hardening): the turn keeps the context it had when the user hit Enter,
      // immune to the user switching canvases while it runs. The same object
      // drives the visible composer chip (DDR-140 reveal — what you see is
      // what rides); the bracket lines carry locators only, never DOM html.
      // APPENDED after the typed text (paste-chip semantics) so the user's own
      // words stay first — chat titles and history read naturally.
      const frozen = getContext?.();
      const text = frozen?.block ? `${typed}\n\n${frozen.block}` : typed;

      const parts = [];
      const toolIndex = new Map();

      for await (const frame of conn.prompt(
        text,
        getChatId(),
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
          case 'agent_thought_chunk': {
            // Extended-thinking — rendered as a collapsed "Thinking" disclosure
            // (assistant-ui reasoning part) so it's available but not in the way.
            if (u.content?.type !== 'text') break;
            const last = parts[parts.length - 1];
            if (last && last.type === 'reasoning') {
              parts[parts.length - 1] = { ...last, text: last.text + u.content.text };
            } else {
              parts.push({ type: 'reasoning', text: u.content.text });
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
