import "server-only";

import { headers } from "next/headers";

import type { SessionUser } from "./auth";
import { query } from "./db";
import { visibility } from "./roles";
import type { CastingSession, Role } from "./types";

/** Every kind of thing worth recording. */
/**
 * Where the request came from, for the audit trail. Behind a proxy the
 * left-most `x-forwarded-for` entry is the client, which is what Vercel sets.
 * Never throws into the caller: a trail that can fail a submission would be
 * worse than a trail with a gap in it.
 */
async function actorAddress(): Promise<string | null> {
  try {
    const list = await headers();
    return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export const ACTIONS = [
  "session.created",
  "session.published",
  "session.edited",
  "session.closed",
  "session.reopened",
  "session.removed",
  "client.created",
  "client.edited",
  "client.suspended",
  "client.restored",
  "client.removed",
  "role.posted",
  "role.edited",
  "role.closed",
  "role.reopened",
  "role.removed",
  "submission.received",
  "submission.guardian_confirmed",
  "submission.status",
  "submission.removed",
  "media.flagged",
  "media.cleared",
  "media.viewed",
  "account.created",
  "account.limits",
  "account.suspended",
  "account.restored",
  "data.purged",
  "data.exported",
  "data.requested",
  "template.edited",
] as const;
export type Action = (typeof ACTIONS)[number];

export type ActivityEntry = {
  id: string;
  createdAt: string;
  action: Action;
  actorName: string;
  roleId: string | null;
  roleTitle: string | null;
  detail: string;
};

type ActivityRow = {
  id: string;
  created_at: Date;
  action: string;
  actor_name: string;
  role_id: string | null;
  role_title: string | null;
  detail: string;
};

function toEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    action: row.action as Action,
    actorName: row.actor_name,
    roleId: row.role_id,
    roleTitle: row.role_title,
    detail: row.detail,
  };
}

/**
 * Writes one entry. Never throws into the caller: an audit trail that can fail
 * a submission is worse than a gap in the trail, so a write that fails is
 * logged and swallowed.
 */
export async function record(entry: {
  action: Action;
  actorId: string | null;
  actorName: string;
  role?: Pick<Role, "id" | "title"> & { ownerId?: string | null; company?: string };
  ownerId?: string | null;
  company?: string | null;
  /** What was acted on, when it is not a role: a submission, a client, an account. */
  subjectId?: string | null;
  detail?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO activity
         (action, actor_id, actor_name, role_id, role_title, owner_id, company,
          subject_id, actor_ip, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.action,
        entry.actorId,
        entry.actorName,
        entry.role?.id ?? null,
        entry.role?.title ?? null,
        entry.ownerId ?? entry.role?.ownerId ?? null,
        entry.company ?? entry.role?.company ?? null,
        entry.subjectId ?? null,
        await actorAddress(),
        entry.detail ?? "",
      ],
    );
  } catch (error) {
    console.error("[activity] could not record", entry.action, error);
  }
}

/**
 * The trail this account may see, scoped by the same rule as the roles
 * themselves, against the owner and company copied onto each entry, so history
 * survives the role being removed. Account events carry neither, which is what
 * keeps them to admins.
 */
export async function listActivity(
  viewer: SessionUser,
  options: { roleId?: string; limit?: number; offset?: number } = {},
): Promise<ActivityEntry[]> {
  const { where, params } = visibility(viewer);
  const conditions = where ? [where] : [];

  if (options.roleId) {
    params.push(options.roleId);
    conditions.push(`role_id = $${params.length}`);
  }

  params.push(options.limit ?? 50);
  let tail = ` LIMIT $${params.length}`;
  if (options.offset) {
    params.push(options.offset);
    tail += ` OFFSET $${params.length}`;
  }
  const rows = await query<ActivityRow>(
    `SELECT id, created_at, action, actor_name, role_id, role_title, detail
       FROM activity
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC${tail}`,
    params,
  );
  return rows.map(toEntry);
}

/**
 * How many entries this account may see, for paging the trail without
 * loading it. The same visibility rule as the list itself.
 */
