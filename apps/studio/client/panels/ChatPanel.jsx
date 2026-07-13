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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  useLocalRuntime,
  useThread,
} from '@assistant-ui/react';

import {
  activityLabel,
  attachmentName,
  createAcpConnection,
  designImageRefs,
  extractAttachmentRefs,
  makeAcpAdapter,
} from './acp-runtime.js';
import { buildChatContext } from './chat-context.js';
import { Markdown } from './chat-markdown.jsx';
import ReadinessList, { useReadiness } from './ReadinessList.jsx';
import {
  buildCommandModel,
  filterCommands,
  matchLeadingCommand,
  normalizeName,
  STATIC_COMMANDS,
} from './slash-commands.js';

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
// Token swatches — reads as "design system"; used on the empty-state DS CTA.
const Swatches = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
    <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.55" />
    <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.55" />
    <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.3" />
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

// ── pasted-path / URL → inline chip (Claude-Code-style attachment badge) ──
// When the whole clipboard is a single path or URL, we collapse it to a short
// literal token ([image-1] / [file-1] / [link-1]) in the textarea and stash the
// real value in a per-chat map. The token is the actual text the caret sees, so
// the mirror can style it as a chip WITHOUT desyncing (chip text === token text),
// and the adapter expands it back to the real path before sending to Claude.
const CHIP_RE = /\[(?:image|file|link)-\d+\]/g;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|heic|heif|ico|tiff?)$/i;

