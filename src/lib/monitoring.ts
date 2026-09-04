import "server-only";

import { query } from "./db";
import { RETENTION_DAYS, daysUntilPurge, purgeDate } from "./retention";
import { SPECIAL_RETENTION_DAYS } from "./types";

/**
 * What the site is holding and what is due to happen to it. Everything here is
 * counted in the database rather than by loading rows, because the point of the
 * page that reads it is to stay quick when the numbers are large.
 */

/** One table, how many rows it holds and what it takes up on disk. */
export type TableUsage = { table: string; rows: number; bytes: number };

/**
 * The tables that grow with use, largest first, with their size on disk.
 * `pg_total_relation_size` counts the indexes and the out-of-line storage too,
 * which is what the hosting bill is actually for.
 */
export async function databaseUsage(): Promise<{ tables: TableUsage[]; bytes: number }> {
  const rows = await query<{ table: string; rows: string; bytes: string }>(
    `SELECT c.relname AS table,
            c.reltuples::bigint::text AS rows,
            pg_total_relation_size(c.oid)::text AS bytes
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC`,
  );
  // reltuples is the planner's estimate and is -1 before a table is analysed,
  // so the rows that matter are counted exactly below and this is the shape.
  const tables = rows.map((row) => ({
    table: row.table,
    rows: Math.max(0, Number(row.rows)),
    bytes: Number(row.bytes),
  }));
  return { tables, bytes: tables.reduce((total, table) => total + table.bytes, 0) };
}

/** What the site holds, counted exactly. */
export type SiteCounts = {
  clients: number;
  accounts: number;
  sessions: number;
  roles: number;
  submissions: number;
  specialAnswers: number;
  activity: number;
};

export async function siteCounts(): Promise<SiteCounts> {
  const [row] = await query<Record<keyof SiteCounts, string>>(
    `SELECT (SELECT count(*) FROM clients)::text          AS clients,
            (SELECT count(*) FROM users)::text            AS accounts,
            (SELECT count(*) FROM sessions_casting)::text  AS sessions,
            (SELECT count(*) FROM roles)::text            AS roles,
            (SELECT count(*) FROM submissions)::text      AS submissions,
            (SELECT count(*) FROM special_answers)::text  AS "specialAnswers",
            (SELECT count(*) FROM activity)::text         AS activity`,
  );
  return {
    clients: Number(row.clients),
    accounts: Number(row.accounts),
    sessions: Number(row.sessions),
    roles: Number(row.roles),
    submissions: Number(row.submissions),
    specialAnswers: Number(row.specialAnswers),
    activity: Number(row.activity),
  };
}

/** A casting call's applicants and the day their details are destroyed. */
export type Retention = {
  id: string;
  name: string;
  company: string;
  productionEndsAt: string;
  /** The day the details go, yyyy-mm-dd. */
  purgeOn: string;
  /** Negative once it is overdue, which means the sweep has not run. */
  daysAway: number;
  submissions: number;
  photos: number;
  videos: number;
  purgedAt: string | null;
};

/**
 * Every casting call still holding applicants' details, soonest to be
 * destroyed first, and separately the ones already destroyed. The dates come
 * from the same helpers the sweep uses, so the page cannot say one thing while
 * the sweep does another.
 */
