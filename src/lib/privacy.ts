import "server-only";

import { query } from "./db";
import { deleteMedia } from "./blob";

/**
 * What somebody asked for about their own data, and what is actually held
 * about them.
 *
 * Under UK GDPR an applicant may ask what is held (a subject access request)
 * and may ask for it to go (erasure). Both arrive by email, since there is no
 * account to ask from, so they are logged here when they arrive: a request
 * nobody wrote down is a request nobody can show they answered.
 */

/** What the request was for. */
export const REQUEST_KINDS = {
  access: { label: "What is held about me", short: "Access" },
  erasure: { label: "Delete what is held about me", short: "Erasure" },
} as const;

export type RequestKind = keyof typeof REQUEST_KINDS;
export const REQUEST_KIND_KEYS = Object.keys(REQUEST_KINDS) as RequestKind[];

/** How long the law allows to answer one, from the day it arrives. */
export const RESPONSE_DAYS = 30;

export type AccessRequest = {
  id: string;
  email: string;
  kind: RequestKind;
  note: string;
  requestedAt: string;
  closedAt: string | null;
  /** Negative once the month is up. */
  daysLeft: number;
};

type Row = {
  id: string;
  email: string;
  kind: string;
  note: string;
  requested_at: Date;
  closed_at: Date | null;
};

function toRequest(row: Row): AccessRequest {
  const due = row.requested_at.getTime() + RESPONSE_DAYS * 86_400_000;
  return {
    id: row.id,
    email: row.email,
    kind: (row.kind as RequestKind) ?? "access",
    note: row.note,
    requestedAt: row.requested_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
    daysLeft: Math.ceil((due - Date.now()) / 86_400_000),
  };
}

export async function logRequest(input: {
  email: string;
  kind: RequestKind;
  note: string;
}): Promise<AccessRequest> {
  const rows = await query<Row>(
    `INSERT INTO access_requests (id, email, kind, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, kind, note, requested_at, closed_at`,
    [`req_${crypto.randomUUID().slice(0, 12)}`, input.email, input.kind, input.note],
  );
  return toRequest(rows[0]);
}

export async function listRequests({ open = true }: { open?: boolean } = {}): Promise<AccessRequest[]> {
  const rows = await query<Row>(
    `SELECT id, email, kind, note, requested_at, closed_at
       FROM access_requests
      ${open ? "WHERE closed_at IS NULL" : ""}
      ORDER BY requested_at DESC
      LIMIT 200`,
  );
  return rows.map(toRequest);
}

export async function closeRequest(id: string, by: string): Promise<AccessRequest | null> {
  const rows = await query<Row>(
    `UPDATE access_requests SET closed_at = now(), closed_by = $2
      WHERE id = $1 AND closed_at IS NULL
      RETURNING id, email, kind, note, requested_at, closed_at`,
    [id, by],
  );
  return rows[0] ? toRequest(rows[0]) : null;
}

/* ------------------------------------------------- what is held, by email -- */

/** One submission somebody made, as their own record of it reads. */
export type HeldSubmission = {
  id: string;
  sessionName: string;
  company: string;
  roleTitle: string;
  status: string;
  submittedAt: string;
  photo: boolean;
  videos: number;
  specialAnswer: boolean;
};

export type Held = {
  email: string;
  submissions: HeldSubmission[];
  /** Every file of theirs the store holds, for the export and for the delete. */
  media: string[];
};

/**
 * Everything held about one email address, across every casting call. Matched
 * case-insensitively, because an address typed into a form is not always typed
 * the same way twice.
 */
export async function heldFor(email: string): Promise<Held> {
  const rows = await query<{
    id: string;
    session_name: string;
    company: string;
    role_title: string;
    status: string;
    submitted_at: Date;
    photo_url: string | null;
    video_url: string | null;
    videos: unknown;
    special: boolean;
  }>(
    `SELECT s.id, c.name AS session_name, c.company, r.title AS role_title, s.status,
            s.submitted_at, s.photo_url, s.video_url, s.videos,
            EXISTS (SELECT 1 FROM special_answers a WHERE a.submission_id = s.id) AS special
       FROM submissions s
       JOIN roles r            ON r.id = s.role_id
       JOIN sessions_casting c ON c.id = s.session_id
      WHERE lower(s.email) = lower($1)
      ORDER BY s.submitted_at DESC`,
    [email],
  );

  const media: string[] = [];
  const submissions = rows.map((row) => {
    const videos = Array.isArray(row.videos) ? (row.videos as { url?: string }[]) : [];
    if (row.photo_url) media.push(row.photo_url);
    if (row.video_url) media.push(row.video_url);
    for (const video of videos) if (typeof video.url === "string") media.push(video.url);
    return {
      id: row.id,
      sessionName: row.session_name,
      company: row.company,
      roleTitle: row.role_title,
      status: row.status,
      submittedAt: row.submitted_at.toISOString(),
      photo: row.photo_url !== null,
      videos: videos.length + (row.video_url ? 1 : 0),
      specialAnswer: row.special,
    };
  });

  return { email, submissions, media };
}

/**
 * Everything held about one address, as the bundle handed over in answer to a
 * subject access request: every field of every submission they made, and the
 * answer to any question about a protected characteristic, which is held
 * apart from the rest and has to be included because it is theirs too.
 */
export async function exportFor(email: string): Promise<Record<string, unknown>> {
  const submissions = await query<Record<string, unknown>>(
    `SELECT s.*, r.title AS role_title, c.name AS casting_call, c.company
       FROM submissions s
       JOIN roles r            ON r.id = s.role_id
       JOIN sessions_casting c ON c.id = s.session_id
      WHERE lower(s.email) = lower($1)
      ORDER BY s.submitted_at DESC`,
    [email],
  );
  const answers = await query<Record<string, unknown>>(
    `SELECT a.* FROM special_answers a
       JOIN submissions s ON s.id = a.submission_id
      WHERE lower(s.email) = lower($1)`,
    [email],
  );
  return {
    about: email,
    generatedAt: new Date().toISOString(),
    note:
      "Everything Open Casting holds about this email address. Files are not in this bundle; " +
      "they are listed by name and are handed over separately.",
    submissions,
    answersAboutProtectedCharacteristics: answers,
  };
}

/**
 * Deletes everything held about one address: every submission they made,
 * across every casting call, with their files and any answer about a
 * protected characteristic, which goes with the submission by cascade.
 *
 * A real delete, not a flag. The casting team loses the submission too, which
 * is the point: an erasure that leaves a copy on somebody's dashboard is not
 * an erasure.
 */
export async function eraseFor(email: string): Promise<{ submissions: number; files: number }> {
  const held = await heldFor(email);
  if (held.submissions.length === 0) return { submissions: 0, files: 0 };

  await query("DELETE FROM submissions WHERE lower(email) = lower($1)", [email]);
  await deleteMedia(held.media);
  return { submissions: held.submissions.length, files: held.media.length };
}
