import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { query } from "./db";
import type { User } from "./users";

/** Short: a link that opens a session should not be sitting in an inbox for long. */
const CHALLENGE_MINUTES = 15;

export const CHALLENGE_WINDOW_MINUTES = CHALLENGE_MINUTES;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Who needs a second factor. Admins always do, because that account can create
 * accounts, read every production and delete other people's data, so a stolen
 * password should not be enough. Anyone else only if it has been turned on for
 * them.
 */
export function needsSecondFactor(user: Pick<User, "role"> & { mfa_required?: boolean }): boolean {
  return user.role === "admin" || user.mfa_required === true;
}

/**
 * Issues a one-time sign-in link. Only its hash is stored, so reading the
 * database does not hand anybody a working link.
 */
export async function createChallenge(userId: string, next: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  // Any earlier challenge for this account is void: asking for a new link must
  // invalidate the old one, or a forwarded email stays usable.
  await query("DELETE FROM login_challenges WHERE user_id = $1", [userId]);

  await query(
    `INSERT INTO login_challenges (token_hash, user_id, next, expires_at)
     VALUES ($1, $2, $3, now() + interval '${CHALLENGE_MINUTES} minutes')`,
    [hash(token), userId, next],
  );

  return token;
}

export type ChallengeResult =
  | { ok: true; userId: string; next: string }
  | { ok: false; reason: "unknown" | "expired" | "used" };

/**
 * Spends a sign-in link. One use only, and the row is marked inside the same
 * UPDATE that reads it, so two clicks racing each other cannot both win.
 */
export async function consumeChallenge(token: string): Promise<ChallengeResult> {
  const rows = await query<{ user_id: string; next: string; expired: boolean; already: boolean }>(
    `UPDATE login_challenges
        SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id, next, false AS expired, false AS already`,
    [hash(token)],
  );

  if (rows[0]) return { ok: true, userId: rows[0].user_id, next: rows[0].next };

  // Nothing was updated. Say which of the three it was, because "that link did
  // not work" sends someone hunting for a problem they may not have.
  const existing = await query<{ used_at: Date | null; expires_at: Date }>(
    "SELECT used_at, expires_at FROM login_challenges WHERE token_hash = $1",
    [hash(token)],
  );
  const row = existing[0];
  if (!row) return { ok: false, reason: "unknown" };
  if (row.used_at) return { ok: false, reason: "used" };
  return { ok: false, reason: "expired" };
}

/** Housekeeping, run alongside the session prune. */
export async function pruneExpiredChallenges(): Promise<void> {
  await query("DELETE FROM login_challenges WHERE expires_at <= now() - interval '1 day'");
}
