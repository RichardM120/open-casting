import "server-only";

import type { SessionUser } from "./auth";
import { FOREIGN_KEY_VIOLATION, query } from "./db";
import type { ProductionCompany } from "./types";

type Row = {
  id: string;
  name: string;
  notes: string;
  owner_id: string | null;
  company: string;
  created_at: Date;
};

const PRODUCTION_COMPANY_COLUMNS = "id, name, notes, owner_id, company, created_at";

function toProductionCompany(row: Row): ProductionCompany {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    ownerId: row.owner_id,
    company: row.company,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * The same rule as productions, so this list never reveals more than the
 * productions under it already would: a director sees the companies they created,
 * a producer every company under their client, an admin all of them.
 */
export function productionCompanyVisibility(
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

export async function listVisibleProductionCompanies(viewer: SessionUser): Promise<ProductionCompany[]> {
  const { where, params } = productionCompanyVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${PRODUCTION_COMPANY_COLUMNS} FROM production_companies
      ${where ? `WHERE ${where}` : ""}
      ORDER BY lower(name) ASC`,
    params,
  );
  return rows.map(toProductionCompany);
}

export async function getVisibleProductionCompany(
  id: string,
  viewer: SessionUser,
): Promise<ProductionCompany | null> {
  const { where, params } = productionCompanyVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${PRODUCTION_COMPANY_COLUMNS} FROM production_companies
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}`,
    [...params, id],
  );
  return rows[0] ? toProductionCompany(rows[0]) : null;
}

/** How many productions sit under each visible productionCompany, for the list. */
export async function productionCompanyCounts(
  viewer: SessionUser,
): Promise<Map<string, number>> {
  const { where, params } = productionCompanyVisibility(viewer, "c.");
  const rows = await query<{ id: string; productions: string }>(
    `SELECT c.id, count(s.id)::text AS productions
       FROM production_companies c
       LEFT JOIN sessions_casting s ON s.production_company_id = c.id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY c.id`,
    params,
  );
  return new Map(rows.map((row) => [row.id, Number(row.productions)]));
}

export type NewProductionCompany = { name: string; notes: string };

export async function createProductionCompany(
  input: NewProductionCompany,
  ownerId: string,
  company: string,
): Promise<ProductionCompany> {
  const rows = await query<Row>(
    `INSERT INTO production_companies (id, name, notes, owner_id, company)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PRODUCTION_COMPANY_COLUMNS}`,
    [`cli_${crypto.randomUUID().slice(0, 12)}`, input.name, input.notes, ownerId, company],
  );
  return toProductionCompany(rows[0]);
}

export async function updateProductionCompany(
  id: string,
  input: NewProductionCompany,
  viewer: SessionUser,
): Promise<ProductionCompany | null> {
  const { where, params } = productionCompanyVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE production_companies SET name = $${params.length + 2}, notes = $${params.length + 3}
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
      RETURNING ${PRODUCTION_COMPANY_COLUMNS}`,
    [...params, id, input.name, input.notes],
  );
  return rows[0] ? toProductionCompany(rows[0]) : null;
}

/**
 * Removes a production company that has nothing under it.
 *
 * A company holding productions is refused rather than cascaded: deleting one
 * would take real casting work and its submissions with it, and the database
 * says no to that anyway. "in-use" is the answer the form turns into a
 * sentence telling the director what to move first.
 */
export async function deleteProductionCompany(
  id: string,
  viewer: SessionUser,
): Promise<"deleted" | "not-found" | "in-use"> {
  const { where, params } = productionCompanyVisibility(viewer);
  try {
    const rows = await query<{ id: string }>(
      `DELETE FROM production_companies
        WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
        RETURNING id`,
      [...params, id],
    );
    return rows.length > 0 ? "deleted" : "not-found";
  } catch (error) {
    if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION) return "in-use";
    throw error;
  }
}
