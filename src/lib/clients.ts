import "server-only";

import type { SessionUser } from "./auth";
import { FOREIGN_KEY_VIOLATION, query } from "./db";
import type { Client } from "./types";

type Row = {
  id: string;
  name: string;
  notes: string;
  owner_id: string | null;
  company: string;
  created_at: Date;
};

const CLIENT_COLUMNS = "id, name, notes, owner_id, company, created_at";

function toClient(row: Row): Client {
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
 * The same rule as productions, so a client list never reveals more than the
 * productions under it already would: a director sees the clients they created,
 * a producer every client under their agency, an admin all of them.
 */
export function clientVisibility(
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

export async function listVisibleClients(viewer: SessionUser): Promise<Client[]> {
  const { where, params } = clientVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${CLIENT_COLUMNS} FROM clients
      ${where ? `WHERE ${where}` : ""}
      ORDER BY lower(name) ASC`,
    params,
  );
  return rows.map(toClient);
}

export async function getVisibleClient(
  id: string,
  viewer: SessionUser,
): Promise<Client | null> {
  const { where, params } = clientVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${CLIENT_COLUMNS} FROM clients
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}`,
    [...params, id],
  );
  return rows[0] ? toClient(rows[0]) : null;
}

/** How many productions sit under each visible client, for the list. */
export async function clientProductionCounts(
  viewer: SessionUser,
): Promise<Map<string, number>> {
  const { where, params } = clientVisibility(viewer, "c.");
  const rows = await query<{ id: string; productions: string }>(
    `SELECT c.id, count(s.id)::text AS productions
       FROM clients c
       LEFT JOIN sessions_casting s ON s.client_id = c.id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY c.id`,
    params,
  );
  return new Map(rows.map((row) => [row.id, Number(row.productions)]));
}

export type NewClient = { name: string; notes: string };

export async function createClient(
  input: NewClient,
  ownerId: string,
  company: string,
): Promise<Client> {
  const rows = await query<Row>(
    `INSERT INTO clients (id, name, notes, owner_id, company)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CLIENT_COLUMNS}`,
    [`cli_${crypto.randomUUID().slice(0, 12)}`, input.name, input.notes, ownerId, company],
  );
  return toClient(rows[0]);
}

export async function updateClient(
  id: string,
  input: NewClient,
  viewer: SessionUser,
): Promise<Client | null> {
  const { where, params } = clientVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE clients SET name = $${params.length + 2}, notes = $${params.length + 3}
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
      RETURNING ${CLIENT_COLUMNS}`,
    [...params, id, input.name, input.notes],
  );
  return rows[0] ? toClient(rows[0]) : null;
}

/**
 * Removes a client that has nothing under it.
 *
 * A client holding productions is refused rather than cascaded: deleting one
 * would take real casting work and its submissions with it, and the database
 * says no to that anyway. "in-use" is the answer the form turns into a
 * sentence telling the director what to move first.
 */
export async function deleteClient(
  id: string,
  viewer: SessionUser,
): Promise<"deleted" | "not-found" | "in-use"> {
  const { where, params } = clientVisibility(viewer);
  try {
    const rows = await query<{ id: string }>(
      `DELETE FROM clients
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
