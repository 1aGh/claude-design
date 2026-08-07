// What the PROJECT holds, versus what this machine happens to carry.
//
// The sync runtime opens one provider per canvas found on LOCAL disk, and Yjs
// has no enumeration — so a document that exists only on the hub is invisible
// to a peer by construction. A desktop with 72 of a project's 75 canvases syncs
// 72, reports "72/72 synced", and is accurate about the wrong universe. The
// user-visible form of that was "I pressed Open in Maude and nothing happened":
// three real canvases (welcome, how-to-use, how-to-make-video) lived only in
// the cloud and could never arrive.
//
// This module asks the hub what it has (`GET /api/documents`, scope-bound to
// the same token the sync uses) and diffs it against the local set, so the
// runtime can say which side is missing what.
//
// SYNC IS BIDIRECTIONAL AND COMPLETE. A project you have been granted access to
// is a project you get — all of it, both directions. Local canvases go up (they
// always did); hub-only documents now come DOWN, materialised as real files.
//
// What that trades, stated plainly: a hub can create files in your design root,
// where before it could only update canvases you already had (DDR-054 treats
// hub-pushed content as untrusted). That is accepted deliberately — the hub is
// the project, the caller is authenticated, and a partial project is not a
// project. The one guard kept is containment: a document NAME can never place a
// file outside the design root. That is not policy filtering, it is the
// difference between writing your project and writing your filesystem.

/** One document as the hub reports it. */
export interface RemoteDoc {
  name: string;
  bytes: number;
}

export interface RemoteDocDiff {
  /** Documents on both sides — the ones actually syncing. */
  shared: string[];
  /** On the hub, absent here. The project has them; this machine cannot get them. */
  hubOnly: RemoteDoc[];
  /** Here, not on the hub yet — normal for a canvas this peer just created. */
  localOnly: string[];
  /** Null when the hub could not be asked (old hub, offline, refused). */
  reachable: boolean;
}

/** How long to wait for the listing. Never blocks a sync — see `fetchRemoteDocs`. */
const LIST_TIMEOUT_MS = 6000;

/**
 * Ask the hub which documents this token may open.
 *
 * Returns null on ANY failure — an old hub without the route, a refused token,
 * a network blip. A peer that cannot get the listing must still sync: this is a
 * reporting improvement, and making it load-bearing would trade a real feature
 * for a nicer message.
 */
export async function fetchRemoteDocs(
  hubUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteDoc[] | null> {
  try {
    const base = hubUrl.replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/api/documents`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { documents?: unknown };
    if (!Array.isArray(body?.documents)) return null;
    return body.documents
      .filter(
        (d): d is RemoteDoc =>
          !!d && typeof (d as RemoteDoc).name === 'string' && (d as RemoteDoc).name.length > 0
      )
      .map((d) => ({ name: d.name, bytes: Number(d.bytes) || 0 }));
  } catch {
    return null;
  }
}

/**
 * Diff the hub's documents against the ones this peer syncs.
 *
 * `localDocNames` must already be in WIRE form (`docNameFor(slug)`), not raw
 * slugs — comparing a namespaced hub against flat local names would report
 * every document as missing on both sides, which is the exact failure the
 * namespace exists to prevent, arrived at from the reporting side.
 */
export function diffRemoteDocs(
  localDocNames: readonly string[],
  remote: RemoteDoc[] | null
): RemoteDocDiff {
  if (remote === null) {
    return { shared: [], hubOnly: [], localOnly: [...localDocNames], reachable: false };
  }
  const local = new Set(localDocNames);
  const remoteNames = new Set(remote.map((d) => d.name));
  return {
    shared: [...local].filter((n) => remoteNames.has(n)).sort(),
    hubOnly: remote.filter((d) => !local.has(d.name)).sort((a, b) => a.name.localeCompare(b.name)),
    localOnly: [...local].filter((n) => !remoteNames.has(n)).sort(),
    reachable: true,
  };
}

/**
 * One line a person can act on.
 *
 * Deliberately names the documents being PULLED rather than only what already
 * matched: "72 synced" was true and useless, because the number is drawn from
 * the local file set and can never express what the project holds beyond it.
 */
export function describeRemoteDiff(diff: RemoteDocDiff): string | null {
  if (!diff.reachable) return null;
  if (diff.hubOnly.length === 0) return null;
  const n = diff.hubOnly.length;
  const names = diff.hubOnly
    .slice(0, 3)
    .map((d) => d.name)
    .join(', ');
  return `pulling ${n} canvas${n === 1 ? '' : 'es'} down from the project (${names}${n > 3 ? ', …' : ''}).`;
}

/**
 * The local slug a hub document name maps to.
 *
 * Namespaced names (`ws/<workspace>/<branch>/<slug>` — DDR-192 §5) carry the
 * slug in the last segment; a legacy flat name IS the slug. Returns null for
 * anything that does not survive the charset the hub itself enforces on
 * `documentName`, so a crafted name cannot become a path component.
 */
export function slugFromDocName(docName: string): string | null {
  const raw = String(docName ?? '');
  // Validate the WHOLE name against the two shapes a hub may legitimately use,
  // never just its last segment. Taking the tail of an arbitrary string would
  // accept `../../etc/passwd` as `passwd`: contained by the check below, and
  // still a file this project never asked for, created from a name that should
  // have been refused outright. A component is `[A-Za-z0-9_-]` — no dots (so no
  // traversal and no extension smuggling), no spaces.
  const COMPONENT = '[A-Za-z0-9_-]{1,120}';
  const FLAT = new RegExp(`^${COMPONENT}$`);
  const NAMESPACED = new RegExp(`^ws/${COMPONENT}/${COMPONENT}/(${COMPONENT})$`);
  if (FLAT.test(raw)) return raw.toLowerCase();
  const ns = NAMESPACED.exec(raw);
  return ns ? ns[1].toLowerCase() : null;
}

export interface PullTarget {
  slug: string;
  docName: string;
  /** Absolute path the body will be written to, flat under the design root. */
  bodyAbs: string;
}

/**
 * Where a hub-only document lands on disk.
 *
 * FLAT, directly under the design root — the same convention the hub applies in
 * the mirror direction (`workspace-files.mjs defaultBodyPath`) and for the same
 * reason: a slug is lossy, `ui-card` cannot be un-flattened into `ui/Card.tsx`
 * without guessing, and guessing wrong scatters files into directories the user
 * never made. A flat file is trivially moved; an invented tree is not. Moving it
 * later does not break sync — both paths slug to the same document.
 *
 * Returns only targets that resolve INSIDE the design root. A document name is
 * hub-controlled input, and this is the last point before a create.
 */
export function pullTargets(
  hubOnly: readonly RemoteDoc[],
  designRoot: string,
  join: (...parts: string[]) => string,
  resolve: (p: string) => string,
  sep: string
): PullTarget[] {
  const rootResolved = resolve(designRoot);
  const out: PullTarget[] = [];
  for (const doc of hubOnly) {
    const slug = slugFromDocName(doc.name);
    if (!slug) continue;
    const bodyAbs = join(designRoot, `${slug}.tsx`);
    const target = resolve(bodyAbs);
    if (target !== rootResolved && !target.startsWith(rootResolved + sep)) continue;
    out.push({ slug, docName: doc.name, bodyAbs });
  }
  return out;
}
