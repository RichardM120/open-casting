import "server-only";

import type { SessionUser } from "./auth";
import { query } from "./db";
import { LIVE, SESSION_COLUMNS, toSession } from "./sessions";
import {
  type CastingSession,
  PAY_TYPES,
  PRODUCTION_TYPES,
  UNION_STATUSES,
  type PayType,
  type ProductionType,
  type Role,
  type UnionStatus,
} from "./types";

export type RoleFilters = {
  query: string;
  productionType: ProductionType | null;
  unionStatus: UnionStatus | null;
  payType: PayType | null;
  selfTapeOnly: boolean;
  includeClosed: boolean;
};

export const EMPTY_FILTERS: RoleFilters = {
  query: "",
  productionType: null,
  unionStatus: null,
  payType: null,
  selfTapeOnly: false,
  includeClosed: false,
};

export function hasActiveFilters(filters: RoleFilters): boolean {
  return (
    filters.query !== "" ||
    filters.productionType !== null ||
    filters.unionStatus !== null ||
    filters.payType !== null ||
    filters.selfTapeOnly ||
    filters.includeClosed
  );
}

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
  pay_type: string;
  rate: string;
  union_status: string;
  shoot_dates: string;
  deadline: string;
  casting_director: string;
  company: string;
  disclaimer: string;
  closed_at: Date | null;
  owner_id: string | null;
  session_id: string;
  posted_at: Date;
};

/** `deadline` is rendered in SQL so the driver's timezone cannot shift the day. */
const COLUMNS = `
  id, slug, title, production, production_type, synopsis, character_brief,
  requirements, location, self_tape, age_min, age_max, pay_type, rate,
  union_status, shoot_dates, to_char(deadline, 'YYYY-MM-DD') AS deadline,
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
    payType: row.pay_type as PayType,
    rate: row.rate,
    unionStatus: row.union_status as UnionStatus,
    shootDates: row.shoot_dates,
    deadline: row.deadline,
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
 * A role is live exactly when its session is — the window belongs to the
 * production, not the individual part. Expressed as a subquery rather than a
 * join because `roles` and `sessions_casting` share column names (id, slug,
 * synopsis, company, owner_id, closed_at) and aliasing every one of them to
 * avoid the collision reads far worse than a second query.
 */
const OPEN = `
  closed_at IS NULL
  AND session_id IN (SELECT id FROM sessions_casting WHERE ${LIVE})
`;

/** Fetches the sessions these roles belong to and attaches them. */
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
    // A role without its session cannot be shown; the foreign key makes this
    // unreachable, and dropping it beats rendering a listing with no dates.
    return session ? [{ ...role, session }] : [];
  });
}

function whereClause(filters: RoleFilters): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const add = (condition: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    conditions.push(condition(`$${params.length}`));
  };

  if (!filters.includeClosed) conditions.push(OPEN);
  if (filters.selfTapeOnly) conditions.push("self_tape");
  if (filters.productionType) add((p) => `production_type = ${p}`, filters.productionType);
  if (filters.payType) add((p) => `pay_type = ${p}`, filters.payType);

  // An "Either" role accepts union and non-union performers, so it matches both.
  if (filters.unionStatus) {
    add((p) => `(union_status = ${p} OR union_status = 'Either')`, filters.unionStatus);
  }

  if (filters.query) {
    add(
      (p) =>
        `concat_ws(' ', title, production, production_type, location,
                   character_brief, synopsis, company, casting_director) ILIKE ${p}`,
      `%${filters.query}%`,
    );
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/** Open roles first, then the ones closing soonest. */
const ORDER = `ORDER BY (${OPEN}) DESC, deadline ASC, posted_at DESC`;

export async function listRoles(
  filters: RoleFilters = EMPTY_FILTERS,
): Promise<ListedRole[]> {
  const { sql, params } = whereClause(filters);
  const rows = await query<RoleRow>(`SELECT ${COLUMNS} FROM roles ${sql} ${ORDER}`, params);
  return attachSessions(rows.map(toRole));
}

export async function listRecentRoles(limit: number): Promise<ListedRole[]> {
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles WHERE ${OPEN} ${ORDER} LIMIT $1`,
    [limit],
  );
  return attachSessions(rows.map(toRole));
}

