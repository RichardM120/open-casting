import "server-only";

import { query } from "./db";

/**
 * How the sweep talks to the database. It is a parameter because the bootstrap
 * runs a sweep while the schema promise is still in flight, and `query()` waits
 * on that promise — a sweep going through it would be waiting on itself.
 */
export type Runner = <T extends Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => Promise<T[]>;

/**
 * How long a performer's details survive after the casting call they were sent
 * to closes. Six months is long enough for a production to finish casting and
 * come back to a shortlist, and short enough that the tool is not sitting on
 * contact details for people who applied for something that wrapped a year ago.
 */
export const RETENTION_MONTHS = 6;

/** The day a session's submissions are destroyed, as `yyyy-mm-dd`. */
export function purgeDate(closesAt: string): string {
  const date = new Date(`${closesAt}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + RETENTION_MONTHS);
  return date.toISOString().slice(0, 10);
}

export type Purged = { sessionId: string; name: string; submissions: number };

/**
 * Destroys the performers' details for every casting session that closed more
 * than the retention period ago, and marks the session so the dashboard can say
 * what happened rather than showing an empty list.
 *
 * The production, its roles and the fact that submissions were received all
 * survive — the casting director keeps a record of what they ran without
 * holding anybody's personal data. This is a real delete, not a flag.
 */
export async function purgeExpiredSubmissions(run: Runner = query): Promise<Purged[]> {
  const due = await run<{ id: string; name: string; owner_id: string | null; company: string }>(
    `SELECT id, name, owner_id, company FROM sessions_casting
      WHERE purged_at IS NULL
        AND closes_at < (now() AT TIME ZONE 'utc')::date - interval '${RETENTION_MONTHS} months'`,
  );

  const purged: Purged[] = [];

  for (const session of due) {
    // Counted before the delete: afterwards there is nothing left to count.
    const [{ count }] = await run<{ count: string }>(
      "SELECT count(*)::text AS count FROM submissions WHERE session_id = $1",
      [session.id],
    );

    await run("DELETE FROM submissions WHERE session_id = $1", [session.id]);
    await run("UPDATE sessions_casting SET purged_at = now() WHERE id = $1", [session.id]);

    purged.push({ sessionId: session.id, name: session.name, submissions: Number(count) });
  }

  return purged;
}
