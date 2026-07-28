// `maude hub workspace-up` — the pure planning layer. Cloud Phase 4 Task 1.
//
// Everything here is a FUNCTION OF ITS INPUTS: validate a config, render the
// files, decide what verification must pass, produce the operator card. No
// disk, no network, no Docker. The command module (`hub-workspace.mjs`) does
// the effects.
//
// That split is not tidiness. A provisioner's failure modes — a bad domain
// silently rendering a broken Caddyfile, a missing no-expiry policy quietly
// scheduling someone's media for deletion, an "it worked!" printed before
// anything round-tripped — are all decisions, and decisions are testable
// without a VPS. What genuinely needs Docker is then a thin, boring shell.
//
// THE BREAKER TRAP THIS FILE EXISTS TO AVOID: a one-command provisioner that
// prints "done" implies it owns the thing forever. It does not. It scaffolds
// and verifies once. Key rotation, backups, upgrades and the bill stay with
// the operator, and `operatorDuties()` says so on every successful run — a
// promise nobody made is a promise nobody breaks.

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {object} WorkspaceConfig
 * @property {string} domain          public hostname, e.g. design.acme.com
 * @property {string} acmeEmail       Let's Encrypt contact
 * @property {string} adminEmail      the first user
 * @property {string} [adminPassword] omitted → the caller must supply one
 * @property {object} [s3]            { endpoint, bucket, accessKeyId, secretAccessKey, region }
 * @property {boolean} [devMinio]     run a local MinIO under the dev profile
 * @property {string} [seedRepo]      git URL to seed from; omitted → start fresh
 * @property {string} [imageTag]
 */

/**
 * Validate a workspace config. Returns `{ ok, errors, config }` — a LIST of
 * problems, not the first one: someone filling this in wants to fix everything
 * in one pass, not to play whack-a-mole with a wizard.
 */
export function validateWorkspaceConfig(raw = {}) {
  const errors = [];
  const cfg = { ...raw };

  cfg.domain = String(raw.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!cfg.domain) errors.push('domain is required (the public hostname, e.g. design.acme.com)');
  else if (!DOMAIN_RE.test(cfg.domain))
    errors.push(`domain "${cfg.domain}" is not a valid hostname`);
  else if (!cfg.domain.includes('.')) errors.push('domain must be fully qualified');

  cfg.acmeEmail = String(raw.acmeEmail ?? '').trim();
  if (!cfg.acmeEmail) errors.push('acmeEmail is required (Let’s Encrypt expiry notices)');
  else if (!EMAIL_RE.test(cfg.acmeEmail))
    errors.push(`acmeEmail "${cfg.acmeEmail}" is not an email`);

  cfg.adminEmail = String(raw.adminEmail ?? '')
    .trim()
    .toLowerCase();
  if (!cfg.adminEmail) errors.push('adminEmail is required (the first person who can sign in)');
  else if (!EMAIL_RE.test(cfg.adminEmail))
    errors.push(`adminEmail "${cfg.adminEmail}" is not an email`);

  if (raw.adminPassword !== undefined) {
    if (typeof raw.adminPassword !== 'string' || raw.adminPassword.length < 12) {
      errors.push('adminPassword must be at least 12 characters');
    }
  }

  cfg.devMinio = raw.devMinio === true;
  if (raw.s3) {
    const s3 = { ...raw.s3 };
    s3.bucket = String(s3.bucket ?? '').trim();
    s3.endpoint = String(s3.endpoint ?? '')
      .trim()
      .replace(/\/+$/, '');
    if (!s3.bucket) errors.push('s3.bucket is required when s3 is configured');
    else if (!BUCKET_RE.test(s3.bucket))
      errors.push(`s3.bucket "${s3.bucket}" is not a valid name`);
    if (!s3.endpoint) errors.push('s3.endpoint is required when s3 is configured');
    else if (!/^https?:\/\//.test(s3.endpoint))
      errors.push('s3.endpoint must start with http:// or https://');
    if (!s3.accessKeyId) errors.push('s3.accessKeyId is required when s3 is configured');
    if (!s3.secretAccessKey) errors.push('s3.secretAccessKey is required when s3 is configured');
    s3.region = s3.region || 'auto';
    cfg.s3 = s3;
  } else if (cfg.devMinio) {
    // The dev profile stands up its own MinIO, so it can supply its own
    // credentials — but they are DEV credentials and the render says so.
    cfg.s3 = {
      endpoint: 'http://minio:9000',
      bucket: 'maude-assets',
      accessKeyId: 'maude-dev',
      secretAccessKey: 'maude-dev-secret',
      region: 'auto',
      dev: true,
    };
  }

  if (raw.seedRepo !== undefined && raw.seedRepo !== null && String(raw.seedRepo).trim() !== '') {
    const seed = String(raw.seedRepo).trim();
    if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(seed)) {
      errors.push('seedRepo must be an https://, ssh:// or git@ URL');
    }
    cfg.seedRepo = seed;
  } else {
    cfg.seedRepo = null;
  }

  cfg.imageTag = String(raw.imageTag ?? 'latest').trim() || 'latest';

  return { ok: errors.length === 0, errors, config: cfg };
}

