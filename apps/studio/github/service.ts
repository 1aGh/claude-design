// github/service.ts — the GitHub REST + git-remote operations behind /_api/github/*
// (Phase 28 / epic E3 / DDR-108).
//
// DELIBERATE DEVIATION from the plan's "@octokit/rest": these are four simple REST
// calls (identity · create-repo · invite · list-repos) plus one local iso-git
// remote write. A hand-rolled `fetch` client keeps the bun --compile sidecar lean
// (no large mixed-module dep to bundle), gives full control over the non-technical
// error copy, and reuses the isomorphic-git engine already shipped in phase-27 for
// `setRemote`. Recorded in DDR-114. Bun provides global `fetch` + AbortSignal.
//
// SECURITY: the token is passed in (resolved by the endpoint layer from the
// loopback bridge — token.ts), used only as the `Authorization: Bearer` header /
// the iso-git `onAuth` username, and never logged or echoed. GitHub error bodies
// are mapped to friendly messages so raw API noise never reaches the UI.

import fs from 'node:fs';

import git from 'isomorphic-git';

const API = 'https://api.github.com';
const UA = 'maude-desktop';
const API_VERSION = '2022-11-28';

export interface GitHubIdentity {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface CreatedRepo {
  full_name: string;
  clone_url: string;
  html_url: string;
  default_branch: string;
  owner: string;
}

export interface RepoSummary {
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  updated_at: string;
}

export interface InviteResult {
  /** true = a brand-new invitation was created; false = already had access. */
  invited: boolean;
}

/** A GitHub API failure carrying a status + a message safe to show a non-technical user. */
export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

/** Map a failed GitHub response to a friendly, non-technical message. */
function friendly(status: number, gh: { message?: string } | null, fallback: string): string {
  if (status === 401) return 'Your GitHub sign-in expired. Sign in again to continue.';
  if (status === 403) {
    const m = gh?.message ?? '';
    if (/rate limit/i.test(m))
      return 'GitHub is rate-limiting requests. Try again in a few minutes.';
    return "GitHub didn't allow that — you may not have permission.";
  }
  if (status === 404) return "GitHub couldn't find that — it may be private or renamed.";
  return fallback;
}

interface ApiOpts {
  method?: string;
  body?: unknown;
  /** Status codes (besides 2xx) to treat as success and return the response for. */
  okStatuses?: number[];
}

async function api(token: string, path: string, opts: ApiOpts = {}): Promise<Response> {
  const { method = 'GET', body, okStatuses = [] } = opts;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': UA,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GitHubApiError(
      0,
      'Could not reach GitHub. Check your internet connection and try again.'
    );
  }
  if (res.ok || okStatuses.includes(res.status)) return res;

  let gh: { message?: string } | null = null;
  try {
    gh = (await res.clone().json()) as { message?: string };
  } catch {
    gh = null;
  }
  throw new GitHubApiError(
    res.status,
    friendly(res.status, gh, 'GitHub request failed. Try again.')
  );
}

/** The signed-in user's public profile (login + name + avatar). */
export async function getIdentity(token: string): Promise<GitHubIdentity> {
  const res = await api(token, '/user');
  const u = (await res.json()) as { login: string; name: string | null; avatar_url: string };
  return { login: u.login, name: u.name ?? null, avatar_url: u.avatar_url };
}

export interface CreateRepoInput {
  name: string;
  private: boolean;
  description?: string;
  /** Seed an initial commit (README) so the new repo is immediately clonable. */
  autoInit?: boolean;
}

/** Create a repo under the authenticated user. */
export async function createRepo(token: string, input: CreateRepoInput): Promise<CreatedRepo> {
  const res = await api(token, '/user/repos', {
    method: 'POST',
    body: {
      name: input.name,
      private: input.private,
      description: input.description ?? '',
      auto_init: input.autoInit ?? false,
    },
  }).catch((e: unknown) => {
    // 422 = name already taken / invalid — give the precise non-technical reason.
    if (e instanceof GitHubApiError && e.status === 422) {
      throw new GitHubApiError(422, 'You already have a project with that name — pick another.');
    }
    throw e;
  });
  const r = (await res.json()) as {
    full_name: string;
    clone_url: string;
    html_url: string;
    default_branch: string;
    owner: { login: string };
  };
  return {
    full_name: r.full_name,
    clone_url: r.clone_url,
    html_url: r.html_url,
    default_branch: r.default_branch,
    owner: r.owner.login,
  };
}

/**
 * Point the local project's `origin` at `remoteUrl` (iso-git, no network). Replaces
 * any existing remote of the same name so re-running "create project" is idempotent.
 */
export async function setRemote(
  repoDir: string,
  remoteUrl: string,
  remote = 'origin'
): Promise<void> {
  await git.deleteRemote({ fs, dir: repoDir, remote }).catch(() => {
    /* no existing remote — fine */
  });
  await git.addRemote({ fs, dir: repoDir, remote, url: remoteUrl });
}

/** Invite a collaborator by GitHub username (default: push/can-edit access). */
export async function inviteCollaborator(
  token: string,
  owner: string,
  repo: string,
  username: string,
  permission: 'pull' | 'push' | 'admin' = 'push'
): Promise<InviteResult> {
  const res = await api(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}`,
    { method: 'PUT', body: { permission }, okStatuses: [204] }
  ).catch((e: unknown) => {
    if (e instanceof GitHubApiError && e.status === 404) {
      throw new GitHubApiError(404, `No GitHub user named "${username}". Check the spelling.`);
    }
    if (e instanceof GitHubApiError && e.status === 422) {
      throw new GitHubApiError(422, `Couldn't invite "${username}" — they may already be invited.`);
    }
    throw e;
  });
  // 201 = invitation created; 204 = already a collaborator (no new invite).
  return { invited: res.status === 201 };
}

/** Repos the user owns or collaborates on, most-recently-updated first. */
export async function listUserRepos(token: string): Promise<RepoSummary[]> {
  const res = await api(
    token,
    '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator'
  );
  const repos = (await res.json()) as Array<{
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
    html_url: string;
    clone_url: string;
    updated_at: string;
  }>;
  return repos.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    owner: r.owner.login,
    private: r.private,
    html_url: r.html_url,
    clone_url: r.clone_url,
    updated_at: r.updated_at,
  }));
}
