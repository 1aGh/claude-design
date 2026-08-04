// Maude Cloud from inside the studio — Cloud Phase 23 C3, the dev-server half.
//
// The desktop app (and a plain `maude design serve` in a browser) signs into
// Maude Cloud WITHOUT any Rust and without CORS on the platform: every call to
// cloud.maude.sh happens HERE, server-side, and the client only talks to the
// loopback `/_api/cloud/*` routes. The personal token lives next to the hub
// credentials the link flow already trusts (`~/.config/maude/`), mode 0600,
// never in the repo and never in the browser.
//
// The lane, end to end (every hop verified live against production):
//   sign-in   POST /auth/device/code → human approves on /activate → poll
//   projects  GET /api/projects (Bearer personal token)
//   attach    POST /projects/open → project token → the CELL exchanges it at
//             POST /auth/login {token} (a POST body, never a URL) → a hub
//             user token → saveHubCredential() + linkedHub in config.json —
//             the exact state `maude design link` would have written by hand.

import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { saveHubCredential } from '../sync/hub-link.ts';
import { getHubToken, normalizeUrl } from '../sync/hubs-config.ts';

/**
 * Where Maude Cloud lives, resolved PER CALL rather than at module load.
 *
 * A module-level read baked whatever `MAUDE_CLOUD_URL` happened to be at
 * import time — so in a shared test process the first importer decided the
 * address for everyone (the e2e/unit stub silently talked to production and
 * the assertion failed 410), and the desktop shell could not set the env
 * after the module graph was already warm.
 */
function cloudUrl(): string {
  return (process.env.MAUDE_CLOUD_URL ?? 'https://cloud.maude.sh').replace(/\/+$/, '');
}

export interface CloudEndpointResult {
  status: number;
  json: unknown;
}

/** Whatever the control plane answered. Read defensively at every use. */
type CloudBody = Record<string, unknown> & {
  token?: string;
  url?: string;
  role?: string;
  project?: string;
  user_code?: string;
  device_code?: string;
  verification_url?: string;
  interval?: number;
  projects?: unknown[];
  account?: { email?: string };
  error?: string;
};

interface CloudFile {
  url: string;
  token: string;
  email?: string;
  connectedAt: number;
}

function cloudConfigPath(): string {
  return process.env.MAUDE_CLOUD_CONFIG ?? join(homedir(), '.config', 'maude', 'cloud.json');
}

function readCloudFile(): CloudFile | null {
  const p = cloudConfigPath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    if (parsed && typeof parsed.token === 'string') return parsed as CloudFile;
  } catch {
    /* malformed → treat as signed out */
  }
  return null;
}

function writeCloudFile(file: CloudFile): void {
  const p = cloudConfigPath();
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(p, `${JSON.stringify(file, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(p, 0o600);
  } catch {
    /* windows / read-only fs — best effort */
  }
}

async function cloudFetch(
  path: string,
  init: RequestInit = {},
  { timeoutMs = 15_000 } = {}
): Promise<{ status: number; body: CloudBody }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cloudUrl()}${path}`, { ...init, signal: ctl.signal });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, body: { error: (err as Error).message } };
  } finally {
    clearTimeout(timer);
  }
}

interface Ctx {
  paths: { repoRoot: string; designRoot: string };
}

