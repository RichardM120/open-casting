import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

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
 * are the names hosted integrations provision automatically — Vercel's Postgres
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
    `No Postgres connection string. Set DATABASE_URL (or one of ${CONNECTION_VARIABLES.slice(1).join(", ")}) — ` +
      "see the Database section of the README for a local one-liner and the hosted setup.",
  );
}

/**
 * Verifies the server certificate by default; hosted Postgres providers use
 * publicly trusted CAs. A provider with its own CA can opt out by setting
 * `DATABASE_SSL_NO_VERIFY=1`, which keeps the connection encrypted but stops
 * checking who is on the other end.
 */
function sslOption(url: string): boolean | { rejectUnauthorized: false } | undefined {
  if (!/\bsslmode=(require|prefer|verify-ca|verify-full)\b/.test(url)) return undefined;
  return process.env.DATABASE_SSL_NO_VERIFY === "1" ? { rejectUnauthorized: false } : true;
}

function pool(): Pool {
  if (!globalThis.__openCastingPool) {
    const url = connectionString();
    globalThis.__openCastingPool = new Pool({
      connectionString: url,
      ssl: sslOption(url),
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

const SCHEMA = `
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

  -- A casting session is one production's casting window. Roles belong to it and
  -- open and close together, because a production casts as a unit.
  CREATE TABLE IF NOT EXISTS sessions_casting (
    id         text PRIMARY KEY,
    slug       text        NOT NULL,
    name       text        NOT NULL,
    synopsis   text        NOT NULL DEFAULT '',
    owner_id   text        REFERENCES users(id) ON DELETE CASCADE,
    company    text        NOT NULL,
    opens_at   date        NOT NULL,
    closes_at  date        NOT NULL,
    -- Set when closed ahead of closes_at.
    closed_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS casting_owner_idx ON sessions_casting (owner_id);
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
    pay_type         text        NOT NULL,
    rate             text        NOT NULL,
    union_status     text        NOT NULL,
    shoot_dates      text        NOT NULL,
    deadline         date        NOT NULL,
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
    union_status text        NOT NULL,
    reel_url     text        NOT NULL DEFAULT '',
    profile_url  text        NOT NULL DEFAULT '',
    cover_note   text        NOT NULL,
    status       text        NOT NULL DEFAULT 'New',
    submitted_at timestamptz NOT NULL DEFAULT now()
  );

  -- Added after the fact: a database seeded before accounts existed still has a
  -- roles table without this column.
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS owner_id text;

  -- Terms the casting director sets on the role. Performers must tick to accept
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
  -- or an account does not erase the record of it — which is the moment the
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
  CREATE INDEX IF NOT EXISTS roles_deadline_idx ON roles (deadline);
  CREATE INDEX IF NOT EXISTS roles_owner_idx ON roles (owner_id);

  -- One submission per person per casting session — a production considers you
  -- once, not once per role. Enforced by the database rather than by a
  -- check-then-insert that two concurrent requests could both pass.
  DROP INDEX IF EXISTS submissions_role_email_idx;
  CREATE UNIQUE INDEX IF NOT EXISTS submissions_session_email_idx
    ON submissions (session_id, lower(email))
    WHERE session_id IS NOT NULL;
`;

/** Postgres error code for a unique constraint violation. */
export const UNIQUE_VIOLATION = "23505";

/**
 * Creates the tables, then loads the demo content if the database is empty.
 * Runs at most once per process, and is safe to run from several at once —
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
    // Sessions first: the roles reference them.
    for (const session of sessions) {
      await client.query(
        `INSERT INTO sessions_casting
           (id, slug, name, synopsis, owner_id, company, opens_at, closes_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [
          session.id, session.slug, session.name, session.synopsis,
          DEMO_USER.id, session.company, session.opensAt, session.closesAt,
        ],
      );
    }

    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (
           id, slug, title, production, production_type, synopsis, character_brief,
           requirements, location, self_tape, age_min, age_max, pay_type, rate,
           union_status, shoot_dates, deadline, casting_director, company, posted_at,
           owner_id, disclaimer, session_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
         ) ON CONFLICT (id) DO NOTHING`,
        [
          role.id, role.slug, role.title, role.production, role.productionType,
          role.synopsis, role.characterBrief, role.requirements, role.location,
          role.selfTape, role.ageMin, role.ageMax, role.payType, role.rate,
          role.unionStatus, role.shootDates, role.deadline, role.castingDirector,
          role.company, role.postedAt, DEMO_USER.id, role.disclaimer, role.sessionId,
        ],
      );
    }

    for (const submission of submissions) {
      await client.query(
        `INSERT INTO submissions (
           id, role_id, session_id, name, email, phone, location, age, union_status,
           reel_url, profile_url, cover_note, status, submitted_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          submission.id, submission.roleId, submission.sessionId, submission.name,
          submission.email, submission.phone, submission.location, submission.age,
          submission.unionStatus, submission.reelUrl, submission.profileUrl,
          submission.coverNote, submission.status, submission.submittedAt,
        ],
      );
    }
  });
}

/**
 * Gives every role a casting session. Roles predate sessions, so one is derived
 * per production per owner: it opens when the earliest of its roles was posted
 * and closes on the latest deadline any of them advertised, which preserves
 * what performers were already told.
 *
 * The id is a hash of the grouping key rather than random, so running this
 * twice cannot produce two sessions for the same production.
 */
async function backfillSessions(): Promise<void> {
  await rawTransaction(async (client) => {
    await client.query(`
      INSERT INTO sessions_casting
        (id, slug, name, synopsis, owner_id, company, opens_at, closes_at)
      SELECT
        'ses_' || substr(md5(coalesce(owner_id, '') || '|' || lower(production)), 1, 12),
        regexp_replace(lower(production), '[^a-z0-9]+', '-', 'g'),
        min(production),
        min(synopsis),
        owner_id,
        min(company),
        min(posted_at)::date,
        max(deadline)
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
}

/**
 * A yes/no on whether this deployment can talk to its database, for the health
 * endpoint. Deliberately reports the environment variable's *name* and never
 * its value, and counts rather than any data.
 */
export async function databaseStatus(): Promise<{
  ok: boolean;
  connectionVariable: string | null;
  schema: "ready" | "unavailable";
  roles?: number;
  sessions?: number;
  error?: string;
}> {
  const variable = connectionVariable();
  if (!variable) {
    return {
      ok: false,
      connectionVariable: null,
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
      ok: true,
      connectionVariable: variable,
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
      schema: "unavailable",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
