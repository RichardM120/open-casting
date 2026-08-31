import "server-only";

import { isOpen } from "./format";
import { read, write } from "./store";
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

function matches(role: Role, filters: RoleFilters): boolean {
  if (!filters.includeClosed && !isOpen(role.deadline)) return false;
  if (filters.productionType && role.productionType !== filters.productionType) return false;
  if (filters.payType && role.payType !== filters.payType) return false;
  if (filters.selfTapeOnly && !role.selfTape) return false;

  // "Either" roles accept union and non-union performers, so they match both.
  if (
    filters.unionStatus &&
    role.unionStatus !== filters.unionStatus &&
    role.unionStatus !== "Either"
  ) {
    return false;
  }

  if (filters.query) {
    const haystack = [
      role.title,
      role.production,
      role.productionType,
      role.location,
      role.characterBrief,
      role.synopsis,
      role.company,
      role.castingDirector,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }

  return true;
}

/** Open roles first, then by deadline — the ones about to close surface highest. */
function byUrgency(a: Role, b: Role): number {
  const openA = isOpen(a.deadline);
  const openB = isOpen(b.deadline);
  if (openA !== openB) return openA ? -1 : 1;
  if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
  return a.postedAt < b.postedAt ? 1 : -1;
}

export function listRoles(filters: RoleFilters = EMPTY_FILTERS): Promise<Role[]> {
  return read((db) => db.roles.filter((role) => matches(role, filters)).sort(byUrgency));
}

export function listRecentRoles(limit: number): Promise<Role[]> {
  return read((db) =>
    db.roles
      .filter((role) => isOpen(role.deadline))
      .sort(byUrgency)
      .slice(0, limit),
  );
}

export function getRole(id: string): Promise<Role | null> {
  return read((db) => db.roles.find((role) => role.id === id) ?? null);
}

export function countOpenRoles(): Promise<number> {
  return read((db) => db.roles.filter((role) => isOpen(role.deadline)).length);
}

export type NewRole = Omit<Role, "id" | "slug" | "postedAt">;

export async function createRole(input: NewRole): Promise<Role> {
  return write((db) => {
    const role: Role = {
      ...input,
      id: `rol_${crypto.randomUUID().slice(0, 12)}`,
      slug: slugify(`${input.title} ${input.production}`),
      postedAt: new Date().toISOString(),
    };
    db.roles.unshift(role);
    return role;
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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
