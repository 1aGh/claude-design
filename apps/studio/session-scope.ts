// Whose runtime state is this? — Cloud Phase 27 D3.
//
// `_active.json` (which canvas is open, what is selected) and
// `_canvas-state/<slug>.view.json` (the camera) are PER-MACHINE singletons by
// design — DDR-115 made them runtime state precisely so they would never be
// versioned or shared. On a desktop that is exactly right: one machine, one
// person, one place in the project.
//
// A cell breaks the assumption without changing a line of that code. One studio
// process serves an owner and a viewer at the same time, so both write the same
// singleton: your colleague opens a different canvas and YOUR tab switches; they
// pan and your camera moves. Silently, and it reads as flakiness rather than as
// two people sharing one file.
//
// The proxy already knows who each request is — it injects `x-maude-session`, a
// stable, non-identifying hash of (project, member) minted at sign-in. What was
// missing is the studio side: a way for code deep in the path helpers to ask
// "whose request am I on?" without every function between here and there
// growing a parameter it does not otherwise care about.
//
// That is what `AsyncLocalStorage` is for, and this is the shape it fits: one
// value, established once at the edge (a request handler, a socket message),
// read at the leaves. The alternative — threading a `session` argument through
// `getCanvasMeta` → `readCanvasViewRaw` → `canvasViewPath` and a dozen siblings
// — spreads a cloud concern across every signature in `api.ts`, where it would
// be forgotten exactly once and reintroduce the bug.
//
// OUTSIDE A CELL THIS IS INERT. No header ⇒ no key ⇒ every path resolves byte
// for byte the way it did before, which is the property the tests assert first.

import { AsyncLocalStorage } from 'node:async_hooks';

/** The header the proxy vouches. Never trusted from a client — the proxy strips
 *  every `x-maude-*` before injecting its own (studio-proxy.mjs property 2). */
export const SESSION_HEADER = 'x-maude-session';

const storage = new AsyncLocalStorage<string>();

/**
 * Keep a session key to what it may safely become: a path segment.
 *
 * The value is minted by the proxy as a 16-char hash, so this rejects rather
 * than sanitizes — a key that does not look like one is not a key we should be
 * guessing the intent of, and falling back to the shared singleton is the same
 * behaviour a desktop already has.
 */
export function normalizeSessionKey(raw: string | null | undefined): string {
  if (!raw) return '';
  return /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : '';
}

/** Read the session key off a request. */
export function sessionFromRequest(req: { headers: { get(name: string): string | null } }): string {
  try {
    return normalizeSessionKey(req.headers.get(SESSION_HEADER));
  } catch {
    return '';
  }
}

/** Run `fn` with `key` as the ambient session. An empty key is the shared
 *  singleton — i.e. exactly today's behaviour, which is why the desktop path
 *  does not need to know this module exists. */
export function runInSession<T>(key: string, fn: () => T): T {
  const normalized = normalizeSessionKey(key);
  return normalized ? storage.run(normalized, fn) : fn();
}

/** Whose request are we on? `''` = nobody in particular (desktop, CLI, tests). */
export function currentSession(): string {
  return storage.getStore() ?? '';
}

/**
 * Insert the session segment into a runtime-state path.
 *
 * `_canvas-state/<slug>.view.json` becomes
 * `_canvas-state/<session>/<slug>.view.json`, and nothing at all happens
 * without a session. A DIRECTORY rather than a filename suffix so the whole of
 * one member's runtime state is one subtree — deletable, ignorable, and obvious
 * to a human looking at the disk.
 */
export function sessionDir(base: string, key = currentSession()): string {
  return key ? `${base}/${key}` : base;
}

/**
 * The same idea for a single FILE — `_active.json` → `_active.<session>.json`.
 *
 * A suffix rather than a subdirectory here because `_active.json` is a named
 * runtime file the gitignore, the runtime-state taxonomy (DDR-115) and
 * `isMaudeRuntimeState` all match by name, and a sibling with the same stem
 * keeps every one of those matchers correct without a fourth list to update.
 */
export function sessionFile(absPath: string, key = currentSession()): string {
  if (!key) return absPath;
  const dot = absPath.lastIndexOf('.');
  const slash = Math.max(absPath.lastIndexOf('/'), absPath.lastIndexOf('\\'));
  if (dot <= slash) return `${absPath}.${key}`;
  return `${absPath.slice(0, dot)}.${key}${absPath.slice(dot)}`;
}