// Classify a raw clipboard string. Returns { kind, value } only when the trimmed
// paste is a SINGLE path/URL token (no internal whitespace) — pasting prose that
// merely contains a link is left as a normal paste. Paths with spaces fall through
// (kept as plain text) in this first cut.
function classifyPaste(raw) {
  const s = (raw || '').trim();
  if (!s || /\s/.test(s)) return null;
  const isUrl = /^(?:https?|ftp):\/\/[^\s]+$/i.test(s);
  const isWinPath = /^[a-zA-Z]:\\[^\s]+$/.test(s);
  const isAnchoredPath = /^(?:~|\.{0,2})\/[^\s]+$/.test(s); // /a, ~/a, ./a, ../a
  const looksLikeFile = s.includes('/') && /\.[a-z0-9]{1,8}$/i.test(s); // folder/file.ext
  if (!isUrl && !isWinPath && !isAnchoredPath && !looksLikeFile) return null;
  const bare = s.split(/[?#]/)[0]; // strip URL query/hash before the extension test
  const kind = IMAGE_EXT_RE.test(bare) ? 'image' : isUrl ? 'link' : 'file';
  return { kind, value: s };
}

// Next free index for a chip kind, scanning existing tokens so deletes renumber
// back down (paste after clearing → [image-1] again, not [image-3]).
function nextChipIndex(text, kind) {
  const re = new RegExp(`\\[${kind}-(\\d+)\\]`, 'g');
  let max = 0;
  let m;
  while ((m = re.exec(text || ''))) max = Math.max(max, parseInt(m[1], 10));
  return max + 1;
}

// Tokenize a string, wrapping [image|file|link-N] tokens in chip spans. Preserves
// every character verbatim (used both in the mirror overlay and the sent-message
// bubble), so it is safe over the caret-critical mirror.
function chipNodes(text, keyPrefix = 'chip') {
  const nodes = [];
  let last = 0;
  let m;
  let k = 0;
  CHIP_RE.lastIndex = 0;
  while ((m = CHIP_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span className="chat-paste-chip" key={`${keyPrefix}-${k++}`}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// First image File on the clipboard — a raw screenshot / copied image arrives as
// bytes with no path (files, or items via getAsFile on some engines).
function clipboardImageFile(cd) {
  const files = cd?.files ? Array.from(cd.files) : [];
  const fromFiles = files.find((f) => f.type && f.type.startsWith('image/'));
  if (fromFiles) return fromFiles;
  const items = cd?.items ? Array.from(cd.items) : [];
  for (const it of items) {
    if (it.kind === 'file' && it.type && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

// Insert `chip` at the textarea caret, keeping the undo stack + assistant-ui's
// controlled value in sync. execCommand is a real user-edit (caret follows); the
// manual splice is the fallback where execCommand('insertText') is unavailable.
function insertChipAtCaret(ta, chip) {
  if (document.execCommand && document.execCommand('insertText', false, chip)) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  const next = ta.value.slice(0, start) + chip + ta.value.slice(end);
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  setter?.call(ta, next);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const pos = start + chip.length;
  ta.setSelectionRange(pos, pos);
}

// POST raw image bytes to the dev-server, which writes them under the runtime
// _chat/attachments/ and returns the absolute path Claude will Read on send.
async function uploadChatImage(file) {
  const buf = await file.arrayBuffer();
  const res = await fetch('/_api/acp/attachment', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: buf,
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data && data.path) || null;
}

// ── message-part renderers ──
// Assistant text: markdown, plus a thumbnail strip for any designRoot image
// path the agent mentioned (e.g. "/design:screenshot → Saved to: .design/…png"
// — DDR-145). The path stays visible in the text; the strip adds the preview.
function ChatText({ text }) {
  const media = useContext(ChatMediaContext);
  const refs = designImageRefs(text, media?.designRel);
  return (
    <div className="chat-bubble">
      <Markdown text={text} />
      {refs.length ? (
        <div className="chat-thumbrow">
          {refs.map((src) => {
            const file = src.split('/').pop();
            return <ChatThumb key={src} src={src} label={`Open ${file}`} caption={file} />;
          })}
        </div>
      ) : null}
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

// ── chat media (image thumbnails + lightbox) ──
// Per-thread context so deeply-nested bubbles reach the single lightbox + the
// paste-attachments map without prop-drilling through assistant-ui's renderers.
// `chipName(token)` resolves a live chip ([image-1]) to its content-addressed
// name via the per-chat map; `openLightbox(src)` opens the one overlay.
const ChatMediaContext = createContext(null);

function attachmentSrc(name) {
  return `/_api/acp/attachment?name=${encodeURIComponent(name)}`;
}

// Thumbnail — a real focusable button (Enter/Space open) wrapping the served
// image; clicking opens the shared lightbox. `src` is always one of our own
// same-origin serve lanes (attachment route or designRoot static).
//
// `caption` marks a REFERENCED path (an image an assistant message merely named,
// DDR-145) as distinct from first-class user/agent media — it prints the
// filename under the thumb so an injected assistant can't fully borrow the
// feed's authority by rendering an arbitrary designRoot image as if it produced
// it (attacker F2). Pasted-image thumbs pass no caption.
function ChatThumb({ src, label = 'Open image', caption }) {
  const media = useContext(ChatMediaContext);
  const btn = (
    <button
      type="button"
      className="chat-thumb-btn"
      aria-label={label}
      onClick={() => media?.openLightbox(src)}
    >
      <img className="chat-thumb" src={src} alt="" loading="lazy" />
    </button>
  );
  if (!caption) return btn;
  return (
    <figure className="chat-thumb-fig">
      {btn}
      <figcaption className="chat-thumb-cap" title={caption}>
        {caption}
      </figcaption>
    </figure>
  );
}

// One live-bubble chip: an image chip whose upload has resolved renders as a
// thumbnail; file/link chips (and a still-pending image upload) keep the text
// badge. The map entry can fill AFTER the bubble first renders (paste + Enter
// immediately), so poll briefly until it resolves — the adapter awaits the
// upload before sending, so this settles within the same turn.
function ChipOrThumb({ token, kind }) {
  const media = useContext(ChatMediaContext);
  const [name, setName] = useState(() => (kind === 'image' ? media?.chipName(token) : null));
  useEffect(() => {
    if (kind !== 'image' || name || !media) return undefined;
    let tries = 0;
    const id = setInterval(() => {
      const n = media.chipName(token);
      if (n) {
        setName(n);
        clearInterval(id);
      } else if (++tries > 20) {
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [kind, name, media, token]);
  if (!name) return <span className="chat-paste-chip">{token}</span>;
  return <ChatThumb src={attachmentSrc(name)} label="Open pasted image" />;
}

// Single fixed overlay for the enlarged image — ESC / backdrop / × close,
// role="dialog", focus moves to the close button on open and returns to the
// invoking thumbnail on close (mirrors tour/overlay.jsx). The capture-phase
// key listener runs only while open, so it never collides with the composer's
// onKeyDownCapture.
function ChatLightbox({ src, onClose }) {
  const closeRef = useRef(null);
  const prevFocus = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      try {
        prevFocus.current?.focus?.();
      } catch {
        /* trigger unmounted — non-fatal */
      }
    };
  }, [onClose]);
  return (
    <div
      className="chat-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Pasted image"
      onClick={onClose}
    >
      <img src={src} alt="pasted image, enlarged" onClick={(e) => e.stopPropagation()} />
      <button
        type="button"
        ref={closeRef}
        className="chat-lightbox-close"
        aria-label="Close image"
        title="Close image"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

// User bubble keeps the collapsed chips in the transcript (Claude Code shows the
// placeholder in history too — the real path went to the agent, not the log),
// EXCEPT images, which render as clickable thumbnails in a strip UNDER the text
// (inline they'd break the message's reading flow). Two spellings resolve to the
// same thumbnail: a live chip ([image-1] → per-chat map) and the reloaded
// transcript's expanded `_chat/attachments/` path (never printed raw).
function UserBubble({ text }) {
  const segs = extractAttachmentRefs(text);
  const inline = [];
  const images = [];
  segs.forEach((seg, i) => {
    if (seg.type === 'text') inline.push(<span key={`t-${i}`}>{seg.text}</span>);
    else if (seg.type === 'chip' && seg.kind !== 'image')
      inline.push(
        <span className="chat-paste-chip" key={`c-${i}`}>
          {seg.token}
        </span>
      );
    else if (seg.type === 'chip')
      images.push(<ChipOrThumb key={`c-${i}`} token={seg.token} kind={seg.kind} />);
    else
      images.push(
        <ChatThumb key={`a-${i}`} src={attachmentSrc(seg.name)} label="Open pasted image" />
      );
  });
  return (
    <div className="chat-bubble">
      {inline}
      {images.length ? <div className="chat-thumbrow">{images}</div> : null}
    </div>
  );
}

function UserMessage() {
  return (
    <div className="chat-msg chat-msg--user">
      <MessagePrimitive.Parts components={{ Text: UserBubble }} />
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
// "Working" is TRUE while the prompt turn is in-flight OR any tool is still
// running — so background subagents that outlive the main turn (the ACP adapter
// settles at the main agent's `result` while they drain, claude-agent-acp #773)
// keep the panel from looking idle. See RCA issue-acp-subagent-activity-invisible.
function StatusRow({ tools = [] }) {
  const running = useThread((t) => t.isRunning);
  const working = running || tools.length > 0;
  return (
    <div className="chat-statusrow">
      <span
        className={`chat-status-dot ${working ? 'chat-status-dot--working' : 'chat-status-dot--ready'}`}
      />
      {working ? 'Working…' : 'Ready'}
      <span className="chat-statusrow-sep">·</span>
      <span className="chat-statusrow-cc">Claude Code</span>
    </div>
  );
}

// Live m:ss since work started — a ticking counter reads as "actively working"
// during a long, output-quiet subagent stretch (the exact case that used to look
// hung). Resets whenever work stops.
function useElapsed(active) {
  const [, tick] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return undefined;
    }
    startRef.current = Date.now();
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!active || startRef.current == null) return null;
  const secs = Math.floor((Date.now() - startRef.current) / 1000);
  if (secs < 1) return null;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

// Live "still working" indicator — sits at the BOTTOM of the feed (under the
// latest Claude message). Driven by turn-in-flight OR any running tool, so a
// background subagent stays visible ("N subagents running · 0:42") instead of
// the feed going quiet and looking dead.
function ActivityBar({ tools }) {
  const running = useThread((t) => t.isRunning);
  const working = running || tools.length > 0;
  const elapsed = useElapsed(working);
  if (!working) return null;
  return (
    <div className="chat-activity" role="status" aria-live="polite">
      <span className="chat-activity-spin" aria-hidden="true" />
      <span className="chat-activity-text">{activityLabel(tools)}</span>
      {elapsed ? <span className="chat-activity-elapsed">{elapsed}</span> : null}
    </div>
  );
}

// Post-turn-end continuation. The ACP adapter settles the prompt at the main
// agent's first `result` (claude-agent-acp #773) but keeps streaming background
// work — subagent results, the consolidated report — AFTER the assistant-ui run
// ended. Those frames can't join the completed message, so acp-runtime collects
// them and we render them here as a live "continuation" bubble instead of
// dropping them (the answer used to only appear on reload). See RCA
// issue-acp-subagent-activity-invisible (facet F2). Cleared when the next turn
// starts; the durable copy lives in the transcript.
function ContinuationBubble({ parts }) {
  if (!parts.length) return null;
  return (
    <div className="chat-msg chat-msg--assistant chat-msg--continued">
      <div className="chat-msg-role">
        <span className="chat-msg-spark">
          <Spark size={13} />
        </span>
        Claude
      </div>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <ChatText key={i} text={p.text} />
        ) : p.type === 'reasoning' ? (
          <ChatReasoning key={i} text={p.text} />
        ) : p.type === 'tool-call' ? (
          <ChatToolCard
            key={i}
            toolName={p.toolName}
            args={p.args}
            result={p.result}
            isError={p.isError}
          />
        ) : null
      )}
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
      {/* One-time contextual CTA: bootstrap a design system. Prefills the guided
          wizard (name is required, so we never fire it blind — the composer opens
          ready for the slug). Canvas verbs live in the persistent quick-action row. */}
      <ThreadPrimitive.Suggestion
        prompt="/design:setup-ds "
        send={false}
        className="chat-empty-cta"
      >
        <span className="chat-empty-cta-ic">
          <Swatches size={15} />
        </span>
        Create new design system
      </ThreadPrimitive.Suggestion>
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

// Merge the static bootstrap list with the live ACP catalogue (pushed over the
// connection). Returns `{ all, existsSet }` — see slash-commands.js.
function useSlashCommands(conn) {
  const [live, setLive] = useState([]);
  useEffect(() => conn.onCommands(setLive), [conn]);
  return useMemo(() => buildCommandModel(STATIC_COMMANDS, live), [live]);
}

// Autocomplete menu — opens upward above the composer while a slash command is
// being typed. Keyboard-driven from the composer (see Composer); mouse hover +
// click supported. onMouseDown (not onClick) so picking beats the textarea blur.
function CommandPopover({ items, activeIndex, onPick, onHover }) {
  if (!items.length) return null;
  return (
    <div className="chat-cmd-menu" role="listbox" data-testid="chat-cmd-menu">
      {items.map((c, i) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          data-testid={`chat-cmd-item-${c.name.replace(/[^a-z0-9]+/gi, '-')}`}
          className={`chat-cmd-item${i === activeIndex ? ' is-active' : ''}`}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(c);
          }}
        >
          <span className={`chat-cmd-name chat-cmd-name--${c.group}`}>/{c.name}</span>
          {c.description ? <span className="chat-cmd-desc">{c.description}</span> : null}
          {c.argHint ? <span className="chat-cmd-arg">{c.argHint}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Inline command highlight via a mirror-overlay: a div behind a transparent-text
// textarea renders the same text, wrapping the leading command token in a pill —
// but ONLY when that token is a command that exists (the badge gate). The mirror
// MUST match the textarea's box model exactly (see .chat-input / .chat-input-mirror
// in 6-acp-chat.css) or the pill drifts off the text.
function HighlightedInput({ existsSet, attachmentsRef, onAttachChange }) {
  const text = useComposer((c) => c.text);
  const mirrorRef = useRef(null);
  const match = matchLeadingCommand(text);
  const token = match ? normalizeName(match.token) : '';
  const highlight = !!(match && token && existsSet.has(token));

  // Build the mirror: an optional leading command pill, then the remainder with
  // any [image|file|link-N] tokens wrapped as chips. Both wrappers preserve the
  // exact glyphs so the transparent-text textarea's caret stays aligned.
  let head = null;
  let bodyStart = 0;
  if (highlight) {
    const leadingWs = text.match(/^\s*/)[0];
    const cmd = `/${match.token}`;
    head = (
      <>
        {leadingWs}
        <span className="chat-cmd-pill">{cmd}</span>
      </>
    );
    bodyStart = leadingWs.length + cmd.length;
  }
  const body = text.slice(bodyStart);
  // Trailing newline needs a zero-width guard so the mirror keeps the last line.
  const guard = text.endsWith('\n') ? '​' : '';

  // Collapse a pasted attachment into a chip token at the caret and stash its real
  // value in the map so the adapter expands it on send. Two sources:
  //  1) a raw clipboard image (screenshot) — insert the chip synchronously, upload
  //     the bytes in the background, and fill the map when the path comes back. The
  //     in-flight promise is tracked so send can await it (no literal [image-N] if
  //     the user hits Enter before the upload lands).
  //  2) a lone path / URL as text — resolved synchronously.
  const onPaste = useCallback(
    (e) => {
      const cd = e.clipboardData;
      const ta = e.currentTarget;
      const { map, pending } = attachmentsRef.current;

      const img = clipboardImageFile(cd);
      if (img) {
        e.preventDefault();
        const chip = `[image-${nextChipIndex(ta.value, 'image')}]`;
        map.set(chip, null); // pending — expandPasteChips leaves it literal until resolved
        insertChipAtCaret(ta, chip);
        onAttachChange?.();
        const p = uploadChatImage(img)
          .then((path) => {
            if (path) map.set(chip, path);
            else map.delete(chip);
          })
          .catch(() => map.delete(chip))
          .finally(() => {
            pending.delete(p);
            onAttachChange?.();
          });
        pending.add(p);
        return;
      }

      const cls = classifyPaste(cd?.getData('text/plain'));
      if (!cls) return; // ordinary paste — let assistant-ui handle it
      e.preventDefault();
      const chip = `[${cls.kind}-${nextChipIndex(ta.value, cls.kind)}]`;
      map.set(chip, cls.value);
      insertChipAtCaret(ta, chip);
      onAttachChange?.();
    },
    [attachmentsRef, onAttachChange]
  );

  return (
    <div className="chat-input-wrap">
      <div className="chat-input-mirror" aria-hidden="true" ref={mirrorRef}>
        {head}
        {chipNodes(body)}
        {guard}
      </div>
      <ComposerPrimitive.Input
        className="chat-input chat-input--overlay"
        submitMode="enter"
        placeholder="Ask Claude to change this canvas…"
        onPaste={onPaste}
        onScroll={(e) => {
          if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}

function Composer({
  activeCanvas,
  chatCtx,
  onCtxDismiss,
  model,
  setModel,
  effort,
  setEffort,
  conn,
  chatId,
  attachmentsRef,
}) {
  const canvasName = prettyCanvas(activeCanvas);
  const { all, existsSet } = useSlashCommands(conn);
  const composerRuntime = useComposerRuntime();
  const text = useComposer((c) => c.text);

  const match = matchLeadingCommand(text);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuOpen = !!(match && match.typing) && !dismissed;

  // Attachment reveal (security — DDR-140): a chip collapses a pasted path/URL to
  // an opaque badge, and the real value is what gets sent to the auto-approving
  // agent. So the composer MUST show what each chip will expand to BEFORE send —
  // otherwise a value the user can't see (e.g. one an untrusted canvas seeded onto
  // the clipboard) rides into the prompt invisibly. `attachTick` re-renders the
  // strip when an async image upload fills its map entry.
  const [attachTick, setAttachTick] = useState(0);
  const bumpAttach = useCallback(() => setAttachTick((t) => t + 1), []);
  const chipList = useMemo(() => {
    const map = attachmentsRef.current.map;
    const seen = new Set();
    const out = [];
    for (const m of text.matchAll(/\[(?:image|file|link)-\d+\]/g)) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      out.push({ token: m[0], value: map.get(m[0]) ?? null });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, attachTick, attachmentsRef]);
  const items = useMemo(
    () => (menuOpen ? filterCommands(all, match.token) : []),
    [menuOpen, all, match?.token]
  );

  // Reset selection + un-dismiss whenever the typed token changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setActiveIndex(0);
    setDismissed(false);
  }, [match?.token]);

  // Warm the adapter the first time the user starts a slash command, so the live
  // catalogue arrives without a full prompt. Guarded to fire once per mount.
  const warmedRef = useRef(false);
  useEffect(() => {
    if (menuOpen && !warmedRef.current) {
      warmedRef.current = true;
      conn.warm(chatId, model, effort);
    }
  }, [menuOpen, conn, chatId, model, effort]);

  const pick = useCallback(
    (cmd) => {
      composerRuntime.setText(`/${cmd.name} `);
      setDismissed(false);
      setActiveIndex(0);
    },
    [composerRuntime]
  );

  const onKeyDownCapture = useCallback(
    (e) => {
      if (!menuOpen || !items.length) return;
      // Swallow navigation keys before they reach the textarea (capture phase +
      // stopPropagation) so the menu drives them, not the caret / submit.
      const swallow = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'ArrowDown') {
        swallow();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        swallow();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        swallow();
        pick(items[Math.min(activeIndex, items.length - 1)]);
      } else if (e.key === 'Escape') {
        swallow();
        setDismissed(true);
      }
    },
    [menuOpen, items, activeIndex, pick]
  );

  return (
    <div className="chat-composer" data-testid="chat-composer">
      <ThreadPrimitive.If running={false}>
        {/* Context attachment chip (feature-acp-context-hardening) — the visible
            reveal of the fenced <maude-context> block the send will prepend
            (built from the SAME buildChatContext result, so chip ≡ payload).
            Removable (DDR-140); a stale selection warns instead of hiding. */}
        {chatCtx ? (
          <div
            className={`chat-ctx${chatCtx.stale ? ' chat-ctx--stale' : ''}`}
            data-testid="chat-context-chip"
          >
            <span className="chat-ctx-label">
              ◆ {chatCtx.chipLabel}
              {chatCtx.stale ? ' — canvas changed since selection' : ''}
            </span>
            <button
              type="button"
              className="chat-ctx-x"
              aria-label="Remove canvas context from this message"
              title="Remove canvas context from this message"
              onClick={onCtxDismiss}
            >
              ×
            </button>
          </div>
        ) : canvasName ? (
          <div className="chat-ctx">
            Editing: <b>{canvasName}</b>
          </div>
        ) : null}
        {/* One box: textarea on top, a bottom toolbar (model · effort · send).
            The anchor is relative so the command popover can float above it. */}
        <div className="chat-cmd-anchor" onKeyDownCapture={onKeyDownCapture}>
          {menuOpen ? (
            <CommandPopover
              items={items}
              activeIndex={activeIndex}
              onPick={pick}
              onHover={setActiveIndex}
            />
          ) : null}
          <ComposerPrimitive.Root className="chat-box">
            <HighlightedInput
              existsSet={existsSet}
              attachmentsRef={attachmentsRef}
              onAttachChange={bumpAttach}
            />
            <div className="chat-toolbar">
            <select
              className="chat-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              aria-label="Model"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className="chat-select"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              aria-label="Effort"
            >
              {EFFORTS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
            <span className="chat-toolbar-spacer" />
            <ComposerPrimitive.Send className="chat-send" aria-label="Send message">
              <SendArrow />
            </ComposerPrimitive.Send>
          </div>
          </ComposerPrimitive.Root>
        </div>
        {chipList.length ? (
          <div className="chat-attach" role="list" aria-label="Attachments — expands on send">
            {chipList.map((c) => (
              <div className="chat-attach-row" role="listitem" key={c.token}>
                <span className="chat-attach-tok">{c.token}</span>
                <span className="chat-attach-arrow" aria-hidden="true">
                  →
                </span>
                <span className="chat-attach-val" title={c.value || undefined}>
                  {c.value || 'attaching…'}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="chat-foot">
          <span>↵ to send · ⇧↵ newline</span>
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

// DDR-166 T0f — the guided, button-driven cold start. Every actionable step
// (install command, Sign in) now lives in ReadinessList itself; this shell no
// longer carries its own terminal-instruction copy, so there's nothing here to
// go stale relative to what the rows actually offer.
function NotConnected({ reason, readiness, readinessLoading, onRecheck }) {
  return (
    <div className="chat-disabled" data-testid="acp-not-connected">
      <span className="chat-disabled-mark">
        <Spark size={28} />
      </span>
      <div className="chat-disabled-title">AI editing isn't ready yet</div>
      <div className="chat-disabled-sub">
        {reason ? <p>{reason}</p> : null}
        <p>AI editing pairs with a Claude Code you have installed. Here's what it still needs:</p>
      </div>
      {readiness ? (
        <ReadinessList report={readiness} loading={readinessLoading} refresh={onRecheck} />
      ) : (
        <p className="chat-disabled-sub">Checking what's needed…</p>
      )}
      <div className="chat-trust">
        <div className="chat-trust-row">
          <Check /> Runs on your Pro/Max subscription
        </div>
        <div className="chat-trust-row">
          <Check /> Signs in via Claude Code's own login — Maude never sees your credentials
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
  selected,
  designRel,
  model,
  setModel,
  effort,
  setEffort,
}) {
  // Paste attachments: `map` = chip token ([image-1]…) → real path/URL (null while
  // an image upload is in flight); `pending` = the in-flight upload promises. The
  // adapter awaits `pending` then expands `map` before sending; the composer writes
  // both on paste.
  const attachmentsRef = useRef({ map: new Map(), pending: new Set() });
  // Canvas/selection context attachment (feature-acp-context-hardening). One
  // buildChatContext result drives BOTH the composer chip and the frozen block
  // the adapter prepends at send. The ref is what the adapter reads (freeze =
  // read-once at send); the state re-renders the chip. Dismissing the chip
  // (DDR-140 — the attachment is removable) suppresses the context until it
  // CHANGES (new selection / canvas), which re-arms it.
  const [chatCtx, setChatCtx] = useState(null);
  const [ctxDismissed, setCtxDismissed] = useState(false);
  const contextRef = useRef(null);
  const ctxDismissedRef = useRef(false);
  useEffect(() => {
    const c = buildChatContext({ canvas: activeCanvas, selected });
    setChatCtx(c);
    contextRef.current = c;
    setCtxDismissed(false);
    ctxDismissedRef.current = false;
  }, [activeCanvas, selected]);
  const dismissCtx = useCallback(() => {
    setCtxDismissed(true);
    ctxDismissedRef.current = true;
  }, []);
  const adapter = useMemo(
    () =>
      makeAcpAdapter(
        conn,
        () => chatId,
        () => modelRef.current || null,
        () => effortRef.current,
        () => attachmentsRef.current,
        () => (ctxDismissedRef.current ? null : contextRef.current)
      ),
    [conn, chatId, modelRef, effortRef]
  );
  const runtime = useLocalRuntime(adapter, { initialMessages });
  // Image thumbnails + lightbox — one overlay per thread; bubbles reach it (and
  // the chip → attachment-name resolution) through ChatMediaContext.
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const media = useMemo(
    () => ({
      chipName: (token) => attachmentName(attachmentsRef.current.map.get(token) || ''),
      openLightbox: setLightboxSrc,
      designRel,
    }),
    [designRel]
  );
  const [activeTools, setActiveTools] = useState([]);
  useEffect(() => conn.onActivity(setActiveTools), [conn]);
  // Post-turn-end continuation (the tail the client used to drop — RCA F2).
  const [bgParts, setBgParts] = useState([]);
  useEffect(() => conn.onBackground(setBgParts), [conn]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatMediaContext.Provider value={media}>
      <div className="chat-panel" style={hidden ? { display: 'none' } : undefined}>
        <StatusRow tools={activeTools} />
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-feed" autoScroll>
            <ThreadPrimitive.Empty>
              <ChatEmpty />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
            {/* Background work that outlived the turn — streamed here so it's not
                dropped (RCA F2). */}
            <ContinuationBubble parts={bgParts} />
            {/* "still working" indicator under the latest message */}
            <ActivityBar tools={activeTools} />
          </ThreadPrimitive.Viewport>
          <QuickActions />
          <Composer
            activeCanvas={activeCanvas}
            chatCtx={ctxDismissed ? null : chatCtx}
            onCtxDismiss={dismissCtx}
            model={model}
            setModel={setModel}
            effort={effort}
            setEffort={setEffort}
            conn={conn}
            chatId={chatId}
            attachmentsRef={attachmentsRef}
          />
        </ThreadPrimitive.Root>
        {lightboxSrc ? (
          <ChatLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        ) : null}
      </div>
      </ChatMediaContext.Provider>
    </AssistantRuntimeProvider>
  );
}

// ── panel root ──
export default function ChatPanel({
  activeCanvas,
  selected,
  designRel,
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
  const [status, setStatus] = useState({ available: null, reason: undefined });
  const probeStatus = useCallback(
    () =>
      fetch('/_api/acp/status')
        .then((r) => r.json())
        .then((d) => setStatus({ available: d.available, reason: d.reason }))
        .catch(() => setStatus({ available: false, reason: 'Could not reach the Claude bridge.' })),
    []
  );
  useEffect(() => {
    probeStatus();
  }, [probeStatus]);

  // DDR-128 — when not connected, surface the full readiness breakdown (claude ·
  // maude · plugins) in the not-connected explainer. Only probes when actually
  // disconnected; Re-check re-probes BOTH the readiness report and the bridge
  // status, so installing the missing pieces and re-checking can unlock the panel
  // without reopening it (the persistent re-check surface).
  const {
    report: readiness,
    loading: readinessLoading,
    refresh: refreshReadiness,
  } = useReadiness(status.available === false);
  const recheck = useCallback(() => {
    refreshReadiness();
    return probeStatus();
  }, [refreshReadiness, probeStatus]);

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
      // Background work (subagents) can outlive the main turn — the ACP adapter
      // settles the prompt at the main agent's `result` while they drain
      // (claude-agent-acp #773). Track live tool activity so the menubar
      // badge/dot + the "finished" ping reflect TRUE quiescence, not the
      // premature turn-end. (RCA issue-acp-subagent-activity-invisible.)
      let bgActive = false; // a tool (e.g. a subagent) is still running
      let busyNow = false; // the prompt turn itself is in flight
      let deferredFinish = false; // turn ended while background work continued
      const syncAggregate = () => {
        const wasAny = [...busyRef.current.values()].some(Boolean);
        busyRef.current.set(chatId, busyNow || bgActive);
        const nowAny = [...busyRef.current.values()].some(Boolean);
        if (wasAny !== nowAny) cbRef.current.onBusyChange?.(nowAny);
      };
      conn.onActivity((activeTools) => {
        bgActive = activeTools.length > 0;
        syncAggregate();
        if (deferredFinish && !bgActive && !busyNow) {
          deferredFinish = false;
          setBusyChats((prev) => ({ ...prev, [chatId]: false }));
          cbRef.current.onFinished?.();
          refreshChats();
        }
      });
      conn.onBusy((busy) => {
        busyNow = busy;
        syncAggregate();
        if (busy) {
          deferredFinish = false; // a new turn supersedes any pending drain ping
          setBusyChats((prev) => ({ ...prev, [chatId]: true })); // reactive dot
          return;
        }
        // Turn ended. If background work is still draining, keep the dot lit and
        // hold the "finished" ping until the activity list empties (onActivity).
        if (bgActive) {
          deferredFinish = true;
          refreshChats();
        } else {
          setBusyChats((prev) => ({ ...prev, [chatId]: false }));
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
          <NotConnected
            reason={status.reason}
            readiness={readiness}
            readinessLoading={readinessLoading}
            onRecheck={recheck}
          />
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
                selected={selected}
                designRel={designRel}
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
