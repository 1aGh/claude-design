// "What does this project actually contain?" — the answer a peer cannot get.
//
// A syncing peer opens one Yjs provider per canvas it finds ON ITS OWN DISK.
// Yjs has no enumeration: a document nobody asks for is a document nobody
// learns about. So a desktop that connects to a project holding 75 canvases,
// carrying 72 of them locally, syncs 72, reports "72/72 synced", and is telling
// the truth about the wrong universe — the three it does not have are invisible
// to it, forever, by construction.
//
// That was reported as "I pressed Open in Maude and nothing happened", and it
// took a hub-side document list to even see. This route is that list.
//
// SCOPE-BOUND, LIKE THE SYNC ITSELF. The bearer is the SAME peer token the
// caller syncs with (never the admin secret — a peer must not need operator
// credentials to ask what it is syncing), and every name is filtered through
// the same `matchesScope` gate that `onAuthenticate` applies per document.
// A token that may not open a document may not learn that it exists: this
// route can never widen what its holder already sees over the wire.
//
// READ-ONLY AND NAMES ONLY. No document CONTENT crosses here — sizes and names,
// which is what a peer needs to notice a gap and what an operator surface
// already exposes. Reconciling the gap is the caller's decision, deliberately
// not this route's: materialising a hub-named document as a NEW local file
// changes what a hub can put on your disk (DDR-054), and that is a decision to
// be taken explicitly rather than smuggled in behind a listing.

/** `GET /api/documents` — the documents this token may open, with sizes. */
export const DOCUMENTS_PATH = '/api/documents';

/**
 * Handle the documents listing.
 *
 * Returns `true` when it answered (so the caller stops routing), `false` when
 * the path/method is not ours.
 *
 * @param {object} args
 * @param {string} args.path            request path, query already stripped
 * @param {string} args.method
 * @param {string|null} args.bearer     presented token, or null
 * @param {(token: string) => ({ scope?: string }|null)} args.verify
 * @param {(scope: string|undefined, name: string) => boolean} args.matchesScope
 * @param {() => { name: string, bytes: number }[]} args.listDocuments
 * @param {(status: number, payload: unknown) => void} args.respondJson
 */
export function handleDocumentsRoute({
  path,
  method,
  bearer,
  verify,
  matchesScope,
  listDocuments,
  respondJson,
}) {
  if (path !== DOCUMENTS_PATH) return false;
  if (method !== 'GET') {
    respondJson(405, { error: 'method not allowed' });
    return true;
  }

  // Same refusal shape as the WS door: a missing credential and a bad one are
  // the same answer, so this cannot be used to probe which tokens exist.
  const match = bearer ? verify(bearer) : null;
  if (!match) {
    respondJson(401, { error: 'a project token is required to list documents' });
    return true;
  }

  const documents = listDocuments()
    .filter((d) => matchesScope(match.scope, d.name))
    .map((d) => ({ name: d.name, bytes: d.bytes }));

  respondJson(200, { documents, count: documents.length });
  return true;
}
