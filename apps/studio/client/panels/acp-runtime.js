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

/**
 * Fold one `session/update` into the assistant-message `parts` array (mutated in
 * place) + `toolIndex` map. Shared by the LIVE turn (makeAcpAdapter's run loop)
 * AND the BACKGROUND sink (the frames the ACP adapter keeps streaming AFTER its
 * premature settle — claude-agent-acp #773; see RCA issue-acp-subagent-activity-
 * invisible). `plan`/`usage_update`/`available_commands_update` are not rendered.
 * Exported for tests.
 */
export function applyUpdate(parts, toolIndex, u) {
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
      // Extended-thinking — a collapsed "Thinking" disclosure (reasoning part).
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
      break; // plan / thought / commands / usage — not rendered
  }
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

  // Post-turn-end continuation — the ACP adapter settles the prompt at the main
  // agent's `result` (claude-agent-acp #773) but KEEPS streaming background work
  // (subagent results, the consolidation) afterward. Those frames arrive with no
  // active turn (`turnHandler === null`), so they can't join the assistant-ui
  // message that already completed; accumulate them here as a live "continuation"
  // the panel renders below the thread — otherwise the whole answer is invisible
  // until reload. See RCA issue-acp-subagent-activity-invisible (facet F2).
  const backgroundListeners = new Set();
  let bgParts = [];
  const bgToolIndex = new Map();
  function emitBackground() {
    const snap = bgParts.slice();
    for (const fn of backgroundListeners) fn(snap);
  }
  function resetBackground() {
    if (!bgParts.length && !bgToolIndex.size) return;
    bgParts = [];
    bgToolIndex.clear();
    emitBackground();
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
    else if (frame.t === 'update') {
      // No active turn, but the adapter is still streaming (the post-settle
      // tail the client used to drop). Fold it into the background continuation.
      applyUpdate(bgParts, bgToolIndex, frame.update);
      emitBackground();
    }
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

    /** Subscribe to the post-turn-end continuation parts; replays the current tail. */
    onBackground(fn) {
      backgroundListeners.add(fn);
      fn(bgParts.slice());
      return () => backgroundListeners.delete(fn);
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
      // Fresh user turn supersedes the previous turn's leftovers: the background
      // continuation tail AND any orphaned activity whose background work never
      // resolved (defensive; the common path drains via completed updates).
      // setBusy(true) fires FIRST so the finished-ping deferral (ChatPanel) sees
      // busy before these empty emits.
      resetBackground();
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

// ── chat-attachment refs (image thumbnails + lightbox) ──
// A pasted image lives in the feed under two spellings: the LIVE bubble holds
// the collapsed chip token ([image-1] — resolved via the per-chat attachments
// map), while a RELOADED bubble (transcript) holds the already-expanded
// absolute path under `_chat/attachments/`. Both funnel into the same
// `<sha8>.<ext>` name the GET /_api/acp/attachment route serves. Pure — tested
// in test/chat-attachments.test.ts.
const ATTACHMENT_NAME = '[0-9a-f]{8}\\.(?:png|jpe?g|gif|webp)';

/**
 * The content-addressed basename when the string is a `_chat/attachments/` path
 * (absolute or relative), else null. Non-attachment paths never match.
 */
export function attachmentName(absPathOrText) {
  const m = new RegExp(`(?:^|/)_chat/attachments/(${ATTACHMENT_NAME})$`).exec(
    String(absPathOrText || '').trim()
  );
  return m ? m[1] : null;
}

/**
 * Split bubble text into ordered segments the renderer walks:
 *   { type:'text', text }                — plain run, rendered verbatim
 *   { type:'chip', token, kind }         — [image|file|link-N] (live bubble)
 *   { type:'attachment', name, raw }     — expanded _chat/attachments path (reload)
 */
export function extractAttachmentRefs(text) {
  const s = String(text || '');
  const re = new RegExp(
    `\\[(image|file|link)-\\d+\\]|\\S*/_chat/attachments/(${ATTACHMENT_NAME})`,
    'g'
  );
  const segs = [];
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) segs.push({ type: 'text', text: s.slice(last, m.index) });
    if (m[1]) segs.push({ type: 'chip', token: m[0], kind: m[1] });
    else segs.push({ type: 'attachment', name: m[2], raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) segs.push({ type: 'text', text: s.slice(last) });
  return segs;
}

/**
 * Image paths under the project's design root that an ASSISTANT message text
 * references (e.g. `/design:screenshot` replying "Saved to: .design/_history/…/
 * 001.png") → servable same-origin URLs for the thumbnail strip (DDR-145).
 * Render-only: the main origin already serves designRoot statics with
 * containment; nothing outside `<designRel>/` ever matches, SVG stays excluded
 * (scriptable), and the per-message cap bounds a hostile/hallucinated wall of
 * paths. Returns unique URLs in first-mention order.
 *
 * Containment is enforced client-side, NOT delegated to the server (DDR-145
 * security follow-up): the assistant text is partly untrusted (tool output /
 * indirect injection), so a token carrying a `..` dot-segment or ANY
 * percent-encoding is rejected outright — otherwise `.design/../../etc/x.png`
 * would collapse to `/etc/x.png` in the browser (and `..%2f` would decode
 * server-side), silently widening the fetch surface from designRel to the whole
 * repoRoot. The server's `safePathUnderRoot` stays the backstop; this makes the
 * client guarantee match the docstring instead of leaning on it.
 */
export function designImageRefs(text, designRel = '.design', cap = 6) {
  const rel = String(designRel || '.design').replace(/^\/+|\/+$/g, '');
  if (!rel) return [];
  const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A path token: optional abs/relative prefix, then `<rel>/…/<img>`. Boundaries
  // tolerate the markdown the paths arrive wrapped in (backticks, quotes,
  // parens) and shed trailing punctuation via the lookahead.
  // Bounded quantifiers ({0,256}/{1,256}) keep the per-start scan constant-time —
  // a long failing candidate (attacker-influenceable assistant text) can't drive
  // superlinear backtracking. No real designRoot path segment run approaches 256.
  const re = new RegExp(
    `(?:^|[\\s\`'"(\\[])((?:[^\\s\`'"()\\[\\]]{0,256}/)?${esc}/[^\\s\`'"()\\[\\]]{1,256}?\\.(?:png|jpe?g|gif|webp))(?=[\\s\`'")\\]]|[.,:;!?]|$)`,
    'gi'
  );
  const urls = [];
  let m;
  while ((m = re.exec(String(text || ''))) && urls.length < cap) {
    const raw = m[1];
    const at = raw.lastIndexOf(`${rel}/`);
    if (at !== 0 && raw[at - 1] !== '/') continue; // `not-.design/x.png` must not match
    const relPath = raw.slice(at);
    const url = `/${relPath}`;
    // Traversal guard — ALLOWLIST the canonical form, don't blocklist escape
    // spellings (DDR-145 security follow-up). Two lanes the browser/server
    // normalize differently:
    //  1. Reject ANY percent-encoding outright — a plain designRoot path in
    //     assistant prose never carries `%`, but `..%2f` survives the WHATWG
    //     `URL` parse (pathname keeps `%2F` literal) and then the SERVER's
    //     `safePathUnderRoot` decodes it out of designRel.
    //  2. Parse exactly as the browser will (WHATWG collapses `..` dot-segments
    //     AND rewrites `\`→`/` for http(s)) and require the result byte-identical
    //     AND still under `/rel/` — closes `..`, `..\`, and mixed spellings.
    if (relPath.includes('%')) continue;
    let canon;
    try {
      canon = new URL(url, 'http://x').pathname;
    } catch {
      continue;
    }
    if (canon !== url || !canon.startsWith(`/${rel}/`)) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
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
        applyUpdate(parts, toolIndex, frame.update);
        yield { content: parts.slice() };
      }
    },
  };
}
