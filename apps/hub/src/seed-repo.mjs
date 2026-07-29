// MAUDE_SEED_REPO — first-boot clone. Cloud Phase 16 Task 4.
//
// The variable already existed and was already rendered into every deployment.
// Nothing read it. That is the same class of bug as MAUDE_ADMIN_EMAIL (which
// provisioned a workspace with zero users): an env var that looks configured,
// is documented, and does nothing. The fix is not only to consume it but to
// TEST that it is consumed — a passing test is what stops it rotting back.
//
// Rules, mirroring first-user.mjs:
//   - first boot only. Never clone over an existing checkout.
//   - report, do not throw. A cell whose seed failed should say so and start
//     empty rather than crash-loop on a typo'd URL.
//   - never log the URL verbatim; a seed URL can carry a token.

import { existsSync, readdirSync } from 'node:fs';

/** Only these schemes. `file://` and bare paths are refused — a seed URL comes
 *  from deployment config, and a local path would let a misconfigured cell
 *  clone something off its own container filesystem. `git://` is unauthenticated
 *  and unencrypted, and `ext::` is remote code execution by design. */
const ALLOWED = /^https:\/\/[^\s]+$/;

/** Redact userinfo, which is where a token lives (`https://x-access-token:ghs_…@`). */
export function safeUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.username || u.password) {
      u.username = '***';
      u.password = '';
    }
    return u.toString();
  } catch {
    return '<unparseable url>';
  }
}

/** True when the directory has no entries other than a dotfile-free nothing. */
function isEmptyDir(dir) {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

/**
 * Clone the seed repo into `repoDir` if — and only if — this is a first boot.
 *
 * @returns {Promise<{ state: 'cloned'|'skipped'|'failed', reason?: string, url?: string }>}
 */
export async function seedRepo(repoDir, run, { url = '', branch = '', log = console } = {}) {
  const seed = String(url || '').trim();
  if (!seed) return { state: 'skipped', reason: 'no MAUDE_SEED_REPO' };

  if (!ALLOWED.test(seed)) {
    return {
      state: 'failed',
      reason: 'MAUDE_SEED_REPO must be an https:// URL (git://, ssh:// and file:// are refused)',
    };
  }
  if (existsSync(`${repoDir}/.git`)) {
    return { state: 'skipped', reason: 'checkout already initialized' };
  }
  if (!isEmptyDir(repoDir)) {
    // Cloning into a non-empty directory would either fail or, worse, merge
    // someone's restored working set with an unrelated repo's history.
    return { state: 'skipped', reason: 'checkout is not empty — refusing to seed over it' };
  }

  const args = ['clone', '--depth', '1'];
  if (branch) args.push('--branch', String(branch));
  // `--` so a URL that starts with a dash can never become an option.
  args.push('--', seed, repoDir);

  log.log?.(`[seed] cloning ${safeUrl(seed)}`);
  const r = await run(args, { cwd: '.' });
  if (r.code !== 0) {
    // Remove the partial checkout. A failed clone leaves `.git` behind, and
    // the "already initialized" guard above would then read it as a completed
    // seed — turning one transient network failure into a workspace that is
    // permanently, silently empty. Observed on the first real container run:
    // the clone died on a missing CA bundle and left exactly this state.
    try {
      const { rmSync } = await import('node:fs');
      rmSync(`${repoDir}/.git`, { recursive: true, force: true });
    } catch {
      /* best effort — the reason below is what the operator acts on */
    }
    return {
      state: 'failed',
      reason: `git clone exited ${r.code}: ${r.stderr.trim().slice(0, 400)}`,
    };
  }
  return { state: 'cloned', url: safeUrl(seed) };
}
