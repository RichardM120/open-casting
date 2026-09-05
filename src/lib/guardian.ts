/**
 * A child's submission, and the adult who has to stand behind it.
 *
 * A tick on a form says one thing: somebody at the keyboard ticked it. It does
 * not say a parent was there, and for a fourteen-year-old sending a headshot
 * and a tape that is the whole question. So the named guardian is emailed a
 * one-time link, sees what is being consented to in their own words, and
 * confirms it themselves.
 *
 * Until they do, the submission exists in the table and nowhere else: the
 * casting team's lists, counts, caps and exports all pass through
 * `CONFIRMED`, so an unconfirmed one cannot be read, reviewed, counted or
 * downloaded. If nobody confirms, it is destroyed — holding a child's photo
 * on a consent that was never given is the thing this is here to prevent.
 */
import crypto from "node:crypto";

import { query } from "./db";
import { GUARDIAN_CONFIRM_DAYS } from "./types";
// The sweep's runner: the same signature, so the nightly job can hand this
// its own connection rather than one waiting on the schema promise.
import type { Runner } from "./retention";

/** Re-exported so the queries below and the pages read one number. */
export const CONFIRM_DAYS = GUARDIAN_CONFIRM_DAYS;

/** The one-time link's secret. Long enough that guessing is not a strategy. */
export function mintToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export type Awaiting = {
  id: string;
  name: string;
  age: number;
  guardianName: string;
  guardianEmail: string;
  roleTitle: string;
  sessionName: string;
  company: string;
  submittedAt: string;
  confirmedAt: string | null;
};

type Row = {
  id: string;
  name: string;
  age: number;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_confirmed_at: Date | null;
  submitted_at: Date;
  role_title: string;
  session_name: string;
  company: string;
};

const toAwaiting = (row: Row): Awaiting => ({
  id: row.id,
  name: row.name,
  age: row.age,
  guardianName: row.guardian_name ?? "",
  guardianEmail: row.guardian_email ?? "",
  roleTitle: row.role_title,
  sessionName: row.session_name,
  company: row.company,
  submittedAt: row.submitted_at.toISOString(),
  confirmedAt: row.guardian_confirmed_at?.toISOString() ?? null,
});

const SELECT = `
  SELECT s.id, s.name, s.age, s.guardian_name, s.guardian_email,
         s.guardian_confirmed_at, s.submitted_at,
         r.title AS role_title, r.company, c.name AS session_name
    FROM submissions s
    JOIN roles r ON r.id = s.role_id
    JOIN sessions_casting c ON c.id = s.session_id
`;

/**
 * What a token stands for, without spending it: the guardian reads this before
 * deciding, so the page can name the child, the part and the company. Returns
 * null for a token that never existed or has already been used.
 */
export async function awaiting(token: string, run: Runner = query): Promise<Awaiting | null> {
  if (!token) return null;
  const rows = await run<Row>(`${SELECT} WHERE s.guardian_token = $1`, [token]);
  return rows[0] ? toAwaiting(rows[0]) : null;
}

/**
 * Spends the token and records the confirmation, in one statement so a link
 * opened twice confirms once. Returns what was confirmed, or null if the
 * token had already gone.
 */
export async function confirm(token: string, run: Runner = query): Promise<Awaiting | null> {
  if (!token) return null;
  const claimed = await run<{ id: string }>(
    `UPDATE submissions
        SET guardian_confirmed_at = now(), guardian_token = NULL
      WHERE guardian_token = $1 AND guardian_confirmed_at IS NULL
      RETURNING id`,
    [token],
  );
  if (!claimed[0]) return null;
  const rows = await run<Row>(`${SELECT} WHERE s.id = $1`, [claimed[0].id]);
  return rows[0] ? toAwaiting(rows[0]) : null;
}

/**
 * A child's submission nobody stood behind. Deleted outright rather than
 * marked: there is no lawful basis to keep a photograph of a minor on a
 * consent that was never given, and the casting team never saw it.
 *
 * Returned so the sweep can say what it took.
 */
export async function purgeUnconfirmed(run: Runner = query): Promise<Awaiting[]> {
  const going = await run<Row>(
    `${SELECT}
      WHERE s.guardian_email IS NOT NULL
        AND s.guardian_confirmed_at IS NULL
        AND s.submitted_at < now() - make_interval(days => $1)`,
    [CONFIRM_DAYS],
  );
  if (going.length === 0) return [];
  await run(`DELETE FROM submissions WHERE id = ANY($1::text[])`, [going.map((row) => row.id)]);
  return going.map(toAwaiting);
}
