import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { query } from "./db";
import type { UserRole } from "./types";

const SESSION_COOKIE = "oc_session";
const SESSION_DAYS = 30;

/* -------------------------------------------------------------- sessions -- */

/**
 * Only a hash of the session token is stored. Someone who reads the database
 * still cannot present a working cookie.
 */
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenHash(token), userId, expiresAt.toISOString()],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  /** Null until the setup wizard has been finished. */
  onboardedAt: string | null;
};

/**
 * The one place that decides who is signed in. Memoised per render pass, so a
 * page and the components inside it share a single lookup.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Suspension is checked here too, not only at sign-in: a session created just
  // before an account was suspended must stop working immediately.
  const rows = await query<{
    id: string;
    name: string;
    email: string;
    company: string;
    role: UserRole;
    onboarded_at: Date | null;
  }>(
    `SELECT u.id, u.name, u.email, u.company, u.role, u.onboarded_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.suspended_at IS NULL`,
    [tokenHash(token)],
  );

  const row = rows[0];
  return row
    ? { ...row, onboardedAt: row.onboarded_at?.toISOString() ?? null }
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
