import "server-only";

import type { SessionUser } from "./auth";
import { query } from "./db";
import { LIVE, SESSION_COLUMNS, toSession } from "./sessions";
import type { CastingSession, ProductionType, Role } from "./types";

/* ------------------------------------------------------------- row shape -- */

type RoleRow = {
  id: string;
  slug: string;
  title: string;
  production: string;
  production_type: string;
  synopsis: string;
  character_brief: string;
  requirements: string[];
  location: string;
  self_tape: boolean;
  age_min: number;
  age_max: number;
  shoot_starts_at: string | null;
  shoot_ends_at: string | null;
  casting_director: string;
  company: string;
  disclaimer: string;
  closed_at: Date | null;
  owner_id: string | null;
  session_id: string;
  posted_at: Date;
};

const COLUMNS = `
  id, slug, title, production, production_type, synopsis, character_brief,
  requirements, location, self_tape, age_min, age_max,
  to_char(shoot_starts_at, 'YYYY-MM-DD') AS shoot_starts_at,
  to_char(shoot_ends_at, 'YYYY-MM-DD') AS shoot_ends_at,
  casting_director, company, disclaimer, closed_at, owner_id, session_id, posted_at
`;

function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    production: row.production,
    productionType: row.production_type as ProductionType,
    synopsis: row.synopsis,
    characterBrief: row.character_brief,
    requirements: row.requirements,
    location: row.location,
    selfTape: row.self_tape,
    ageMin: row.age_min,
    ageMax: row.age_max,
    shootStartsAt: row.shoot_starts_at,
    shootEndsAt: row.shoot_ends_at,
    castingDirector: row.casting_director,
    company: row.company,
    disclaimer: row.disclaimer,
    closedAt: row.closed_at?.toISOString() ?? null,
    ownerId: row.owner_id,
    sessionId: row.session_id,
    postedAt: row.posted_at.toISOString(),
  };
}

export type ListedRole = Role & { session: CastingSession };

/**
 * A role is live exactly when its production is. The window belongs to the
 * production, not the individual part. Expressed as a subquery rather than a
 * join because `roles` and `sessions_casting` share column names (id, slug,
 * synopsis, company, owner_id, closed_at) and aliasing every one of them to
 * avoid the collision reads far worse than a second query.
 */
const OPEN = `
  closed_at IS NULL
  AND session_id IN (SELECT id FROM sessions_casting WHERE ${LIVE})
`;

/** Open roles first, then the ones whose production closes soonest. */
const ORDER = `
  ORDER BY (${OPEN}) DESC,
    (SELECT closes_at FROM sessions_casting s WHERE s.id = roles.session_id) ASC,
    posted_at DESC
`;

/** Fetches the productions these roles belong to and attaches them. */
async function attachSessions(roles: Role[]): Promise<ListedRole[]> {
  if (roles.length === 0) return [];

  const ids = [...new Set(roles.map((role) => role.sessionId))];
  const rows = await query<Parameters<typeof toSession>[0]>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE id = ANY($1)`,
    [ids],
  );

  const sessions = new Map(rows.map((row) => [row.id, toSession(row)]));
  return roles.flatMap((role) => {
    const session = sessions.get(role.sessionId);
    // A role without its production cannot be shown; the foreign key makes this
    // unreachable, and dropping it beats rendering a listing with no dates.
    return session ? [{ ...role, session }] : [];
  });
}

/** Any role, by id, with the production that dates it. */
export async function getRole(id: string): Promise<ListedRole | null> {
  const rows = await query<RoleRow>(`SELECT ${COLUMNS} FROM roles WHERE id = $1`, [id]);
  return (await attachSessions(rows.map(toRole)))[0] ?? null;
}

/**
 * The one definition of what a dashboard shows, by role:
 *
 *  - director: only the roles they posted
 *  - producer: every role posted under their company, across productions
 *  - admin:    everything
 *
 * Returned as a fragment rather than applied here so every dashboard query
 * (the listing, a single role, the submission counts) is scoped by the same
 * rule and cannot drift apart.
 */
export function visibility(
  viewer: SessionUser,
  column = { owner: "owner_id", company: "company" },
): { where: string; params: unknown[] } {
  switch (viewer.role) {
    case "admin":
      return { where: "", params: [] };
    case "producer":
      return { where: `lower(${column.company}) = lower($1)`, params: [viewer.company] };
    default:
      return { where: `${column.owner} = $1`, params: [viewer.id] };
  }
}

/** Every role this account may see on its dashboard. */
export async function listVisibleRoles(viewer: SessionUser): Promise<ListedRole[]> {
  const { where, params } = visibility(viewer);
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles ${where ? `WHERE ${where}` : ""} ${ORDER}`,
    params,
  );
  return attachSessions(rows.map(toRole));
}

/**
 * One role inside a production, by the readable handle in its URL.
 *
 * Matched on the slug first so the link says what the part is; falls back to
 * the id, which is what older links carry. Scoped to the production either
 * way, so one production's link cannot reach another's role.
 */