export async function retentionSchedule(): Promise<{ due: Retention[]; purged: Retention[] }> {
  const rows = await query<{
    id: string;
    name: string;
    company: string;
    production_ends_at: string | null;
    purged_at: Date | null;
    submissions: string;
    photos: string;
    videos: string;
  }>(
    `SELECT s.id, s.name, s.company,
            to_char(s.production_ends_at, 'YYYY-MM-DD') AS production_ends_at,
            s.purged_at,
            (SELECT count(*) FROM submissions sub WHERE sub.session_id = s.id)::text AS submissions,
            (SELECT count(*) FROM submissions sub
              WHERE sub.session_id = s.id AND sub.photo_url IS NOT NULL)::text AS photos,
            (SELECT count(*) FROM submissions sub
              WHERE sub.session_id = s.id
                AND (sub.video_url IS NOT NULL OR jsonb_array_length(sub.videos) > 0))::text AS videos
       FROM sessions_casting s
      WHERE s.production_ends_at IS NOT NULL
      ORDER BY s.production_ends_at ASC`,
  );

  const due: Retention[] = [];
  const purged: Retention[] = [];
  for (const row of rows) {
    if (!row.production_ends_at) continue;
    const entry: Retention = {
      id: row.id,
      name: row.name,
      company: row.company,
      productionEndsAt: row.production_ends_at,
      purgeOn: purgeDate(row.production_ends_at),
      daysAway: daysUntilPurge(row.production_ends_at),
      submissions: Number(row.submissions),
      photos: Number(row.photos),
      videos: Number(row.videos),
      purgedAt: row.purged_at?.toISOString() ?? null,
    };
    (entry.purgedAt ? purged : due).push(entry);
  }
  purged.sort((a, b) => (a.purgedAt! < b.purgedAt! ? 1 : -1));
  return { due, purged };
}

/** What one run of the nightly sweep did. */
export type Sweep = {
  ranAt: string;
  warned: number;
  sessions: number;
  submissions: number;
  specialAnswers: number;
  orphanedFiles: number;
  ms: number;
};

export async function recordSweep(sweep: Omit<Sweep, "ranAt">): Promise<void> {
  await query(
    `INSERT INTO sweeps (warned, sessions, submissions, special_answers, orphaned_files, ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sweep.warned, sweep.sessions, sweep.submissions, sweep.specialAnswers, sweep.orphanedFiles, sweep.ms],
  );
}

/** The last few runs, newest first. An empty list means it has never run here. */
export async function recentSweeps(limit = 5): Promise<Sweep[]> {
  const rows = await query<{
    ran_at: Date;
    warned: number;
    sessions: number;
    submissions: number;
    special_answers: number;
    orphaned_files: number;
    ms: number;
  }>(
    `SELECT ran_at, warned, sessions, submissions, special_answers, orphaned_files, ms
       FROM sweeps ORDER BY ran_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    ranAt: row.ran_at.toISOString(),
    warned: row.warned,
    sessions: row.sessions,
    submissions: row.submissions,
    specialAnswers: row.special_answers,
    orphanedFiles: row.orphaned_files,
    ms: row.ms,
  }));
}

/** How overdue the sweep is, in days, or null when it has never run here. */
export function sweepAge(last: Sweep | undefined): number | null {
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last.ranAt).getTime()) / 86_400_000);
}

export { RETENTION_DAYS };

/**
 * What the nightly sweep would do if it ran now, without doing any of it.
 * The same conditions as the sweep itself, counted rather than acted on, so
 * the button that runs it says first what it is about to destroy.
 */
export async function sweepDryRun(): Promise<{
  sessions: number;
  submissions: number;
  specialAnswers: number;
}> {
  const [row] = await query<{ sessions: string; submissions: string; answers: string }>(
    `SELECT
       (SELECT count(*) FROM sessions_casting s
         WHERE s.purged_at IS NULL AND s.production_ends_at IS NOT NULL
           AND s.production_ends_at < (now() AT TIME ZONE 'utc')::date - interval '${RETENTION_DAYS} days'
       )::text AS sessions,
       (SELECT count(*) FROM submissions sub
         WHERE sub.session_id IN (
           SELECT s.id FROM sessions_casting s
            WHERE s.purged_at IS NULL AND s.production_ends_at IS NOT NULL
              AND s.production_ends_at < (now() AT TIME ZONE 'utc')::date - interval '${RETENTION_DAYS} days'
         )
       )::text AS submissions,
       (SELECT count(*) FROM special_answers a
         WHERE a.session_id IN (
           SELECT id FROM sessions_casting
            WHERE COALESCE(closed_at, closes_at) < now() - interval '${SPECIAL_RETENTION_DAYS} days'
         )
       )::text AS answers`,
  );
  return {
    sessions: Number(row?.sessions ?? 0),
    submissions: Number(row?.submissions ?? 0),
    specialAnswers: Number(row?.answers ?? 0),
  };
}
