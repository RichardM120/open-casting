import "server-only";

import { randomBytes } from "node:crypto";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { uploadsEnabled } from "./blob";
import { hashPassword, unusablePassword } from "./password";
import { seedDatabase } from "./seed-data";

/**
 * One pool per process. Serverless keeps a warm instance between invocations,
 * so the pool is cached on `globalThis` to survive module re-evaluation in dev
 * and hot instances in production.
 */
declare global {
  var __openCastingPool: Pool | undefined;
  var __openCastingSchema: Promise<void> | undefined;
}

/**
 * `DATABASE_URL` is what the README documents and what to set by hand. The rest
 * are the names hosted integrations provision automatically: Vercel's Postgres
 * and Neon integrations set `POSTGRES_URL` rather than `DATABASE_URL`, so
 * reading both means a one-click database works without renaming anything.
 * Pooled strings come first: every serverless instance opens its own pool.
 */
const CONNECTION_VARIABLES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

/** The variable the connection string came from, or null if none is set. */
function connectionVariable(): string | null {
  for (const name of CONNECTION_VARIABLES) {
    if (process.env[name]?.trim()) return name;
  }
  return null;
}

function connectionString(): string {
  for (const name of CONNECTION_VARIABLES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  throw new Error(
    `No Postgres connection string. Set DATABASE_URL (or one of ${CONNECTION_VARIABLES.slice(1).join(", ")}). ` +
      "The Database section of the README has a local one-liner and the hosted setup.",
  );
}

type SslOption = boolean | { rejectUnauthorized: false } | undefined;

/**
 * The connection string with TLS decided here rather than by its `sslmode`.
 *
 * pg lets a URL's own `sslmode` override whatever `ssl` option it is handed,
 * so the mode is read off the string and taken out, and the option is the one
 * that counts. Any mode asking for TLS gets it with the certificate verified,
 * since hosted providers use publicly trusted CAs, which is what pg 8 does for
 * every mode, warning on each cold start that pg 9 will stop doing so for
 * `require`, the mode providers hand out. A provider with its own CA can opt
 * out with `DATABASE_SSL_NO_VERIFY=1` (or pg's `sslmode=no-verify`), which
 * keeps the connection encrypted but stops checking who is on the other end.
 * A string naming a root certificate is left to pg, which verifies against it.
 */
function connection(): { connectionString: string; ssl: SslOption } {
  const raw = connectionString();
  const mode = /[?&]sslmode=([^&]*)/.exec(raw)?.[1];
  if (mode === undefined) return { connectionString: raw, ssl: undefined };

  const stripped = raw.replace(/([?&])sslmode=[^&]*(&?)/, (_match, lead, tail) => (tail ? lead : ""));
  const ssl: SslOption =
    mode === "disable"
      ? false
      : mode === "no-verify" || process.env.DATABASE_SSL_NO_VERIFY === "1"
        ? { rejectUnauthorized: false }
        : true;
  return { connectionString: stripped, ssl };
}

function pool(): Pool {
  if (!globalThis.__openCastingPool) {
    globalThis.__openCastingPool = new Pool({
      ...connection(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
    });
  }
  return globalThis.__openCastingPool;
}

/**
 * Runs several statements in one transaction, without waiting on the schema.
 * Bootstrapping seeds through this: going via `transaction` would leave the
 * schema promise waiting on itself.
 */
async function rawTransaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Runs a statement, creating the schema first if this process has not yet. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await pool().query<T>(text, params as unknown[]);
  return result.rows;
}

/** Runs several statements in one transaction. */
export async function transaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  return rawTransaction(run);
}

/**
 * Gives every account a client, and every production the client it ran under.
 *
 * One client per distinct company name, carrying across what those accounts
 * were sold. A NULL ceiling means no limit, so if any account under a name had
 * one, the client gets none: a migration must not quietly tighten what a paying
 * customer already had. Idempotent, and run again after the demo owner and the
 * bootstrapped administrator are created, since those arrive after the schema.
 */
