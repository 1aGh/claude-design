// Compact, XSS-safe markdown renderer for the ACP chat feed. Builds React nodes
// directly (never innerHTML) so agent output can't inject markup. Covers the
// subset a coding agent actually emits: fenced code blocks, headings, bullet +
// numbered lists, bold / italic / inline code, and http(s) links. Anything else
// falls through as plain (pre-wrapped) text. No new dependency.

function safeHref(url) {
  // Only allow http(s) — never javascript:/data:/etc.
  return /^https?:\/\//i.test(url) ? url : null;
}

// Inline tokenizer: `code`, **bold**, *italic*, [text](url).
const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

function inline(text) {
  const out = [];
  let last = 0;
  let key = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else {
      const link = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok);
      const href = link && safeHref(link[2]);
      out.push(
        href ? (
          <a key={key++} href={href} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>
        ) : (
          link ? link[1] : tok
        )
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }) {
  const lines = String(text).split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  const isList = (l) => /^\s*[-*]\s/.test(l) || /^\s*\d+\.\s/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.trimStart().startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre key={key++} className="chat-code">
          <code>{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading → a styled paragraph (chat doesn't want giant h1s).
    if (/^#{1,6}\s/.test(line)) {
      blocks.push(
        <p key={key++} className="chat-md-h">
          {inline(line.replace(/^#{1,6}\s/, ''))}
        </p>
      );
      i++;
      continue;
    }

    // List (consecutive list lines).
    if (isList(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length && isList(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s/, ''))}</li>);
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={key++} className="chat-md-list">
            {items}
          </ol>
        ) : (
          <ul key={key++} className="chat-md-list">
            {items}
          </ul>
        )
      );
      continue;
    }

    // Blank line → paragraph separator.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-special lines.
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !isList(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="chat-md-p">
        {inline(buf.join('\n'))}
      </p>
    );
  }

  return <>{blocks}</>;
}
