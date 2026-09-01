import "server-only";

import type { SessionUser } from "./auth";
import { query } from "./db";
import type { CastingSession } from "./types";

type Row = {
  id: string;
  slug: string;
  name: string;
  synopsis: string;
  owner_id: string | null;
  company: string;
  opens_at: string;
  closes_at: string;
  closed_at: Date | null;
  created_at: Date;
};

/** Dates are rendered in SQL so the driver's timezone cannot shift the day. */
export const SESSION_COLUMNS = `
  id, slug, name, synopsis, owner_id, company,
  to_char(opens_at, 'YYYY-MM-DD')  AS opens_at,
  to_char(closes_at, 'YYYY-MM-DD') AS closes_at,
  closed_at, created_at
`;

export function toSession(row: Row): CastingSession {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    synopsis: row.synopsis,
    ownerId: row.owner_id,
    company: row.company,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    closedAt: row.closed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

/** Live now: within the window and not closed by hand. */
export const LIVE = `
  closed_at IS NULL
  AND opens_at <= (now() AT TIME ZONE 'utc')::date
  AND closes_at >= (now() AT TIME ZONE 'utc')::date
`;

/**
 * The same rule as roles, applied to a session's own owner and company: a
 * director sees the sessions they created, a producer every session under their
 * company, an admin all of them.
 */
export function sessionVisibility(
  viewer: SessionUser,
  prefix = "",
): { where: string; params: unknown[] } {
  switch (viewer.role) {
    case "admin":
      return { where: "", params: [] };
    case "producer":
      return { where: `lower(${prefix}company) = lower($1)`, params: [viewer.company] };
    default:
      return { where: `${prefix}owner_id = $1`, params: [viewer.id] };
  }
}

export async function listVisibleSessions(viewer: SessionUser): Promise<CastingSession[]> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting
      ${where ? `WHERE ${where}` : ""}
      ORDER BY (${LIVE}) DESC, closes_at ASC, created_at DESC`,
    params,
  );
  return rows.map(toSession);
}

export async function getVisibleSession(
  id: string,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}`,
    [...params, id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** The public view: any session, by id. */
export async function getSession(id: string): Promise<CastingSession | null> {
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Roles and submissions per session, for the sessions list. */
export type SessionStats = { roles: number; submissions: number };

export async function sessionStats(
  viewer: SessionUser,
): Promise<Map<string, SessionStats>> {
  const { where, params } = sessionVisibility(viewer, "s.");
  const rows = await query<{ id: string; roles: string; submissions: string }>(
    `SELECT s.id,
            count(DISTINCT r.id)::text  AS roles,
            count(DISTINCT sub.id)::text AS submissions
       FROM sessions_casting s
       LEFT JOIN roles r         ON r.session_id = s.id
       LEFT JOIN submissions sub ON sub.role_id = r.id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY s.id`,
    params,
  );
  return new Map(
    rows.map((row) => [
      row.id,
      { roles: Number(row.roles), submissions: Number(row.submissions) },
    ]),
  );
}

export type NewSession = {
  name: string;
  synopsis: string;
  company: string;
  opensAt: string;
  closesAt: string;
};

export async function createSession(
  input: NewSession,
  ownerId: string,
): Promise<CastingSession> {
  const rows = await query<Row>(
    `INSERT INTO sessions_casting
       (id, slug, name, synopsis, owner_id, company, opens_at, closes_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${SESSION_COLUMNS}`,
    [
      `ses_${crypto.randomUUID().slice(0, 12)}`,
      slugify(input.name),
      input.name,
      input.synopsis,
      ownerId,
      input.company,
      input.opensAt,
      input.closesAt,
    ],
  );
  return toSession(rows[0]);
}

export async function updateSession(
  id: string,
  input: NewSession,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE sessions_casting SET
       name = $${params.length + 2},
       slug = $${params.length + 3},
       synopsis = $${params.length + 4},
       company = $${params.length + 5},
       opens_at = $${params.length + 6},
       closes_at = $${params.length + 7}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${SESSION_COLUMNS}`,
    [
      ...params, id,
      input.name, slugify(input.name), input.synopsis, input.company,
      input.opensAt, input.closesAt,
    ],
  );
  if (!rows[0]) return null;

  // `roles.deadline` mirrors the session's closing date. Moving the window has
  // to carry the roles with it, or the column contradicts the session.
  await query("UPDATE roles SET deadline = $1 WHERE session_id = $2", [
    input.closesAt,
    id,
  ]);

  return toSession(rows[0]);
}

/** Closes a session ahead of its closing date, or puts it back. */
export async function setSessionClosed(
  id: string,
  closed: boolean,
  viewer: SessionUser,
): Promise<boolean> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<{ id: string }>(
    `UPDATE sessions_casting SET closed_at = ${closed ? "now()" : "NULL"}
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
      RETURNING id`,
    [...params, id],
  );
  return rows.length > 0;
}

/** Removes a session, its roles and their submissions. Admin only. */
export async function deleteSessionAsAdmin(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "DELETE FROM sessions_casting WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