const CLIENT_BACKFILL = `
  INSERT INTO clients (id, name, tier, max_sessions, max_roles_per_session, access_until)
  SELECT 'cl_' || substr(md5(lower(u.company)), 1, 12),
         min(u.company),
         (array_agg(u.tier ORDER BY u.tier) FILTER (WHERE u.tier IS NOT NULL))[1],
         CASE WHEN bool_or(u.max_sessions IS NULL) THEN NULL
              ELSE max(u.max_sessions) END,
         CASE WHEN bool_or(u.max_roles_per_session IS NULL) THEN NULL
              ELSE max(u.max_roles_per_session) END,
         CASE WHEN bool_or(u.access_until IS NULL) THEN NULL
              ELSE max(u.access_until) END
    FROM users u
   WHERE u.client_id IS NULL AND btrim(u.company) <> ''
   GROUP BY lower(u.company)
  ON CONFLICT DO NOTHING;

  UPDATE users u
     SET client_id = 'cl_' || substr(md5(lower(u.company)), 1, 12)
   WHERE u.client_id IS NULL AND btrim(u.company) <> '';

  UPDATE sessions_casting s SET client_id = u.client_id
    FROM users u
   WHERE u.id = s.owner_id AND s.client_id IS NULL AND u.client_id IS NOT NULL;
`;

