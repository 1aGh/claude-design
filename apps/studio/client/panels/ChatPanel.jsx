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

import { useEffect, useMemo, useRef, useState } from 'react';

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
      <MessagePrimitive.Parts components={{ Text: ChatText, ToolCall: ChatToolCard }} />
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
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Root className="chat-input-wrap">
          <ComposerPrimitive.Input
            className="textarea"
            submitMode="ctrlEnter"
            placeholder="Ask Claude to change this canvas…"
          />
          <ComposerPrimitive.Send className="btn btn--primary chat-send" aria-label="Send">
            ↑
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

// ── panel root ──
export default function ChatPanel({ activeCanvas, width, resizing, onClose, hidden = false }) {
  const conn = useMemo(() => createAcpConnection(), []);
  const canvasRef = useRef(activeCanvas);
  useEffect(() => {
    canvasRef.current = activeCanvas;
  }, [activeCanvas]);

  // Model + effort — persisted across sessions; read live by the adapter (refs,
  // like the active canvas) so changing them mid-session re-spawns on next send.
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

  const adapter = useMemo(
    () =>
      makeAcpAdapter(
        conn,
        () => canvasRef.current,
        () => modelRef.current || null,
        () => effortRef.current
      ),
    [conn]
  );
  const runtime = useLocalRuntime(adapter);

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
            // adapter present but no claude on PATH → offer the install hint
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
    const off = conn.onStatus((s) => {
      if (alive && s.available !== null) {
        setStatus((prev) => ({ ...prev, available: s.available, reason: s.reason ?? prev.reason }));
      }
    });
    // Closing the panel tears down the socket → the bridge kills the claude child.
    return () => {
      alive = false;
      off();
      conn.close();
    };
  }, [conn]);

  return (
    <aside
      className={`st-rpanel${resizing ? ' is-resizing' : ''}`}
      // Stays MOUNTED while another right-dock panel is showing (display:none) so
      // the chat keeps streaming in the background and its history survives a
      // panel switch — fixed the "reopen loses the running chat" bug.
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
      <div className="st-rp-body st-rp-body--chat">
        {status.available === false ? (
          <NotConnected reason={status.reason} claudeMissing={status.claudeMissing} />
        ) : (
          <AssistantRuntimeProvider runtime={runtime}>
            <div className="chat-panel">
              <StatusRow />
              <ThreadPrimitive.Root className="chat-thread">
                <ThreadPrimitive.Viewport className="chat-feed" autoScroll>
                  <ThreadPrimitive.Empty>
                    <ChatEmpty />
                  </ThreadPrimitive.Empty>
                  <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
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
        )}
      </div>
    </aside>
  );
}
