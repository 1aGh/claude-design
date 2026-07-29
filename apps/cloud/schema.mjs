// The control-plane schema as a STRING — Cloud Phase 13.
//
// Why a .mjs and not `import './schema.sql'`: the Worker cannot read a file
// (node:fs is unavailable — CI caught that), and Node cannot import a .sql
// (unknown extension). A JS module is the one form BOTH runtimes accept.
//
// `schema.sql` remains on disk for humans and for `wrangler d1 execute`, and
// `migrate.test.mjs` asserts the two are byte-identical — so a drift between
// them fails a test instead of a deployment.

export const SCHEMA_SQL = `-- Maude Cloud control plane — D1 schema. Cloud Phase 7.
--
-- Small on purpose. This database holds WHO owns WHAT and WHAT STATE it is in.
-- It is deliberately not the source of truth for anything it can re-derive:
-- subscription status lives in Stripe, cell health lives in the cell. The
-- reconciler (apps/cloud/reconcile.mjs) reads both and decides; this table is
-- the memory between runs, not the authority.
--
-- Everything a customer entrusted us with lives in their CELL, not here. A
-- total loss of this database costs us the routing table and the billing links
-- — it costs a customer nothing. That is the intended blast radius, and it is
-- why there is no design content, no comments and no assets in any column.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- accounts

CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT PRIMARY KEY,          -- acct_<random>
  email              TEXT NOT NULL UNIQUE,      -- normalized: trimmed, lowercased
  name               TEXT,
  stripe_customer_id TEXT UNIQUE,
  created_at         INTEGER NOT NULL,
  -- Set when the human accepted the DDR-054 disclosure shown INSIDE signup.
  -- Nullable rather than defaulted: "we assume you agreed" is not consent, and
  -- a null here is a real answer we may need later.
  disclosure_accepted_at INTEGER
);

CREATE INDEX IF NOT EXISTS accounts_stripe ON accounts (stripe_customer_id);

-- ---------------------------------------------------------------- projects
--
-- One project = one cell = one price (DDR-193 §1). \`id\` is the tenant id: it
-- becomes the hostname, the R2 prefix and the Durable Object name, so it is
-- validated by cli/lib/cell-plan.mjs BEFORE it ever reaches this table.

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,               -- what the human calls it
  state           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending','active','past_due','suspended','exported','purged')),
  state_since     INTEGER NOT NULL,
  subscription_id TEXT,                        -- Stripe; null until checkout completes
  plan            TEXT NOT NULL DEFAULT 'project',
  -- Fleet bookkeeping. \`previous_version\` is what makes a rollback a re-pin
  -- rather than a rebuild (apps/cloud/fleet.mjs).
  version          TEXT,
  previous_version TEXT,
  canary           INTEGER NOT NULL DEFAULT 0,
  cell_running     INTEGER NOT NULL DEFAULT 0,
  -- The export-before-teardown guarantee is a state machine, but it needs one
  -- fact remembered across runs: did the export actually go out.
  export_sent_at   INTEGER,
  last_checkpoint  INTEGER,                    -- last replication to R2
  last_restore_drill INTEGER,
  created_at       INTEGER NOT NULL
);

-- ON DELETE RESTRICT above, deliberately: deleting an account must not silently
-- orphan or cascade-destroy a project. Teardown goes through the lifecycle.

CREATE INDEX IF NOT EXISTS projects_account ON projects (account_id);
CREATE INDEX IF NOT EXISTS projects_state ON projects (state);
CREATE INDEX IF NOT EXISTS projects_subscription ON projects (subscription_id);

-- ----------------------------------------------------------------- jobs
--
-- The queue's durable record. A job is always "reconcile this project" — a
-- webhook never carries an instruction, only a nudge (see reconcile.mjs). That
-- is why there is no payload column: there is nothing to carry.

CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,                  -- 'webhook' | 'cron' | 'api' | 'manual'
  created_at   INTEGER NOT NULL,
  started_at   INTEGER,
  finished_at  INTEGER,
  outcome      TEXT,                           -- 'ok' | 'halted' | 'failed'
  detail       TEXT
);

CREATE INDEX IF NOT EXISTS jobs_pending ON jobs (project_id, finished_at);

-- ---------------------------------------------------------------- invites
--
-- Control-plane invites are to an ACCOUNT (billing, projects). Invites into a
-- project's workspace are the cell's own (apps/hub/src/invites.mjs) and stay
-- there — the control plane must not become a second place that can hand out
-- access to someone's designs.

CREATE TABLE IF NOT EXISTS account_invites (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  hash        TEXT NOT NULL UNIQUE,            -- never the raw value
  email       TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  redeemed_at INTEGER,
  revoked_at  INTEGER
);

-- ------------------------------------------------------------------ audit
--
-- Append-only, and CUSTOMER-VISIBLE (DDR-193 §4). "We could look but we don't"
-- is not a control; "you can see that we looked" is. Break-glass access writes
-- here, and the Trust page promises the customer can read it.
--
-- There is deliberately no UPDATE or DELETE path in the application for this
-- table. A log an operator can quietly edit is not a log.

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects (id) ON DELETE SET NULL,
  at         INTEGER NOT NULL,
  actor      TEXT NOT NULL,                    -- 'system' | 'operator:<name>' | 'customer:<email>'
  action     TEXT NOT NULL,
  -- Why, in the operator's own words, for break-glass entries. Nullable for
  -- system actions; REQUIRED by the application for operator ones — an access
  -- with no stated reason is the one worth noticing.
  reason     TEXT,
  detail     TEXT
);

CREATE INDEX IF NOT EXISTS audit_account ON audit_log (account_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_project ON audit_log (project_id, at DESC);

-- ------------------------------------------------------------- migrations

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (1, unixepoch() * 1000);
`;
