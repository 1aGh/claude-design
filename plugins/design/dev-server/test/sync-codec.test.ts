// Codec unit tests — Phase 9 Task 4.
//
// Verify Y.Doc <-> disk round-trips for the three classes of files the sync
// agent shuttles: HTML body, comments JSON, annotations SVG.

import { describe, expect, test } from 'bun:test';
import * as Y from 'yjs';

import { Y_TYPES } from '../collab/persistence.ts';
import {
  annotationsFromDoc,
  applyAnnotationsToDoc,
  applyCommentsToDoc,
  applyHtmlToDoc,
  commentsFromDoc,
  htmlFromDoc,
  Y_SYNC_TYPES,
} from '../sync/codec.ts';

describe('HTML codec', () => {
  test('htmlFromDoc returns empty string for a fresh doc', () => {
    const doc = new Y.Doc();
    expect(htmlFromDoc(doc)).toBe('');
  });

  test('applyHtmlToDoc → htmlFromDoc round-trip', () => {
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<button>hello</button>');
    expect(htmlFromDoc(doc)).toBe('<button>hello</button>');
  });

  test('applyHtmlToDoc with identical content is a no-op', () => {
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<button>hi</button>');
    let updates = 0;
    doc.on('update', () => {
      updates++;
    });
    const changed = applyHtmlToDoc(doc, '<button>hi</button>');
    expect(changed).toBe(false);
    expect(updates).toBe(0);
  });

  test('applyHtmlToDoc emits a minimal op via common prefix + suffix', () => {
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, '<button class="cta">Click</button>');

    // Yjs requires `event.changes.delta` to be read inside the observer.
    let inserts = '';
    let deletes = 0;
    const yText = doc.getText(Y_SYNC_TYPES.html);
    yText.observe((evt) => {
      for (const d of evt.changes.delta) {
        if (typeof d.insert === 'string') inserts += d.insert;
        if (typeof d.delete === 'number') deletes += d.delete;
      }
    });

    applyHtmlToDoc(doc, '<button class="cta">Tap</button>');
    expect(htmlFromDoc(doc)).toBe('<button class="cta">Tap</button>');

    // The change is "Click" → "Tap". With shared prefix
    // `<button class="cta">` and shared suffix `</button>`, the delta should
    // only touch the middle.
    expect(inserts).toBe('Tap');
    expect(deletes).toBe('Click'.length);
  });

  test('applyHtmlToDoc handles complete replace (no shared prefix)', () => {
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, 'aaaa');
    applyHtmlToDoc(doc, 'bbbb');
    expect(htmlFromDoc(doc)).toBe('bbbb');
  });

  test('applyHtmlToDoc tags transaction with origin', () => {
    const doc = new Y.Doc();
    applyHtmlToDoc(doc, 'seed');

    let observedOrigin: unknown = 'unset';
    doc.on('update', (_update: Uint8Array, origin: unknown) => {
      observedOrigin = origin;
    });

    const myOrigin = { id: 'sync-agent' };
    applyHtmlToDoc(doc, 'changed', myOrigin);
    expect(observedOrigin).toBe(myOrigin);
  });
});

describe('Comments codec', () => {
  test('commentsFromDoc returns empty array for a fresh doc', () => {
    expect(commentsFromDoc(new Y.Doc())).toEqual([]);
  });

  test('applyCommentsToDoc → commentsFromDoc round-trip', () => {
    const doc = new Y.Doc();
    const snap = [{ id: 'c1', body: 'hi' }];
    applyCommentsToDoc(doc, snap);
    expect(commentsFromDoc(doc)).toEqual(snap);
  });

  test('applyCommentsToDoc with identical content is a no-op', () => {
    const doc = new Y.Doc();
    applyCommentsToDoc(doc, [{ id: 'c1' }]);
    let updates = 0;
    doc.on('update', () => {
      updates++;
    });
    const changed = applyCommentsToDoc(doc, [{ id: 'c1' }]);
    expect(changed).toBe(false);
    expect(updates).toBe(0);
  });

  test('applyCommentsToDoc replaces existing entries on disk-wins update', () => {
    const doc = new Y.Doc();
    applyCommentsToDoc(doc, [{ id: 'c1' }, { id: 'c2' }]);
    applyCommentsToDoc(doc, [{ id: 'c3' }]);
    expect(commentsFromDoc(doc)).toEqual([{ id: 'c3' }]);
  });

  test('comments share Y_TYPES.comments name with Phase 6 persistence', () => {
    const doc = new Y.Doc();
    applyCommentsToDoc(doc, [{ id: 'c1' }]);
    // The Phase 6 persistence layer reads from this name directly.
    expect(doc.getArray(Y_TYPES.comments).toArray()).toEqual([{ id: 'c1' }]);
  });
});

describe('Annotations codec', () => {
  test('annotationsFromDoc returns null for a fresh doc', () => {
    expect(annotationsFromDoc(new Y.Doc())).toBeNull();
  });

  test('applyAnnotationsToDoc → annotationsFromDoc round-trip', () => {
    const doc = new Y.Doc();
    applyAnnotationsToDoc(doc, '<svg></svg>');
    expect(annotationsFromDoc(doc)).toBe('<svg></svg>');
  });

  test('applyAnnotationsToDoc with null clears the entry', () => {
    const doc = new Y.Doc();
    applyAnnotationsToDoc(doc, '<svg></svg>');
    applyAnnotationsToDoc(doc, null);
    expect(annotationsFromDoc(doc)).toBeNull();
  });

  test('applyAnnotationsToDoc with identical content is a no-op', () => {
    const doc = new Y.Doc();
    applyAnnotationsToDoc(doc, '<svg></svg>');
    let updates = 0;
    doc.on('update', () => {
      updates++;
    });
    const changed = applyAnnotationsToDoc(doc, '<svg></svg>');
    expect(changed).toBe(false);
    expect(updates).toBe(0);
  });

  test('annotations share Y_TYPES.annotations name with Phase 5 persistence', () => {
    const doc = new Y.Doc();
    applyAnnotationsToDoc(doc, '<svg>x</svg>');
    expect(doc.getMap<string>(Y_TYPES.annotations).get('svg')).toBe('<svg>x</svg>');
  });
});