/**
 * The `.env` a workspace deployment needs. Returned as an ordered array of
 * `{ key, value, comment }` so the renderer can annotate and a test can assert
 * a secret is present without string-matching a whole file.
 *
 * `HUB_TRUSTED_PROXIES` is set unconditionally: Caddy fronts the hub, so
 * without it every client shares one rate-limit bucket and a single attacker's
 * login flood limits everybody (DDR-194 §4).
 */
export function envEntries(cfg, { hubSecret, adminPassword }) {
  const entries = [
    {
      key: 'PUBLIC_DOMAIN',
      value: cfg.domain,
      comment: 'public hostname; Caddy fetches a cert for it',
    },
    { key: 'ACME_EMAIL', value: cfg.acmeEmail, comment: "Let's Encrypt expiry notices" },
    {
      key: 'HUB_SECRET',
      value: hubSecret,
      comment: 'operator credential — rotate on staff change',
    },
    {
      key: 'HUB_TRUSTED_PROXIES',
      value: '172.16.0.0/12,10.0.0.0/8,192.168.0.0/16,fd00::/8',
      comment: 'Caddy fronts the hub; without this every client shares one rate-limit bucket',
    },
    { key: 'HUB_WORKSPACE_MODE', value: '1', comment: 'users required; permissive dev auth off' },
    {
      key: 'MAUDE_WORKSPACE_MODE',
      value: '1',
      comment: 'containment invariant enforced (DDR-193 §2)',
    },
    {
      key: 'MAUDE_ADMIN_EMAIL',
      value: cfg.adminEmail,
      comment: 'first user, created on first boot',
    },
  ];
  if (adminPassword) {
    entries.push({
      key: 'MAUDE_ADMIN_PASSWORD',
      value: adminPassword,
      comment: 'first sign-in; change it after, then remove this line',
    });
  }
  if (cfg.s3) {
    entries.push(
      { key: 'MAUDE_S3_ENDPOINT', value: cfg.s3.endpoint },
      { key: 'MAUDE_S3_BUCKET', value: cfg.s3.bucket },
      { key: 'MAUDE_S3_ACCESS_KEY_ID', value: cfg.s3.accessKeyId },
      { key: 'MAUDE_S3_SECRET_ACCESS_KEY', value: cfg.s3.secretAccessKey },
      { key: 'MAUDE_S3_REGION', value: cfg.s3.region }
    );
  }
  if (cfg.seedRepo) {
    entries.push({ key: 'MAUDE_SEED_REPO', value: cfg.seedRepo, comment: 'cloned on first boot' });
  }
  entries.push({
    key: 'MAUDE_IMAGE_TAG',
    value: cfg.imageTag,
    comment: 'pin this to a release before you rely on it',
  });
  return entries;
}

