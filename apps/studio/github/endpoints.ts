// github/endpoints.ts — `/_api/github/*` orchestration (Phase 28 / epic E3).
//
// Pure-ish handlers behind the GitHub routes: validate inputs, resolve the token
// from the loopback bridge (token.ts), call the service, and shape a
// `{ status, json }` result. NO HTTP/Request dependency — http.ts owns the gating
// (method · main-origin CSRF · loopback Host) and this module owns orchestration,
// mirroring git/endpoints.ts.
//
// SECURITY: every route is main-origin-only by omission from CANVAS_SAFE_API +
// startCanvasServer's `routes` map (the dual-allowlist rule). The token is fetched
// per-request from the keychain bridge, used once for the GitHub call, and never
// logged, echoed, or returned to the client. Inputs (repo name, username) are
// validated at this boundary before they reach the GitHub API.

import fs from 'node:fs';

import git from 'isomorphic-git';

import type { Context } from '../context.ts';
import {
  createRepo,
  GitHubApiError,
  getIdentity,
  inviteCollaborator,
  listUserRepos,
  setRemote,
} from './service.ts';
import { getGithubToken } from './token.ts';

export interface GitHubEndpointResult {
  status: number;
  json: unknown;
}

// A GitHub username: 1–39 chars, alphanumeric or single hyphens, no leading/
// trailing/consecutive hyphen. Anchored — never reaches the API path unvalidated.
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** Turn a human project name into a valid GitHub repo slug, or null if nothing
 *  usable survives. GitHub repo names allow [A-Za-z0-9._-]; we lowercase, map
 *  spaces/invalid runs to single hyphens, trim hyphens, and cap at 100. */
export function slugifyRepoName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const slug = raw
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100)
    .toLowerCase();
  return slug.length > 0 ? slug : null;
}

/** Parse `owner/repo` out of a GitHub remote URL (https or ssh form). */
export function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  if (!USERNAME_RE.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return { owner, repo };
}

export interface GitHubEndpoints {
  identity(): Promise<GitHubEndpointResult>;
  repos(): Promise<GitHubEndpointResult>;
  createRepo(body: unknown): Promise<GitHubEndpointResult>;
  invite(body: unknown): Promise<GitHubEndpointResult>;
}

export function createGitHubEndpoints(ctx: Context): GitHubEndpoints {
  const repoDir = ctx.paths.repoRoot;

  function bad(error: string): GitHubEndpointResult {
    return { status: 400, json: { ok: false, error } };
  }

  /** Resolve the token, run `fn`, and map any GitHubApiError to a JSON result. */
  async function withToken(
    fn: (token: string) => Promise<GitHubEndpointResult>
  ): Promise<GitHubEndpointResult> {
    const token = await getGithubToken();
    if (!token) {
      return {
        status: 401,
        json: { ok: false, signedIn: false, error: 'Sign in with GitHub in the Maude app first.' },
      };
    }
    try {
      return await fn(token);
    } catch (e) {
      if (e instanceof GitHubApiError) {
        // status 0 = network → 502; otherwise pass GitHub's status through.
        return { status: e.status === 0 ? 502 : e.status, json: { ok: false, error: e.message } };
      }
      return { status: 502, json: { ok: false, error: 'GitHub request failed. Try again.' } };
    }
  }

  async function identity(): Promise<GitHubEndpointResult> {
    return withToken(async (token) => ({
      status: 200,
      json: { ok: true, ...(await getIdentity(token)) },
    }));
  }

  async function repos(): Promise<GitHubEndpointResult> {
    return withToken(async (token) => ({
      status: 200,
      json: { ok: true, repos: await listUserRepos(token) },
    }));
  }

  async function createRepoHandler(body: unknown): Promise<GitHubEndpointResult> {
    const b = (body ?? {}) as { name?: unknown; private?: unknown; description?: unknown };
    const name = slugifyRepoName(b.name);
    if (!name) return bad('Enter a project name (letters, numbers, hyphens).');
    if (b.private != null && typeof b.private !== 'boolean') return bad('Invalid visibility.');
    const isPrivate = b.private !== false; // default PRIVATE for non-technical safety
    let description: string | undefined;
    if (b.description != null) {
      if (typeof b.description !== 'string' || b.description.length > 350)
        return bad('Description is too long.');
      description = b.description;
    }
    return withToken(async (token) => {
      const repo = await createRepo(token, { name, private: isPrivate, description });
      // Point the local project's origin at the new repo so the next Publish pushes
      // to it. iso-git, no network. Failure here is non-fatal to repo creation.
      let remoteSet = true;
      try {
        await setRemote(repoDir, repo.clone_url);
      } catch {
        remoteSet = false;
      }
      return { status: 200, json: { ok: true, repo, remoteSet } };
    });
  }

  async function invite(body: unknown): Promise<GitHubEndpointResult> {
    const b = (body ?? {}) as { username?: unknown };
    if (typeof b.username !== 'string') return bad('Enter a GitHub username.');
    const username = b.username.trim().replace(/^@/, '');
    if (!USERNAME_RE.test(username)) return bad('That doesn’t look like a GitHub username.');

    // owner/repo come from the CURRENT project's origin remote — the client never
    // supplies them, so you can only ever invite to the project you have open.
    const remotes = await git.listRemotes({ fs, dir: repoDir }).catch(() => []);
    const origin = remotes.find((r) => r.remote === 'origin');
    if (!origin) {
      return {
        status: 409,
        json: {
          ok: false,
          error: 'This project isn’t on GitHub yet — create or open it on GitHub first.',
        },
      };
    }
    const parsed = parseGitHubRemote(origin.url);
    if (!parsed)
      return { status: 409, json: { ok: false, error: 'This project isn’t a GitHub project.' } };

    return withToken(async (token) => {
      const res = await inviteCollaborator(token, parsed.owner, parsed.repo, username);
      return { status: 200, json: { ok: true, invited: res.invited, username } };
    });
  }

  return { identity, repos, createRepo: createRepoHandler, invite };
}

export const __testing = { slugifyRepoName, parseGitHubRemote, USERNAME_RE };
