import "server-only";

import { read, write } from "./store";
import { SUBMISSION_STATUSES, type Submission, type SubmissionStatus } from "./types";

export type SubmissionCounts = Record<SubmissionStatus, number> & { total: number };

function emptyCounts(): SubmissionCounts {
  const counts = { total: 0 } as SubmissionCounts;
  for (const status of SUBMISSION_STATUSES) counts[status] = 0;
  return counts;
}

function newestFirst(a: Submission, b: Submission): number {
  return a.submittedAt < b.submittedAt ? 1 : -1;
}

export function listSubmissions(roleId: string): Promise<Submission[]> {
  return read((db) =>
    db.submissions.filter((entry) => entry.roleId === roleId).sort(newestFirst),
  );
}

/** Counts keyed by role id, so the dashboard needs a single pass over the data. */
export function countsByRole(): Promise<Map<string, SubmissionCounts>> {
  return read((db) => {
    const counts = new Map<string, SubmissionCounts>();
    for (const submission of db.submissions) {
      let entry = counts.get(submission.roleId);
      if (!entry) {
        entry = emptyCounts();
        counts.set(submission.roleId, entry);
      }
      entry[submission.status] += 1;
      entry.total += 1;
    }
    return counts;
  });
}

export function countSubmissions(): Promise<number> {
  return read((db) => db.submissions.length);
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

export async function createSubmission(input: NewSubmission): Promise<Submission> {
  return write((db) => {
    const submission: Submission = {
      ...input,
      id: `sub_${crypto.randomUUID().slice(0, 12)}`,
      status: "New",
      submittedAt: new Date().toISOString(),
    };
    db.submissions.push(submission);
    return submission;
  });
}

/** Returns false when the submission no longer exists. */
export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
): Promise<boolean> {
  return write((db) => {
    const submission = db.submissions.find((entry) => entry.id === id);
    if (!submission) return false;
    submission.status = status;
    return true;
  });
}

/** True when this email has already submitted for the role. */
export function hasSubmitted(roleId: string, email: string): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  return read((db) =>
    db.submissions.some(
      (entry) => entry.roleId === roleId && entry.email.toLowerCase() === normalised,
    ),
  );
}
