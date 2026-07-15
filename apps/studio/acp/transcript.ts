// Repo-level chat transcripts (`<designRoot>/_chat/<chatId>.jsonl`). The bridge
// appends raw per-update lines; these readers turn them into the chat list (for
// the switcher) and clean per-turn messages (for hydrating the thread on open).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export interface ChatSummary {
  id: string;
  title: string;
  updated: number; // mtime ms
  /** True when `title` came from a user rename (meta.json), not the
   *  auto-derived first line. The client uses this to stop a later live
   *  `session_info_update` (agent auto-title) from clobbering an explicit
   *  rename — see ChatPanel.jsx's `renamedChatIdsRef`. */
  renamed?: boolean;
}

/**
 * User-set overrides (Task C5 — per-chat overflow menu), `<designRoot>/_chat/
 * <chatId>.meta.json`. `title` wins over BOTH the auto-derived first-line
 * title and any live `session_info_update` the agent later emits — an
 * explicit rename must not be silently clobbered by an auto-generated
 * summary landing afterward. `archived` hides the chat from the switcher's
 * recents list (`listChats`) without deleting its transcript.
 */
export interface ChatMeta {
  title?: string;
  archived?: boolean;
}

export interface ChatMessagePart {
  type: 'text' | 'tool';
  text?: string;
  toolName?: string;
  done?: boolean;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  parts: ChatMessagePart[];
}

function chatDir(designRoot: string): string {
  return join(designRoot, '_chat');
}

function metaPath(designRoot: string, chatId: string): string {
  return join(chatDir(designRoot), `${chatId}.meta.json`);
}

/** Read a chat's meta sidecar. Missing/corrupt/malformed → `{}` (no override),
 *  never throws — a bad sidecar must degrade to "no rename/archive", not break
 *  the switcher. */
export function readChatMeta(designRoot: string, chatId: string): ChatMeta {
  try {
    const raw = JSON.parse(readFileSync(metaPath(designRoot, chatId), 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const r = raw as Record<string, unknown>;
    const meta: ChatMeta = {};
    if (typeof r.title === 'string' && r.title.trim()) meta.title = r.title.trim().slice(0, 200);
    if (typeof r.archived === 'boolean') meta.archived = r.archived;
    return meta;
  } catch {
    return {};
  }
}

/** Merge `patch` into the chat's meta sidecar (creates `_chat/` if needed).
 *  `title: null` / `archived: false` clear that field rather than deleting
 *  the file — callers pass only the field(s) they're changing. */
export function writeChatMeta(
  designRoot: string,
  chatId: string,
  patch: { title?: string | null; archived?: boolean }
): ChatMeta {
  const dir = chatDir(designRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = readChatMeta(designRoot, chatId);
  const next: ChatMeta = { ...current };
  if ('title' in patch) {
    const t = patch.title?.trim();
    if (t) next.title = t.slice(0, 200);
    else next.title = undefined;
  }
  if ('archived' in patch) {
    if (patch.archived) next.archived = true;
    else next.archived = undefined;
  }
  writeFileSync(metaPath(designRoot, chatId), JSON.stringify(next));
  return next;
}

function readLines(file: string): Array<Record<string, unknown>> {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((x): x is Record<string, unknown> => x !== null);
  } catch {
    return [];
  }
}

/** First user line, truncated — the chat's display title. Context-attachment
 *  lines are stripped first, so a chat never titles itself `[maude-context …`
 *  (the 2026-07-03 dogfood finding). */
function deriveTitle(lines: Array<Record<string, unknown>>): string {
  const firstUser = lines.find((l) => l.role === 'user' && typeof l.text === 'string');
  const text = stripContextBlock((firstUser?.text as string) ?? '');
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, 60) : 'New chat';
}

/** List chats newest-first. Archived chats (Task C5) are excluded — the
 *  transcript stays on disk, it just doesn't show up in the switcher. A
 *  user-set title (readChatMeta) wins over the auto-derived first-line one. */
export function listChats(designRoot: string): ChatSummary[] {
  const dir = chatDir(designRoot);
  if (!existsSync(dir)) return [];
  const out: ChatSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue;
    const id = name.replace(/\.jsonl$/, '');
    const meta = readChatMeta(designRoot, id);
    if (meta.archived) continue;
    const file = join(dir, name);
    let updated = 0;
    try {
      updated = statSync(file).mtimeMs;
    } catch {
      /* skip unreadable */
    }
    const lines = readLines(file);
    if (lines.length === 0) continue;
    out.push({ id, title: meta.title || deriveTitle(lines), updated, renamed: !!meta.title });
  }
  return out.sort((a, b) => b.updated - a.updated);
}

