// Create the workspace's first user on first boot — Cloud Phase 4 follow-up.
//
// `maude hub workspace-up` asks the operator for `--admin-email` and either
// takes or generates `--admin-password`, writes both into `.env`, and compose
// hands them to the container. Until this module existed NOTHING read them: a
// freshly provisioned workspace had zero users, `HUB_WORKSPACE_MODE=1` meant
// permissive auth was correctly off, and so the one person the operator just
// named could not sign in. The provisioner reported success because its two
// implemented checks (health, operator credential) both passed — the sign-in
// check was one of the six that reported `skipped`.
//
// That is the exact failure DDR-196 §2 warns about, arriving from the other
// direction: the unrun check was not merely uninformative, it was hiding a
// product-stopping bug. Found by booting the real image, not by a fixture.
//
// THE RULES:
//
//   1. FIRST BOOT ONLY. If the store already has any user, do nothing. A
//      restart must never reset a password — least of all to a value sitting
//      in a file on the host.
//   2. NEVER OVERWRITE. Even at zero users, a create that collides is an
//      error to report, not a silent update.
//   3. NEVER LOG THE PASSWORD. The operator already has it; the logs are the
//      one place it must not also be.

import { createUser, getUser, userCount } from './users.mjs';

/**
 * Seed the first user from the environment, if and only if there are none.
 *
 * Returns a small verdict rather than throwing, so a boot never dies over
 * this: a workspace that is up with no first user is recoverable through the
 * admin UI, whereas a crash-looping container is not.
 *
 * @param {string} dataDir
 * @param {{ email?: string, password?: string }} [env]
 * @returns {{ state: 'created'|'skipped'|'failed', email?: string, reason?: string }}
 */
export function seedFirstUser(dataDir, { email = '', password = '' } = {}) {
  const wanted = String(email || '').trim();
  if (!wanted) return { state: 'skipped', reason: 'no MAUDE_ADMIN_EMAIL' };

  // Rule 1. Checked before anything else, so the password value is never even
  // considered on a hub that already has users.
  if (userCount(dataDir) > 0) {
    return { state: 'skipped', reason: 'hub already has users' };
  }

  if (!password) {
    // Deliberately not an invented password: one the operator does not know
    // is indistinguishable from no account at all, and it would take the
    // first-boot slot so the real fix (creating it in /admin) then collides.
    return { state: 'failed', reason: 'MAUDE_ADMIN_EMAIL set but MAUDE_ADMIN_PASSWORD is empty' };
  }

  // Rule 2 — belt and braces. userCount() being 0 should make this impossible,
  // but "should" is doing load-bearing work in a sentence about overwriting
  // somebody's credentials.
  if (getUser(dataDir, wanted)) {
    return { state: 'skipped', reason: 'user already exists' };
  }

  try {
    const user = createUser(dataDir, { email: wanted, password, role: 'admin' });
    return { state: 'created', email: user.email };
  } catch (err) {
    return { state: 'failed', reason: err.message };
  }
}

/**
 * Boot-time wrapper: seed, then say what happened in one line.
 *
 * The `failed` line is deliberately loud. An operator who ran a provisioner
 * that said "verified" needs to learn here, not at their first sign-in
 * attempt, that nobody can get in.
 */
export function seedFirstUserOnBoot(dataDir, env = process.env, log = console) {
  const result = seedFirstUser(dataDir, {
    email: env.MAUDE_ADMIN_EMAIL,
    password: env.MAUDE_ADMIN_PASSWORD,
  });
  if (result.state === 'created') {
    // Rule 3: the address, never the password.
    log.log(`[hub] first user created: ${result.email} — sign in and change the password.`);
  } else if (result.state === 'failed') {
    log.warn(`[hub] could NOT create the first user (${result.reason}) — nobody can sign in yet.`);
  }
  return result;
}