const SCHEMA = `
  -- Renames, before anything is created, and once only.
  --
  -- "Client" used to mean the company a director casts for. It now means the
  -- company paying for Open Casting, and the older sense became a production
  -- company. Both senses use the table name "clients", so a guard that only asks
  -- what exists cannot tell them apart: once the old table has been renamed
  -- away and the new one created, "clients exists and production_companies
  -- does not" is true again, and a second run would rename the new table.
  --
  -- So this is recorded rather than inferred. It runs on the installation that
  -- needs it and never again, which is also what makes it safe to leave here
  -- long after every deployment has passed through it.
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id         text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );

  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE id = 'client-means-the-payer') THEN
      RETURN;
    END IF;

    IF to_regclass('clients') IS NOT NULL
       AND to_regclass('production_companies') IS NULL THEN
      ALTER TABLE clients RENAME TO production_companies;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'sessions_casting' AND column_name = 'client_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'sessions_casting' AND column_name = 'production_company_id'
    ) THEN
      ALTER TABLE sessions_casting RENAME COLUMN client_id TO production_company_id;
    END IF;

    -- The indexes follow their table, so renaming them is only tidiness.
    -- Without it the CREATE INDEX statements below build a second copy of each.
    IF to_regclass('clients_company_idx') IS NOT NULL
       AND to_regclass('production_companies_company_idx') IS NULL THEN
      ALTER INDEX clients_company_idx RENAME TO production_companies_company_idx;
    END IF;
    IF to_regclass('clients_owner_idx') IS NOT NULL
       AND to_regclass('production_companies_owner_idx') IS NULL THEN
      ALTER INDEX clients_owner_idx RENAME TO production_companies_owner_idx;
    END IF;
    IF to_regclass('clients_owner_name_idx') IS NOT NULL
       AND to_regclass('production_companies_owner_name_idx') IS NULL THEN
      ALTER INDEX clients_owner_name_idx RENAME TO production_companies_owner_name_idx;
    END IF;
    IF to_regclass('sessions_client_idx') IS NOT NULL
       AND to_regclass('sessions_production_company_idx') IS NULL THEN
      ALTER INDEX sessions_client_idx RENAME TO sessions_production_company_idx;
    END IF;

    BEGIN
      IF to_regclass('sessions_casting') IS NOT NULL THEN
        ALTER TABLE sessions_casting
          RENAME CONSTRAINT sessions_casting_client_fk
                         TO sessions_casting_production_company_fk;
      END IF;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN NULL;
    END;

    INSERT INTO schema_migrations (id) VALUES ('client-means-the-payer');
  END $$;

  CREATE TABLE IF NOT EXISTS users (
    id            text PRIMARY KEY,
    email         text        NOT NULL,
    name          text        NOT NULL,
    company       text        NOT NULL,
    password_hash text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

  -- Added after the fact so an installation created before roles existed, or
  -- before Google sign-in, migrates in place.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'director';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;

  -- Suspended accounts cannot sign in and their sessions are revoked.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

  -- What the administrator sold this account. NULL means no limit; a number is
  -- a ceiling the account cannot post past. access_until ends the arrangement.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS max_sessions integer;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS max_roles_per_session integer;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS access_until date;

  -- An account that only ever signs in with Google has no password.
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

  DO $$
  BEGIN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('director', 'producer', 'admin'));
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
    ON users (google_sub) WHERE google_sub IS NOT NULL;

  -- Only the hash of a session token is kept, so reading this table does not
  -- hand anyone a working cookie.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

  -- Second-factor challenges. A password alone does not start a session for an
  -- account that requires one: this row does, once the emailed link is opened.
  -- Only a hash of the link's token is kept, for the same reason as sessions.
  CREATE TABLE IF NOT EXISTS login_challenges (
    token_hash text PRIMARY KEY,
    user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    next       text        NOT NULL DEFAULT '/dashboard',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
  );

  CREATE INDEX IF NOT EXISTS login_challenges_user_idx ON login_challenges (user_id);
  CREATE INDEX IF NOT EXISTS login_challenges_expiry_idx ON login_challenges (expires_at);

  -- Admins always need a second factor; anyone else only if this is set.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false;

  -- The commercial tier the account was sold, from the MSA's fee schedule.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS tier text;

  -- Which version of which agreement an account has accepted. Insert-only: the
  -- record of what was agreed, and when, is the point of having it.
  CREATE TABLE IF NOT EXISTS agreement_acceptances (
    id          bigserial PRIMARY KEY,
    user_id     text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document    text        NOT NULL,
    version     text        NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    ip          text
  );

  CREATE UNIQUE INDEX IF NOT EXISTS agreement_acceptances_idx
    ON agreement_acceptances (user_id, document, version);

  -- Failed sign-ins, so a public login form cannot be brute-forced freely.
  CREATE TABLE IF NOT EXISTS login_attempts (
    id           bigserial PRIMARY KEY,
    email        text        NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS login_attempts_idx
    ON login_attempts (lower(email), attempted_at);

  -- General purpose throttle. The submission form is open to anyone, takes no
  -- account, and writes to the database, so it needs a ceiling.
  CREATE TABLE IF NOT EXISTS rate_limits (
    id      bigserial PRIMARY KEY,
    bucket  text        NOT NULL,
    subject text        NOT NULL,
    at      timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS rate_limits_idx ON rate_limits (bucket, subject, at);

  -- A production and its casting window. Roles belong to it and open and close
  -- together, because a production casts as a unit.
  -- The clients: the companies paying for Open Casting. One row per customer,
  -- managed by the owner from the admin side. Accounts belong to a client, and
  -- what the client bought (the tier, the ceilings, how long access runs) is
  -- held here rather than repeated on each of its accounts.
  CREATE TABLE IF NOT EXISTS clients (
    id                    text PRIMARY KEY,
    name                  text NOT NULL,
    contact_name          text NOT NULL DEFAULT '',
    contact_email         text NOT NULL DEFAULT '',
    contact_phone         text NOT NULL DEFAULT '',
    billing_email         text NOT NULL DEFAULT '',
    billing_reference     text NOT NULL DEFAULT '',
    address               text NOT NULL DEFAULT '',
    notes                 text NOT NULL DEFAULT '',
    -- What they bought. NULL ceilings mean no limit, as they do on an account.
    tier                  text,
    max_sessions          integer,
    max_roles_per_session integer,
    access_until          date,
    -- Set to stop the whole client: every account under it is locked out at
    -- once, checked on every request rather than only at sign-in.
    suspended_at          timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS clients_name_idx ON clients (lower(name));

  -- Accounts belong to a client. Nullable for rows that predate clients; the
  -- backfill below gives every existing account one.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id text;
  DO $$
  BEGIN
    ALTER TABLE users ADD CONSTRAINT users_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX IF NOT EXISTS users_client_idx ON users (client_id);

  CREATE TABLE IF NOT EXISTS sessions_casting (
    id         text PRIMARY KEY,
    slug       text        NOT NULL,
    name       text        NOT NULL,
    synopsis   text        NOT NULL DEFAULT '',
    owner_id   text        REFERENCES users(id) ON DELETE CASCADE,
    company    text        NOT NULL,
    -- Submissions are taken from opens_at up to closes_at, to the minute.
    opens_at   timestamptz NOT NULL,
    closes_at  timestamptz NOT NULL,
    -- Set when closed ahead of closes_at.
    closed_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- The unguessable half of a project's share link. Applicants reach a casting
  -- session only by holding this; there is no index to browse and nothing links
  -- to it, so the token is the whole of the access control.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS public_token text;

  -- Filled in by backfillTokens(), from Node's CSPRNG: gen_random_bytes() is
  -- pgcrypto, which is not guaranteed to be installed, and the weaker SQL
  -- alternatives (random(), md5(clock_timestamp())) are not acceptable for a
  -- value that is the whole of the access control.

  CREATE UNIQUE INDEX IF NOT EXISTS casting_token_idx
    ON sessions_casting (public_token) WHERE public_token IS NOT NULL;

  -- A casting session is a draft until it is published. Until then its share
  -- link is not a way in for anybody, and it is not live whatever its dates say.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS published_at timestamptz;

  -- Set when the applicants' details have been destroyed under the retention
  -- policy, so the dashboard can say so rather than showing an empty list.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS purged_at timestamptz;

  -- When the production itself finishes, which is what the retention clock runs
  -- from rather than the casting close. A production may still be shooting long
  -- after its casting call shut, and the material is needed until it wraps.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS production_ends_at date;

  -- The MSA promises warnings before the purge. Recorded so a warning is sent
  -- once rather than on every sweep.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS purge_warned_14d timestamptz;
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS purge_warned_48h timestamptz;

  -- Existing projects predate the field; the casting close date is the only
  -- honest guess at when they wrapped.
  UPDATE sessions_casting SET production_ends_at = closes_at::date WHERE production_ends_at IS NULL;

  CREATE INDEX IF NOT EXISTS casting_owner_idx ON sessions_casting (owner_id);
  CREATE INDEX IF NOT EXISTS casting_retention_idx ON sessions_casting (production_ends_at)
    WHERE purged_at IS NULL;
  CREATE INDEX IF NOT EXISTS casting_company_idx ON sessions_casting (lower(company));
  CREATE INDEX IF NOT EXISTS casting_window_idx ON sessions_casting (opens_at, closes_at);

  CREATE TABLE IF NOT EXISTS roles (
    id               text PRIMARY KEY,
    slug             text        NOT NULL,
    title            text        NOT NULL,
    production       text        NOT NULL,
    production_type  text        NOT NULL,
    synopsis         text        NOT NULL,
    character_brief  text        NOT NULL,
    requirements     text[]      NOT NULL DEFAULT '{}',
    location         text        NOT NULL,
    self_tape        boolean     NOT NULL,
    age_min          integer     NOT NULL,
    age_max          integer     NOT NULL,
    -- Legacy. Roles once carried their own closing date; the production owns
    -- it now, and this is only read to derive productions for roles that
    -- predate them.
    deadline         date,
    casting_director text        NOT NULL,
    company          text        NOT NULL,
    posted_at        timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id           text PRIMARY KEY,
    role_id      text        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    name         text        NOT NULL,
    email        text        NOT NULL,
    phone        text        NOT NULL,
    location     text        NOT NULL,
    age          integer     NOT NULL,
    reel_url     text        NOT NULL DEFAULT '',
    profile_url  text        NOT NULL DEFAULT '',
    cover_note   text        NOT NULL,
    status       text        NOT NULL DEFAULT 'New',
    submitted_at timestamptz NOT NULL DEFAULT now()
  );

  -- Added after the fact: a database seeded before accounts existed still has a
  -- roles table without this column.
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS owner_id text;

  -- Terms the casting director sets on the role. Applicants must tick to accept
  -- them, and the wording is copied onto the submission as it stood at the time,
  -- so a later edit cannot rewrite what somebody agreed to.
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS disclaimer text NOT NULL DEFAULT '';

  -- Closing early is recorded separately rather than by moving the deadline,
  -- so the listing still shows the date it originally advertised.
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS closed_at timestamptz;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS accepted_terms text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

  DO $$
  BEGIN
    ALTER TABLE roles ADD CONSTRAINT roles_owner_fkey
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;

  -- An audit trail of who did what. Ids are nullable with ON DELETE SET NULL and
  -- the human-readable fields are snapshotted alongside them, so removing a role
  -- or an account does not erase the record of it, which is the moment the
  -- trail is worth most.
  CREATE TABLE IF NOT EXISTS activity (
    id         bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    action     text        NOT NULL,
    actor_id   text        REFERENCES users(id) ON DELETE SET NULL,
    actor_name text        NOT NULL,
    role_id    text        REFERENCES roles(id) ON DELETE SET NULL,
    role_title text,
    -- Copied from the role so the trail stays visible to the right people once
    -- the role itself is gone. Null on account events, which only admins see.
    owner_id   text,
    company    text,
    detail     text        NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS activity_role_idx ON activity (role_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS activity_recent_idx ON activity (created_at DESC);
  CREATE INDEX IF NOT EXISTS activity_scope_idx ON activity (owner_id, company);

  ALTER TABLE roles ADD COLUMN IF NOT EXISTS session_id text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS session_id text;

  DO $$
  BEGIN
    ALTER TABLE roles ADD CONSTRAINT roles_session_fkey
      FOREIGN KEY (session_id) REFERENCES sessions_casting(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  DO $$
  BEGIN
    ALTER TABLE submissions ADD CONSTRAINT submissions_session_fkey
      FOREIGN KEY (session_id) REFERENCES sessions_casting(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE INDEX IF NOT EXISTS roles_session_idx ON roles (session_id);
  CREATE INDEX IF NOT EXISTS submissions_session_idx ON submissions (session_id);
  CREATE INDEX IF NOT EXISTS submissions_role_idx ON submissions (role_id);
  CREATE INDEX IF NOT EXISTS roles_owner_idx ON roles (owner_id);

  -- One submission per person per production: a production considers you
  -- once, not once per role. Enforced by the database rather than by a
  -- check-then-insert that two concurrent requests could both pass.
  DROP INDEX IF EXISTS submissions_role_email_idx;
  -- What the applicant accepted, and the guardian who accepted it for a child.
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS terms_version text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS guardian_name text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS guardian_email text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz;
  -- A profile photo and a video, uploaded straight to the store. Private, and
  -- deleted with the submission.
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS photo_url text;
  ALTER TABLE submissions ADD COLUMN IF NOT EXISTS video_url text;

  CREATE UNIQUE INDEX IF NOT EXISTS submissions_session_email_idx
    ON submissions (session_id, lower(email))
    WHERE session_id IS NOT NULL;

  -- A production casts as a whole, so what used to be asked per role now lives
  -- on the production: its type here, and the opening and closing moments to
  -- the minute rather than the day. Every role is paid and union membership
  -- is not asked about, so those columns go.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS production_type text;
  UPDATE sessions_casting s SET production_type = coalesce(
    (SELECT r.production_type FROM roles r WHERE r.session_id = s.id ORDER BY r.posted_at LIMIT 1),
    'Feature Film'
  ) WHERE s.production_type IS NULL;
  ALTER TABLE sessions_casting ALTER COLUMN production_type SET DEFAULT 'Feature Film';
  ALTER TABLE sessions_casting ALTER COLUMN production_type SET NOT NULL;

  -- Dates become moments. A window that used to run from the start of one day
  -- to the end of another, UK time, still does.
  DO $$
  BEGIN
    IF (
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sessions_casting' AND column_name = 'opens_at'
    ) = 'date' THEN
      ALTER TABLE sessions_casting
        ALTER COLUMN opens_at TYPE timestamptz
          USING (opens_at::timestamp AT TIME ZONE 'Europe/London'),
        ALTER COLUMN closes_at TYPE timestamptz
          USING ((closes_at + 1)::timestamp AT TIME ZONE 'Europe/London' - interval '1 minute');
    END IF;
  END $$;

  ALTER TABLE roles ALTER COLUMN deadline DROP NOT NULL;
  DROP INDEX IF EXISTS roles_deadline_idx;
  ALTER TABLE roles DROP COLUMN IF EXISTS pay_type;
  ALTER TABLE roles DROP COLUMN IF EXISTS union_status;
  ALTER TABLE submissions DROP COLUMN IF EXISTS union_status;

  -- The rate is no longer asked for on a role.
  ALTER TABLE roles DROP COLUMN IF EXISTS rate;

  -- Shoot dates are picked rather than typed, so they are dates. The free text
  -- they replace cannot be parsed into a range reliably, so it is dropped
  -- rather than guessed at.
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS shoot_starts_at date;
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS shoot_ends_at date;
  UPDATE roles SET shoot_starts_at = current_date WHERE shoot_starts_at IS NULL;
  ALTER TABLE roles ALTER COLUMN shoot_starts_at SET NOT NULL;
  ALTER TABLE roles DROP COLUMN IF EXISTS shoot_dates;

  -- Who is making the production. A line on the form rather than a record of
  -- its own: a casting director types it, and nothing else hangs off it. The
  -- text is carried over from the table that used to hold it, which then goes.
  ALTER TABLE sessions_casting
    ADD COLUMN IF NOT EXISTS production_company text NOT NULL DEFAULT '';
  -- An optional image across the top of the applicant's page. A public
  -- blob: it is on a page anyone with the link can open.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS hero_url text;

  DO $$
  BEGIN
    -- Guarded on the column as well as the table. They go together on a
    -- database that has run the older schema, but not on one where
    -- sessions_casting was rebuilt while the old table was left behind, and a
    -- missing column is a parse error the table check alone would not stop.
    IF to_regclass('production_companies') IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'sessions_casting' AND column_name = 'production_company_id'
    ) THEN
      UPDATE sessions_casting s
         SET production_company = pc.name
        FROM production_companies pc
       WHERE pc.id = s.production_company_id AND s.production_company = '';
    END IF;
  END $$;

  ALTER TABLE sessions_casting DROP COLUMN IF EXISTS production_company_id;
  DROP TABLE IF EXISTS production_companies;

  -- A production also records the client it was run for. It is set from the
  -- owner's client when the production is opened, so visibility is one column
  -- match rather than a join through the account on every query.
  ALTER TABLE sessions_casting ADD COLUMN IF NOT EXISTS client_id text;
  DO $$
  BEGIN
    ALTER TABLE sessions_casting ADD CONSTRAINT sessions_casting_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX IF NOT EXISTS sessions_client_idx ON sessions_casting (client_id);

  ${CLIENT_BACKFILL}

  -- Productions with no owner left fall back to matching the company name.
  UPDATE sessions_casting s SET client_id = c.id
    FROM clients c
   WHERE lower(c.name) = lower(s.company) AND s.client_id IS NULL;
`;

