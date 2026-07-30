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
import { dirname, join } from 'node:path';

import { saveHubCredential } from '../sync/hub-link.ts';
import { normalizeUrl } from '../sync/hubs-config.ts';

const CLOUD_URL = (process.env.MAUDE_CLOUD_URL ?? 'https://cloud.maude.sh').replace(/\/+$/, '');

export interface CloudEndpointResult {
  status: number;
  json: unknown;
}

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
): Promise<{ status: number; body: any }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${CLOUD_URL}${path}`, { ...init, signal: ctl.signal });
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
    /** Signed in? Who? Cheap — reads the file, never the network. */
    status(): CloudEndpointResult {
      const file = readCloudFile();
      return {
        status: 200,
        json: file
          ? { connected: true, email: file.email ?? null, url: file.url }
          : { connected: false, url: CLOUD_URL },
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
        return { status: 502, json: { ok: false, error: 'Maude Cloud could not be reached. Try again in a moment.' } };
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
        return { status: 410, json: { ok: false, error: 'The code expired. Start the sign-in again.' } };
      }
      writeCloudFile({
        url: CLOUD_URL,
        token: r.body.token,
        email: r.body.account?.email ?? undefined,
        connectedAt: Date.now(),
      });
      return { status: 200, json: { ok: true, pending: false, email: r.body.account?.email ?? null } };
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
      if (!file) return { status: 401, json: { ok: false, error: 'Sign in to Maude Cloud first.' } };
      const r = await cloudFetch('/api/projects', {
        headers: { authorization: `Bearer ${file.token}` },
      });
      if (r.status === 401) {
        // Revoked from the dashboard — honor it locally too.
        this.signout();
        return { status: 401, json: { ok: false, error: 'This device was disconnected. Sign in again.' } };
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
      if (!file) return { status: 401, json: { ok: false, error: 'Sign in to Maude Cloud first.' } };
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(projectId ?? ''))) {
        return { status: 400, json: { ok: false, error: 'unknown project' } };
      }

      const opened = await cloudFetch('/projects/open', {
        method: 'POST',
        headers: { authorization: `Bearer ${file.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ project: projectId }),
      });
      if (opened.status !== 200 || !opened.body?.token) {
        return { status: 502, json: { ok: false, error: 'The project could not be opened with this account.' } };
      }

      const workspaceUrl: string = opened.body.url;
      // The cell is a different host than the control plane — one direct call.
      let hubToken: string | null = null;
      try {
        const res = await fetch(`${workspaceUrl}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: opened.body.token }),
        });
        const body: any = await res.json().catch(() => ({}));
        if (res.ok && body?.token) hubToken = body.token;
      } catch {
        /* handled below */
      }
      if (!hubToken) {
        return { status: 502, json: { ok: false, error: 'The workspace did not accept the sign-in. Try again in a minute.' } };
      }

      const norm = normalizeUrl(workspaceUrl);
      saveHubCredential(norm, hubToken);

      // Project side — linkedHub in .design/config.json (committed; no token).
      const cfgPath = join(ctx.paths.designRoot, 'config.json');
      let cfg: any = {};
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
          role: opened.body.role,
          note: 'Linked. Restart the studio server to start syncing.',
        },
      };
    },
  };
}
