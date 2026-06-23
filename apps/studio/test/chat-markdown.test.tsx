// chat-markdown — Phase 31. The ACP chat feed's compact, XSS-safe markdown
// renderer. Builds React nodes (never innerHTML), so we assert the rendered
// markup + that unsafe link schemes are dropped.

import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Markdown } from '../client/panels/chat-markdown.jsx';

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe('chat-markdown', () => {
  test('inline bold / italic / code', () => {
    const out = html('Use **bold**, *italic* and `code` here.');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toContain('<code>code</code>');
  });

  test('fenced code block', () => {
    const out = html('text\n```\nconst x = 1;\n```\nmore');
    expect(out).toContain('class="chat-code"');
    expect(out).toContain('const x = 1;');
  });

  test('bullet + numbered lists', () => {
    const bullet = html('- one\n- two');
    expect(bullet).toContain('<ul class="chat-md-list">');
    expect(bullet).toContain('<li>one</li>');
    const ordered = html('1. first\n2. second');
    expect(ordered).toContain('<ol class="chat-md-list">');
    expect(ordered).toContain('<li>first</li>');
  });

  test('headings render as styled paragraphs (no giant h1)', () => {
    const out = html('## Section');
    expect(out).toContain('class="chat-md-h"');
    expect(out).toContain('Section');
    expect(out).not.toContain('<h1');
  });

  test('http(s) links are kept, unsafe schemes are dropped to text', () => {
    const safe = html('see [Anthropic](https://anthropic.com)');
    expect(safe).toContain('href="https://anthropic.com"');
    expect(safe).toContain('rel="noreferrer noopener"');

    const unsafe = html('[click](javascript:alert(1))');
    expect(unsafe).not.toContain('javascript:');
    expect(unsafe).not.toContain('<a ');
    expect(unsafe).toContain('click'); // falls back to plain text
  });

  test('plain text passes through as a paragraph', () => {
    const out = html('just a line');
    expect(out).toContain('class="chat-md-p"');
    expect(out).toContain('just a line');
  });
});