/** Postgres error code for a unique constraint violation. */
export const UNIQUE_VIOLATION = "23505";

/** Postgres error code for a foreign key violation. */
export const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Creates the tables, then loads the demo content if the database is empty.
 * Runs at most once per process, and is safe to run from several at once:
 * every statement is idempotent, and seeding is keyed on fixed ids.
 */
function ensureSchema(): Promise<void> {
  globalThis.__openCastingSchema ??= (async () => {
    await pool().query(SCHEMA);
    // The owner must exist before the sample roles that reference it.
    await ensureDemoOwner();
    const { rows } = await pool().query<{ count: string }>(
      "SELECT count(*)::text AS count FROM roles",
    );
    if (rows[0]?.count === "0") await seed();
    await backfillSessions();
    await backfillTokens();
    await bootstrapAdmin();
    // The demo owner and the administrator are made above, after the schema's
    // own pass, so they need one of their own.
    await pool().query(CLIENT_BACKFILL);
    await purgeOnBoot();
  })().catch((error) => {
    // Let the next request retry rather than caching a failed bootstrap.
    globalThis.__openCastingSchema = undefined;
    throw error;
  });

  return globalThis.__openCastingSchema;
}

/**
 * The sample listings need an owner, since the dashboard is scoped to one.
 * Set DEMO_PASSWORD to sign in as this account and see a populated dashboard;
 * without it the account exists but has a password nobody knows, and the roles
 * are still publicly browsable.
 */
