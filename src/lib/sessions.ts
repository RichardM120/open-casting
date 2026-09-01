import "server-only";

import type { SessionUser } from "./auth";
import { query, shareToken } from "./db";
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
  published_at: Date | null;
  purged_at: Date | null;
  production_ends_at: string;
  public_token: string;
  created_at: Date;
};

/** Dates are rendered in SQL so the driver's timezone cannot shift the day. */
export const SESSION_COLUMNS = `
  id, slug, name, synopsis, owner_id, company,
  to_char(opens_at, 'YYYY-MM-DD')  AS opens_at,
  to_char(closes_at, 'YYYY-MM-DD') AS closes_at,
  to_char(production_ends_at, 'YYYY-MM-DD') AS production_ends_at,
  closed_at, published_at, purged_at, public_token, created_at
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
    publishedAt: row.published_at?.toISOString() ?? null,
    purgedAt: row.purged_at?.toISOString() ?? null,
    productionEndsAt: row.production_ends_at,
    publicToken: row.public_token,
    createdAt: row.created_at.toISOString(),
  };
}

/** Live now: published, within the window, and not closed by hand. */
export const LIVE = `
  published_at IS NOT NULL
  AND closed_at IS NULL
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
      ORDER BY (${LIVE}) DESC, published_at IS NULL DESC, closes_at ASC, created_at DESC`,
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

/** Any session, by id. For the dashboard side, which has already authorised. */
export async function getSession(id: string): Promise<CastingSession | null> {
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * The one public entry point: a production, by its share token. Holding the
 * token is the authorisation — there is nothing else to check, and nothing
 * else in the app will hand a performer one.
 */
export async function getSessionByToken(token: string): Promise<CastingSession | null> {
  // Length-checked before the query so an absurd URL is not a database round
  // trip, and so a token cannot be a wildcard.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;

  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE public_token = $1`,
    [token],
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
  /** When the production wraps. The retention clock runs from here. */
  productionEndsAt: string;
};

export async function createSession(
  input: NewSession,
  ownerId: string,
): Promise<CastingSession> {
  const rows = await query<Row>(
    `INSERT INTO sessions_casting
       (id, slug, name, synopsis, owner_id, company, opens_at, closes_at,
        production_ends_at, public_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      input.productionEndsAt,
      shareToken(),
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
       closes_at = $${params.length + 7},
       production_ends_at = $${params.length + 8}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${SESSION_COLUMNS}`,
    [
      ...params, id,
      input.name, slugify(input.name), input.synopsis, input.company,
      input.opensAt, input.closesAt, input.productionEndsAt,
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

/**
 * Publishes a casting session: the moment its share link starts working.
 *
 * One way on purpose. Once the link has gone onto a post or into a mailout it
 * is out of anyone's hands, so un-publishing would only break it for people who
 * already have it — "close early" is the honest way to stop a call.
 */
export async function publishSession(
  id: string,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE sessions_casting SET published_at = now()
      WHERE id = $${params.length + 1} AND published_at IS NULL
        ${where ? `AND ${where}` : ""}
      RETURNING ${SESSION_COLUMNS}`,
    [...params, id],
  );
  return rows[0] ? toSession(rows[0]) : null;
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
