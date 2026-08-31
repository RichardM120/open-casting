import "server-only";

import { UNIQUE_VIOLATION, query } from "./db";
import {
  SUBMISSION_STATUSES,
  type Submission,
  type SubmissionStatus,
  type UnionStatus,
} from "./types";

export type SubmissionCounts = Record<SubmissionStatus, number> & { total: number };

function emptyCounts(): SubmissionCounts {
  const counts = { total: 0 } as SubmissionCounts;
  for (const status of SUBMISSION_STATUSES) counts[status] = 0;
  return counts;
}

/** Thrown when someone submits twice for the same role. */
export class DuplicateSubmissionError extends Error {
  constructor() {
    super("A submission from this email already exists for this role");
    this.name = "DuplicateSubmissionError";
  }
}

/* ------------------------------------------------------------- row shape -- */

type SubmissionRow = {
  id: string;
  role_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  age: number;
  union_status: string;
  reel_url: string;
  profile_url: string;
  cover_note: string;
  status: string;
  submitted_at: Date;
};

const COLUMNS = `
  id, role_id, name, email, phone, location, age, union_status,
  reel_url, profile_url, cover_note, status, submitted_at
`;

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    roleId: row.role_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    age: row.age,
    unionStatus: row.union_status as Exclude<UnionStatus, "Either">,
    reelUrl: row.reel_url,
    profileUrl: row.profile_url,
    coverNote: row.cover_note,
    status: row.status as SubmissionStatus,
    submittedAt: row.submitted_at.toISOString(),
  };
}

/* --------------------------------------------------------------- queries -- */

export async function listSubmissions(roleId: string): Promise<Submission[]> {
  const rows = await query<SubmissionRow>(
    `SELECT ${COLUMNS} FROM submissions WHERE role_id = $1 ORDER BY submitted_at DESC`,
    [roleId],
  );
  return rows.map(toSubmission);
}

/** Counts keyed by role id, so the dashboard needs a single round trip. */
export async function countsByRole(): Promise<Map<string, SubmissionCounts>> {
  const rows = await query<{ role_id: string; status: string; count: string }>(
    "SELECT role_id, status, count(*)::text AS count FROM submissions GROUP BY role_id, status",
  );

  const counts = new Map<string, SubmissionCounts>();
  for (const row of rows) {
    let entry = counts.get(row.role_id);
    if (!entry) {
      entry = emptyCounts();
      counts.set(row.role_id, entry);
    }
    const n = Number(row.count);
    entry[row.status as SubmissionStatus] += n;
    entry.total += n;
  }
  return counts;
}

export async function countSubmissions(): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM submissions",
  );
  return Number(rows[0]?.count ?? 0);
}

export function summarise(submissions: Submission[]): SubmissionCounts {
  const counts = emptyCounts();
  for (const submission of submissions) {
    counts[submission.status] += 1;
    counts.total += 1;
  }
  return counts;
}

export type NewSubmission = Omit<Submission, "id" | "status" | "submittedAt">;

/**
 * Throws `DuplicateSubmissionError` if this email has already submitted for the
 * role. The unique index does the deciding, so two requests racing each other
 * cannot both get through.
 */
export async function createSubmission(input: NewSubmission): Promise<Submission> {
  try {
    const rows = await query<SubmissionRow>(
      `INSERT INTO submissions (
         id, role_id, name, email, phone, location, age, union_status,
         reel_url, profile_url, cover_note
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${COLUMNS}`,
      [
        `sub_${crypto.randomUUID().slice(0, 12)}`,
        input.roleId,
        input.name,
        input.email,
        input.phone,
        input.location,
        input.age,
        input.unionStatus,
        input.reelUrl,
        input.profileUrl,
        input.coverNote,
      ],
    );
    return toSubmission(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new DuplicateSubmissionError();
    }
    throw error;
  }
}

/** Returns false when the submission no longer exists. */
export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE submissions SET status = $2 WHERE id = $1 RETURNING id",
    [id, status],
  );
  return rows.length > 0;
}
