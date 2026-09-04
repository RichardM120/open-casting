import "server-only";

import type { SessionUser } from "./auth";
import { UNIQUE_VIOLATION, query } from "./db";
import { visibility } from "./roles";
import {
  ADULT_AGE,
  SUBMISSION_STATUSES,
  type Submission,
  type SubmissionStatus,
  type SubmissionVideo,
} from "./types";

export type SubmissionCounts = Record<SubmissionStatus, number> & { total: number };

function emptyCounts(): SubmissionCounts {
  const counts = { total: 0 } as SubmissionCounts;
  for (const status of SUBMISSION_STATUSES) counts[status] = 0;
  return counts;
}

/** Thrown when someone submits twice into the same production. */
export class DuplicateSubmissionError extends Error {
  constructor() {
    super("A submission from this email already exists for this casting call");
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
  height_cm: number | null;
  residency: string;
  available: boolean | null;
  reel_url: string;
  profile_url: string;
  cover_note: string;
  status: string;
  accepted_terms: string | null;
  accepted_at: Date | null;
  terms_version: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_consent_at: Date | null;
  photo_url: string | null;
  video_url: string | null;
  videos: unknown;
  media_flagged_at: Date | null;
  media_flag_reason: string;
  submitted_at: Date;
};

const COLUMNS = `
  id, role_id, session_id, name, email, phone, location, age, reel_url,
  profile_url, cover_note, status, accepted_terms, accepted_at, terms_version,
  guardian_name, guardian_email, guardian_consent_at, photo_url, video_url, videos,
  height_cm, residency, available, media_flagged_at, media_flag_reason, submitted_at
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
    heightCm: row.height_cm,
    residency: row.residency,
    available: row.available,
    reelUrl: row.reel_url,
    profileUrl: row.profile_url,
    coverNote: row.cover_note,
    status: row.status as SubmissionStatus,
    acceptedTerms: row.accepted_terms,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    termsVersion: row.terms_version,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    guardianConsentAt: row.guardian_consent_at?.toISOString() ?? null,
    photoUrl: row.photo_url,
    videoUrl: row.video_url,
    videos: readVideos(row.videos),
    mediaFlaggedAt: row.media_flagged_at?.toISOString() ?? null,
    mediaFlagReason: row.media_flag_reason ?? "",
    submittedAt: row.submitted_at.toISOString(),
  };
}

/** The stored videos, kept to the shape the app writes. */
function readVideos(value: unknown): SubmissionVideo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const video = item as Record<string, unknown>;
    if (typeof video.url !== "string" || !video.url) return [];
    return [{
      slot: typeof video.slot === "string" ? video.slot : "tape",
      url: video.url,
      name: typeof video.name === "string" ? video.name : "",
    }];
  });
}

/* --------------------------------------------------------------- queries -- */

/** How a list is narrowed and paged. Without a limit it is everything. */
export type SubmissionListOptions = {
  status?: SubmissionStatus | null;
  limit?: number;
  offset?: number;
};

/** The LIMIT and OFFSET a list asked for, placed after its own parameters. */
function pageClause(options: SubmissionListOptions, params: unknown[]): string {
  let clause = "";
  if (options.limit !== undefined) {
    params.push(options.limit);
    clause += ` LIMIT $${params.length}`;
  }
  if (options.offset) {
    params.push(options.offset);
    clause += ` OFFSET $${params.length}`;
  }
  return clause;
}

/** Sums a GROUP BY status result into one set of counts. */
function tally(rows: Array<{ status: string; count: string }>): SubmissionCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    const n = Number(row.count);
    counts[row.status as SubmissionStatus] += n;
    counts.total += n;
  }
  return counts;
}

export async function listSubmissions(
  roleId: string,
  options: Pick<SubmissionListOptions, "limit" | "offset"> = {},
): Promise<Submission[]> {
  const params: unknown[] = [roleId];
  const rows = await query<SubmissionRow>(
    `SELECT ${COLUMNS} FROM submissions WHERE role_id = $1
      ORDER BY submitted_at DESC, id${pageClause(options, params)}`,
    params,
  );
  return rows.map(toSubmission);
}

/** The counts for one role, without loading its submissions. */
export async function countsForRole(roleId: string): Promise<SubmissionCounts> {
  return tally(
    await query<{ status: string; count: string }>(
      "SELECT status, count(*)::text AS count FROM submissions WHERE role_id = $1 GROUP BY status",
      [roleId],
    ),
  );
}

/** The counts for one casting call, across its roles, without loading them. */
export async function countsForSession(sessionId: string): Promise<SubmissionCounts> {
  return tally(
    await query<{ status: string; count: string }>(
      "SELECT status, count(*)::text AS count FROM submissions WHERE session_id = $1 GROUP BY status",
      [sessionId],
    ),
  );
}

/** A submission with the role it was made for: one row of a casting call's list. */
export type SessionSubmission = Submission & { roleTitle: string };

/**
 * Every submission to a casting call, across all its roles, newest first. The
 * caller has already established it may see the casting call; that is the
 * same rule as seeing the submissions.
 */
export async function listSessionSubmissions(
  sessionId: string,
  options: SubmissionListOptions = {},
): Promise<SessionSubmission[]> {
  const params: unknown[] = [sessionId];
  let where = "s.session_id = $1";
  if (options.status) {
    params.push(options.status);
    where += ` AND s.status = $${params.length}`;
  }
  const rows = await query<SubmissionRow & { role_title: string }>(
    `SELECT s.*, r.title AS role_title
       FROM submissions s
       JOIN roles r ON r.id = s.role_id
      WHERE ${where}
      ORDER BY s.submitted_at DESC, s.id${pageClause(options, params)}`,
    params,
  );
  return rows.map((row) => ({ ...toSubmission(row), roleTitle: row.role_title }));
}

/** Counts keyed by casting call id, across whatever this account may see. */
export async function countsBySession(
  viewer: SessionUser,
): Promise<Map<string, SubmissionCounts>> {
  const { where, params } = visibility(viewer, { owner: "r.owner_id", company: "r.company" });
  const rows = await query<{ session_id: string; status: string; count: string }>(
    `SELECT s.session_id, s.status, count(*)::text AS count
       FROM submissions s
       JOIN roles r ON r.id = s.role_id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY s.session_id, s.status`,
    params,
  );

  const counts = new Map<string, SubmissionCounts>();
  for (const row of rows) {
    let entry = counts.get(row.session_id);
    if (!entry) {
      entry = emptyCounts();
      counts.set(row.session_id, entry);
    }
    const n = Number(row.count);
    entry[row.status as SubmissionStatus] += n;
    entry.total += n;
  }
  return counts;
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

export type NewSubmission = Omit<
  Submission,
  "id" | "status" | "submittedAt" | "mediaFlaggedAt" | "mediaFlagReason"
>;

/**
 * Throws `DuplicateSubmissionError` if this email has already submitted into
 * the same production: a production considers an applicant once, not once per
 * role. The unique index does the deciding, so two requests racing each other
 * cannot both get through.
 */
export async function createSubmission(input: NewSubmission): Promise<Submission> {
  try {
    const rows = await query<SubmissionRow>(
      `INSERT INTO submissions (
         id, role_id, session_id, name, email, phone, location, age, reel_url,
         profile_url, cover_note, accepted_terms, accepted_at, terms_version,
         guardian_name, guardian_email, guardian_consent_at, photo_url, video_url,
         height_cm, residency, available, videos
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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
        input.reelUrl,
        input.profileUrl,
        input.coverNote,
        input.acceptedTerms,
        input.acceptedAt,
        input.termsVersion,
        input.guardianName,
        input.guardianEmail,
        input.guardianConsentAt,
        input.photoUrl,
        input.videoUrl,
        input.heightCm,
        input.residency,
        input.available,
        JSON.stringify(input.videos),
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

/** The submission a stored file belongs to, for the route that reads it back. */
export async function findSubmissionByMediaUrl(url: string): Promise<Submission | null> {
  const rows = await query<SubmissionRow>(
    `SELECT ${COLUMNS} FROM submissions
     WHERE photo_url = $1 OR video_url = $1 OR videos @> $2::jsonb LIMIT 1`,
    [url, JSON.stringify([{ url }])],
  );
  return rows[0] ? toSubmission(rows[0]) : null;
}

type MediaRow = { photo_url: string | null; video_url: string | null; videos: unknown };

/** Every file a row refers to, the slot videos included, each once. */
function urlsOf(rows: MediaRow[]): string[] {
  const urls = new Set<string>();
  for (const row of rows) {
    if (row.photo_url) urls.add(row.photo_url);
    if (row.video_url) urls.add(row.video_url);
    for (const video of readVideos(row.videos)) urls.add(video.url);
  }
  return [...urls];
}

/** Every file under a casting call, so removing it can remove them too. */
export async function mediaUrlsForSession(sessionId: string): Promise<string[]> {
  const rows = await query<MediaRow>(
    "SELECT photo_url, video_url, videos FROM submissions WHERE session_id = $1",
    [sessionId],
  );
  return urlsOf(rows);
}

/** Every file any submission still refers to: what the orphan sweep must keep. */
export async function allMediaUrls(): Promise<string[]> {
  const rows = await query<MediaRow>(
    "SELECT photo_url, video_url, videos FROM submissions WHERE photo_url IS NOT NULL OR video_url IS NOT NULL OR videos <> '[]'::jsonb",
  );
  return urlsOf(rows);
}

/** Every file under a role, for the same reason. */
export async function mediaUrlsForRole(roleId: string): Promise<string[]> {
  const rows = await query<MediaRow>(
    "SELECT photo_url, video_url, videos FROM submissions WHERE role_id = $1",
    [roleId],
  );
  return urlsOf(rows);
}

/* ------------------------------------------------- admin: the whole feed -- */

/** One row of the administrator's feed: a submission with where it came from. */
export type FeedSubmission = Submission & {
  roleTitle: string;
  sessionName: string;
  company: string;
  clientId: string | null;
};

export type FeedFilter = {
  status?: SubmissionStatus | null;
  /** "flagged" for held media, "minors" for applicants under 18, "media" for anything with a file. */
  only?: "flagged" | "minors" | "media" | null;
  clientId?: string | null;
  sessionId?: string | null;
  limit?: number;
  offset?: number;
};

function feedWhere(filter: FeedFilter): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filter.clientId) {
    params.push(filter.clientId);
    conditions.push(`c.client_id = $${params.length}`);
  }
  if (filter.sessionId) {
    params.push(filter.sessionId);
    conditions.push(`s.session_id = $${params.length}`);
  }
  if (filter.only === "flagged") conditions.push("s.media_flagged_at IS NOT NULL");
  if (filter.only === "minors") conditions.push(`s.age < ${ADULT_AGE}`);
  if (filter.only === "media") {
    conditions.push("(s.photo_url IS NOT NULL OR s.video_url IS NOT NULL OR jsonb_array_length(s.videos) > 0)");
  }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

const FEED_SOURCE = `
  FROM submissions s
  JOIN roles r            ON r.id = s.role_id
  JOIN sessions_casting c ON c.id = s.session_id
`;

/**
 * Every submission on the site, newest first, whoever it was sent to. The
 * administrator's feed only: the pages that call this refuse anyone else
 * before they run, which is why there is no visibility clause here.
 */
export async function listAllSubmissions(filter: FeedFilter = {}): Promise<FeedSubmission[]> {
  const { where, params } = feedWhere(filter);
  let tail = "";
  if (filter.limit !== undefined) {
    params.push(filter.limit);
    tail += ` LIMIT $${params.length}`;
  }
  if (filter.offset) {
    params.push(filter.offset);
    tail += ` OFFSET $${params.length}`;
  }
  const rows = await query<
    SubmissionRow & {
      role_title: string;
      session_name: string;
      session_company: string;
      client_id: string | null;
    }
  >(
    `SELECT s.*, r.title AS role_title, c.name AS session_name,
            c.company AS session_company, c.client_id
       ${FEED_SOURCE}
       ${where}
      ORDER BY s.submitted_at DESC, s.id${tail}`,
    params,
  );
  return rows.map((row) => ({
    ...toSubmission(row),
    roleTitle: row.role_title,
    sessionName: row.session_name,
    company: row.session_company,
    clientId: row.client_id,
  }));
}

/** How the feed breaks down, for the filter bar and for paging it. */
export async function countAllSubmissions(
  filter: FeedFilter = {},
): Promise<{ total: number; flagged: number; minors: number; withMedia: number; byStatus: SubmissionCounts }> {
  const { where, params } = feedWhere({ ...filter, status: null, only: null });
  const [row] = await query<{
    total: string;
    flagged: string;
    minors: string;
    with_media: string;
  }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE s.media_flagged_at IS NOT NULL)::text AS flagged,
            count(*) FILTER (WHERE s.age < ${ADULT_AGE})::text AS minors,
            count(*) FILTER (WHERE s.photo_url IS NOT NULL OR s.video_url IS NOT NULL
                               OR jsonb_array_length(s.videos) > 0)::text AS with_media
       ${FEED_SOURCE}
       ${where}`,
    params,
  );
  const statusRows = await query<{ status: string; count: string }>(
    `SELECT s.status, count(*)::text AS count ${FEED_SOURCE} ${where} GROUP BY s.status`,
    params,
  );
  return {
    total: Number(row?.total ?? 0),
    flagged: Number(row?.flagged ?? 0),
    minors: Number(row?.minors ?? 0),
    withMedia: Number(row?.with_media ?? 0),
    byStatus: tally(statusRows),
  };
}

/**
 * Holds a submission's photo and tapes back from the casting team, or lets
 * them through again. The files are not moved: what changes is who may fetch
 * them, which /api/media decides on every request.
 */
export async function setMediaFlagged(
  id: string,
  flagged: boolean,
  by: { id: string; reason: string },
): Promise<Submission | null> {
  const rows = await query<SubmissionRow>(
    flagged
      ? `UPDATE submissions
            SET media_flagged_at = now(), media_flagged_by = $2, media_flag_reason = $3
          WHERE id = $1 RETURNING ${COLUMNS}`
      : `UPDATE submissions
            SET media_flagged_at = NULL, media_flagged_by = NULL, media_flag_reason = ''
          WHERE id = $1 RETURNING ${COLUMNS}`,
    flagged ? [id, by.id, by.reason.slice(0, 300)] : [id],
  );
  return rows[0] ? toSubmission(rows[0]) : null;
}

/** One submission, whoever it belongs to. Admin only; enforce upstream. */
export async function getSubmission(id: string): Promise<FeedSubmission | null> {
  const rows = await query<
    SubmissionRow & {
      role_title: string;
      session_name: string;
      session_company: string;
      client_id: string | null;
    }
  >(
    `SELECT s.*, r.title AS role_title, c.name AS session_name,
            c.company AS session_company, c.client_id
       ${FEED_SOURCE}
      WHERE s.id = $1`,
    [id],
  );
  const row = rows[0];
  return row
    ? {
        ...toSubmission(row),
        roleTitle: row.role_title,
        sessionName: row.session_name,
        company: row.session_company,
        clientId: row.client_id,
      }
    : null;
}
