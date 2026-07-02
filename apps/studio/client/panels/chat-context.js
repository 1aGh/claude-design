// Frozen-at-send chat context (feature-acp-context-hardening).
//
// Builds BOTH halves of the context attachment from one source, so the visible
// chip and the prompt block can never diverge (DDR-140 reveal rule: what the
// user sees IS what rides):
//   - `chipLabel` — the composer/bubble chip text,
//   - `block`     — the fenced `<maude-context>` text prepended to the prompt.
//
// Security shape (debate 2026-07-02, guard 3): locators ONLY — data-cd-id,
// selector, index, tag, short text. NEVER `selected.html`: canvas DOM is
// untrusted (DDR-054) and the agent auto-approves (F2); it can read the
// element from disk itself, which is also fresher than a frozen copy. All
// interpolated values are sanitized so canvas-controlled strings can't break
// out of the fence or forge attributes.

/** Max elements listed in the block; the rest collapse to a `+N more` line. */
export const CONTEXT_MAX_ELEMENTS = 12;

/** Strip line/grammar-breaking chars from a canvas-derived string. Newlines are
 *  the load-bearing removal: the context rides as `[maude-context …]` LINES, so
 *  a value that can't contain a newline can't forge a new context line. */
function sanitize(value, max) {
  let out = '';
  for (const ch of String(value ?? '')) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue; // controls (incl. newlines)
    if (ch === '<' || ch === '>' || ch === '"' || ch === '`' || ch === '[' || ch === ']') continue;
    out += ch;
    if (out.length >= max) break;
  }
  return out;
}

function asArray(selected) {
  if (selected == null) return [];
  return Array.isArray(selected) ? selected : [selected];
}

function shortName(canvas) {
  const base = String(canvas || '').split('/').pop() || '';
  return base.replace(/\.(tsx|html)$/i, '');
}

function elementLabel(el) {
  const tag = sanitize(el.tag || 'element', 24);
  const text = sanitize(el.text || '', 32).trim();
  return text ? `${tag} “${text}”` : tag;
}

/**
 * Freeze the current canvas + selection into a chat-context attachment.
 * Returns null when there's no canvas (no attachment to make).
 *
 * @param {{ canvas?: string|null, selected?: object|object[]|null }} input
 * @returns {{ chipLabel: string, block: string, count: number, stale: boolean } | null}
 */
export function buildChatContext({ canvas, selected } = {}) {
  if (!canvas || typeof canvas !== 'string') return null;
  // Scope to the given canvas — a foreign-file selection (races, restored
  // cross-canvas state) must not masquerade as this canvas's context.
  const els = asArray(selected).filter((e) => e && typeof e === 'object' && e.file === canvas);
  const stale = els.some((e) => e.stale === true);
  const mtime = els.find((e) => Number.isFinite(e.canvas_mtime))?.canvas_mtime ?? 0;

  const name = shortName(canvas);
  const chipLabel =
    els.length === 0
      ? `${name} · whole canvas`
      : els.length === 1
        ? `${name} · ${elementLabel(els[0])}${stale ? ' ⚠' : ''}`
        : `${name} · ${els.length} elements${stale ? ' ⚠' : ''}`;

  // Paste-chip shape (user feedback 2026-07-03): compact bracket LINES appended
  // after the typed text — like a pasted file path — not a fenced XML block that
  // bloats titles and reads as workflow ceremony. Single-select common case:
  //   [maude-context canvas=".design/ui/Pricing.tsx" mtime=1234]
  //   [selected: h2 "Every feature…" data-cd-id=a1b2c3d4 selector="div.hero h2" index=0]
  const lines = [
    `[maude-context canvas="${sanitize(canvas, 200)}" mtime=${mtime}${stale ? ' stale=true' : ''}]`,
  ];
  for (const el of els.slice(0, CONTEXT_MAX_ELEMENTS)) {
    const parts = [sanitize(el.tag || 'element', 24)];
    const text = sanitize(el.text || '', 120).trim();
    if (text) parts.push(`"${text}"`);
    if (el.id) parts.push(`data-cd-id=${sanitize(el.id, 16)}`);
    if (el.selector) parts.push(`selector="${sanitize(el.selector, 160)}"`);
    if (typeof el.index === 'number') parts.push(`index=${el.index}`);
    if (el.stale === true) parts.push('stale=true');
    lines.push(`[selected: ${parts.join(' ')}]`);
  }
  if (els.length > CONTEXT_MAX_ELEMENTS) {
    lines.push(`[selected: …+${els.length - CONTEXT_MAX_ELEMENTS} more]`);
  }

  return { chipLabel, block: lines.join('\n'), count: els.length, stale };
}
