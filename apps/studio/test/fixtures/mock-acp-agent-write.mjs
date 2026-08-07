#!/usr/bin/env bun
// feature-acp-write-path-scope Task 1 — the RECORDED SHAPE of a write tool's
// permission request, replayed as a mock ACP agent.
//
// This is not an invented shape. It reproduces, field for field, what
// `@agentclientprotocol/claude-agent-acp@0.57.0` actually puts on the wire for
// `Write`/`Edit`/`NotebookEdit`, read out of its own `dist/` on 2026-08-07:
//
//   • `dist/acp-agent.js:2270-2286` builds the permission request's `toolCall`
//     as `{ toolCallId, rawInput, ...toolInfoFromToolUse(name, input, id) }` —
//     note there is NO tool NAME anywhere in that object.
//   • `dist/tools.js` `case "Write"` / `case "Edit"` set
//     `locations: input?.file_path ? [{ path: input.file_path }] : []` — the
//     model's string VERBATIM. No normalization, no absolutization, despite the
//     ACP schema (`types.gen.d.ts:568-572`) describing the field as "The
//     absolute file path being accessed or modified".
//   • `NotebookEdit` has NO case at all — it falls through to `case "Other"`,
//     which emits no `locations` whatsoever. Its target lives only on
//     `rawInput.notebook_path`.
//   • `dist/acp-agent.js:3808-3829` (`toolCallNotification`) is the ONLY carrier
//     of the tool name: `_meta.claudeCode.toolName` on the streamed `tool_call`.
//   • `requestPermissionFromClient` (`:2134-2141`) AWAITS `ensureToolCallEmitted`
//     before issuing the request, so that notification is guaranteed to be on
//     the wire FIRST. The bridge's gate depends on exactly that ordering, so the
//     fixture reproduces it rather than assuming it.
//
// Driven by env so one fixture covers every case:
//   MAUDE_TEST_WRITE_PATH  — the `file_path` the "model" emitted (required)
//   MAUDE_TEST_WRITE_TOOL  — Write (default) | Edit | NotebookEdit | Read
//   MAUDE_TEST_OMIT_TOOL_CALL=1 — skip the `tool_call` notification, i.e.
//        simulate an adapter that reorders or drops it. The gate must fail
//        CLOSED here (prompt), never auto-approve.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

const TOOL = process.env.MAUDE_TEST_WRITE_TOOL || 'Write';
const FILE_PATH = process.env.MAUDE_TEST_WRITE_PATH || '/tmp/unset';
const OMIT_TOOL_CALL = process.env.MAUDE_TEST_OMIT_TOOL_CALL === '1';
const TOOL_CALL_ID = 'tc-write-1';

// Mirrors `toolInfoFromToolUse`'s per-tool branches. NotebookEdit deliberately
// yields NO `locations` key — that is the adapter's real behaviour, and the case
// that makes the rawInput fallback mandatory rather than decorative.
function toolInfo() {
  if (TOOL === 'NotebookEdit') {
    return { title: 'NotebookEdit', kind: 'other', content: [] };
  }
  if (TOOL === 'Read') {
    return {
      title: `Read ${FILE_PATH}`,
      kind: 'read',
      content: [],
      locations: [{ path: FILE_PATH, line: 1 }],
    };
  }
  return {
    title: `${TOOL} ${FILE_PATH}`,
    kind: 'edit',
    content: [],
    locations: [{ path: FILE_PATH }],
  };
}

function rawInput() {
  if (TOOL === 'NotebookEdit') return { notebook_path: FILE_PATH, new_source: 'x' };
  if (TOOL === 'Write') return { file_path: FILE_PATH, content: 'x' };
  if (TOOL === 'Read') return { file_path: FILE_PATH };
  return { file_path: FILE_PATH, old_string: 'a', new_string: 'b' };
}

acp
  .agent({ name: 'mock-acp-agent-write' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: 'mock-write-session-1' }))
  .onRequest('session/prompt', async (ctx) => {
    // (1) The `tool_call` notification — the tool NAME's only carrier.
    if (!OMIT_TOOL_CALL) {
      await ctx.client.notify('session/update', {
        sessionId: ctx.params.sessionId,
        update: {
          _meta: { claudeCode: { toolName: TOOL } },
          toolCallId: TOOL_CALL_ID,
          sessionUpdate: 'tool_call',
          rawInput: rawInput(),
          status: 'pending',
          ...toolInfo(),
        },
      });
    }
    // (2) THEN the permission request, with the adapter's real option set for a
    //     routine tool call (`acp-agent.js:2271-2278`) — note `allow_always` is
    //     listed FIRST, which is what Decision D's filter has to contend with.
    const outcome = await ctx.client.request(acp.methods.client.session.requestPermission, {
      sessionId: ctx.params.sessionId,
      toolCall: { toolCallId: TOOL_CALL_ID, rawInput: rawInput(), ...toolInfo() },
      options: [
        { optionId: 'allow_always', name: 'Always Allow', kind: 'allow_always' },
        { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
        { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
      ],
    });
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `outcome=${JSON.stringify(outcome.outcome)}` },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
