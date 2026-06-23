// Phase 31 (DDR-123) — the native ACP chat sidepanel.
//
// Built over @assistant-ui/react's HEADLESS primitives (ThreadPrimitive /
// MessagePrimitive / ComposerPrimitive + useLocalRuntime) with our own
// Maude-styled components on top — NOT the lib's shadcn/Tailwind theme. The
// streaming/runtime plumbing comes from assistant-ui; the look is Maude CSS
// (the `chat-*` classes ported from `.design/ui/ChatPanel.css`). The runtime
// adapter (acp-runtime.js) bridges to the dev-server `/_ws/acp` bridge, which
// drives the user's own `claude` on their subscription (never API billing).
//
// Native-app only — app.jsx mounts this gated on isNativeApp().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  useThread,
} from '@assistant-ui/react';

import { createAcpConnection, makeAcpAdapter } from './acp-runtime.js';
import { Markdown } from './chat-markdown.jsx';

// ── inline icons (separate panel files carry their own, like GitPanel) ──
const Spark = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1.5l1.4 3.7 3.7 1.4-3.7 1.4L8 11.7 6.6 8 2.9 6.6l3.7-1.4L8 1.5z"
      fill="currentColor"
    />
  </svg>
);
const Check = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M13.5 4.5l-7 7L3 8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Close = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 4l8 8M12 4l-8 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const SendArrow = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 12.5V4.2M4.4 7.6 8 4l3.6 3.6"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Persistent quick-action verbs (prefill the composer; never fire blind). The
// one-time `/design:setup-ds` is offered contextually in the empty state, not here.
const QUICK_ACTIONS = [
  { label: '/design:edit', prompt: '/design:edit ' },
  { label: '/design:new', prompt: '/design:new ' },
  { label: '/design:critic', prompt: '/design:critic' },
  { label: '/design:screenshot', prompt: '/design:screenshot' },
];

const SUGGESTIONS = [
  '/design:edit make the primary button more prominent',
  '/design:critic',
  '/design:new Pricing "a 3-tier pricing page"',
];

// Model — '' = the user's own `claude` default; the rest are CLI aliases passed
// as ANTHROPIC_MODEL. Effort → extended-thinking budget (server maps the label).
const MODELS = [
  { value: '', label: 'Default model' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];
const EFFORTS = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'thorough', label: 'Thorough' },
];

function safeStorageGet(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / unavailable — non-fatal */
  }
}

function prettyCanvas(path) {
  if (!path) return null;
  const file = path.split('/').pop() || path;
  return file.replace(/\.(tsx|html)$/i, '');
}

// ── message-part renderers ──
function ChatText({ text }) {
  return (
    <div className="chat-bubble">
      <Markdown text={text} />
    </div>
  );
}

function ChatReasoning({ text }) {
  return (
    <details className="chat-think">
      <summary className="chat-think-sum">
        <span className="chat-think-spark">
          <Spark size={11} />
        </span>
        Thinking
      </summary>
      <div className="chat-think-body">
        <Markdown text={text} />
      </div>
    </details>
  );
}

