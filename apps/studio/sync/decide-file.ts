// The ONE file decision — Sync v2 Increment 3 (DDR-226 §4).
//
// Every non-CRDT file in a linked project resolves through this function, and
// through nothing else. It is pure, total, and Y-free, in the shape
// `cold-start.ts` established: the table is the specification, and the caller
// executes what it returns.
//
// ── Why three inputs, and why the third one matters most ────────────────────
//
// Two-way sync (local vs remote) cannot tell "I changed it" from "they changed
// it" — both look like "the two sides differ", and every answer to that is a
// coin flip that sometimes erases a person's work. The third input is the
// ANCESTOR: the hash this machine last reconciled through. With it, the same
// difference becomes a fact rather than a guess —
//
//   ancestor == local   → they moved, I did not  → PULL
//   ancestor == remote  → I moved, they did not  → PUSH
//   ancestor == neither → we both moved          → CONFLICT
//
// That is the entire idea, and it is the same one Dropbox, Syncthing and
// CouchDB converged on. Everything below is the edges.
//
// ── The rules that are not negotiable ───────────────────────────────────────
//
// **Bytes are never merged.** A conflict parks the local copy aside under a
// name both ends can see and then adopts the remote — never a silent
// overwrite, never a three-way text merge of a PNG or a stylesheet.
//
// **Absence is never authority** (DDR-076, generalized). A file missing from
// the hub does not mean "delete yours"; it means the hub does not have it. Only
// an explicit tombstone row can propagate a deletion, and even then only when
// the remote is still at the ancestor — an edit beats a delete (the Syncthing
// rule).
//
// **Unstamped emptiness never beats content** (DDR-223, generalized). Emptiness
// is just a hash here; it wins only where any other hash would, through
// ancestor equality. There is no branch that treats "nothing" as newer.
//
// **A degraded epoch downgrades every overwrite.** When the hub's epoch no
// longer matches what our ancestors were anchored against, those ancestors
// describe a log that no longer exists — so they stop being overwrite
// authority. Every PULL that would land on top of a local change becomes
// keep-local + park-the-remote-copy + push-local-up.

/** What the caller must do with this path. */
export type FileAction =
  /** Nothing to move. Adopt the ancestor so the next pass is cheap. */
  | 'noop'
  /** Fetch the remote bytes and materialize them. */
  | 'pull'
  /** Upload the local bytes (CAS'd against the head we decided from). */
  | 'push'
  /** Park local aside, then adopt remote. Both ends end up seeing both. */
  | 'conflict-aside'
  /** A tombstone we agree with: quarantine the local copy to `_trash/`. */
  | 'quarantine'
  /** Local is gone and the hub still has what we last saw: state the delete. */
  | 'propagate-delete'
  /** A tombstone we disagree with: keep local and push it back up. */
  | 'revive';

export interface FileState {
  /** designRoot-relative path, for the reason string only. */
  path: string;
  /** sha256 of the local file, or null when it is not on disk. */
  local: string | null;
  /** sha256 the hub's latest row carries, or null when it has no row. */
  remote: string | null;
  /**
   * The ancestor: the hash this machine last reconciled through for this path.
   * Null means "never reconciled here" — a first anchor, not an empty file.
   */
  ancestor: string | null;
  /** The hub's latest row for this path is a tombstone. */
  remoteTombstone?: boolean;
  /**
   * The hub's epoch differs from the one our ancestors were anchored against,
   * and the journal could not reconstruct the gap. Ancestors stop being
   * overwrite authority — see the header.
   */
  epochChanged?: boolean;
  /**
   * The remote hash equals something this machine has in flight. The "remote
   * change" is our own write coming back to us; adopt it and move on rather
   * than manufacturing a conflict with ourselves.
   */
  selfInFlight?: boolean;
  /**
   * Deletion EMISSION is off until Increment 6. When false, a local absence
   * that would propagate a delete is held instead — the row exists in the
   * table from day one so the behaviour is a flag, not a missing branch.
   */
  propagateDeletes?: boolean;
}