export async function getSessionRole(
  sessionId: string,
  handle: string,
): Promise<ListedRole | null> {
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles
      WHERE session_id = $1 AND (slug = lower($2) OR id = $2)
      ORDER BY posted_at ASC
      LIMIT 1`,
    [sessionId, handle],
  );
  return (await attachSessions(rows.map(toRole)))[0] ?? null;
}

/** The roles inside one production, for its dashboard page. */
export async function listSessionRoles(sessionId: string): Promise<ListedRole[]> {
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles WHERE session_id = $1 ORDER BY posted_at DESC`,
    [sessionId],
  );
  return attachSessions(rows.map(toRole));
}

/**
 * A role only if this account may see it. Returning null rather than throwing
 * lets the page render a 404, so someone guessing ids cannot tell an id that
 * exists from one that does not.
 */
export async function getVisibleRole(
  id: string,
  viewer: SessionUser,
): Promise<ListedRole | null> {
  const { where, params } = visibility(viewer);
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}`,
    [...params, id],
  );
  return (await attachSessions(rows.map(toRole)))[0] ?? null;
}

/**
 * What a role says for itself. Everything about the production comes from the
 * production it is posted into, and the name of whoever posts it is taken from
 * their account.
 */
export type NewRole = Omit<
  Role,
  | "id"
  | "slug"
  | "postedAt"
  | "closedAt"
  | "ownerId"
  | "sessionId"
  | "production"
  | "productionType"
  | "synopsis"
  | "company"
  | "castingDirector"
>;

export async function createRole(
  input: NewRole,
  session: CastingSession,
  poster: { id: string; name: string },
): Promise<Role> {
  const rows = await query<RoleRow>(
    `INSERT INTO roles (
       id, slug, title, production, production_type, synopsis, character_brief,
       requirements, location, self_tape, age_min, age_max, shoot_starts_at,
       shoot_ends_at, casting_director, company, owner_id, disclaimer, session_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING ${COLUMNS}`,
    [
      `rol_${crypto.randomUUID().slice(0, 12)}`,
      slugify(`${input.title} ${session.name}`),
      input.title,
      // Mirrored from the production, and kept in step when it is edited.
      session.name,
      session.productionType,
      session.synopsis,
      input.characterBrief,
      input.requirements,
      input.location,
      input.selfTape,
      input.ageMin,
      input.ageMax,
      input.shootStartsAt,
      input.shootEndsAt,
      poster.name,
      session.company,
      poster.id,
      input.disclaimer,
      session.id,
    ],
  );
  return toRole(rows[0]);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ------------------------------------------------------------ moderation -- */

/**
 * Rewrites a role in place. Scoped through the same `visibility()` rule as
 * reading, so a director can edit their own, a producer any under their
 * company, an admin any at all. Ownership and the closed flag are deliberately
 * not editable here, and nor are the production's details: those are changed
 * on the production, which pushes them down to every role in it.
 *
 * Editing the terms does not rewrite history: what an applicant accepted was
 * copied onto their submission when they made it.
 */
export async function updateRole(
  id: string,
  input: NewRole,
  viewer: SessionUser,
): Promise<Role | null> {
  const { where, params } = visibility(viewer);
  const rows = await query<RoleRow>(
    `UPDATE roles SET
       title = $${params.length + 2},
       character_brief = $${params.length + 3},
       requirements = $${params.length + 4},
       location = $${params.length + 5},
       self_tape = $${params.length + 6},
       age_min = $${params.length + 7},
       age_max = $${params.length + 8},
       shoot_starts_at = $${params.length + 9},
       shoot_ends_at = $${params.length + 10},
       disclaimer = $${params.length + 11}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${COLUMNS}`,
    [
      ...params, id,
      input.title, input.characterBrief, input.requirements, input.location,
      input.selfTape, input.ageMin, input.ageMax, input.shootStartsAt,
      input.shootEndsAt,
      input.disclaimer,
    ],
  );
  return rows[0] ? toRole(rows[0]) : null;
}

/** Closes a role ahead of its production's closing time, or puts it back. */
export async function setRoleClosed(
  id: string,
  closed: boolean,
  viewer: SessionUser,
): Promise<boolean> {
  const { where, params } = visibility(viewer);
  const rows = await query<{ id: string }>(
    `UPDATE roles SET closed_at = ${closed ? "now()" : "NULL"}
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
      RETURNING id`,
    [...params, id],
  );
  return rows.length > 0;
}

/**
 * Removes a role and, by the cascade on submissions, everything sent to it.
 * Callers must confirm the account is an admin. This is not scoped by
 * `visibility()`, because destroying other people's submissions is not
 * something a producer should be able to do by virtue of a shared company name.
 */
export async function deleteRoleAsAdmin(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "DELETE FROM roles WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0;
}
