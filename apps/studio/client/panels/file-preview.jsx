// feature-studio-file-preview — inline preview for a non-canvas tree row
// (markdown / text / image / video / audio / font). Reuses the existing
// static byte-serving route (no new server endpoint) and the chat panel's
// hand-rolled Markdown renderer — no new dependency.

import { useEffect, useState } from 'react';
import { Markdown } from './chat-markdown.jsx';

const TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — beyond this, just show a size note

function basename(p) {
  return p.split('/').pop() || p;
}

// Bidi-override control chars (U+202A-E, U+2066-9) let a crafted filename
// visually disguise its own name/extension (the classic "invoice‮gnp.exe"
// trick) wherever we render a raw path/name as text — strip them before
// display. Doesn't affect matching (previewKind() regexes run on the
// unstripped name), only what a human/AT reads.
export function sanitizeDisplayText(s) {
  return String(s).replace(/[\u202a-\u202e\u2066-\u2069]/g, '');
}

function useFetchedText(url, enabled) {
  const [state, setState] = useState({ loading: true, error: null, text: '', tooLarge: false });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ loading: true, error: null, text: '', tooLarge: false });
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const len = Number(r.headers.get('content-length') || 0);
        if (len > TEXT_PREVIEW_MAX_BYTES) {
          if (!cancelled) setState({ loading: false, error: null, text: '', tooLarge: len });
          return;
        }
        const text = await r.text();
        if (!cancelled) setState({ loading: false, error: null, text, tooLarge: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message || 'Failed to load', text: '', tooLarge: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);
  return state;
}

function TextPreview({ url, name, as }) {
  const { loading, error, text, tooLarge } = useFetchedText(url, true);
  if (loading) return <div className="st-file-preview-status">Loading {name}…</div>;
  if (error) return <div className="st-file-preview-status st-file-preview-error">Couldn't load {name}: {error}</div>;
  if (tooLarge) {
    return (
      <div className="st-file-preview-status">
        {name} is {Math.round(tooLarge / 1024)} KB — too large to preview inline.
      </div>
    );
  }
  if (as === 'markdown') return <div className="st-file-preview-markdown"><Markdown text={text} /></div>;
  return <pre className="st-file-preview-text">{text}</pre>;
}

// CSS-string-literal escape for a value interpolated inside url("...") —
// filenames can contain arbitrary characters (only "/" and NUL are forbidden
// on disk), so an unescaped `"` or `\` could break out of the string and
// inject arbitrary rules into the live app-shell stylesheet (not just the
// sandboxed canvas iframe). family is already alnum/hyphen-only; this covers
// the url() side of the same interpolation.
function cssStringEscape(s) {
  // CSS input-preprocessing (CSS Syntax Module Level 3 §3.3) normalizes CR,
  // CRLF, AND FORM FEED (\f, U+000C) to a single LF before tokenizing, so an
  // unescaped \f terminates a double-quoted string exactly like \r/\n does —
  // strip all three, not just the two obvious ones.
  return String(s).replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\r\n\f]/g, '');
}

function FontPreview({ url, name }) {
  const family = `st-preview-font-${name.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <div className="st-file-preview-font">
      <style>{`@font-face { font-family: "${family}"; src: url("${cssStringEscape(url)}"); }`}</style>
      <div className="st-file-preview-font-specimen" style={{ fontFamily: family }}>
        <div className="st-file-preview-font-lg">The quick brown fox</div>
        <div className="st-file-preview-font-md">jumps over the lazy dog</div>
        <div className="st-file-preview-font-sm">ABCDEFGHIJKLM abcdefghijklm 0123456789</div>
      </div>
    </div>
  );
}

export function FilePreview({ path, kind }) {
  if (!path || !kind) return null;
  const url = `/${path}`;
  const name = sanitizeDisplayText(basename(path));
  return (
    <div className="st-file-preview" data-kind={kind}>
      <h2 className="st-file-preview-header">{sanitizeDisplayText(path)}</h2>
      <div className="st-file-preview-body">
        {kind === 'markdown' && <TextPreview url={url} name={name} as="markdown" />}
        {kind === 'text' && <TextPreview url={url} name={name} as="text" />}
        {kind === 'image' && (
          <div className="st-file-preview-image-wrap">
            <img src={url} alt={`Preview: ${name}`} className="st-file-preview-image" />
          </div>
        )}
        {kind === 'video' && <video key={url} src={url} controls className="st-file-preview-media" />}
        {kind === 'audio' && <audio key={url} src={url} controls className="st-file-preview-audio" />}
        {kind === 'font' && <FontPreview url={url} name={name} />}
      </div>
    </div>
  );
}