function ChatToolCard({ toolName, args, result, isError }) {
  const running = result === undefined;
  const path =
    args && typeof args === 'object' ? args.path || args.file || args.filePath : undefined;
  return (
    <div className="chat-tool">
      <div className="chat-tool-hd">
        <b>{toolName}</b>
        {path ? <span className="chat-tool-path">{String(path).split('/').pop()}</span> : null}
        <span
          className={`chat-tool-dot ${running ? 'chat-tool-dot--run' : 'chat-tool-dot--done'}`}
        />
      </div>
      {!running ? (
        <div className="chat-tool-body">
          <div className={`chat-tool-line${isError ? ' del' : ''}`}>
            {isError ? 'failed' : 'done'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMessage() {
  return (
    <div className="chat-msg chat-msg--user">
      <MessagePrimitive.Parts
        components={{ Text: ({ text }) => <div className="chat-bubble">{text}</div> }}
      />
    </div>
  );
}

function AssistantMessage() {
  return (
    <div className="chat-msg chat-msg--assistant">
      <div className="chat-msg-role">
        <span className="chat-msg-spark">
          <Spark size={13} />
        </span>
        Claude
      </div>
      <MessagePrimitive.Parts
        components={{ Text: ChatText, ToolCall: ChatToolCard, Reasoning: ChatReasoning }}
      />
    </div>
  );
}

// ── sub-sections ──
function StatusRow() {
  const running = useThread((t) => t.isRunning);
  return (
    <div className="chat-statusrow">
      <span
        className={`chat-status-dot ${running ? 'chat-status-dot--working' : 'chat-status-dot--ready'}`}
      />
      {running ? 'Working…' : 'Ready'}
      <span className="chat-statusrow-sep">·</span>
      <span className="chat-statusrow-cc">Claude Code</span>
    </div>
  );
}

// Live "still working" indicator — sits at the BOTTOM of the feed (under the
// latest Claude message) so it's clear the turn is still going. Shows the
// in-flight tool (edit/read/shell/sub-agent) when there is one, else "Working…".
function ActivityBar({ tools }) {
  const running = useThread((t) => t.isRunning);
  if (!running) return null;
  const label =
    tools.length === 1 ? tools[0].title : tools.length > 1 ? `${tools.length} tasks running` : 'Working…';
  return (
    <div className="chat-activity" role="status" aria-live="polite">
      <span className="chat-activity-spin" aria-hidden="true" />
      <span className="chat-activity-text">{label}</span>
    </div>
  );
}

function ChatEmpty() {
  return (
    <div className="chat-empty">
      <span className="chat-empty-mark">
        <Spark size={28} />
      </span>
      <div className="chat-empty-title">Edit this canvas with Claude</div>
      <div className="chat-empty-sub">
        Ask for a change, a critique, or a new screen — Claude runs on your own subscription.
      </div>
      <div className="chat-sugs">
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion key={s} prompt={s} send={false} className="chat-sug">
            {s}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="chat-quick">
      {QUICK_ACTIONS.map((a) => (
        <ThreadPrimitive.Suggestion
          key={a.label}
          prompt={a.prompt}
          send={false}
          className="btn btn--ghost btn--sm chat-qa"
        >
          {a.label}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
}

function Composer({ activeCanvas, model, setModel, effort, setEffort }) {
  const canvasName = prettyCanvas(activeCanvas);
  return (
    <div className="chat-composer">
      {/* Controls (canvas chip + model/effort) only matter while you can type —
          hide them mid-turn so the Stop bar stands alone. */}
      <ThreadPrimitive.If running={false}>
        <div className="chat-controls">
          {canvasName ? (
          <div className="chat-ctx">
            Editing: <b>{canvasName}</b>
          </div>
        ) : (
          <span className="chat-ctx-spacer" />
        )}
        <label className="chat-select-wrap" aria-label="Model">
          <select className="chat-select" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="chat-select-wrap" aria-label="Effort">
          <select
            className="chat-select"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
          >
            {EFFORTS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        </div>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Root className="chat-input-wrap">
          <ComposerPrimitive.Input
            className="textarea"
            submitMode="ctrlEnter"
            placeholder="Ask Claude to change this canvas…"
          />
          <ComposerPrimitive.Send className="btn btn--primary chat-send" aria-label="Send">
            <SendArrow />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <div className="chat-foot">
          <span>⌘↵ to send</span>
          <span className="chat-foot-spacer" />
          <span>your Claude subscription</span>
        </div>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <div className="chat-stopbar">
          <span className="chat-stop-meta">
            <span className="chat-status-dot chat-status-dot--working" />
            Working…
          </span>
          <span className="chat-foot-spacer" />
          <ComposerPrimitive.Cancel className="btn btn--danger" aria-label="Stop">
            Stop
          </ComposerPrimitive.Cancel>
        </div>
      </ThreadPrimitive.If>
    </div>
  );
}

function NotConnected({ reason, claudeMissing }) {
  return (
    <div className="chat-disabled">
      <span className="chat-disabled-mark">
        <Spark size={28} />
      </span>
      <div className="chat-disabled-title">Claude Code isn't connected</div>
      <div className="chat-disabled-sub">
        {reason ? <p>{reason}</p> : null}
        {claudeMissing ? (
          <p>
            Install it with <code>npm i -g @anthropic-ai/claude-code</code>, then run{' '}
            <code>claude</code> and <code>/login</code> in a terminal.
          </p>
        ) : (
          <p>
            Open a terminal, run <code>claude</code> and <code>/login</code>, then reopen this panel.
          </p>
        )}
      </div>
      <div className="chat-trust">
        <div className="chat-trust-row">
          <Check /> Runs on your Pro/Max subscription
        </div>
        <div className="chat-trust-row">
          <Check /> No login inside Maude
        </div>
        <div className="chat-trust-row">
          <Check /> Never metered API billing
        </div>
      </div>
    </div>
  );
}

// Repo-level chat id — generated for each new chat.
function newChatId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Disk transcript (clean ChatMessage[]) → assistant-ui initial messages.
function toThreadMessages(msgs) {
  return (msgs || []).map((m) => {
    if (m.role === 'user') {
      return {
        role: 'user',
        content: [{ type: 'text', text: (m.parts || []).map((p) => p.text || '').join('') }],
      };
    }
    return {
      role: 'assistant',
      content: (m.parts || []).map((p, i) =>
        p.type === 'text'
          ? { type: 'text', text: p.text || '' }
          : {
              type: 'tool-call',
              toolCallId: `h-${i}`,
              toolName: p.toolName || 'tool',
              args: {},
              argsText: '{}',
              result: p.done ? {} : undefined,
            }
      ),
    };
  });
}

// One thread = one chat, with its OWN connection (own WS / bridge / claude) so
// chats run in parallel. ChatPanel keeps every open thread MOUNTED and just
// toggles `hidden`, so switching never interrupts a running chat — it keeps
// streaming in the background.
function ChatThread({
  conn,
  chatId,
  initialMessages,
  hidden,
  modelRef,
  effortRef,
  activeCanvas,
  model,
  setModel,
  effort,
  setEffort,
}) {
  const adapter = useMemo(
    () =>
      makeAcpAdapter(
        conn,
        () => chatId,
        () => modelRef.current || null,
        () => effortRef.current
      ),
    [conn, chatId, modelRef, effortRef]
  );
  const runtime = useLocalRuntime(adapter, { initialMessages });
  const [activeTools, setActiveTools] = useState([]);
  useEffect(() => conn.onActivity(setActiveTools), [conn]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-panel" style={hidden ? { display: 'none' } : undefined}>
        <StatusRow />
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-feed" autoScroll>
            <ThreadPrimitive.Empty>
              <ChatEmpty />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
            {/* "still working" indicator under the latest message */}
            <ActivityBar tools={activeTools} />
          </ThreadPrimitive.Viewport>
          <QuickActions />
          <Composer
            activeCanvas={activeCanvas}
            model={model}
            setModel={setModel}
            effort={effort}
            setEffort={setEffort}
          />
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}

// ── panel root ──
export default function ChatPanel({
  activeCanvas,
  width,
  resizing,
  onClose,
  hidden = false,
  onBusyChange,
  onFinished,
}) {
  // Model + effort — persisted across sessions; read live by each chat's adapter.
  const [model, setModel] = useState(() => safeStorageGet('maude-acp-model', ''));
  const [effort, setEffort] = useState(() => safeStorageGet('maude-acp-effort', 'balanced'));
  const modelRef = useRef(model);
  const effortRef = useRef(effort);
  useEffect(() => {
    modelRef.current = model;
    safeStorageSet('maude-acp-model', model);
  }, [model]);
  useEffect(() => {
    effortRef.current = effort;
    safeStorageSet('maude-acp-effort', effort);
  }, [effort]);

  // Availability is global (is claude installed) — a single probe, no connection.
  const [status, setStatus] = useState({ available: null, reason: undefined, claudeMissing: false });
  useEffect(() => {
    let alive = true;
    fetch('/_api/acp/status')
      .then((r) => r.json())
      .then((d) => {
        if (alive)
          setStatus({
            available: d.available,
            reason: d.reason,
            claudeMissing: !!d.adapterEntry && !d.claudePath,
          });
      })
      .catch(() => {
        if (alive)
          setStatus({
            available: false,
            reason: 'Could not reach the Claude bridge.',
            claudeMissing: false,
          });
      });
    return () => {
      alive = false;
    };
  }, []);

  // Recents (for the switcher).
  const [chats, setChats] = useState([]);
  const refreshChats = useCallback(() => {
    fetch('/_api/acp/chats')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setChats(d))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  // PARALLEL chats — one connection (own WS / bridge / claude) per open chat.
  // Every open chat stays mounted; switching just changes which is visible, so
  // a running chat keeps going in the background.
  const connsRef = useRef(new Map()); // chatId → connection
  const busyRef = useRef(new Map()); // chatId → busy (aggregated for the menubar)
  const hydratedRef = useRef(new Map()); // chatId → initial messages
  const [openChatIds, setOpenChatIds] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [busyChats, setBusyChats] = useState({}); // reactive: chatId → busy (for the dot)
  const [menuOpen, setMenuOpen] = useState(false);
  const cbRef = useRef({ onBusyChange, onFinished });
  useEffect(() => {
    cbRef.current = { onBusyChange, onFinished };
  }, [onBusyChange, onFinished]);

  const ensureConn = useCallback(
    (chatId) => {
      const existing = connsRef.current.get(chatId);
      if (existing) return existing;
      const conn = createAcpConnection();
      connsRef.current.set(chatId, conn);
      conn.onBusy((busy) => {
        const wasAny = [...busyRef.current.values()].some(Boolean);
        busyRef.current.set(chatId, busy);
        const nowAny = [...busyRef.current.values()].some(Boolean);
        if (wasAny !== nowAny) cbRef.current.onBusyChange?.(nowAny);
        setBusyChats((prev) => ({ ...prev, [chatId]: busy })); // reactive dot
        if (!busy) {
          cbRef.current.onFinished?.();
          refreshChats();
        }
      });
      return conn;
    },
    [refreshChats]
  );

  const openChat = useCallback(
    (chatId, initialMessages) => {
      hydratedRef.current.set(chatId, initialMessages || []);
      ensureConn(chatId);
      setOpenChatIds((ids) => (ids.includes(chatId) ? ids : [...ids, chatId]));
      setActiveChatId(chatId);
    },
    [ensureConn]
  );

  const newChat = useCallback(() => openChat(newChatId(), []), [openChat]);

  const switchTo = useCallback(
    (id) => {
      if (!id || id === activeChatId) return;
      if (connsRef.current.has(id)) {
        setActiveChatId(id); // already open in the background → just show it
        return;
      }
      fetch(`/_api/acp/chat?id=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((msgs) => openChat(id, toThreadMessages(msgs)))
        .catch(() => {});
    },
    [activeChatId, openChat]
  );

  // Delete a chat — kill its claude (close the conn), drop the transcript, and
  // fall back to another open chat (or a fresh one) if it was active.
  const deleteChat = useCallback(
    (id) => {
      const conn = connsRef.current.get(id);
      if (conn) conn.close();
      connsRef.current.delete(id);
      busyRef.current.delete(id);
      hydratedRef.current.delete(id);
      setBusyChats((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetch(`/_api/acp/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(() => {})
        .finally(refreshChats);
      setOpenChatIds((ids) => {
        const remaining = ids.filter((x) => x !== id);
        if (id === activeChatId) {
          if (remaining.length) setActiveChatId(remaining[remaining.length - 1]);
          else {
            const fresh = newChatId();
            hydratedRef.current.set(fresh, []);
            ensureConn(fresh);
            setActiveChatId(fresh);
            return [fresh];
          }
        }
        return remaining;
      });
    },
    [activeChatId, ensureConn, refreshChats]
  );

  // Open a fresh chat on mount; close every connection on unmount.
  useEffect(() => {
    newChat();
    const conns = connsRef.current;
    return () => {
      for (const c of conns.values()) c.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switcher options — open chats first (parallel), then the rest of the recents.
  const chatOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const id of openChatIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, title: chats.find((c) => c.id === id)?.title || 'New chat', open: true });
    }
    for (const c of chats) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      list.push(c);
    }
    return list;
  }, [chats, openChatIds]);

  const connected = status.available !== false;

  return (
    <aside
      className={`st-rpanel${resizing ? ' is-resizing' : ''}`}
      style={{
        ...(width ? { width, flexBasis: width } : {}),
        ...(hidden ? { display: 'none' } : {}),
      }}
      aria-label="Assistant"
      aria-hidden={hidden || undefined}
    >
      <div className="st-rp-tabs">
        <span className="st-rp-tab is-active">
          <Spark size={13} /> Assistant
        </span>
        <button
          type="button"
          className="st-iconbtn"
          aria-label="Close assistant"
          style={{ marginLeft: 'auto' }}
          onClick={onClose}
        >
          <Close />
        </button>
      </div>
      {connected ? (
        <div className="chat-bar">
          <div className="chat-switch">
            <button
              type="button"
              className="chat-switch-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
            >
              <span
                className={`chat-dot ${busyChats[activeChatId] ? 'chat-dot--busy' : 'chat-dot--idle'}`}
              />
              <span className="chat-switch-title">
                {chatOptions.find((c) => c.id === activeChatId)?.title || 'New chat'}
              </span>
              <span className="chat-switch-caret">▾</span>
            </button>
            {menuOpen ? (
              <>
                <div className="chat-menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="chat-menu" role="listbox">
                  {chatOptions.map((c) => (
                    <div
                      key={c.id}
                      className={`chat-menu-row${c.id === activeChatId ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="chat-menu-open"
                        onClick={() => {
                          switchTo(c.id);
                          setMenuOpen(false);
                        }}
                      >
                        <span
                          className={`chat-dot ${busyChats[c.id] ? 'chat-dot--busy' : c.open ? 'chat-dot--idle' : 'chat-dot--off'}`}
                          title={busyChats[c.id] ? 'Running' : c.open ? 'Open' : 'Saved'}
                        />
                        <span className="chat-menu-title">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        className="chat-menu-del"
                        onClick={() => deleteChat(c.id)}
                        aria-label="Delete chat"
                        title="Delete chat"
                      >
                        <Close size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="chat-newbtn"
            onClick={() => {
              newChat();
              setMenuOpen(false);
            }}
            title="Start a new chat"
          >
            ＋ New
          </button>
        </div>
      ) : null}
      <div className="st-rp-body st-rp-body--chat">
        {status.available === false ? (
          <NotConnected reason={status.reason} claudeMissing={status.claudeMissing} />
        ) : (
          openChatIds.map((id) => {
            const conn = connsRef.current.get(id);
            if (!conn) return null;
            return (
              <ChatThread
                key={id}
                conn={conn}
                chatId={id}
                initialMessages={hydratedRef.current.get(id) || []}
                hidden={id !== activeChatId}
                modelRef={modelRef}
                effortRef={effortRef}
                activeCanvas={activeCanvas}
                model={model}
                setModel={setModel}
                effort={effort}
                setEffort={setEffort}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
