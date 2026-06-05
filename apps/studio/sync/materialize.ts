// Canonical doc materialization — Phase 9.2 (DDR-064 Task 10, shadow-compare).
//
// A deterministic, stable string view of a canvas doc's five synced types. Two
// docs that have CONVERGED (same comments/annotations/body/meta/css content)
// produce byte-identical output regardless of CRDT internal structure or apply
// order. This is the comparison primitive the cutover relies on:
//
//   - shadow-compare: materialize the shared-doc path's doc and the legacy
//     two-doc path's doc; equal strings ⇒ zero divergence ⇒ safe to cut over a
//     canvas's reads to the shared doc. (The convergence test suite asserts this
//     law deterministically; the live runtime "shadow mode" — running both paths
//     simultaneously and logging divergences — is a cutover-time activity layered
//     on this same primitive.)
//   - round-trip laws: materialize∘import and import∘materialize for the
//     projection (test/shared-doc-* suites).
//
// Comments are canonicalized via JSON.stringify of the array (the snapshot IS
// the source of truth — LWW per the codec); the SVG / body / css / meta are
// taken as their string values. The object is key-ordered so the output is
// stable.

import type * as Y from 'yjs';
import { Y_TYPES } from '../collab/persistence.ts';
import { annotationsFromDoc, commentsFromDoc, Y_SYNC_TYPES } from './codec.ts';

export interface CanonicalMaterialization {
  html: string;
  css: string;
  meta: string;
  comments: unknown[];
  annotations: string;
}

/** Structured canonical view (for assertions that want to compare per-type). */
export function materialize(doc: Y.Doc): CanonicalMaterialization {
  return {
    html: doc.getText(Y_SYNC_TYPES.html).toString(),
    css: doc.getText(Y_SYNC_TYPES.css).toString(),
    meta: doc.getText(Y_SYNC_TYPES.meta).toString(),
    comments: commentsFromDoc(doc),
    annotations: annotationsFromDoc(doc) ?? '',
  };
}

/**
 * Stable canonical STRING of a doc's synced content. Byte-equal ⟺ converged.
 * Use for shadow-compare diffing + the round-trip convergence laws.
 */
export function materializeCanonical(doc: Y.Doc): string {
  const m = materialize(doc);
  // Fixed key order; comments serialized as-is (the JSON snapshot is canonical).
  return JSON.stringify({
    html: m.html,
    css: m.css,
    meta: m.meta,
    comments: m.comments,
    annotations: m.annotations,
  });
}

// Re-export so a shadow-compare caller has the type names in one import.
export { Y_SYNC_TYPES, Y_TYPES };
