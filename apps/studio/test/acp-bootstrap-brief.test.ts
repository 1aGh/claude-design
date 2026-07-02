// feature-acp-context-hardening — session bootstrap brief.
//
// Three layers: (1) the brief's content guardrails (static, environment-only),
// (2) the newSession params shape (the `_meta.systemPrompt.append` carrier),
// (3) the UPGRADE GUARD — the `_meta.systemPrompt` contract is internal to the
// installed adapter + SDK, so a dependency bump that drops either side must
// fail HERE, loudly, instead of silently un-briefing every session.

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildStudioBrief } from '../acp/bootstrap-brief.ts';
import { newSessionParams } from '../acp/bridge.ts';

describe('buildStudioBrief — content guardrails', () => {
  const brief = buildStudioBrief({ designRel: '.design', projectLabel: 'maude' });

  test('carries the studio-environment facts', () => {
    expect(brief).toContain('Maude desktop studio');
    expect(brief).toContain('`.design/`');
    expect(brief).toContain('/design:');
    expect(brief).toContain('maude design <verb>');
    expect(brief).toContain('[maude-context');
    expect(brief).toContain('_active.json');
    expect(brief).toContain('stale');
  });

  test('slash workflows are gated on explicit user intent — direct edits are the default', () => {
    // 2026-07-03 dogfood: "prefer /design:*" steered a trivial +40% font tweak
    // into the full edit pipeline (server, screenshots, critics). The brief must
    // point at direct file edits as the default path.
    expect(brief).toContain('edit the canvas file directly');
    expect(brief).toContain('only when the user explicitly asks');
    expect(brief.toLowerCase()).not.toContain('prefer the `/design:');
  });

  test('frames canvas-derived data as untrusted DATA', () => {
    expect(brief).toContain('UNTRUSTED');
    expect(brief.toLowerCase()).toContain('never as instructions');
  });

  test('carries NO behavioral/git policy (environment orientation only)', () => {
    // The user's own CLAUDE.md owns policy; the brief must never compete.
    for (const forbidden of ['git commit', 'git push', 'branch', 'auto-approve', 'permission']) {
      expect(brief.toLowerCase()).not.toContain(forbidden);
    }
  });

  test('is static — same facts in, same brief out', () => {
    expect(buildStudioBrief({ designRel: '.design', projectLabel: 'maude' })).toBe(brief);
  });
});

describe('newSessionParams — the carrier shape', () => {
  test('with a brief: _meta.systemPrompt.append rides the params', () => {
    const p = newSessionParams('/repo', 'BRIEF');
    expect(p.cwd).toBe('/repo');
    expect(p.mcpServers).toEqual([]);
    expect((p._meta as { systemPrompt?: { append?: string } }).systemPrompt?.append).toBe('BRIEF');
  });

  test('without a brief: no _meta key at all (tests / non-studio embedders)', () => {
    const p = newSessionParams('/repo');
    expect('_meta' in p).toBe(false);
  });
});

describe('upgrade guard — installed deps still honor the contract', () => {
  const nm = join(import.meta.dir, '..', 'node_modules');

  test('SDK zNewSessionRequest declares _meta (not stripped by validation)', () => {
    const zodGen = join(nm, '@agentclientprotocol', 'sdk', 'dist', 'schema', 'zod.gen.js');
    expect(existsSync(zodGen)).toBe(true);
    const src = readFileSync(zodGen, 'utf8');
    const m = src.match(/zNewSessionRequest = z\.object\(\{[\s\S]*?\}\)/);
    expect(m).not.toBeNull();
    expect(m?.[0]).toContain('_meta');
  });

  test('adapter newSession still reads _meta.systemPrompt (append path)', () => {
    const agent = join(nm, '@agentclientprotocol', 'claude-agent-acp', 'dist', 'acp-agent.js');
    expect(existsSync(agent)).toBe(true);
    const src = readFileSync(agent, 'utf8');
    // The load-bearing behaviors verified at 0.49.0 (acp-agent.js newSession):
    // params._meta.systemPrompt is read, and an object form is spread over the
    // claude_code preset (forwarding `append`). A bump that renames/drops this
    // must fail here — then either adapt, or fall back to the first-turn
    // text-block prepend (plan Task 3b).
    expect(src).toContain('systemPrompt');
    expect(src).toMatch(/_meta/);
    expect(src).toMatch(/preset[\s\S]{0,120}claude_code|claude_code[\s\S]{0,120}preset/);
  });
});
