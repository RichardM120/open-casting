import "server-only";

import { headers } from "next/headers";

import { DOCUMENTS, type LegalDocument } from "@/content/legal";
import { query } from "./db";

export type Acceptance = {
  document: string;
  version: string;
  acceptedAt: string;
  current: boolean;
};

/**
 * Records that an account accepted an agreement. Insert-only, and idempotent on
 * the same version — clicking twice is not two agreements.
 *
 * The IP is kept because an acceptance is evidence, and evidence with no
 * provenance is worth less. It is the same address the rate limiter already
 * sees, and it goes when the account does.
 */
export async function recordAcceptance(
  userId: string,
  document: LegalDocument,
): Promise<void> {
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || null;

  await query(
    `INSERT INTO agreement_acceptances (user_id, document, version, ip)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, document, version) DO NOTHING`,
    [userId, document.id, document.version, ip],
  );
}

/** Whether this account has accepted the current version of a document. */
export async function hasAccepted(
  userId: string,
  document: LegalDocument,
): Promise<boolean> {
  const rows = await query<{ one: number }>(
    `SELECT 1 AS one FROM agreement_acceptances
      WHERE user_id = $1 AND document = $2 AND version = $3`,
    [userId, document.id, document.version],
  );
  return rows.length > 0;
}

/** Everything this account has ever accepted, newest first. */
export async function listAcceptances(userId: string): Promise<Acceptance[]> {
  const rows = await query<{ document: string; version: string; accepted_at: Date }>(
    `SELECT document, version, accepted_at FROM agreement_acceptances
      WHERE user_id = $1 ORDER BY accepted_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    document: row.document,
    version: row.version,
    acceptedAt: row.accepted_at.toISOString(),
    current: DOCUMENTS[row.document as keyof typeof DOCUMENTS]?.version === row.version,
  }));
}