export interface FileDecision {
  action: FileAction;
  reason: string;
  /**
   * Park the LOCAL copy aside before anything else happens. Set on
   * `conflict-aside`. If the park fails the caller must refuse the overwrite —
   * DDR-102's fail-closed rule, applied to files.
   */
  parkLocal?: boolean;
  /**
   * Park the REMOTE copy aside instead of landing it. Set on the
   * epoch-degraded rows, where the remote is worth keeping a copy of but is
   * not allowed to overwrite anything.
   */
  parkRemote?: boolean;
  /** The decision moves no bytes; just record the ancestor. */
  adoptAncestor?: boolean;
}

/**
 * The shapes the (local, remote, ancestor, tombstone) space collapses into.
 *
 * Naming the shape BEFORE deciding is what makes the switch below exhaustive
 * with a compile-time `never`: the classification is total by construction, and
 * a new shape cannot be added without the compiler demanding a row for it.
 */
type Shape =
  | 'both-absent'
  | 'equal'
  | 'self-echo'
  | 'local-anchored'
  | 'remote-anchored'
  | 'create-down'
  | 'create-up'
  | 'remote-regressed'
  | 'diverged'
  | 'local-deleted-clean'
  | 'local-deleted-but-remote-moved'
  | 'tombstone-agreed'
  | 'tombstone-contested';

function classify(s: FileState): Shape {
  const { local, remote, ancestor } = s;

  // A tombstone is a statement about the path, so it outranks hash comparison.
  if (s.remoteTombstone) {
    if (local === null) return 'tombstone-agreed';
    // We still hold what the tombstone describes ⇒ agree with it.
    if (ancestor !== null && local === ancestor) return 'tombstone-agreed';
    // We hold something the deleter never saw ⇒ an edit beats their delete.
    return 'tombstone-contested';
  }

  if (local === null && remote === null) return 'both-absent';

  // Our own write echoing back off the hub. Checked before the difference
  // rows, because to every one of them this looks like a remote change.
  if (s.selfInFlight === true && remote !== null && remote !== local) return 'self-echo';

  if (local !== null && local === remote) return 'equal';

  if (local === null) {
    if (ancestor === null) return 'create-down'; // remote !== null here
    // We had it, we reconciled it, and now it is gone from disk.
    return remote === ancestor ? 'local-deleted-clean' : 'local-deleted-but-remote-moved';
  }

  if (remote === null) {
    if (ancestor === null) return 'create-up';
    // The hub had it and no longer does, with no tombstone to say why.
    // Absence is not authority (DDR-076): put it back.
    return 'remote-regressed';
  }

  // Both present and different.
  if (ancestor !== null && ancestor === local) return 'local-anchored';
  if (ancestor !== null && ancestor === remote) return 'remote-anchored';
  return 'diverged';
}

/**
 * Decide what happens to one file. Pure and total.
 */
