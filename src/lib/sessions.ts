import "server-only";

import type { SessionUser } from "./auth";
import { query, shareToken } from "./db";
import type { CastingSession, HeroKind, ProductionType } from "./types";

type Row = {
  id: string;
  slug: string;
  name: string;
  production_type: string;
  synopsis: string;
  owner_id: string | null;
  company: string;
  production_company: string;
  hero_url: string | null;
  hero_kind: string;
  inclusion_statement: string | null;
  agent_route: string;
  tape_guidance: string | null;
  opens_at: Date;
  closes_at: Date;
  closed_at: Date | null;
  published_at: Date | null;
  purged_at: Date | null;
  production_ends_at: string;
  public_token: string;
  submission_cap: number | null;
  created_at: Date;
};

/**
 * The production end is a date, rendered in SQL so the driver's timezone cannot
 * shift the day. The opening and closing moments are instants and come back as
 * such.
 */
export const SESSION_COLUMNS = `
  id, slug, name, production_type, synopsis, owner_id, company, production_company, hero_url,
  hero_kind, inclusion_statement, agent_route, tape_guidance, opens_at, closes_at,
  to_char(production_ends_at, 'YYYY-MM-DD') AS production_ends_at,
  closed_at, published_at, purged_at, public_token, submission_cap, created_at
`;

export function toSession(row: Row): CastingSession {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    productionType: row.production_type as ProductionType,
    synopsis: row.synopsis,
    ownerId: row.owner_id,
    company: row.company,
    productionCompany: row.production_company,
    submissionCap: row.submission_cap,
    heroUrl: row.hero_url,
    heroKind: row.hero_kind === "logo" ? "logo" : "banner",
    inclusionStatement: row.inclusion_statement,
    agentRoute: row.agent_route,
    tapeGuidance: row.tape_guidance,
    opensAt: row.opens_at.toISOString(),
    closesAt: row.closes_at.toISOString(),
    closedAt: row.closed_at?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
    purgedAt: row.purged_at?.toISOString() ?? null,
    productionEndsAt: row.production_ends_at,
    publicToken: row.public_token,
    createdAt: row.created_at.toISOString(),
  };
}

/** Live now: published, within the window, and not closed by hand. */
export const LIVE = `
  published_at IS NOT NULL
  AND closed_at IS NULL
  AND opens_at <= now()
  AND closes_at >= now()
`;

/**
 * The same rule as roles, applied to a production's own owner and company: a
 * director sees the productions they created, a producer every production
 * under their company, an admin all of them.
 */