/** Delete a chat's transcript + its meta/session sidecars. Returns true if
 *  the transcript file was removed (the sidecars are best-effort cleanup). */
export function deleteChat(designRoot: string, chatId: string): boolean {
  const dir = chatDir(designRoot);
  for (const suffix of ['.meta.json', '.session.json']) {
    try {
      rmSync(join(dir, `${chatId}${suffix}`));
    } catch {
      /* absent or unreadable — non-fatal, best-effort cleanup */
    }
  }
  const file = join(dir, `${chatId}.jsonl`);
  if (!existsSync(file)) return false;
  try {
    rmSync(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * UI-projection strip of the frozen chat-context a send attaches
 * (feature-acp-context-hardening). PROJECTION ONLY — the on-disk jsonl keeps
 * the raw prompt (it's the audit record of what steered the auto-approving
 * agent); the rendered bubble/title shows just what the user typed. Handles
 * both formats: the current TRAILING `[maude-context …]` (+ `[selected: …]`)
 * bracket lines, and the legacy leading `<maude-context>` fence (2026-07-02,
 * one release window). `role:'bootstrap'` brief entries are skipped by this
 * reader by construction (only user/stop/agent roles are consumed below).
 */
function stripContextBlock(text: string): string {
  let out = text;
  if (out.startsWith('<maude-context')) {
    const end = out.indexOf('</maude-context>');
    if (end !== -1) out = out.slice(end + '</maude-context>'.length).replace(/^\s+/, '');
  }
  const i = out.indexOf('\n[maude-context ');
  if (i !== -1) {
    const tail = out.slice(i + 1);
    // Only strip when the remainder is EXACTLY the context block (all lines are
    // bracket lines) — a user merely quoting `[maude-context …]` mid-text stays.
    if (/^\[maude-context [^\n]*\](\n\[selected:[^\n]*\])*\s*$/.test(tail)) {
      out = out.slice(0, i).replace(/\s+$/, '');
    }
  }
  return out;
}

/**
 * Convert the raw transcript into clean per-turn messages: user lines become
 * user messages; the agent updates between them aggregate into one assistant
 * message (text + tool parts; `available_commands_update` / `usage_update` /
 * thoughts dropped — chrome noise, not the conversation).
 */
export function readChatMessages(designRoot: string, chatId: string): ChatMessage[] {
  const file = join(chatDir(designRoot), `${chatId}.jsonl`);
  if (!existsSync(file)) return [];
  const lines = readLines(file);
  const messages: ChatMessage[] = [];
  let assistant: ChatMessage | null = null;
  const toolIndex = new Map<string, number>();

  const flush = () => {
    if (assistant?.parts.length) messages.push(assistant);
    assistant = null;
    toolIndex.clear();
  };

  for (const line of lines) {
    if (line.role === 'user' && typeof line.text === 'string') {
      flush();
      messages.push({
        role: 'user',
        parts: [{ type: 'text', text: stripContextBlock(line.text) }],
      });
      continue;
    }
    if (line.role === 'stop') {
      flush();
      continue;
    }
    if (line.role !== 'agent') continue;
    const update = line.update as Record<string, unknown> | undefined;
    if (!update) continue;
    if (!assistant) assistant = { role: 'assistant', parts: [] };
    const kind = update.sessionUpdate;
    if (kind === 'agent_message_chunk') {
      const content = update.content as { type?: string; text?: string } | undefined;
      if (content?.type !== 'text' || typeof content.text !== 'string') continue;
      const last = assistant.parts[assistant.parts.length - 1];
      if (last && last.type === 'text') last.text = (last.text ?? '') + content.text;
      else assistant.parts.push({ type: 'text', text: content.text });
    } else if (kind === 'tool_call') {
      const id = String(update.toolCallId ?? '');
      toolIndex.set(id, assistant.parts.length);
      assistant.parts.push({
        type: 'tool',
        toolName: String(update.title ?? update.kind ?? 'tool'),
        done: false,
      });
    } else if (kind === 'tool_call_update') {
      const id = String(update.toolCallId ?? '');
      const idx = toolIndex.get(id);
      const status = update.status;
      if (idx != null && (status === 'completed' || status === 'failed')) {
        const part = assistant.parts[idx];
        if (part) part.done = true;
      }
    }
  }
  flush();
  return messages;
}