/** The public listing: any role, by id, with the session that dates it. */
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
 * Returned as a fragment rather than applied here so every dashboard query —
 * the listing, a single role, the submission counts — is scoped by the same
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

/** The roles inside one session, for its dashboard page. */
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

export async function countOpenRoles(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM roles WHERE ${OPEN}`,
  );
  return Number(rows[0]?.count ?? 0);
}

export type NewRole = Omit<
  Role,
  "id" | "slug" | "postedAt" | "closedAt" | "ownerId" | "sessionId" | "deadline"
>;

export async function createRole(
  input: NewRole,
  session: CastingSession,
  ownerId: string,
): Promise<Role> {
  const rows = await query<RoleRow>(
    `INSERT INTO roles (
       id, slug, title, production, production_type, synopsis, character_brief,
       requirements, location, self_tape, age_min, age_max, pay_type, rate,
       union_status, shoot_dates, deadline, casting_director, company, owner_id,
       disclaimer, session_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING ${COLUMNS}`,
    [
      `rol_${crypto.randomUUID().slice(0, 12)}`,
      slugify(`${input.title} ${input.production}`),
      input.title,
      input.production,
      input.productionType,
      input.synopsis,
      input.characterBrief,
      input.requirements,
      input.location,
      input.selfTape,
      input.ageMin,
      input.ageMax,
      input.payType,
      input.rate,
      input.unionStatus,
      input.shootDates,
      // Kept in step with the session rather than set independently.
      session.closesAt,
      input.castingDirector,
      input.company,
      ownerId,
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

/* -------------------------------------------------------- url parameters -- */

type RawSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | null {
  const candidate = one(value);
  return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : null;
}

/** Turns the URL's query string into filters, ignoring anything unrecognised. */
export function parseRoleFilters(searchParams: RawSearchParams): RoleFilters {
  return {
    query: one(searchParams.q).slice(0, 80),
    productionType: oneOf(searchParams.type, PRODUCTION_TYPES),
    unionStatus: oneOf(searchParams.union, UNION_STATUSES),
    payType: oneOf(searchParams.pay, PAY_TYPES),
    selfTapeOnly: one(searchParams.selftape) === "1",
    includeClosed: one(searchParams.closed) === "1",
  };
}

/* ------------------------------------------------------------ moderation -- */

/**
 * Rewrites a role in place. Scoped through the same `visibility()` rule as
 * reading, so a director can edit their own, a producer any under their
 * company, an admin any at all. Ownership and the closed flag are deliberately
 * not editable here.
 *
 * Editing the terms does not rewrite history: what a performer accepted was
 * copied onto their submission when they made it.
 */
export async function updateRole(
  id: string,
  input: NewRole,
  viewer: SessionUser,
): Promise<Role | null> {
  // `deadline` is deliberately absent: it mirrors the session's closing date,
  // which is changed on the session rather than here.
  const { where, params } = visibility(viewer);
  const rows = await query<RoleRow>(
    `UPDATE roles SET
       title = $${params.length + 2},
       production = $${params.length + 3},
       production_type = $${params.length + 4},
       synopsis = $${params.length + 5},
       character_brief = $${params.length + 6},
       requirements = $${params.length + 7},
       location = $${params.length + 8},
       self_tape = $${params.length + 9},
       age_min = $${params.length + 10},
       age_max = $${params.length + 11},
       pay_type = $${params.length + 12},
       rate = $${params.length + 13},
       union_status = $${params.length + 14},
       shoot_dates = $${params.length + 15},
       casting_director = $${params.length + 16},
       company = $${params.length + 17},
       disclaimer = $${params.length + 18}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${COLUMNS}`,
    [
      ...params, id,
      input.title, input.production, input.productionType, input.synopsis,
      input.characterBrief, input.requirements, input.location, input.selfTape,
      input.ageMin, input.ageMax, input.payType, input.rate, input.unionStatus,
      input.shootDates, input.castingDirector, input.company,
      input.disclaimer,
    ],
  );
  return rows[0] ? toRole(rows[0]) : null;
}

/** Closes a role ahead of its deadline, or puts it back. */
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
 * Callers must confirm the account is an admin — this is not scoped by
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
