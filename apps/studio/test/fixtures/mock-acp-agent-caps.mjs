#!/usr/bin/env bun
// Mock ACP agent exercising the session-capabilities channel (feature-acp-
// panel-dynamic-claude-code-capabilities) — modes + configOptions returned
// from session/new, live session/set_mode + session/set_config_option, and
// the config_option_update / session_info_update notifications a real
// claude-agent-acp session emits. No real `claude` needed.
//
// Mirrors the REAL adapter's observed behavior (read from the installed
// @agentclientprotocol/claude-agent-acp source, not guessed):
//   - session/set_mode updates the mode AND mirrors it into configOptions'
//     "mode" entry, emitting ONLY a config_option_update notification (no
//     current_mode_update) — bridge.ts cross-derives lastModes from that.
//   - session/set_config_option('model', …) can change which OTHER options
//     are offered (here: picking "opus" adds a "fast" option) and returns
//     the FULL refreshed configOptions in its RPC response (no notification).

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

const MODEL_OPTIONS = [
  { value: 'sonnet', name: 'Sonnet' },
  { value: 'opus', name: 'Opus' },
];
const EFFORT_OPTIONS = [
  { value: 'default', name: 'Default' },
  { value: 'high', name: 'High' },
];
const MODE_OPTIONS = [
  { value: 'default', name: 'Manual' },
  { value: 'plan', name: 'Plan Mode' },
];
const AVAILABLE_MODES = [
  { id: 'default', name: 'Manual', description: 'Standard behavior, prompts for dangerous operations' },
  { id: 'plan', name: 'Plan Mode', description: 'Planning mode, no actual tool execution' },
];

// `session` carries every tracked field (model/effort/mode/fast) so a call
// that rebuilds the FULL option set (e.g. session/set_mode, which is scoped
// to just the mode) never regresses a field a PRIOR call already changed —
// mirrors the real adapter's `session.configOptions` being one persistent
// object, not independently recomputed per field.
function baseConfigOptions(session) {
  const opts = [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: session.model,
      options: MODEL_OPTIONS,
    },
    {
      id: 'effort',
      name: 'Effort',
      category: 'thought_level',
      type: 'select',
      currentValue: session.effort,
      options: EFFORT_OPTIONS,
    },
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: session.mode,
      options: MODE_OPTIONS,
    },
  ];
  if (session.model === 'opus') {
    opts.push({
      id: 'fast',
      name: 'Fast mode',
      category: 'model_config',
      type: 'select',
      currentValue: session.fast,
      options: [
        { value: 'on', name: 'On' },
        { value: 'off', name: 'Off' },
      ],
    });
  }
  return opts;
}

let n = 0;
const sessions = new Map(); // sessionId -> { model, effort, mode, fast }

acp
  .agent({ name: 'mock-acp-agent-caps' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', async (ctx) => {
    const sessionId = `mock-caps-session-${++n}`;
    const session = { model: 'sonnet', effort: 'default', mode: 'default', fast: 'off' };
    sessions.set(sessionId, session);
    await ctx.client.notify('session/update', {
      sessionId,
      update: { sessionUpdate: 'session_info_update', title: 'New chat' },
    });
    return {
      sessionId,
      modes: { currentModeId: 'default', availableModes: AVAILABLE_MODES },
      configOptions: baseConfigOptions(session),
    };
  })
  .onRequest('session/prompt', async (ctx) => {
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
    });
    return { stopReason: 'end_turn' };
  })
  .onRequest('session/set_mode', async (ctx) => {
    const session = sessions.get(ctx.params.sessionId);
    if (!session) throw new Error('session not found');
    if (!AVAILABLE_MODES.some((m) => m.id === ctx.params.modeId)) {
      throw new Error(`unknown mode: ${ctx.params.modeId}`);
    }
    session.mode = ctx.params.modeId;
    // Real adapter: setSessionMode emits ONLY config_option_update, never
    // current_mode_update — bridge.ts must cross-derive lastModes from it.
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: { sessionUpdate: 'config_option_update', configOptions: baseConfigOptions(session) },
    });
    return {};
  })
  .onRequest('session/set_config_option', async (ctx) => {
    const session = sessions.get(ctx.params.sessionId);
    if (!session) throw new Error('session not found');
    const { configId, value } = ctx.params;
    if (configId === 'model') {
      if (!MODEL_OPTIONS.some((o) => o.value === value)) throw new Error(`unknown model: ${value}`);
      session.model = value;
    } else if (configId === 'effort') {
      if (!EFFORT_OPTIONS.some((o) => o.value === value)) throw new Error(`unknown effort: ${value}`);
      session.effort = value;
    } else if (configId === 'mode') {
      if (!AVAILABLE_MODES.some((m) => m.id === value)) throw new Error(`unknown mode: ${value}`);
      session.mode = value;
    } else if (configId === 'fast') {
      session.fast = value;
    } else {
      throw new Error(`unknown config option: ${configId}`);
    }
    return { configOptions: baseConfigOptions(session) };
  })
  .connect(stream);
