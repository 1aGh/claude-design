// Deleting means the bytes — Cloud Phase 24 B4.
//
// WHAT WAS TRUE BEFORE THIS FILE. `Delete project` stopped billing, set
// `state = 'purged'` and detached the address — and left `tenants/<id>/` in
// object storage forever. For a product whose entire pitch is "you can leave",
// keeping the work after somebody asked us to destroy it is the one thing that
// must not be true. It also made A11's cancellation countdown a lie with a
// timestamp on it: a deletion date that nothing ever performs.
//
// THE PREFIX IS THE ISOLATION, SO THE PREFIX IS CHECKED TWICE. Every object a
// tenant owns lives under `tenants/<id>/`. The listing is asked for that
// prefix, and then EVERY key is re-checked against it before the delete call.
// That second check is redundant against a correct bucket and is the whole
// safety margin against an incorrect one: this is the only code path in the
// platform that destroys customer data, and a prefix bug here deletes the
// wrong customer.

/** Same grammar the tenant id is validated by everywhere else. */
const TENANT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `tenants/<id>/` — with the trailing slash, so `a` never matches `ab`. */
export function tenantPrefix(projectId) {
  if (typeof projectId !== 'string' || !TENANT_ID.test(projectId) || projectId.length > 63) {
    throw new Error(`refusing to build a storage prefix from "${projectId}"`);
  }
  return `tenants/${projectId}/`;
}

/**
 * Is this key genuinely inside this tenant's namespace?
 *
 * Pure and exported so the one rule that stands between a delete and the wrong
 * customer's data is a unit test rather than a belief.
 */
export function ownsKey(key, projectId) {
  const prefix = tenantPrefix(projectId);
  return typeof key === 'string' && key.startsWith(prefix) && key.length > prefix.length;
}

/**
 * Destroy everything one project holds in object storage.
 *
 * INCLUDING ITS PREPARED EXPORTS. "Delete" that quietly keeps a copy of the
 * designs on our servers is the failure this exists to end, so there is no
 * second retention window hiding under the first — which is why the confirm
 * screen says the prepared copies go too, and why the flow is gated on an
 * export having been made in the first place.
 *
 * Reports rather than throws. A purge that fails half-way must be visible and
 * re-runnable, not an exception that leaves the row saying `purged` while the
 * bytes are still there — so the caller gets counts, and running it again is
 * harmless (an empty listing deletes nothing).
 *
 * @returns {Promise<{ok: boolean, deleted: number, reason?: string}>}
 */
export async function purgeTenantObjects(bucket, projectId, { batch = 200 } = {}) {
  if (!bucket) return { ok: false, deleted: 0, reason: 'object storage is not configured' };
  const prefix = tenantPrefix(projectId);
  let deleted = 0;
  let cursor;
  try {
    do {
      const listed = await bucket.list({ prefix, limit: batch, cursor });
      const keys = (listed?.objects ?? []).map((o) => o.key).filter((k) => ownsKey(k, projectId));
      if (keys.length) {
        await bucket.delete(keys);
        deleted += keys.length;
      }
      // A page that listed objects but matched none would loop forever on the
      // same cursor; the cursor advancing is what makes the loop terminate,
      // and an absent cursor ends it.
      cursor = listed?.truncated ? listed.cursor : undefined;
    } while (cursor);
    return { ok: true, deleted };
  } catch (err) {
    console.error(`[purge] ${projectId}: ${err.message}`);
    return { ok: false, deleted, reason: err.message };
  }
}