export function decideFile(state: FileState): FileDecision {
  const shape = classify(state);
  const degraded = state.epochChanged === true;

  switch (shape) {
    case 'both-absent':
      return { action: 'noop', reason: 'neither side has this path', adoptAncestor: true };

    case 'equal':
      return { action: 'noop', reason: 'local and hub already agree', adoptAncestor: true };

    case 'self-echo':
      // The hub is telling us about our own in-flight write. Adopting rather
      // than conflicting is what stops a push from fighting its own echo —
      // the reason the old fast lane needed a probe-guard at all.
      return {
        action: 'noop',
        reason: 'the hub row is this machine’s own in-flight write coming back',
        adoptAncestor: true,
      };

    case 'local-anchored':
      // They moved, we did not — the clean download.
      return degraded
        ? {
            action: 'noop',
            reason:
              'the hub changed, but the epoch no longer matches our anchor — keeping local and parking their copy rather than overwriting on a stale ancestor',
            parkRemote: true,
          }
        : { action: 'pull', reason: 'the hub moved and this machine did not' };

    case 'remote-anchored':
      // We moved, they did not — the clean upload.
      return { action: 'push', reason: 'this machine moved and the hub did not' };

    case 'create-down':
      // Nothing local to lose. Never degraded: there is no local change for a
      // stale ancestor to endanger.
      return { action: 'pull', reason: 'the hub offers a file this machine has never had' };

    case 'create-up':
      return { action: 'push', reason: 'this machine has a file the hub has never had' };

    case 'remote-regressed':
      // DDR-076 generalized. A hub that lost a file gets it back; it does not
      // get to take ours.
      return {
        action: 'push',
        reason:
          'the hub no longer has a file it once did, and said no tombstone — absence is not authority',
      };

    case 'diverged':
      // Both moved. Never a merge, never a silent winner: park ours under a
      // name both ends can see, adopt theirs, and let the copy travel too.
      return degraded
        ? {
            action: 'noop',
            reason:
              'both sides moved and the epoch is degraded — keeping local, parking the hub copy, and pushing local up',
            parkRemote: true,
          }
        : {
            action: 'conflict-aside',
            reason: 'both sides changed this file since they last agreed',
            parkLocal: true,
          };

    case 'local-deleted-clean':
      // The Syncthing rule. The deletion is real, but EMITTING it is Increment
      // 6's job — until then we hold rather than pretend the file is back.
      return state.propagateDeletes === true
        ? {
            action: 'propagate-delete',
            reason: 'deleted here, and the hub still has what we last saw',
          }
        : {
            action: 'noop',
            reason:
              'deleted here, but delete propagation is off — holding rather than resurrecting',
          };

    case 'local-deleted-but-remote-moved':
      // An edit beats a delete: somebody changed the file after we last saw
      // it, so bring it back rather than deleting their work.
      return {
        action: 'pull',
        reason: 'deleted here, but the hub has newer content — an edit beats a delete',
      };

    case 'tombstone-agreed':
      if (state.local === null) {
        return {
          action: 'noop',
          reason: 'the hub tombstoned a file this machine does not have',
          adoptAncestor: true,
        };
      }
      // B6 (post-1.0 burn-down) — a degraded epoch damps the deletion row
      // like every overwrite row above it. The "agreement" here is
      // `local === ancestor`, and the degrade just disqualified exactly those
      // ancestors — honouring a tombstone on their strength would let a hub
      // whose log rewound (or a hostile one that answered `reanchor`) delete
      // files using authority it no longer has. Hold; a later pass on a
      // matching epoch re-decides with real ancestors.
      if (degraded) {
        return {
          action: 'noop',
          reason:
            'the hub tombstoned this file, but the epoch is degraded — the ancestors that would justify agreeing were just disqualified; keeping local until a clean pass',
        };
      }
      // Quarantine, never unlink — the recoverability spine.
      return {
        action: 'quarantine',
        reason: 'the hub deleted a file this machine still holds unchanged',
      };

    case 'tombstone-contested':
      return {
        action: 'revive',
        reason:
          'the hub deleted a file this machine has changed since — keeping local and pushing it back',
      };

    default: {
      // Adding a shape without a row is a compile error, never a silent
      // fallthrough. (This is the mistake `migrate-seed` made with
      // `recover-seed-dup`, and it cost a duplicated canvas body.)
      const never: never = shape;
      throw new Error(`decideFile: unhandled shape ${String(never)}`);
    }
  }
}

/** The conflict-copy name. NEVER `*.sync-conflict-*` — see the note below. */
export function conflictCopyName(rel: string, ts: number, label: string): string {
  // `~/git` runs real Syncthing, whose own conflict artifacts are
  // `*.sync-conflict-*`. Emitting the identical pattern would make a conflict
  // unattributable — you could not tell which program parked the file, and the
  // classifier would happily sync Syncthing's copies as if they were ours.
  const safeLabel = label.replace(/[^A-Za-z0-9-]/g, '').slice(0, 32) || 'peer';
  const stamp = new Date(ts).toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  const slash = rel.lastIndexOf('/');
  const dir = slash === -1 ? '' : rel.slice(0, slash + 1);
  const base = slash === -1 ? rel : rel.slice(slash + 1);
  const dot = base.indexOf('.');
  const stem = dot === -1 ? base : base.slice(0, dot);
  const ext = dot === -1 ? '' : base.slice(dot);
  return `${dir}${stem}.maude-conflict-${stamp}-${safeLabel}${ext}`;
}

/** Is this path one of OUR conflict copies? */
export function isMaudeConflictCopy(rel: string): boolean {
  return /\.maude-conflict-/.test(rel);
}