export const DEMO_USER = {
  id: "usr_demo",
  email: "demo@opencasting.app",
  name: "Demo Casting",
  company: "Open Casting Demo",
} as const;

/** Inserts the demo roles and submissions, skipping any that already exist. */
async function seed(): Promise<void> {
  const { sessions, roles, submissions } = seedDatabase();

  await rawTransaction(async (client) => {
    // Productions first: the roles reference them.
    for (const session of sessions) {
      await client.query(
        `INSERT INTO sessions_casting
           (id, slug, name, production_type, synopsis, owner_id, company, opens_at,
            closes_at, production_ends_at, public_token, production_company, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now()) ON CONFLICT (id) DO NOTHING`,
        [
          session.id, session.slug, session.name, session.productionType,
          session.synopsis, DEMO_USER.id, session.company, session.opensAt,
          session.closesAt, session.productionEndsAt, session.publicToken,
          session.productionCompany,
        ],
      );
    }

    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (
           id, slug, title, production, production_type, synopsis, character_brief,
           requirements, location, self_tape, age_min, age_max, shoot_starts_at,
           shoot_ends_at, casting_director, company, posted_at, owner_id, disclaimer,
           session_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
         ) ON CONFLICT (id) DO NOTHING`,
        [
          role.id, role.slug, role.title, role.production, role.productionType,
          role.synopsis, role.characterBrief, role.requirements, role.location,
          role.selfTape, role.ageMin, role.ageMax, role.shootStartsAt, role.shootEndsAt,
          role.castingDirector, role.company, role.postedAt, DEMO_USER.id,
          role.disclaimer, role.sessionId,
        ],
      );
    }

    for (const submission of submissions) {
      await client.query(
        `INSERT INTO submissions (
           id, role_id, session_id, name, email, phone, location, age,
           reel_url, profile_url, cover_note, status, submitted_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          submission.id, submission.roleId, submission.sessionId, submission.name,
          submission.email, submission.phone, submission.location, submission.age,
          submission.reelUrl, submission.profileUrl, submission.coverNote,
          submission.status, submission.submittedAt,
        ],
      );
    }
  });
}

