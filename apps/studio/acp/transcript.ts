// Repo-level chat transcripts (`<designRoot>/_chat/<chatId>.jsonl`). The bridge
// appends raw per-update lines; these readers turn them into the chat list (for
// the switcher) and clean per-turn messages (for hydrating the thread on open).

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ChatSummary {
  id: string;
  title: string;
  updated: number; // mtime ms
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

/** First user line, truncated — the chat's display title. */
function deriveTitle(lines: Array<Record<string, unknown>>): string {
  const firstUser = lines.find((l) => l.role === 'user' && typeof l.text === 'string');
  const text = (firstUser?.text as string) ?? '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, 60) : 'New chat';
}

/** List chats newest-first. */
export function listChats(designRoot: string): ChatSummary[] {
  const dir = chatDir(designRoot);
  if (!existsSync(dir)) return [];
  const out: ChatSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue;
    const file = join(dir, name);
    let updated = 0;
    try {
      updated = statSync(file).mtimeMs;
    } catch {
      /* skip unreadable */
    }
    const lines = readLines(file);
    if (lines.length === 0) continue;
    out.push({ id: name.replace(/\.jsonl$/, ''), title: deriveTitle(lines), updated });
  }
  return out.sort((a, b) => b.updated - a.updated);
}

/** Delete a chat's transcript. Returns true if a file was removed. */
export function deleteChat(designRoot: string, chatId: string): boolean {
  const file = join(chatDir(designRoot), `${chatId}.jsonl`);
  if (!existsSync(file)) return false;
  try {
    rmSync(file);
    return true;
  } catch {
    return false;
  }
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
      messages.push({ role: 'user', parts: [{ type: 'text', text: line.text }] });
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
