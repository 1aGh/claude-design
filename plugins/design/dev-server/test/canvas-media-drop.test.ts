// use-canvas-media-drop — Phase 23 pure helpers (no DOM).
//
// Covers the drop/paste dispatch matrix + the URL helpers. The http(s) scheme
// gate (isHttpUrl) is security-relevant — a link chip must never carry a
// javascript:/data: URL into window.open.

import { describe, expect, test } from 'bun:test';

import {
  anchorTextFromHtml,
  classifyMediaPayload,
  firstHttpUrl,
  isHttpUrl,
  linkDomain,
  type MediaPayload,
  normalizeUrl,
  prettifyUrl,
} from '../use-canvas-media-drop.tsx';

const empty: MediaPayload = { files: [], uriList: '', html: '', plain: '' };
const fakeFile = (type: string): File => ({ type, name: 'x', size: 1 }) as unknown as File;

describe('use-canvas-media-drop / isHttpUrl (scheme gate)', () => {
  test('accepts http + https only', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com/a/b?c=1')).toBe(true);
  });
  test('rejects javascript: / data: / file: / mailto: / garbage', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('mailto:a@b.com')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('use-canvas-media-drop / normalizeUrl (no scheme required)', () => {
  test('keeps an explicit http(s) URL', () => {
    expect(normalizeUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
  test('prepends https:// to a bare domain', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('www.example.com/blog/post?x=1')).toBe(
      'https://www.example.com/blog/post?x=1'
    );
    expect(normalizeUrl('sub.example.io:8080/path')).toBe('https://sub.example.io:8080/path');
  });
  test('rejects dangerous schemes even though it is lenient about http(s)', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,x')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeUrl('mailto:a@b.com')).toBeNull();
  });
  test('does NOT mistake a bare decimal / non-domain for a URL', () => {
    expect(normalizeUrl('3.5')).toBeNull();
    expect(normalizeUrl('v1.2')).toBeNull();
    expect(normalizeUrl('hello world')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });
});

describe('use-canvas-media-drop / firstHttpUrl', () => {
  test('a bare-domain line becomes an https URL (no scheme needed to paste)', () => {
    expect(firstHttpUrl('example.com')).toBe('https://example.com');
  });

  test('skips uri-list comment lines and returns the first real URL', () => {
    expect(firstHttpUrl('# a comment\nhttps://example.com/p\nhttps://other.com')).toBe(
      'https://example.com/p'
    );
  });
  test('finds an inline URL in a prose paste', () => {
    expect(firstHttpUrl('see https://example.com/post for details')).toBe(
      'https://example.com/post'
    );
  });
  test('returns null for non-URL text', () => {
    expect(firstHttpUrl('just some words')).toBeNull();
    expect(firstHttpUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('use-canvas-media-drop / linkDomain + prettifyUrl', () => {
  test('linkDomain strips www.', () => {
    expect(linkDomain('https://www.example.com/x')).toBe('example.com');
    expect(linkDomain('https://sub.example.io')).toBe('sub.example.io');
  });
  test('prettifyUrl yields host + path (no protocol, no trailing slash)', () => {
    expect(prettifyUrl('https://www.example.com/blog/post/')).toBe('example.com/blog/post');
    expect(prettifyUrl('https://example.com/')).toBe('example.com');
  });
});

describe('use-canvas-media-drop / anchorTextFromHtml', () => {
  test('extracts the anchor text from a text/html payload', () => {
    expect(anchorTextFromHtml('<a href="https://x.io">Cool Post</a>')).toBe('Cool Post');
  });
  test('strips inner markup and collapses whitespace', () => {
    expect(anchorTextFromHtml('<a href="#"><b>Bold</b>  title</a>')).toBe('Bold title');
  });
  test('returns null when there is no anchor', () => {
    expect(anchorTextFromHtml('<div>no link</div>')).toBeNull();
    expect(anchorTextFromHtml('')).toBeNull();
  });
});

describe('use-canvas-media-drop / classifyMediaPayload (dispatch matrix)', () => {
  test('an image file wins (even when a uri-list is also present)', () => {
    const intent = classifyMediaPayload({
      ...empty,
      files: [fakeFile('image/png')],
      uriList: 'https://example.com',
    });
    expect(intent?.kind).toBe('image');
  });

  test('a non-image file is ignored', () => {
    expect(classifyMediaPayload({ ...empty, files: [fakeFile('application/pdf')] })).toBeNull();
  });

  test('a URL drop becomes a link with the anchor text as the title', () => {
    const intent = classifyMediaPayload({
      ...empty,
      uriList: 'https://example.com/post',
      html: '<a href="https://example.com/post">Read this</a>',
    });
    expect(intent).toEqual({ kind: 'link', url: 'https://example.com/post', title: 'Read this' });
  });

  test('a URL drop with no anchor text falls back to the prettified URL', () => {
    const intent = classifyMediaPayload({ ...empty, uriList: 'https://example.com/post' });
    expect(intent).toEqual({
      kind: 'link',
      url: 'https://example.com/post',
      title: 'example.com/post',
    });
  });

  test('a bare-domain paste (no scheme) becomes a link normalized to https', () => {
    const intent = classifyMediaPayload({ ...empty, plain: 'example.com/post' });
    expect(intent).toEqual({
      kind: 'link',
      url: 'https://example.com/post',
      title: 'example.com/post',
    });
  });

  test('a plain-text (non-media) paste classifies as null — caller leaves it alone', () => {
    expect(classifyMediaPayload({ ...empty, plain: 'hello world' })).toBeNull();
  });

  test('a javascript: URL is never classified as a link', () => {
    expect(classifyMediaPayload({ ...empty, plain: 'javascript:alert(1)' })).toBeNull();
    expect(classifyMediaPayload({ ...empty, uriList: 'javascript:alert(1)' })).toBeNull();
  });
});
