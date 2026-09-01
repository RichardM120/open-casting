import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { query } from "./db";
import { signContext } from "./token";
import type { UserRole } from "./types";

export const SESSION_COOKIE = "oc_session";
/**
 * The signed context the proxy reads. It sits alongside the session cookie and
 * says who this is and what role they hold, so the edge can turn away an
 * obviously-wrong request without a database it cannot reach.
 */
export const CONTEXT_COOKIE = "oc_ctx";
const SESSION_DAYS = 30;

/**
 * The key the context cookie is signed with. Deliberately fails loudly rather
 * than falling back to a default: a predictable signing key would let anyone
 * mint a cookie claiming to be an admin, and the proxy would believe it.
 */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return secret;
}

/* -------------------------------------------------------------- sessions -- */

/**
 * Only a hash of the session token is stored. Someone who reads the database
 * still cannot present a working cookie.
 */
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionCookie = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  expires: Date;
};

/**
 * Records a session and returns the cookies that carry it.
 *
 * Returned rather than set, because where they are set differs: a Server Action
 * writes through `cookies()`, while a Route Handler must put them on the
 * `NextResponse` it returns — cookies set through `cookies()` there do not
 * reach the browser, which is a silent failure rather than an error.
 */
export async function sessionCookies(
  userId: string,
  role: UserRole,
): Promise<SessionCookie[]> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenHash(token), userId, expiresAt.toISOString()],
  );

  const shared = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/" as const,
    expires: expiresAt,
  };

  return [
    { name: SESSION_COOKIE, value: token, ...shared },
    {
      name: CONTEXT_COOKIE,
      value: await signContext(
        { sub: userId, role, exp: Math.floor(expiresAt.getTime() / 1000) },
        authSecret(),
      ),
      ...shared,
    },
  ];
}

/** Starts a session from a Server Action, where `cookies()` is writable. */
export async function startSession(userId: string, role: UserRole): Promise<void> {
  const store = await cookies();
  for (const cookie of await sessionCookies(userId, role)) {
    store.set(cookie.name, cookie.value, cookie);
  }
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }
  store.delete(SESSION_COOKIE);
  store.delete(CONTEXT_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  /** Null until the setup wizard has been finished. */
  onboardedAt: string | null;
  /** What the administrator sold this account. Null means no ceiling. */
  maxSessions: number | null;
  maxRolesPerSession: number | null;
};

/**
 * The one place that decides who is signed in. Memoised per render pass, so a
 * page and the components inside it share a single lookup.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Suspension and the end of the arrangement are checked here, not only at
  // sign-in: a session created just before either must stop working at once.
  const rows = await query<{
    id: string;
    name: string;
    email: string;
    company: string;
    role: UserRole;
    onboarded_at: Date | null;
    max_sessions: number | null;
    max_roles_per_session: number | null;
  }>(
    `SELECT u.id, u.name, u.email, u.company, u.role, u.onboarded_at,
            u.max_sessions, u.max_roles_per_session
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.suspended_at IS NULL
        AND (u.access_until IS NULL OR u.access_until >= (now() AT TIME ZONE 'utc')::date)`,
    [tokenHash(token)],
  );

  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        company: row.company,
        role: row.role,
        onboardedAt: row.onboarded_at?.toISOString() ?? null,
        maxSessions: row.max_sessions,
        maxRolesPerSession: row.max_roles_per_session,
      }
    : null;
});

/** Clears sessions that have already lapsed. Called after a successful sign-in. */
export async function pruneExpiredSessions(): Promise<void> {
  await query("DELETE FROM sessions WHERE expires_at <= now()");
}

/**
 * The gate every protected page and action goes through. Redirects to sign-in,
 * carrying where the person was headed so they land there afterwards.
 *
 * It lives here rather than beside the sign-in actions: a "use server" module
 * publishes every export as an endpoint the browser can call, and this is not
 * something the browser should be able to invoke.
 */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
