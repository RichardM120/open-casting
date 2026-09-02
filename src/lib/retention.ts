import "server-only";

import { deleteMedia } from "./blob";
import { query } from "./db";
import { mediaUrlsForSession } from "./submissions";

/**
 * How the sweep talks to the database. It is a parameter because the bootstrap
 * runs a sweep while the schema promise is still in flight, and `query()` waits
 * on that promise: a sweep going through it would be waiting on itself.
 */
export type Runner = <T extends Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => Promise<T[]>;

/**
 * How long an applicant's details survive after the casting call they applied to
 * finishes. Thirty days, as the Master Services Agreement and the public Terms
 * of Submission both promise.
 *
 * The clock runs from the casting call end date, not the casting close date: a
 * shoot can run for months after its casting call shut, and the casting
 * director needs the shortlist until it wraps.
 */
export const RETENTION_DAYS = 30;

/** The MSA promises a warning at fourteen days and again at forty-eight hours. */
export const WARN_DAYS = [14, 2] as const;

const MS_PER_DAY = 86_400_000;

/** The day a casting call's submissions are destroyed, as `yyyy-mm-dd`. */
export function purgeDate(productionEndsAt: string): string {
  return new Date(Date.parse(`${productionEndsAt}T00:00:00Z`) + RETENTION_DAYS * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Whole days until that happens. Negative once it has. */
export function daysUntilPurge(productionEndsAt: string): number {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${purgeDate(productionEndsAt)}T00:00:00Z`) - today) / MS_PER_DAY);
}

export type Purged = { sessionId: string; name: string; submissions: number };
export type Warning = {
  sessionId: string;
  name: string;
  email: string;
  days: number;
  submissions: number;
  purgeOn: string;
};

/**
 * Destroys the applicants' details for every casting call that finished more than
 * the retention period ago, and marks the session so the dashboard can say what
 * happened rather than showing an empty list.
 *
 * The casting call, its roles and the fact that submissions were received all
 * survive, so the casting director keeps a record of what they ran without
 * holding anybody's personal data. This is a real delete, not a flag.
 */
export async function purgeExpiredSubmissions(run: Runner = query): Promise<Purged[]> {
  const due = await run<{ id: string; name: string }>(
    `SELECT id, name FROM sessions_casting
      WHERE purged_at IS NULL
        AND production_ends_at IS NOT NULL
        AND production_ends_at < (now() AT TIME ZONE 'utc')::date - interval '${RETENTION_DAYS} days'`,
  );

  const purged: Purged[] = [];

  for (const session of due) {
    // Counted before the delete: afterwards there is nothing left to count.
    const [{ count }] = await run<{ count: string }>(
      "SELECT count(*)::text AS count FROM submissions WHERE session_id = $1",
      [session.id],
    );

    // The files go with the rows. Collected first, because once the rows are
    // gone nothing else knows where the files were.
    const media = await mediaUrlsForSession(session.id);
    await run("DELETE FROM submissions WHERE session_id = $1", [session.id]);
    await deleteMedia(media);
    await run("UPDATE sessions_casting SET purged_at = now() WHERE id = $1", [session.id]);

    purged.push({ sessionId: session.id, name: session.name, submissions: Number(count) });
  }

  return purged;
}

/**
 * Casting calls whose purge is close enough to warn about, and which have not
 * been warned at that threshold yet. Claiming the threshold is part of the same
 * `UPDATE`, so two sweeps overlapping cannot both send the same warning.
 */
export async function claimPurgeWarnings(run: Runner = query): Promise<Warning[]> {
  const warnings: Warning[] = [];

  for (const days of WARN_DAYS) {
    const column = days === 14 ? "purge_warned_14d" : "purge_warned_48h";

    const due = await run<{ id: string; name: string; email: string; purge_on: string }>(
      `UPDATE sessions_casting s SET ${column} = now()
         FROM users u
        WHERE u.id = s.owner_id
          AND s.${column} IS NULL
          AND s.purged_at IS NULL
          AND s.production_ends_at IS NOT NULL
          AND (s.production_ends_at + interval '${RETENTION_DAYS} days')
              <= (now() AT TIME ZONE 'utc')::date + interval '${days} days'
          AND (s.production_ends_at + interval '${RETENTION_DAYS} days')
              >= (now() AT TIME ZONE 'utc')::date
        RETURNING s.id, s.name, u.email,
                  to_char(s.production_ends_at + interval '${RETENTION_DAYS} days', 'YYYY-MM-DD') AS purge_on`,
    );

    for (const row of due) {
      const [{ count }] = await run<{ count: string }>(
        "SELECT count(*)::text AS count FROM submissions WHERE session_id = $1",
        [row.id],
      );
      warnings.push({
        sessionId: row.id,
        name: row.name,
        email: row.email,
        days,
        submissions: Number(count),
        purgeOn: row.purge_on,
      });
    }
  }

  return warnings;
}
