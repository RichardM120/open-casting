import "server-only";

import type { SessionUser } from "./auth";
import { query, shareToken } from "./db";
import type { CastingSession, ProductionType } from "./types";

type Row = {
  id: string;
  slug: string;
  name: string;
  production_type: string;
  synopsis: string;
  owner_id: string | null;
  company: string;
  opens_at: Date;
  closes_at: Date;
  closed_at: Date | null;
  published_at: Date | null;
  purged_at: Date | null;
  production_ends_at: string;
  public_token: string;
  created_at: Date;
};

/**
 * The production end is a date, rendered in SQL so the driver's timezone cannot
 * shift the day. The opening and closing moments are instants and come back as
 * such.
 */
export const SESSION_COLUMNS = `
  id, slug, name, production_type, synopsis, owner_id, company,
  opens_at, closes_at,
  to_char(production_ends_at, 'YYYY-MM-DD') AS production_ends_at,
  closed_at, published_at, purged_at, public_token, created_at
`;

export function toSession(row: Row): CastingSession {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    productionType: row.production_type as ProductionType,
    synopsis: row.synopsis,
    ownerId: row.owner_id,
    company: row.company,
    opensAt: row.opens_at.toISOString(),
    closesAt: row.closes_at.toISOString(),
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
  AND opens_at <= now()
  AND closes_at >= now()
`;

/**
 * The same rule as roles, applied to a production's own owner and company: a
 * director sees the productions they created, a producer every production
 * under their company, an admin all of them.
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

/** Any production, by id. For the dashboard side, which has already authorised. */
export async function getSession(id: string): Promise<CastingSession | null> {
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * The readable half of a share link: `saltmarsh-e9e3qmqde8`.
 *
 * The slug is decoration. It makes the link say what it is on a poster or in a
 * caption, and only the suffix is looked up. So a link whose production has
 * since been renamed still works, and a guessed slug gets nobody anywhere.
 */
export function shareSlug(session: CastingSession): string {
  return session.slug ? `${session.slug}-${session.publicToken}` : session.publicToken;
}

/**
 * The one public entry point: a production, by its share link. Holding the
 * token is the authorisation. There is nothing else to check, and nothing else
 * in the app will hand a performer one.
 */
export async function getSessionByToken(handle: string): Promise<CastingSession | null> {
  // Everything up to the last dash is the readable slug and is ignored.
  const token = handle.slice(handle.lastIndexOf("-") + 1).toLowerCase();

  // Shape-checked before the query, so an absurd URL is not a database round
  // trip and a token cannot be made into a wildcard. Older links carry the
  // longer base64url token, so both lengths are accepted.
  if (!/^[a-z0-9_-]{10,64}$/.test(token)) return null;

  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE lower(public_token) = $1`,
    [token],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Roles and submissions per production, for the dashboard. */
export type SessionStats = { roles: number; submissions: number; unread: number };

export async function sessionStats(
  viewer: SessionUser,
): Promise<Map<string, SessionStats>> {
  const { where, params } = sessionVisibility(viewer, "s.");
  const rows = await query<{ id: string; roles: string; submissions: string; unread: string }>(
    `SELECT s.id,
            count(DISTINCT r.id)::text  AS roles,
            count(DISTINCT sub.id)::text AS submissions,
            count(DISTINCT sub.id) FILTER (WHERE sub.status = 'New')::text AS unread
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
      {
        roles: Number(row.roles),
        submissions: Number(row.submissions),
        unread: Number(row.unread),
      },
    ]),
  );
}

export type NewSession = {
  name: string;
  productionType: ProductionType;
  synopsis: string;
  company: string;
  /** ISO timestamps: the moments submissions open and close. */
  opensAt: string;
  closesAt: string;
  /** When the production wraps, yyyy-mm-dd. The retention clock runs from here. */
  productionEndsAt: string;
};

export async function createSession(
  input: NewSession,
  ownerId: string,
): Promise<CastingSession> {
  const rows = await query<Row>(
    `INSERT INTO sessions_casting
       (id, slug, name, production_type, synopsis, owner_id, company, opens_at,
        closes_at, production_ends_at, public_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${SESSION_COLUMNS}`,
    [
      `ses_${crypto.randomUUID().slice(0, 12)}`,
      slugify(input.name),
      input.name,
      input.productionType,
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
       production_type = $${params.length + 4},
       synopsis = $${params.length + 5},
       company = $${params.length + 6},
       opens_at = $${params.length + 7},
       closes_at = $${params.length + 8},
       production_ends_at = $${params.length + 9}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${SESSION_COLUMNS}`,
    [
      ...params, id,
      input.name, slugify(input.name), input.productionType, input.synopsis,
      input.company, input.opensAt, input.closesAt, input.productionEndsAt,
    ],
  );
  if (!rows[0]) return null;

  // The roles carry the production's name, type, synopsis and company so they
  // read as a whole on their own. Editing the production has to carry them
  // with it, or a role would contradict the production it sits in.
  await query(
    `UPDATE roles SET production = $2, production_type = $3, synopsis = $4, company = $5
      WHERE session_id = $1`,
    [id, input.name, input.productionType, input.synopsis, input.company],
  );

  return toSession(rows[0]);
}

/**
 * Publishes a production: the moment its share link starts working.
 *
 * One way on purpose. Once the link has gone onto a post or into a mailout it
 * is out of anyone's hands, so un-publishing would only break it for people who
 * already have it. Closing early is the honest way to stop a call.
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

/** Closes a production ahead of its closing time, or puts it back. */
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

/** Removes a production, its roles and their submissions. Admin only. */
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
