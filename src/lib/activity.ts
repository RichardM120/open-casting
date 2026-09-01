import "server-only";

import type { SessionUser } from "./auth";
import { query } from "./db";
import { visibility } from "./roles";
import type { CastingSession, Role } from "./types";

/** Every kind of thing worth recording. */
export const ACTIONS = [
  "session.created",
  "session.edited",
  "session.closed",
  "session.reopened",
  "session.removed",
  "role.posted",
  "role.edited",
  "role.closed",
  "role.reopened",
  "role.removed",
  "submission.received",
  "submission.status",
  "account.suspended",
  "account.restored",
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
  detail?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO activity
         (action, actor_id, actor_name, role_id, role_title, owner_id, company, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.action,
        entry.actorId,
        entry.actorName,
        entry.role?.id ?? null,
        entry.role?.title ?? null,
        entry.ownerId ?? entry.role?.ownerId ?? null,
        entry.company ?? entry.role?.company ?? null,
        entry.detail ?? "",
      ],
    );
  } catch (error) {
    console.error("[activity] could not record", entry.action, error);
  }
}

/**
 * The trail this account may see, scoped by the same rule as the roles
 * themselves — against the owner and company copied onto each entry, so history
 * survives the role being removed. Account events carry neither, which is what
 * keeps them to admins.
 */
export async function listActivity(
  viewer: SessionUser,
  options: { roleId?: string; limit?: number } = {},
): Promise<ActivityEntry[]> {
  const { where, params } = visibility(viewer);
  const conditions = where ? [where] : [];

  if (options.roleId) {
    params.push(options.roleId);
    conditions.push(`role_id = $${params.length}`);
  }

  params.push(options.limit ?? 50);
  const rows = await query<ActivityRow>(
    `SELECT id, created_at, action, actor_name, role_id, role_title, detail
       FROM activity
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(toEntry);
}

/** Field-by-field diff, so "edited" says what actually changed. */
const TRACKED: { key: keyof Role; label: string }[] = [
  { key: "title", label: "role name" },
  { key: "production", label: "production" },
  { key: "productionType", label: "production type" },
  { key: "synopsis", label: "synopsis" },
  { key: "characterBrief", label: "character brief" },
  { key: "requirements", label: "requirements" },
  { key: "location", label: "location" },
  { key: "selfTape", label: "self-tape" },
  { key: "ageMin", label: "playing age" },
  { key: "ageMax", label: "playing age" },
  { key: "payType", label: "pay type" },
  { key: "rate", label: "rate" },
  { key: "unionStatus", label: "union status" },
  { key: "shootDates", label: "shoot dates" },
  { key: "castingDirector", label: "casting director" },
  { key: "company", label: "company" },
  { key: "disclaimer", label: "terms" },
];

export function describeChanges(before: Role, after: Role): string {
  return diff(before, after, TRACKED);
}

/** The session fields worth naming when one is edited. */
const TRACKED_SESSION: { key: keyof CastingSession; label: string }[] = [
  { key: "name", label: "production" },
  { key: "synopsis", label: "synopsis" },
  { key: "company", label: "company" },
  { key: "opensAt", label: "opening date" },
  { key: "closesAt", label: "closing date" },
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
    const same = Array.isArray(a) && Array.isArray(b)
      ? a.length === b.length && a.every((value, index) => value === b[index])
      : a === b;
    if (!same) changed.add(label);
  }

  const labels = [...changed];
  if (labels.length === 0) return "no changes";
  if (labels.length <= 3) return `changed ${labels.join(", ")}`;
  return `changed ${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`;
}
