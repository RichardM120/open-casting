import "server-only";

import type { SessionUser } from "./auth";
import { UNIQUE_VIOLATION, query } from "./db";
import { visibility } from "./roles";
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

/** Thrown when someone submits twice into the same casting session. */
export class DuplicateSubmissionError extends Error {
  constructor() {
    super("A submission from this email already exists for this casting session");
    this.name = "DuplicateSubmissionError";
  }
}

/* ------------------------------------------------------------- row shape -- */

type SubmissionRow = {
  id: string;
  role_id: string;
  session_id: string;
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
  accepted_terms: string | null;
  accepted_at: Date | null;
  submitted_at: Date;
};

const COLUMNS = `
  id, role_id, session_id, name, email, phone, location, age, union_status,
  reel_url, profile_url, cover_note, status, accepted_terms, accepted_at, submitted_at
`;

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    roleId: row.role_id,
    sessionId: row.session_id,
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
    acceptedTerms: row.accepted_terms,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
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

/** Counts keyed by role id, across whatever this account may see. */
export async function countsByRole(viewer: SessionUser): Promise<Map<string, SubmissionCounts>> {
  const { where, params } = visibility(viewer, { owner: "r.owner_id", company: "r.company" });
  const rows = await query<{ role_id: string; status: string; count: string }>(
    `SELECT s.role_id, s.status, count(*)::text AS count
       FROM submissions s
       JOIN roles r ON r.id = s.role_id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY s.role_id, s.status`,
    params,
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
 * Throws `DuplicateSubmissionError` if this email has already submitted into
 * the same casting session — a production considers a performer once, not once
 * per role. The unique index does the deciding, so two requests racing each
 * other cannot both get through.
 */
export async function createSubmission(input: NewSubmission): Promise<Submission> {
  try {
    const rows = await query<SubmissionRow>(
      `INSERT INTO submissions (
         id, role_id, session_id, name, email, phone, location, age, union_status,
         reel_url, profile_url, cover_note, accepted_terms, accepted_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${COLUMNS}`,
      [
        `sub_${crypto.randomUUID().slice(0, 12)}`,
        input.roleId,
        input.sessionId,
        input.name,
        input.email,
        input.phone,
        input.location,
        input.age,
        input.unionStatus,
        input.reelUrl,
        input.profileUrl,
        input.coverNote,
        input.acceptedTerms,
        input.acceptedAt,
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

/**
 * Returns false when the submission does not exist, or hangs off a role this
 * account may not see. The permission check is part of the UPDATE rather than a
 * query beforehand, so there is no window between deciding and writing.
 */
export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  viewer: SessionUser,
): Promise<boolean> {
  const { where, params } = visibility(viewer);
  const rows = await query<{ id: string }>(
    `UPDATE submissions SET status = $${params.length + 2}
      WHERE id = $${params.length + 1}
        AND role_id IN (SELECT id FROM roles${where ? ` WHERE ${where}` : ""})
      RETURNING id`,
    [...params, id, status],
  );
  return rows.length > 0;
}

/** Enough about a submission to describe it in the activity trail. */
export async function submissionContext(id: string): Promise<{
  name: string;
  roleId: string;
  roleTitle: string;
  ownerId: string | null;
  company: string;
} | null> {
  const rows = await query<{
    name: string;
    role_id: string;
    role_title: string;
    owner_id: string | null;
    company: string;
  }>(
    `SELECT s.name, s.role_id, r.title AS role_title, r.owner_id, r.company
       FROM submissions s JOIN roles r ON r.id = s.role_id
      WHERE s.id = $1`,
    [id],
  );
  const row = rows[0];
  return row
    ? {
        name: row.name,
        roleId: row.role_id,
        roleTitle: row.role_title,
        ownerId: row.owner_id,
        company: row.company,
      }
    : null;
}
