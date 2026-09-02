import "server-only";

import { query } from "./db";
import type { Client, Tier } from "./types";

type Row = {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  billing_reference: string;
  address: string;
  notes: string;
  tier: string | null;
  max_sessions: number | null;
  max_roles_per_session: number | null;
  access_until: string | null;
  suspended_at: Date | null;
  created_at: Date;
};

/** access_until is rendered in SQL so the driver's timezone cannot shift the day. */
const CLIENT_COLUMNS = `
  id, name, contact_name, contact_email, contact_phone, billing_email,
  billing_reference, address, notes, tier, max_sessions, max_roles_per_session,
  to_char(access_until, 'YYYY-MM-DD') AS access_until,
  suspended_at, created_at
`;

function toClient(row: Row): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    billingEmail: row.billing_email,
    billingReference: row.billing_reference,
    address: row.address,
    notes: row.notes,
    tier: (row.tier as Tier | null) ?? null,
    maxSessions: row.max_sessions,
    maxRolesPerSession: row.max_roles_per_session,
    accessUntil: row.access_until,
    suspendedAt: row.suspended_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Every client. There is no visibility rule here because there is no audience
 * but the owner: the pages that call this are admin-only, and the proxy refuses
 * a director before the page runs.
 */
export async function listClients(): Promise<Client[]> {
  const rows = await query<Row>(
    `SELECT ${CLIENT_COLUMNS} FROM clients ORDER BY lower(name) ASC`,
  );
  return rows.map(toClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const rows = await query<Row>(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = $1`,
    [id],
  );
  return rows[0] ? toClient(rows[0]) : null;
}

/** What a client is actually using, against what they bought. */
export type ClientUsage = {
  accounts: number;
  productions: number;
  roles: number;
  submissions: number;
};

export async function clientUsage(): Promise<Map<string, ClientUsage>> {
  const rows = await query<{
    id: string;
    accounts: string;
    productions: string;
    roles: string;
    submissions: string;
  }>(
    `SELECT c.id,
            (SELECT count(*) FROM users u WHERE u.client_id = c.id)::text AS accounts,
            (SELECT count(*) FROM sessions_casting s WHERE s.client_id = c.id)::text
              AS productions,
            (SELECT count(*) FROM roles r
               JOIN sessions_casting s ON s.id = r.session_id
              WHERE s.client_id = c.id)::text AS roles,
            (SELECT count(*) FROM submissions sub
               JOIN sessions_casting s ON s.id = sub.session_id
              WHERE s.client_id = c.id)::text AS submissions
       FROM clients c`,
  );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        accounts: Number(row.accounts),
        productions: Number(row.productions),
        roles: Number(row.roles),
        submissions: Number(row.submissions),
      },
    ]),
  );
}

export type NewClient = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingEmail: string;
  billingReference: string;
  address: string;
  notes: string;
  tier: Tier | null;
  maxSessions: number | null;
  maxRolesPerSession: number | null;
  accessUntil: string | null;
};

const WRITABLE = `
  name = $2, contact_name = $3, contact_email = $4, contact_phone = $5,
  billing_email = $6, billing_reference = $7, address = $8, notes = $9,
  tier = $10, max_sessions = $11, max_roles_per_session = $12, access_until = $13
`;

function writableValues(input: NewClient): unknown[] {
  return [
    input.name, input.contactName, input.contactEmail, input.contactPhone,
    input.billingEmail, input.billingReference, input.address, input.notes,
    input.tier, input.maxSessions, input.maxRolesPerSession,
    input.accessUntil || null,
  ];
}

export async function createClient(input: NewClient): Promise<Client> {
  const rows = await query<Row>(
    `INSERT INTO clients
       (id, name, contact_name, contact_email, contact_phone, billing_email,
        billing_reference, address, notes, tier, max_sessions,
        max_roles_per_session, access_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${CLIENT_COLUMNS}`,
    [`cl_${crypto.randomUUID().slice(0, 12)}`, ...writableValues(input)],
  );
  return toClient(rows[0]);
}

export async function updateClient(
  id: string,
  input: NewClient,
): Promise<Client | null> {
  const rows = await query<Row>(
    `UPDATE clients SET ${WRITABLE} WHERE id = $1 RETURNING ${CLIENT_COLUMNS}`,
    [id, ...writableValues(input)],
  );
  return rows[0] ? toClient(rows[0]) : null;
}

/**
 * Stops or restarts a whole client. Every account under it is refused on the
 * next request, because the session lookup checks the client as well as the
 * account, so this does not wait for anyone to sign out.
 */
export async function setClientSuspended(
  id: string,
  suspended: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE clients SET suspended_at = ${suspended ? "now()" : "NULL"}
      WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

/**
 * Removes a client that has nothing under it. One with accounts or productions
 * is refused: deleting it would take real casting work and people's contact
 * details with it. Suspending is the reversible way to stop a customer.
 */
export async function deleteClient(
  id: string,
): Promise<"deleted" | "not-found" | "in-use"> {
  const [{ count }] = await query<{ count: string }>(
    `SELECT ((SELECT count(*) FROM users WHERE client_id = $1)
           + (SELECT count(*) FROM sessions_casting WHERE client_id = $1))::text
         AS count`,
    [id],
  );
  if (Number(count) > 0) return "in-use";

  const rows = await query<{ id: string }>(
    "DELETE FROM clients WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0 ? "deleted" : "not-found";
}