/**
 * Enforces the retention policy on the way up, as well as on the schedule.
 *
 * The scheduled job is the one that runs to time; this is here so that a
 * deployment where nobody configured the cron still honours the promise made to
 * applicants, rather than keeping their details for ever in silence.
 */
async function purgeOnBoot(): Promise<void> {
  try {
    const { purgeExpiredSubmissions } = await import("./retention");
    // Straight at the pool: going through `query()` would wait on the schema
    // promise this is running inside, and deadlock the first request.
    const purged = await purgeExpiredSubmissions(async (text, params) => {
      const result = await pool().query(text, params as unknown[]);
      return result.rows;
    });
    for (const entry of purged) {
      console.log(
        `[retention] removed ${entry.submissions} submissions from ${entry.name} (${entry.sessionId})`,
      );
    }
  } catch (error) {
    // A retention sweep that fails must not stop the app from starting.
    console.error("[retention] sweep failed", error);
  }
}

/**
 * The unguessable half of a share link.
 *
 * Ten characters from an alphabet with no look-alikes (no 0/O, no 1/l/I),
 * because these get read off a phone screen, typed from a poster, and said out
 * loud.
 * That is ~49 bits: far too many to enumerate, and short enough that the whole
 * link fits in a caption.
 *
 * Case-insensitive by construction, so a link retyped in capitals still works.
 */
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function shareToken(): string {
  return Array.from(
    randomBytes(10),
    (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length],
  ).join("");
}