export async function countActivity(
  viewer: SessionUser,
  options: { roleId?: string } = {},
): Promise<number> {
  const { where, params } = visibility(viewer);
  const conditions = where ? [where] : [];
  if (options.roleId) {
    params.push(options.roleId);
    conditions.push(`role_id = $${params.length}`);
  }
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM activity
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}`,
    params,
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Field-by-field diff, so "edited" says what actually changed. Only the role's
 * own fields: the production's details are edited on the production, and that
 * is recorded against it.
 */
const TRACKED: { key: keyof Role; label: string }[] = [
  { key: "requiredFields", label: "what applicants must send" },
  { key: "hiddenFields", label: "what applicants are asked for" },
  { key: "paid", label: "whether it is paid" },
  { key: "mediaSlots", label: "the videos asked for" },
  { key: "specialQuestion", label: "the question about a protected characteristic" },
  { key: "title", label: "role name" },
  { key: "characterBrief", label: "character brief" },
  { key: "requirements", label: "requirements" },
  { key: "location", label: "location" },
  { key: "selfTape", label: "self-tape" },
  { key: "ageMin", label: "playing age" },
  { key: "ageMax", label: "playing age" },
  { key: "shootStartsAt", label: "shoot dates" },
  { key: "shootEndsAt", label: "shoot dates" },
  { key: "disclaimer", label: "terms" },
];

export function describeChanges(before: Role, after: Role): string {
  return diff(before, after, TRACKED);
}

/** The production's fields worth naming when one is edited. */
const TRACKED_SESSION: { key: keyof CastingSession; label: string }[] = [
  { key: "name", label: "production name" },
  { key: "productionType", label: "production type" },
  { key: "synopsis", label: "synopsis" },
  { key: "company", label: "company" },
  { key: "opensAt", label: "opening time" },
  { key: "closesAt", label: "closing time" },
  { key: "productionEndsAt", label: "production end" },
  { key: "inclusionStatement", label: "inclusive casting statement" },
  { key: "agentRoute", label: "the route for represented actors" },
  { key: "tapeGuidance", label: "the self-tape guidance" },
];

export function describeSessionChanges(
  before: CastingSession,
  after: CastingSession,
): string {
  return diff(before, after, TRACKED_SESSION);
}

function diff<T>(before: T, after: T, tracked: { key: keyof T; label: string }[]): string {
  const changed = new Set<string>();

  for (const { key, label } of tracked) {
    const a: unknown = before[key];
    const b: unknown = after[key];
    const same =
      (Array.isArray(a) && Array.isArray(b)) || (a && b && typeof a === "object" && typeof b === "object")
        ? JSON.stringify(a) === JSON.stringify(b)
        : a === b;
    if (!same) changed.add(label);
  }

  const labels = [...changed];
  if (labels.length === 0) return "no changes";
  if (labels.length <= 3) return `changed ${labels.join(", ")}`;
  return `changed ${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`;
}

/**
 * Notes that somebody watched an applicant's tape, once a day per person per
 * file. Every frame the player asks for would otherwise be a line, and a trail
 * nobody can read is not a record of anything.
 */
export async function noteMediaView(view: {
  user: SessionUser;
  submissionId: string;
  name: string;
  url: string;
}): Promise<void> {
  try {
    const [seen] = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM activity
        WHERE action = 'media.viewed' AND actor_id = $1 AND subject_id = $2
          AND detail = $3 AND created_at > now() - interval '1 day'`,
      [view.user.id, view.submissionId, view.url],
    );
    if (Number(seen?.n ?? 0) > 0) return;
  } catch {
    // A trail that cannot check itself still records; a duplicate line is
    // better than a missing one.
  }

  await record({
    action: "media.viewed",
    actorId: view.user.id,
    actorName: view.user.name,
    subjectId: view.submissionId,
    detail: view.url,
  });
}

/* ----------------------------------------------------------- audit trail -- */

/** One line of the audit log: everything recorded about one action. */
export type AuditEntry = ActivityEntry & {
  actorId: string | null;
  actorEmail: string | null;
  actorIp: string | null;
  subjectId: string | null;
  company: string | null;
};

export type AuditFilter = {
  action?: Action | null;
  /** An email, an id, or any words to look for in what was recorded. */
  search?: string | null;
  limit?: number;
  offset?: number;
};

function auditWhere(filter: AuditFilter): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.action) {
    params.push(filter.action);
    conditions.push(`a.action = $${params.length}`);
  }
  const search = filter.search?.trim();
  if (search) {
    params.push(search);
    params.push(`%${search}%`);
    // An email finds the account that did it; anything else is matched against
    // the ids and the words, so one box answers "who" and "what" alike.
    conditions.push(
      `(lower(u.email) = lower($${params.length - 1})
        OR a.actor_id = $${params.length - 1}
        OR a.subject_id = $${params.length - 1}
        OR a.role_id = $${params.length - 1}
        OR a.actor_ip = $${params.length - 1}
        OR a.actor_name ILIKE $${params.length}
        OR a.detail ILIKE $${params.length}
        OR a.role_title ILIKE $${params.length})`,
    );
  }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

/**
 * The whole trail, for the administrator, with the actor's address and the
 * thing acted on. No visibility clause: the page that calls this refuses
 * anyone but an administrator before it runs.
 */
export async function listAudit(filter: AuditFilter = {}): Promise<AuditEntry[]> {
  const { where, params } = auditWhere(filter);
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
    ActivityRow & {
      actor_id: string | null;
      actor_email: string | null;
      actor_ip: string | null;
      subject_id: string | null;
      company: string | null;
    }
  >(
    `SELECT a.id, a.created_at, a.action, a.actor_name, a.role_id, a.role_title, a.detail,
            a.actor_id, u.email AS actor_email, a.actor_ip, a.subject_id, a.company
       FROM activity a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}
      ORDER BY a.created_at DESC, a.id DESC${tail}`,
    params,
  );
  return rows.map((row) => ({
    ...toEntry(row),
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorIp: row.actor_ip,
    subjectId: row.subject_id,
    company: row.company,
  }));
}

export async function countAudit(filter: AuditFilter = {}): Promise<number> {
  const { where, params } = auditWhere(filter);
  const [row] = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM activity a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}`,
    params,
  );
  return Number(row?.count ?? 0);
}