export function sessionVisibility(
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

export async function listVisibleSessions(viewer: SessionUser): Promise<CastingSession[]> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting
      ${where ? `WHERE ${where}` : ""}
      ORDER BY (${LIVE}) DESC, published_at IS NULL DESC, closes_at ASC, created_at DESC`,
    params,
  );
  return rows.map(toSession);
}

export async function getVisibleSession(
  id: string,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}`,
    [...params, id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Any production, by id. For the dashboard side, which has already authorised. */
export async function getSession(id: string): Promise<CastingSession | null> {
  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * The readable half of a share link: `saltmarsh-e9e3qmqde8`.
 *
 * The slug is decoration. It makes the link say what it is on a poster or in a
 * caption, and only the suffix is looked up. So a link whose production has
 * since been renamed still works, and a guessed slug gets nobody anywhere.
 */
export function shareSlug(session: CastingSession): string {
  return session.slug ? `${session.slug}-${session.publicToken}` : session.publicToken;
}

/**
 * The one public entry point: a production, by its share link. Holding the
 * token is the authorisation. There is nothing else to check, and nothing else
 * in the app will hand an applicant one.
 */
export async function getSessionByToken(handle: string): Promise<CastingSession | null> {
  // Everything up to the last dash is the readable slug and is ignored.
  const token = handle.slice(handle.lastIndexOf("-") + 1).toLowerCase();

  // Shape-checked before the query, so an absurd URL is not a database round
  // trip and a token cannot be made into a wildcard. Older links carry the
  // longer base64url token, so both lengths are accepted.
  if (!/^[a-z0-9_-]{10,64}$/.test(token)) return null;

  const rows = await query<Row>(
    `SELECT ${SESSION_COLUMNS} FROM sessions_casting WHERE lower(public_token) = $1`,
    [token],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Roles and submissions per production, for the dashboard. */
export type SessionStats = { roles: number; submissions: number; unread: number };

export async function sessionStats(
  viewer: SessionUser,
): Promise<Map<string, SessionStats>> {
  const { where, params } = sessionVisibility(viewer, "s.");
  const rows = await query<{ id: string; roles: string; submissions: string; unread: string }>(
    `SELECT s.id,
            count(DISTINCT r.id)::text  AS roles,
            count(DISTINCT sub.id)::text AS submissions,
            count(DISTINCT sub.id) FILTER (WHERE sub.status = 'New')::text AS unread
       FROM sessions_casting s
       LEFT JOIN roles r         ON r.session_id = s.id
       LEFT JOIN submissions sub ON sub.role_id = r.id
      ${where ? `WHERE ${where}` : ""}
      GROUP BY s.id`,
    params,
  );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        roles: Number(row.roles),
        submissions: Number(row.submissions),
        unread: Number(row.unread),
      },
    ]),
  );
}

export type NewSession = {
  name: string;
  productionType: ProductionType;
  synopsis: string;
  /** Who is making it. Free text, and internal. */
  productionCompany: string;
  /** The image on the applicant's page, or null for none. */
  heroUrl: string | null;
  /** Shown as a banner across the top, or centred as a logo. Banner when unsaid. */
  heroKind?: HeroKind;
  /** The inclusive casting statement for applicants. Empty for none. */
  inclusionStatement: string;
  /** Where represented actors go instead of the form. Empty for no gate. */
  agentRoute: string;
  /** How to tape, shown beside the upload. Empty for none. */
  tapeGuidance: string;
  /** ISO timestamps: the moments submissions open and close. */
  opensAt: string;
  closesAt: string;
  /** When the production wraps, yyyy-mm-dd. The retention clock runs from here. */
  productionEndsAt: string;
};

/**
 * Opens a production.
 *
 * `company` is the client's name, taken from the signed-in account rather than
 * typed: it is what producer visibility matches on, so letting a form set it
 * would let one account post into another client's view of the dashboard.
 * `clientId` records the same thing by id, for the owner's usage figures.
 */
export async function createSession(
  input: NewSession,
  ownerId: string,
  company: string,
  clientId: string | null,
): Promise<CastingSession> {
  const rows = await query<Row>(
    `INSERT INTO sessions_casting
       (id, slug, name, production_type, synopsis, owner_id, company, opens_at,
        closes_at, production_ends_at, public_token, production_company, client_id, hero_url,
        hero_kind, inclusion_statement, agent_route, tape_guidance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${SESSION_COLUMNS}`,
    [
      `ses_${crypto.randomUUID().slice(0, 12)}`,
      slugify(input.name),
      input.name,
      input.productionType,
      input.synopsis,
      ownerId,
      company,
      input.opensAt,
      input.closesAt,
      input.productionEndsAt,
      shareToken(),
      input.productionCompany,
      clientId,
      input.heroUrl,
      input.heroKind ?? "banner",
      input.inclusionStatement,
      input.agentRoute,
      input.tapeGuidance,
    ],
  );
  return toSession(rows[0]);
}

export async function updateSession(
  id: string,
  input: NewSession,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE sessions_casting SET
       name = $${params.length + 2},
       slug = $${params.length + 3},
       production_type = $${params.length + 4},
       synopsis = $${params.length + 5},
       opens_at = $${params.length + 6},
       closes_at = $${params.length + 7},
       production_ends_at = $${params.length + 8},
       production_company = $${params.length + 9},
       hero_url = $${params.length + 10},
       hero_kind = $${params.length + 11},
       inclusion_statement = $${params.length + 12},
       agent_route = $${params.length + 13},
       tape_guidance = $${params.length + 14}
     WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
     RETURNING ${SESSION_COLUMNS}`,
    [
      ...params, id,
      input.name, slugify(input.name), input.productionType, input.synopsis,
      input.opensAt, input.closesAt, input.productionEndsAt, input.productionCompany,
      input.heroUrl, input.heroKind ?? "banner",
      input.inclusionStatement, input.agentRoute, input.tapeGuidance,
    ],
  );
  if (!rows[0]) return null;

  // The roles carry the production's name, type, synopsis and company so they
  // read as a whole on their own. Editing the production has to carry them
  // with it, or a role would contradict the production it sits in.
  await query(
    `UPDATE roles SET production = $2, production_type = $3, synopsis = $4, company = $5
      WHERE session_id = $1`,
    [id, input.name, input.productionType, input.synopsis, rows[0].company],
  );

  return toSession(rows[0]);
}

/**
 * Publishes a production: the moment its share link starts working.
 *
 * One way on purpose. Once the link has gone onto a post or into a mailout it
 * is out of anyone's hands, so un-publishing would only break it for people who
 * already have it. Closing early is the honest way to stop a call.
 */
export async function publishSession(
  id: string,
  viewer: SessionUser,
): Promise<CastingSession | null> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<Row>(
    `UPDATE sessions_casting SET published_at = now()
      WHERE id = $${params.length + 1} AND published_at IS NULL
        ${where ? `AND ${where}` : ""}
      RETURNING ${SESSION_COLUMNS}`,
    [...params, id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Closes a production ahead of its closing time, or puts it back. */
export async function setSessionClosed(
  id: string,
  closed: boolean,
  viewer: SessionUser,
): Promise<boolean> {
  const { where, params } = sessionVisibility(viewer);
  const rows = await query<{ id: string }>(
    `UPDATE sessions_casting SET closed_at = ${closed ? "now()" : "NULL"}
      WHERE id = $${params.length + 1}${where ? ` AND ${where}` : ""}
      RETURNING id`,
    [...params, id],
  );
  return rows.length > 0;
}

/** Removes a production, its roles and their submissions. Admin only. */
export async function deleteSessionAsAdmin(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "DELETE FROM sessions_casting WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Where a casting call is in its life, as one word for a filter and a badge. */
export type CallState = "draft" | "scheduled" | "open" | "full" | "closed" | "purged";

export function callState(
  session: Pick<CastingSession, "publishedAt" | "purgedAt" | "closedAt" | "opensAt" | "closesAt" | "submissionCap">,
  submissions: number,
): CallState {
  if (session.purgedAt) return "purged";
  if (session.publishedAt === null) return "draft";
  if (session.closedAt) return "closed";
  if (Date.parse(session.opensAt) > Date.now()) return "scheduled";
  if (Date.parse(session.closesAt) < Date.now()) return "closed";
  if (session.submissionCap !== null && submissions >= session.submissionCap) return "full";
  return "open";
}

/** One row of the administrator's list of every casting call on the site. */
export type AdminCall = CastingSession & {
  clientId: string | null;
  clientName: string | null;
  ownerName: string | null;
  roles: number;
  submissions: number;
  state: CallState;
};

export type CallFilter = {
  clientId?: string | null;
  state?: CallState | null;
  /** yyyy-mm-dd, matched against the closing time. */
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
};

/**
 * Every casting call on the site, whoever runs it, with its client, its
 * counts and where it is in its life. The administrator's view only: there is
 * no visibility clause here because the page that calls it is admin-only and
 * refuses anyone else before it runs.
 *
 * The state is worked out in SQL as well as in `callState`, because filtering
 * by it has to happen in the database, and paging a list filtered in the page
 * would page the wrong thing.
 */
const STATE_SQL = `
  CASE
    WHEN s.purged_at IS NOT NULL THEN 'purged'
    WHEN s.published_at IS NULL THEN 'draft'
    WHEN s.closed_at IS NOT NULL THEN 'closed'
    WHEN s.opens_at > now() THEN 'scheduled'
    WHEN s.closes_at < now() THEN 'closed'
    WHEN s.submission_cap IS NOT NULL AND subs.n >= s.submission_cap THEN 'full'
    ELSE 'open'
  END
`;

function callWhere(filter: CallFilter): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.clientId) {
    params.push(filter.clientId);
    conditions.push(`s.client_id = $${params.length}`);
  }
  if (filter.from) {
    params.push(filter.from);
    conditions.push(`s.closes_at >= $${params.length}::date`);
  }
  if (filter.to) {
    params.push(filter.to);
    conditions.push(`s.closes_at < $${params.length}::date + 1`);
  }
  if (filter.state) {
    params.push(filter.state);
    conditions.push(`${STATE_SQL} = $${params.length}`);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

/** SESSION_COLUMNS again, qualified: this query joins tables that share names. */
const PREFIXED_COLUMNS = `
  s.id, s.slug, s.name, s.production_type, s.synopsis, s.owner_id, s.company,
  s.production_company, s.hero_url, s.hero_kind, s.inclusion_statement,
  s.agent_route, s.tape_guidance, s.opens_at, s.closes_at,
  to_char(s.production_ends_at, 'YYYY-MM-DD') AS production_ends_at,
  s.closed_at, s.published_at, s.purged_at, s.public_token, s.submission_cap,
  s.created_at
`;

const CALL_SOURCE = `
  FROM sessions_casting s
  LEFT JOIN clients c ON c.id = s.client_id
  LEFT JOIN users u   ON u.id = s.owner_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS n FROM submissions sub WHERE sub.session_id = s.id
  ) subs ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS n FROM roles r WHERE r.session_id = s.id
  ) rls ON true
