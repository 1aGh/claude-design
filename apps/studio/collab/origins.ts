// Origin gate for canvas-realm Y.Doc ops — the named-but-undone DDR-122
// follow-up ("Origin-gate canvas-injected doc ops"), landed by Cloud Phase 1
// Task 3.
//
// THE THREAT (DDR-054 F1/F3, restated by DDR-122's security residual): the
// canvas iframe is untrusted, and same-realm canvas script can reach the live
// collab Y.Doc via `useCollab().doc`. Nothing stopped it from writing the BODY
// lanes — `html` / `css` / `meta` / `syncMeta`, i.e. the canvas's own `.tsx`,
// its sibling `.css`, and the shared `.meta.json` — which the sync agent then
// materializes to **every peer's disk**. That is "untrusted canvas writes
// source code to all peers" (stored-XSS + Claude-Code-context-poisoning).
//
// THE GATE, dual-lock (DDR-063's canvas-origin split is the seam that makes
// lock 2 expressible at all):
//
//   Lock 1 — CLIENT (`use-collab.tsx`): a local doc update that touches a body
//            lane is not broadcast to the server unless its transaction origin
//            is a *trusted sentinel* registered here. Closes the honest path
//            (`useCollab().doc.getText('html').insert(...)`).
//   Lock 2 — SERVER (`collab/room.ts`): an update arriving on a collab socket
//            that was upgraded on the CANVAS origin is validated against a
//            mirror doc before it is allowed to touch the real room doc; a
//            body-lane write is refused outright and never broadcast. Closes
//            the bypass where canvas script skips `use-collab` and opens its
//            own WebSocket to `/_ws/collab/:slug`.
//
// Lock 1 alone is defense-in-depth; lock 2 is the actual boundary. Both exist
// because lock 1 is where the intent is legible and lock 2 is where it is
// enforceable.
//
// WHY A MIRROR DOC AND NOT UPDATE INSPECTION (load-bearing, don't "simplify"):
// `Y.decodeUpdate` only reveals a struct's parent when the struct has neither a
// left nor a right origin (yjs writes the parent key *only* in that case). An
// insert into existing text carries an origin ID instead, so the lane it targets
// is simply not in the bytes — it is only resolvable against a doc that already
// holds the referenced items. Hence: apply to a mirror of the room doc, read
// `transaction.changed`, decide, and only then touch the real doc.

import * as Y from 'yjs';

/**
 * Lanes that carry the canvas SOURCE (and its sync bookkeeping). Written only
 * by server-side code — `sync/agent.ts`, `sync/codec.ts`, `sync/projection.ts`.
 * No browser-realm code writes these today; the gate keeps it that way.
 */
const BODY_LANES = new Set<string>(['html', 'css', 'meta', 'syncMeta']);

/**
 * Lanes the canvas realm legitimately co-authors — annotations (draw layer),
 * comments, and the presentation channel. Deliberately NOT used as an allowlist
 * for the gate (a new lane must be reasoned about, not silently permitted); it
 * documents intent and backs `isCanvasAuthorableLane` for callers that want the
 * positive form.
 */
const CANVAS_AUTHORABLE_LANES = new Set<string>(['comments', 'annotations', 'presentation']);

/** True when `name` is a source-carrying lane the canvas realm may never write. */
export function isBodyLane(name: string): boolean {
  return BODY_LANES.has(name);
}

/** True when `name` is a lane the canvas realm co-authors by design. */
export function isCanvasAuthorableLane(name: string): boolean {
  return CANVAS_AUTHORABLE_LANES.has(name);
}

/** Test/introspection — the frozen lane vocabulary as plain arrays. */
export function laneVocabulary(): { body: string[]; canvasAuthorable: string[] } {
  return { body: [...BODY_LANES].sort(), canvasAuthorable: [...CANVAS_AUTHORABLE_LANES].sort() };
}

// ---------------------------------------------------------------------------
// Trusted origin sentinels
// ---------------------------------------------------------------------------

// A WeakSet, not a marker property: a marker property is forgeable by any
// same-realm script (`{ maudeTrusted: true }`), a WeakSet membership is not —
// an attacker would need the sentinel *object itself*, which is only reachable
// from module scope of the modules that legitimately hold it.
const TRUSTED_ORIGINS = new WeakSet<object>();

/**
 * Register `origin` as a trusted doc-update origin. Returns it, so a sentinel
 * can be declared and marked in one expression. Frozen objects are fine —
 * freezing does not affect WeakSet membership.
 */
export function markTrustedOrigin<T extends object>(origin: T): T {
  TRUSTED_ORIGINS.add(origin);
  return origin;
}

/** True when a Y transaction origin was registered via `markTrustedOrigin`. */
export function isTrustedOrigin(origin: unknown): boolean {
  return typeof origin === 'object' && origin !== null && TRUSTED_ORIGINS.has(origin as object);
}

/**
 * The shell's sanctioned edit path — the inspector / shell UI mutating a body
 * lane on behalf of an explicit user gesture. Nothing in the canvas realm can
 * obtain this object; it is exported for the shell modules that need it.
 */
export const SHELL_EDIT_ORIGIN: object = markTrustedOrigin(
  Object.freeze({ maudeOrigin: 'shell-edit' })
);

/**
 * The local sync agent applying a disk-authoritative body into the doc. Used by
 * server-side code that runs outside the canvas realm entirely; marked here so
 * the client-side lock stays correct if a future build ever colocates them.
 */
export const SYNC_AGENT_ORIGIN: object = markTrustedOrigin(
  Object.freeze({ maudeOrigin: 'sync-agent' })
);

// ---------------------------------------------------------------------------
// Transaction inspection
// ---------------------------------------------------------------------------

/**
 * Root shared-type names a transaction touched.
 *
 * `transaction.changed` is keyed by the *concrete* type that changed, which for
 * a nested structure is not the root — so walk `_item.parent` up to the root and
 * resolve its registered name via `Y.findRootTypeKey`. A type that cannot be
 * resolved (detached / mid-destroy) yields the sentinel `'<unresolved>'`, which
 * is deliberately NOT a body lane but also not an authorable one — callers that
 * fail closed should treat an unresolved root as untrusted.
 */
export function rootTypesTouched(transaction: Y.Transaction): Set<string> {
  const roots = new Set<string>();
  for (const type of transaction.changed.keys()) {
    // `transaction.changed` keys are AbstractType<YEvent<any>>; the parent walk
    // below is event-type agnostic, so widen once here rather than at each step.
    let t: Y.AbstractType<unknown> = type as unknown as Y.AbstractType<unknown>;
    // biome-ignore lint/suspicious/noExplicitAny: `_item` is yjs-internal but stable API surface for parent walks.
    while ((t as any)._item != null) t = (t as any)._item.parent;
    try {
      roots.add(Y.findRootTypeKey(t));
    } catch {
      roots.add('<unresolved>');
    }
  }
  return roots;
}

/** True when a transaction wrote any source-carrying lane. */
export function touchesBodyLane(transaction: Y.Transaction): boolean {
  for (const name of rootTypesTouched(transaction)) {
    if (isBodyLane(name)) return true;
  }
  return false;
}
