import "server-only";

import { UNIQUE_VIOLATION, query } from "./db";
import { hashPassword } from "./password";
import type { SignupRole, UserRole } from "./types";

export type User = {
  id: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  suspended_at: Date | null;
  onboarded_at: Date | null;
};

type UserRow = User & { password_hash: string | null };

const COLUMNS = "id, email, name, company, role, suspended_at, onboarded_at";

/** Thrown when an email is already registered. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "EmailTakenError";
  }
}

/* ----------------------------------------------------------- admin grant -- */

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().has(email.trim().toLowerCase());
}

/** Admin is never self-selected at sign-up; the env allowlist is the only source. */
export function roleForEmail(email: string, requested: SignupRole): UserRole {
  return isAdminEmail(email) ? "admin" : requested;
}

/**
 * Keeps admin in step with the allowlist on every sign-in: added to it and you
 * are promoted, removed from it and you drop back to director. Producers and
 * directors are left alone.
 */
export async function syncAdminRole(user: User): Promise<User> {
  const shouldBeAdmin = isAdminEmail(user.email);
  if (shouldBeAdmin === (user.role === "admin")) return user;

  const next: UserRole = shouldBeAdmin ? "admin" : "director";
  await query("UPDATE users SET role = $2 WHERE id = $1", [user.id, next]);
  return { ...user, role: next };
}

/* --------------------------------------------------------------- queries -- */

export async function createUser(input: {
  name: string;
  email: string;
  company: string;
  password: string;
  role: SignupRole;
}): Promise<User> {
  const passwordHash = await hashPassword(input.password);

  try {
    const rows = await query<User>(
      `INSERT INTO users (id, email, name, company, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [
        `usr_${crypto.randomUUID().slice(0, 12)}`,
        input.email,
        input.name,
        input.company,
        passwordHash,
        roleForEmail(input.email, input.role),
      ],
    );
    return rows[0];
  } catch (error) {
    // The unique index on lower(email) decides, so two simultaneous sign-ups
    // with the same address cannot both succeed.
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new EmailTakenError();
    throw error;
  }
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    `SELECT ${COLUMNS}, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserByGoogleSub(sub: string): Promise<User | null> {
  const rows = await query<User>(`SELECT ${COLUMNS} FROM users WHERE google_sub = $1`, [sub]);
  return rows[0] ?? null;
}

/**
 * Links a Google identity to the account with the same email, or creates one.
 *
 * Linking on a matching email is only safe because Google tells us whether it
 * verified the address; the caller must refuse an unverified one.
 */
export async function upsertGoogleUser(profile: {
  sub: string;
  email: string;
  name: string;
}): Promise<User> {
  const linked = await findUserByGoogleSub(profile.sub);
  if (linked) return linked;

  const existing = await findUserByEmail(profile.email);
  if (existing) {
    const rows = await query<User>(
      `UPDATE users SET google_sub = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
      [existing.id, profile.sub],
    );
    return rows[0];
  }

  const rows = await query<User>(
    `INSERT INTO users (id, email, name, company, role, google_sub)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      `usr_${crypto.randomUUID().slice(0, 12)}`,
      profile.email,
      profile.name,
      // Company is asked for at sign-up; a Google-first account fills it in later.
      profile.name,
      roleForEmail(profile.email, "director"),
      profile.sub,
    ],
  );
  return rows[0];
}

/* --------------------------------------------------------- login throttle -- */

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;

export const THROTTLE_WINDOW_MINUTES = WINDOW_MINUTES;

export async function recentFailures(email: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM login_attempts
      WHERE lower(email) = lower($1)
        AND attempted_at > now() - interval '${WINDOW_MINUTES} minutes'`,
    [email],
  );
  return Number(rows[0]?.count ?? 0);
}

export function isThrottled(failures: number): boolean {
  return failures >= MAX_FAILURES;
}

export async function recordFailedLogin(email: string): Promise<void> {
  await query("INSERT INTO login_attempts (email) VALUES ($1)", [email]);
}

export async function clearFailedLogins(email: string): Promise<void> {
  await query("DELETE FROM login_attempts WHERE lower(email) = lower($1)", [email]);
}

/* ------------------------------------------------------- account admin -- */

export type Account = User & { roles: number; submissions: number };

/** Every account, with how much each has posted. Admin only — enforce upstream. */
export async function listAccounts(): Promise<Account[]> {
  return query<Account>(
    `SELECT u.id, u.email, u.name, u.company, u.role, u.suspended_at,
            count(DISTINCT r.id)::int AS roles,
            count(s.id)::int          AS submissions
       FROM users u
       LEFT JOIN roles r       ON r.owner_id = u.id
       LEFT JOIN submissions s ON s.role_id = r.id
      GROUP BY u.id
      ORDER BY u.suspended_at IS NULL DESC, lower(u.company), lower(u.name)`,
  );
}

/**
 * Suspends or restores an account. Suspending also drops its sessions, so
 * somebody already signed in is out immediately rather than at expiry.
 */
export async function setAccountSuspended(id: string, suspended: boolean): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users SET suspended_at = ${suspended ? "now()" : "NULL"}
      WHERE id = $1 RETURNING id`,
    [id],
  );
  if (suspended && rows.length > 0) {
    await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  }
  return rows.length > 0;
}

/** One account, for naming it in the activity trail. */
export async function findAccount(id: string): Promise<User | null> {
  const rows = await query<User>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/* ---------------------------------------------------------------- profile -- */

/** What someone can change about themselves. Role and email are not on the list. */
export async function updateProfile(
  id: string,
  input: { name: string; company: string },
): Promise<void> {
  await query("UPDATE users SET name = $2, company = $3 WHERE id = $1", [
    id,
    input.name,
    input.company,
  ]);
}

export async function markOnboarded(id: string): Promise<void> {
  await query("UPDATE users SET onboarded_at = now() WHERE onboarded_at IS NULL AND id = $1", [id]);
}