/** Render `.env`. Written at mode 0600 by the caller — it holds two secrets. */
export function renderEnv(entries) {
  const lines = [
    '# Maude workspace — generated by `maude hub workspace-up`.',
    '# Contains SECRETS. Mode 0600, never committed.',
    '',
  ];
  for (const e of entries) {
    if (e.comment) lines.push(`# ${e.comment}`);
    lines.push(`${e.key}=${e.value}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * The compose stack: hub + Caddy, MinIO only under the `dev` profile.
 *
 * MinIO is behind a profile rather than commented out, because a commented
 * service is one someone uncomments in production. `--profile dev` is a thing
 * you have to mean.
 */
export function renderCompose(cfg) {
  const envLines = (keys) => keys.map((k) => `      ${k}: \${${k}}`).join('\n');
  const hubEnv = [
    'HUB_SECRET',
    'HUB_TRUSTED_PROXIES',
    'HUB_WORKSPACE_MODE',
    'MAUDE_WORKSPACE_MODE',
    'MAUDE_ADMIN_EMAIL',
    ...(cfg.s3
      ? [
          'MAUDE_S3_ENDPOINT',
          'MAUDE_S3_BUCKET',
          'MAUDE_S3_ACCESS_KEY_ID',
          'MAUDE_S3_SECRET_ACCESS_KEY',
          'MAUDE_S3_REGION',
        ]
      : []),
    ...(cfg.seedRepo ? ['MAUDE_SEED_REPO'] : []),
  ];

  return `# Maude workspace — generated by \`maude hub workspace-up\`.
#
# Re-running the command regenerates this file; edit \`.env\` instead, or pass
# different flags. Bring it up with:
#
#   docker compose up -d
#
# MinIO is behind the \`dev\` profile ON PURPOSE. A commented-out service is one
# somebody uncomments in production; \`--profile dev\` is a thing you have to mean.

services:
  hub:
    image: ghcr.io/1agh/maude-hub:\${MAUDE_IMAGE_TAG:-latest}
    restart: unless-stopped
    environment:
      HUB_PUBLIC_URL: https://\${PUBLIC_DOMAIN}
${envLines(hubEnv)}
    volumes:
      - hub-data:/data
    expose:
      - "1234"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      PUBLIC_DOMAIN: \${PUBLIC_DOMAIN}
      ACME_EMAIL: \${ACME_EMAIL}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - hub
${
  cfg.devMinio
    ? `
  # DEV ONLY — object storage for local testing. Never expose this publicly and
  # never point a real workspace at it: the credentials below are in this file.
  minio:
    profiles: ["dev"]
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: \${MAUDE_S3_ACCESS_KEY_ID}
      MINIO_ROOT_PASSWORD: \${MAUDE_S3_SECRET_ACCESS_KEY}
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
`
    : ''
}
volumes:
  hub-data:
  caddy-data:
  caddy-config:${cfg.devMinio ? '\n  minio-data:' : ''}
`;
}

/** Caddyfile with `trusted_proxies` wired, so XFF is honoured correctly. */
export function renderCaddyfile(cfg) {
  return `# Maude workspace — generated by \`maude hub workspace-up\`.

{
  email {$ACME_EMAIL}
}

{$PUBLIC_DOMAIN} {
  encode zstd gzip

  # The hub reads X-Forwarded-For only from addresses it trusts
  # (HUB_TRUSTED_PROXIES). Caddy is on the compose network, so it must set the
  # header for per-client rate limiting to work at all — without it every
  # client shares one bucket and one attacker's login flood limits everybody.
  reverse_proxy hub:1234 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
    header_up Host {host}
  }
}
`;
}

/**
 * The checks that must pass before this command is allowed to say it worked.
 *
 * Returned as data so the runner executes them uniformly and reports each by
 * name. A provisioner that prints a URL without proving a round-trip has told
 * the operator something it does not know.
 */
export function verificationPlan(cfg) {
  const steps = [
    {
      id: 'health',
      title: 'the workspace answers',
      detail: `GET https://${cfg.domain}/health returns ok`,
    },
    {
      id: 'admin-claimed',
      title: 'the operator credential works',
      detail: 'the admin API accepts the generated HUB_SECRET',
    },
    {
      id: 'user-signin',
      title: 'the first person can sign in',
      detail: `${cfg.adminEmail} exchanges a password for a session`,
    },
    {
      id: 'canvas-roundtrip',
      title: 'a canvas survives a round trip',
      detail: 'a sentinel canvas syncs up and reads back byte-identical',
    },
    {
      id: 'git-commit',
      title: 'autosave produced a commit',
      detail: 'the sentinel edit exists in the workspace git history',
    },
  ];
  if (cfg.s3) {
    steps.push(
      {
        id: 's3-object',
        title: 'media reaches the bucket',
        detail: 'a sentinel asset is retrievable from object storage',
      },
      {
        id: 's3-no-expiry',
        title: 'nothing will expire the media',
        // The quiet catastrophe: a lifecycle rule on `assets/` deletes objects
        // that canvases in git history still point at, with no recovery path.
        detail: 'no lifecycle/expiry rule applies to the assets/ prefix',
      }
    );
  }
  steps.push({
    id: 'restore-drill',
    title: 'a backup can actually be restored',
    detail: '`maude hub restore-drill` passes against the configured target',
  });
  return steps;
}

/**
 * What the operator still owns. Printed on every successful run.
 *
 * The trap this avoids: a one-command provisioner that prints "done" implies it
 * owns the deployment forever. It scaffolded and verified it, once. Saying so
 * plainly is the difference between a tool that is trusted and one that is
 * blamed.
 */
export function operatorDuties(cfg) {
  const duties = [
    {
      title: 'Rotate HUB_SECRET when someone leaves',
      detail:
        'It is in .env and it is the operator credential. `maude hub token rotate` for peers.',
    },
    {
      title: 'Watch the restore drill, not the backup',
      detail:
        'Schedule `maude hub restore-drill`. A backup nobody has restored is a hypothesis, and an empty restore looks exactly like a working one.',
    },
    {
      title: 'Pin the image tag before you rely on this',
      detail: `MAUDE_IMAGE_TAG is "${cfg.imageTag}". \`latest\` means an unplanned upgrade on the next restart.`,
    },
    {
      title: 'Upgrades are yours',
      detail: 'Re-running workspace-up regenerates the files; it does not watch for releases.',
    },
    {
      title: 'The bill is yours',
      detail: 'This runs on your infrastructure. Nothing here monitors spend.',
    },
  ];
  if (cfg.s3) {
    duties.push({
      title: 'Never expire the assets/ prefix',
      detail:
        'A canvas in git history can reference media no current canvas does, so "unreferenced" never means "unreachable". An expired object is a permanently broken canvas.',
    });
  }
  if (cfg.s3?.dev) {
    duties.push({
      title: 'The MinIO credentials are in this directory',
      detail:
        'The dev profile is for local testing. Point a real workspace at real object storage.',
    });
  }
  return duties;
}