`;

export async function listAllCalls(filter: CallFilter = {}): Promise<AdminCall[]> {
  const { where, params } = callWhere(filter);
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
    Row & {
      client_id: string | null;
      client_name: string | null;
      owner_name: string | null;
      roles: number;
      submissions: number;
      state: CallState;
    }
  >(
    `SELECT ${PREFIXED_COLUMNS},
            s.client_id, c.name AS client_name, u.name AS owner_name,
            rls.n AS roles, subs.n AS submissions,
            ${STATE_SQL} AS state
       ${CALL_SOURCE}
       ${where}
      ORDER BY s.closes_at DESC, s.id${tail}`,
    params,
  );
  return rows.map((row) => ({
    ...toSession(row),
    clientId: row.client_id,
    clientName: row.client_name,
    ownerName: row.owner_name,
    roles: row.roles,
    submissions: row.submissions,
    state: row.state,
  }));
}

/** How many calls match, and how they break down by state, for the filter bar. */
export async function countAllCalls(
  filter: CallFilter = {},
): Promise<{ total: number; byState: Record<CallState, number> }> {
  const { where, params } = callWhere({ ...filter, state: null });
  const rows = await query<{ state: CallState; count: string }>(
    `SELECT ${STATE_SQL} AS state, count(*)::text AS count
       ${CALL_SOURCE}
       ${where}
      GROUP BY 1`,
    params,
  );
  const byState: Record<CallState, number> = {
    draft: 0,
    scheduled: 0,
    open: 0,
    full: 0,
    closed: 0,
    purged: 0,
  };
  let total = 0;
  for (const row of rows) {
    byState[row.state] = Number(row.count);
    total += Number(row.count);
  }
  return { total, byState };
}

/** Sets or clears the cap on a casting call, and its closing time with it. */
export async function setCallLimits(
  id: string,
  limits: { submissionCap: number | null; closesAt?: string },
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    limits.closesAt
      ? `UPDATE sessions_casting SET submission_cap = $2, closes_at = $3 WHERE id = $1 RETURNING id`
      : `UPDATE sessions_casting SET submission_cap = $2 WHERE id = $1 RETURNING id`,
    limits.closesAt ? [id, limits.submissionCap, limits.closesAt] : [id, limits.submissionCap],
  );
  return rows.length > 0;
}
