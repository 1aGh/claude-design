// use-agent-presence — Phase 13.2. Funny-name/color derivation + provider gating.
// Live wiring (postMessage / WS subscription) is skipped via the `initialAgent`
// seed, so this stays SSR-renderable (renderToStaticMarkup capture pattern).

import { describe, expect, test } from 'bun:test';

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  type AgentPresence,
  AgentPresenceProvider,
  agentFunnyName,
  deriveAgent,
  useAgentPresence,
} from '../use-agent-presence.tsx';

describe('use-agent-presence / agentFunnyName', () => {
  test('deterministic — same seed → same name', () => {
    expect(agentFunnyName('Claude:1700000000000')).toBe(agentFunnyName('Claude:1700000000000'));
  });

  test('shape is "Adjective Animal"', () => {
    expect(agentFunnyName('seed-x')).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  test('different seeds usually differ (no constant collapse)', () => {
    const names = new Set(
      Array.from({ length: 24 }, (_, i) => agentFunnyName(`Claude:${1700000000000 + i * 7919}`))
    );
    // Not all 24 identical — the generator actually spreads.
    expect(names.size).toBeGreaterThan(5);
  });

  test('empty seed is handled (no throw, stable)', () => {
    expect(agentFunnyName('')).toBe(agentFunnyName(''));
  });
});

describe('use-agent-presence / deriveAgent', () => {
  const entry = {
    file: 'ui/Foo.tsx',
    author: 'Claude (acting for Ada)',
    startedAt: 1700000000000,
    lastHeartbeat: 1700000000000,
  };

  test('id = author:startedAt; name = funny; color present; author preserved', () => {
    const a = deriveAgent(entry);
    expect(a.id).toBe('Claude (acting for Ada):1700000000000');
    expect(a.name).toBe(agentFunnyName(a.id));
    expect(a.author).toBe('Claude (acting for Ada)');
    expect(a.startedAt).toBe(1700000000000);
    expect(typeof a.color).toBe('string');
    expect(a.color.length).toBeGreaterThan(0);
  });

  test('same entry → identical derived agent (stable across heartbeats)', () => {
    expect(deriveAgent(entry)).toEqual(deriveAgent({ ...entry, lastHeartbeat: 9999999999999 }));
  });
});

describe('use-agent-presence / provider gating', () => {
  function Wrap({
    initialAgent,
    children,
  }: {
    initialAgent: AgentPresence | null;
    children: ReactNode;
  }) {
    return <AgentPresenceProvider initialAgent={initialAgent}>{children}</AgentPresenceProvider>;
  }

  test('seeded agent flows through the hook', () => {
    const seeded = deriveAgent({
      file: 'ui/Foo.tsx',
      author: 'Claude',
      startedAt: 42,
      lastHeartbeat: 42,
    });
    let got: AgentPresence | null = null;
    function Probe() {
      got = useAgentPresence();
      return null;
    }
    renderToStaticMarkup(
      <Wrap initialAgent={seeded}>
        <Probe />
      </Wrap>
    );
    expect(got).toEqual(seeded);
  });

  test('null seed → no agent', () => {
    let got: AgentPresence | null = { id: 'x' } as AgentPresence;
    function Probe() {
      got = useAgentPresence();
      return null;
    }
    renderToStaticMarkup(
      <Wrap initialAgent={null}>
        <Probe />
      </Wrap>
    );
    expect(got).toBeNull();
  });

  test('outside the provider the hook is inert (null)', () => {
    let got: AgentPresence | null = { id: 'x' } as AgentPresence;
    function Probe() {
      got = useAgentPresence();
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(got).toBeNull();
  });
});