/**
 * Gives every casting session a share token. Done here rather than in SQL
 * because the token is the only thing standing between a link and a
 * production's casting brief, so it comes from a real CSPRNG.
 */
async function backfillTokens(): Promise<void> {
  const rows = await pool().query<{ id: string }>(
    "SELECT id FROM sessions_casting WHERE public_token IS NULL",
  );
  for (const row of rows.rows) {
    await pool().query("UPDATE sessions_casting SET public_token = $2 WHERE id = $1", [
      row.id,
      shareToken(),
    ]);
  }
}

/**
 * Creates the administrator's account, once, from the environment.
 *
 * Nobody can register themselves, so without this there would be no way into a
 * fresh deployment. It only ever inserts: an existing account is left alone, so
 * changing the password here later does nothing. Change it in the app.
 */
async function bootstrapAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!email || !password) return;

  const existing = await pool().query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [
    email,
  ]);
  if (existing.rowCount && existing.rowCount > 0) return;

  await pool().query(
    `INSERT INTO users (id, email, name, company, password_hash, role, onboarded_at)
     VALUES ($1, $2, $3, $4, $5, 'admin', NULL)
     ON CONFLICT DO NOTHING`,
    [
      `usr_${crypto.randomUUID().slice(0, 12)}`,
      email,
      email.split("@")[0],
      "Open Casting",
      await hashPassword(password),
    ],
  );
  console.log(`[bootstrap] created the administrator account for ${email}`);
}

/**
 * Gives every role a production. The earliest roles predate productions, so one
 * is derived per production name per owner: it opens when the earliest of its
 * roles was posted and closes at the end of the latest closing date any of them
 * advertised, which preserves what applicants were already told.
 *
 * The id is a hash of the grouping key rather than random, so running this
 * twice cannot produce two productions for the same name.
 */
async function backfillSessions(): Promise<void> {
  await rawTransaction(async (client) => {
    await client.query(`
      INSERT INTO sessions_casting
        (id, slug, name, production_type, synopsis, owner_id, company, opens_at,
         closes_at, published_at)
      SELECT
        'ses_' || substr(md5(coalesce(owner_id, '') || '|' || lower(production)), 1, 12),
        regexp_replace(lower(production), '[^a-z0-9]+', '-', 'g'),
        min(production),
        min(production_type),
        min(synopsis),
        owner_id,
        min(company),
        min(posted_at),
        (coalesce(max(deadline), max(posted_at)::date) + 1)::timestamp
          AT TIME ZONE 'Europe/London' - interval '1 minute',
        -- These roles were already public before productions existed; leaving
        -- them as drafts would take down live casting calls.
        min(posted_at)
      FROM roles
      WHERE session_id IS NULL
      GROUP BY owner_id, lower(production)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      UPDATE roles SET session_id =
        'ses_' || substr(md5(coalesce(owner_id, '') || '|' || lower(production)), 1, 12)
      WHERE session_id IS NULL
    `);

    // Submissions carry the session too, so the uniqueness rule has a column to
    // sit on without a join.
    await client.query(`
      UPDATE submissions s SET session_id = r.session_id
        FROM roles r WHERE r.id = s.role_id AND s.session_id IS NULL
    `);
  });
}

