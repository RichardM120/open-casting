import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

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

  CREATE INDEX IF NOT EXISTS submissions_role_idx ON submissions (role_id);
  CREATE INDEX IF NOT EXISTS roles_deadline_idx ON roles (deadline);

  -- One submission per person per role, enforced by the database rather than by
  -- a check-then-insert that two concurrent requests could both pass.
  CREATE UNIQUE INDEX IF NOT EXISTS submissions_role_email_idx
    ON submissions (role_id, lower(email));
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
    const { rows } = await pool().query<{ count: string }>(
      "SELECT count(*)::text AS count FROM roles",
    );
    if (rows[0]?.count === "0") await seed();
  })().catch((error) => {
    // Let the next request retry rather than caching a failed bootstrap.
    globalThis.__openCastingSchema = undefined;
    throw error;
  });

  return globalThis.__openCastingSchema;
}

/** Inserts the demo roles and submissions, skipping any that already exist. */
async function seed(): Promise<void> {
  const { roles, submissions } = seedDatabase();

  await rawTransaction(async (client) => {
    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (
           id, slug, title, production, production_type, synopsis, character_brief,
           requirements, location, self_tape, age_min, age_max, pay_type, rate,
           union_status, shoot_dates, deadline, casting_director, company, posted_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
         ) ON CONFLICT (id) DO NOTHING`,
        [
          role.id, role.slug, role.title, role.production, role.productionType,
          role.synopsis, role.characterBrief, role.requirements, role.location,
          role.selfTape, role.ageMin, role.ageMax, role.payType, role.rate,
          role.unionStatus, role.shootDates, role.deadline, role.castingDirector,
          role.company, role.postedAt,
        ],
      );
    }

    for (const submission of submissions) {
      await client.query(
        `INSERT INTO submissions (
           id, role_id, name, email, phone, location, age, union_status,
           reel_url, profile_url, cover_note, status, submitted_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          submission.id, submission.roleId, submission.name, submission.email,
          submission.phone, submission.location, submission.age,
          submission.unionStatus, submission.reelUrl, submission.profileUrl,
          submission.coverNote, submission.status, submission.submittedAt,
        ],
      );
    }
  });
}

/** Drops everything and reloads the demo content. Used by the dashboard reset. */
export async function resetToSeed(): Promise<void> {
  await ensureSchema();
  await rawTransaction(async (client) => {
    await client.query("TRUNCATE submissions, roles");
  });
  await seed();
}
