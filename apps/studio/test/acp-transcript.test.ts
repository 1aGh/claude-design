// acp/transcript — repo-level chat list + raw-transcript → clean-messages.

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listChats, readChatMessages } from '../acp/transcript.ts';

let root: string;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function seed(chatId: string, lines: object[]): string {
  root = mkdtempSync(join(tmpdir(), 'acp-tx-'));
  const dir = join(root, '_chat');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${chatId}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n'));
  return root;
}

describe('readChatMessages — raw → clean turns', () => {
  test('aggregates agent updates into one assistant message; drops noise', () => {
    const designRoot = seed('c1', [
      { ts: 1, role: 'user', text: 'make the button red' },
      { ts: 2, role: 'agent', update: { sessionUpdate: 'available_commands_update', availableCommands: [] } },
      { ts: 3, role: 'agent', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Sure, ' } } },
      { ts: 4, role: 'agent', update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Edit Button.tsx', kind: 'edit', status: 'pending' } },
      { ts: 5, role: 'agent', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'done.' } } },
      { ts: 6, role: 'agent', update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' } },
      { ts: 7, role: 'agent', update: { sessionUpdate: 'usage_update', used: 10 } },
      { ts: 8, role: 'stop', stopReason: 'end_turn' },
    ]);

    const msgs = readChatMessages(designRoot, 'c1');
    expect(msgs.length).toBe(2);
    expect(msgs[0]).toEqual({ role: 'user', parts: [{ type: 'text', text: 'make the button red' }] });
    expect(msgs[1].role).toBe('assistant');
    // text parts merged across the tool call boundary order-preserving
    const texts = msgs[1].parts.filter((p) => p.type === 'text').map((p) => p.text);
    expect(texts.join('')).toBe('Sure, done.');
    const tool = msgs[1].parts.find((p) => p.type === 'tool');
    expect(tool?.toolName).toBe('Edit Button.tsx');
    expect(tool?.done).toBe(true);
    // noise (available_commands_update / usage_update) is not rendered
    expect(JSON.stringify(msgs)).not.toContain('availableCommands');
    expect(JSON.stringify(msgs)).not.toContain('usage');
  });

  test('missing chat → empty', () => {
    const designRoot = seed('c1', [{ ts: 1, role: 'user', text: 'hi' }]);
    expect(readChatMessages(designRoot, 'nope')).toEqual([]);
  });
});

describe('listChats', () => {
  test('lists chats with a title derived from the first user line', () => {
    const designRoot = seed('chat-7', [
      { ts: 1, role: 'user', text: 'redesign the pricing page please' },
      { ts: 2, role: 'stop', stopReason: 'end_turn' },
    ]);
    const chats = listChats(designRoot);
    expect(chats.length).toBe(1);
    expect(chats[0].id).toBe('chat-7');
    expect(chats[0].title).toBe('redesign the pricing page please');
  });

  test('no _chat dir → empty', () => {
    root = mkdtempSync(join(tmpdir(), 'acp-tx-'));
    expect(listChats(root)).toEqual([]);
  });
});