/**
 * Creates the demo account and claims the sample roles for it. Runs on every
 * bootstrap, not just an empty database, so an installation seeded before
 * accounts existed ends up in the same state as a fresh one.
 */
async function ensureDemoOwner(): Promise<void> {
  const existing = await pool().query("SELECT 1 FROM users WHERE id = $1", [DEMO_USER.id]);

  if (existing.rowCount === 0) {
    // Hashing is deliberately slow, so only pay for it when the row is missing.
    const passwordHash = await hashPassword(
      process.env.DEMO_PASSWORD?.trim() || unusablePassword(),
    );
    await pool().query(
      `INSERT INTO users (id, email, name, company, password_hash)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [DEMO_USER.id, DEMO_USER.email, DEMO_USER.name, DEMO_USER.company, passwordHash],
    );
  }

  await pool().query(
    "UPDATE roles SET owner_id = $1 WHERE owner_id IS NULL AND id = ANY($2)",
    [DEMO_USER.id, seedDatabase().roles.map((role) => role.id)],
  );
}

/** Drops everything and reloads the demo content. Used by the dashboard reset. */
export async function resetToSeed(): Promise<void> {
  await ensureSchema();
  await rawTransaction(async (client) => {
    // sessions_casting cascades to roles and their submissions; naming all
    // three keeps it explicit that everything posted goes.
    await client.query("TRUNCATE submissions, roles, sessions_casting CASCADE");
  });
  await ensureDemoOwner();
  await seed();
  await backfillSessions();
  await backfillTokens();
  await bootstrapAdmin();
  await purgeOnBoot();
}

/**
 * A yes/no on whether this deployment can talk to its database, for the health
 * endpoint. Deliberately reports the environment variable's *name* and never
 * its value, and counts rather than any data.
 */
export async function databaseStatus(): Promise<{
  ok: boolean;
  connectionVariable: string | null;
  authSecret: "set" | "missing";
  email: "configured" | "missing";
  /** Whether a file store is set, so applicants can attach a photo and a video. */
  uploads: "ready" | "off";
  /** Pre-launch switches. Both must read "off" before this is a live service. */
  site: "walled off: passcode, and sign-in checks nothing" | "open to the public";
  schema: "ready" | "unavailable";
  roles?: number;
  sessions?: number;
  error?: string;
}> {
  const variable = connectionVariable();
  const authSecret: "set" | "missing" =
    (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32 ? "set" : "missing";
  // Without a mail provider an account that needs a second factor cannot sign
  // in at all, so this belongs next to the other two things that stop it dead.
  const email: "configured" | "missing" = process.env.RESEND_API_KEY?.trim()
    ? "configured"
    : "missing";
  // Without a store the form simply offers no uploads; nothing breaks, but it
  // is the difference between "it works" and "nobody could send a tape".
  const uploads: "ready" | "off" = uploadsEnabled() ? "ready" : "off";
  const site: "walled off: passcode, and sign-in checks nothing" | "open to the public" =
    process.env.SITE_PASSCODE?.trim()
      ? "walled off: passcode, and sign-in checks nothing"
      : "open to the public";
  if (!variable) {
    return {
      ok: false,
      connectionVariable: null,
      authSecret,
      email,
      uploads,
      site,
      schema: "unavailable",
      error:
        "No connection string. Set DATABASE_URL (or POSTGRES_URL) in the deployment's environment and redeploy.",
    };
  }

  try {
    const [roles, sessions] = await Promise.all([
      query<{ count: string }>("SELECT count(*)::text AS count FROM roles"),
      query<{ count: string }>("SELECT count(*)::text AS count FROM sessions_casting"),
    ]);
    return {
      ok: authSecret === "set",
      connectionVariable: variable,
      authSecret,
      email,
      uploads,
      site,
      schema: "ready",
      roles: Number(roles[0]?.count ?? 0),
      sessions: Number(sessions[0]?.count ?? 0),
    };
  } catch (error) {
    // The message can carry a host name but never a password: `pg` does not put
    // the connection string in its errors.
    return {
      ok: false,
      connectionVariable: variable,
      authSecret,
      email,
      uploads,
      site,
      schema: "unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