export function createCloudEndpoints(ctx: Ctx) {
  return {
    /**
     * Signed in? Who? And WHICH folder is asking? Cheap — reads two files,
     * never the network.
     *
     * `project` + `linkedHub` are the local half of the answer, and they exist
     * for one reason: a maude:// link names a CLOUD project, and the person
     * confirming it deserves to see which LOCAL folder is about to be attached
     * to it. Both are already-public facts (a directory name, and the
     * token-free `linkedHub` this same module writes into a committed
     * config.json) — no credential material widens by being reported here.
     */
    status(): CloudEndpointResult {
      const file = readCloudFile();
      return {
        status: 200,
        json: {
          connected: !!file,
          email: file?.email ?? null,
          url: file ? file.url : cloudUrl(),
          project: basename(ctx.paths.repoRoot),
          linkedHub: readLinkedHub(),
        },
      };
    },

    /** Start the device flow: hand the client the human-facing half. */
    async signinStart(): Promise<CloudEndpointResult> {
      const r = await cloudFetch('/auth/device/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: `Maude Studio on ${process.platform}` }),
      });
      if (r.status !== 200) {
        return {
          status: 502,
          json: { ok: false, error: 'Maude Cloud could not be reached. Try again in a moment.' },
        };
      }
      return {
        status: 200,
        json: {
          ok: true,
          userCode: r.body.user_code,
          verificationUrl: r.body.verification_url,
          deviceCode: r.body.device_code,
          interval: r.body.interval ?? 5,
        },
      };
    },

    /** One poll tick. On success the credential is stored server-side. */
    async signinPoll(deviceCode: string): Promise<CloudEndpointResult> {
      if (!deviceCode) return { status: 400, json: { ok: false, error: 'missing device code' } };
      const r = await cloudFetch('/auth/device/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });
      if (r.status === 202) return { status: 200, json: { ok: true, pending: true } };
      if (r.status !== 200 || !r.body?.token) {
        return {
          status: 410,
          json: { ok: false, error: 'The code expired. Start the sign-in again.' },
        };
      }
      writeCloudFile({
        url: cloudUrl(),
        token: r.body.token,
        email: r.body.account?.email ?? undefined,
        connectedAt: Date.now(),
      });
      return {
        status: 200,
        json: { ok: true, pending: false, email: r.body.account?.email ?? null },
      };
    },

    /** Forget the local credential. (Revocation lives on /account.) */
    signout(): CloudEndpointResult {
      try {
        unlinkSync(cloudConfigPath());
      } catch {
        /* already gone */
      }
      return { status: 200, json: { ok: true } };
    },

    /** The signed-in account's projects, states included. */
    async projects(): Promise<CloudEndpointResult> {
      const file = readCloudFile();
      if (!file)
        return { status: 401, json: { ok: false, error: 'Sign in to Maude Cloud first.' } };
      const r = await cloudFetch('/api/projects', {
        headers: { authorization: `Bearer ${file.token}` },
      });
      if (r.status === 401) {
        // Revoked from the dashboard — honor it locally too.
        this.signout();
        return {
          status: 401,
          json: { ok: false, error: 'This device was disconnected. Sign in again.' },
        };
      }
      if (r.status !== 200) {
        return { status: 502, json: { ok: false, error: 'Maude Cloud could not be reached.' } };
      }
      return { status: 200, json: { ok: true, projects: r.body.projects ?? [] } };
    },

    /**
     * Attach THIS project to a cloud workspace: open → exchange at the cell →
     * store the hub credential + linkedHub, exactly as `maude design link`
     * would. The sync agent picks the link up on the next server start.
     */
    async attach(projectId: string): Promise<CloudEndpointResult> {
      const file = readCloudFile();
      if (!file)
        return { status: 401, json: { ok: false, error: 'Sign in to Maude Cloud first.' } };
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(projectId ?? ''))) {
        return { status: 400, json: { ok: false, error: 'unknown project' } };
      }

      const opened = await cloudFetch('/projects/open', {
        method: 'POST',
        headers: { authorization: `Bearer ${file.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ project: projectId }),
      });
      if (opened.status !== 200 || !opened.body?.token) {
        return {
          status: 502,
          json: { ok: false, error: 'The project could not be opened with this account.' },
        };
      }
      return linkToWorkspace({
        workspaceUrl: opened.body.url,
        projectToken: opened.body.token,
        role: opened.body.role,
      });
    },

    /**
     * Attach via a one-time handoff code — the maude:// lane (Phase 17). The
     * code came from an untrusted URL, so it is exchanged ONLY against the
     * configured Maude Cloud address (never one the link names), and the
     * workspace we then link is the one THAT exchange returns. Needs no
     * personal token: the code itself proves the dashboard session.
     */
    async attachCode(code: string, claimedProject?: string): Promise<CloudEndpointResult> {
      if (typeof code !== 'string' || !/^mhc_[0-9a-f]{16,128}$/.test(code)) {
        return { status: 400, json: { ok: false, error: 'That link is not valid.' } };
      }
      const exchanged = await cloudFetch('/auth/handoff/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (exchanged.status !== 200 || !exchanged.body?.token) {
        return {
          status: 410,
          json: {
            ok: false,
            error:
              'That link expired — it works once, for two minutes. Press “Open in Maude” on the project page again.',
          },
        };
      }

      // The link CLAIMED a project name and the person confirmed THAT name.
      // The exchange is the only authority on which project the code really
      // opens, so the two must agree — otherwise a code minted for the
      // attacker's own project, wrapped in a link naming something familiar,
      // would be confirmed by a victim and then linked, sending their local
      // work to the attacker's workspace. Refuse rather than silently link
      // something the person did not agree to.
      if (claimedProject && exchanged.body.project && claimedProject !== exchanged.body.project) {
        return {
          status: 409,
          json: {
            ok: false,
            error: `That link said ${claimedProject} but it opens ${exchanged.body.project}. Nothing was connected — open the project from its own page instead.`,
          },
        };
      }

      return linkToWorkspace({
        workspaceUrl: exchanged.body.url,
        projectToken: exchanged.body.token,
        role: exchanged.body.role,
        project: exchanged.body.project,
      });
    },
  };

  /**
   * The workspace this folder already answers to, if any. Address only.
   *
   * `credentialed` is the half that can be trusted. `config.json` is COMMITTED
   * and travels with the repo, so a `linkedHub` in it is attacker-authorable:
   * publish a template pointing at your own cell and the connect dialog would
   * cheerfully print "this folder is already linked to <you>" — the strongest
   * reassurance it can give, produced entirely by content the person merely
   * opened (attacker pass 2026-08-04, B2). A stored hub credential for that
   * address is the corroboration, because only a real sign-in writes one.
   */
  function readLinkedHub(): { url: string; credentialed: boolean } | null {
    try {
      const cfg = JSON.parse(readFileSync(join(ctx.paths.designRoot, 'config.json'), 'utf8'));
      const url = cfg?.linkedHub?.url;
      if (typeof url !== 'string' || !url) return null;
      let credentialed = false;
      try {
        credentialed = !!getHubToken(normalizeUrl(url));
      } catch {
        /* unreadable credential store → treat as uncorroborated */
      }
      return { url, credentialed };
    } catch {
      return null; // absent/malformed → simply not linked
    }
  }

  /** The shared tail of every attach: cell exchange → credential + linkedHub. */
  async function linkToWorkspace({
    workspaceUrl,
    projectToken,
    role,
    project,
  }: {
    workspaceUrl: string;
    projectToken: string;
    role?: string;
    project?: string;
  }): Promise<CloudEndpointResult> {
    // The cell is a different host than the control plane — one direct call.
    let hubToken: string | null = null;
    try {
      const res = await fetch(`${workspaceUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: projectToken }),
      });
      const body = (await res.json().catch(() => ({}))) as CloudBody;
      if (res.ok && body?.token) hubToken = body.token;
    } catch {
      /* handled below */
    }
    if (!hubToken) {
      return {
        status: 502,
        json: {
          ok: false,
          error: 'The workspace did not accept the sign-in. Try again in a minute.',
        },
      };
    }

    const norm = normalizeUrl(workspaceUrl);
    saveHubCredential(norm, hubToken);

    // Project side — linkedHub in .design/config.json (committed; no token).
    const cfgPath = join(ctx.paths.designRoot, 'config.json');
    let cfg: Record<string, unknown> = {};
    try {
      cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    } catch {
      /* absent/malformed → start minimal */
    }
    cfg.linkedHub = { url: norm, linkedAt: Date.now() };
    writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');

    return {
      status: 200,
      json: {
        ok: true,
        url: norm,
        role: role ?? null,
        project: project ?? null,
        note: 'Linked. Restart the studio server to start syncing.',
      },
    };
  }
}
