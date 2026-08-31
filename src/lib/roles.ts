import "server-only";

import { query } from "./db";
import {
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
  posted_at: Date;
};

/** `deadline` is rendered in SQL so the driver's timezone cannot shift the day. */
const COLUMNS = `
  id, slug, title, production, production_type, synopsis, character_brief,
  requirements, location, self_tape, age_min, age_max, pay_type, rate,
  union_status, shoot_dates, to_char(deadline, 'YYYY-MM-DD') AS deadline,
  casting_director, company, posted_at
`;

/** Today in UTC, matching how `isOpen` decides the same thing in JS. */
const TODAY = "(now() AT TIME ZONE 'utc')::date";

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
    postedAt: row.posted_at.toISOString(),
  };
}

/* --------------------------------------------------------------- queries -- */

function whereClause(filters: RoleFilters): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const add = (condition: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    conditions.push(condition(`$${params.length}`));
  };

  if (!filters.includeClosed) conditions.push(`deadline >= ${TODAY}`);
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
const ORDER = `ORDER BY (deadline >= ${TODAY}) DESC, deadline ASC, posted_at DESC`;

export async function listRoles(filters: RoleFilters = EMPTY_FILTERS): Promise<Role[]> {
  const { sql, params } = whereClause(filters);
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles ${sql} ${ORDER}`,
    params,
  );
  return rows.map(toRole);
}

export async function listRecentRoles(limit: number): Promise<Role[]> {
  const rows = await query<RoleRow>(
    `SELECT ${COLUMNS} FROM roles WHERE deadline >= ${TODAY} ${ORDER} LIMIT $1`,
    [limit],
  );
  return rows.map(toRole);
}

export async function getRole(id: string): Promise<Role | null> {
  const rows = await query<RoleRow>(`SELECT ${COLUMNS} FROM roles WHERE id = $1`, [id]);
  return rows[0] ? toRole(rows[0]) : null;
}

export async function countOpenRoles(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM roles WHERE deadline >= ${TODAY}`,
  );
  return Number(rows[0]?.count ?? 0);
}

export type NewRole = Omit<Role, "id" | "slug" | "postedAt">;

export async function createRole(input: NewRole): Promise<Role> {
  const rows = await query<RoleRow>(
    `INSERT INTO roles (
       id, slug, title, production, production_type, synopsis, character_brief,
       requirements, location, self_tape, age_min, age_max, pay_type, rate,
       union_status, shoot_dates, deadline, casting_director, company
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
      input.deadline,
      input.castingDirector,
      input.company,
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
