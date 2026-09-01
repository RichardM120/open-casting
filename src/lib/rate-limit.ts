import "server-only";

import { headers } from "next/headers";

import { query } from "./db";

/**
 * Who a limit applies to. Behind a proxy the left-most `x-forwarded-for` entry
 * is the client; Vercel sets it. Falls back to a single shared bucket, which
 * throttles everyone together rather than nobody — the safe direction.
 */
export async function clientAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

export type Limit = { max: number; windowMinutes: number };

export const LIMITS = {
  /** Submissions from one address. Generous for a household, useless for a script. */
  submission: { max: 10, windowMinutes: 60 },
  /** New accounts from one address. */
  signup: { max: 5, windowMinutes: 60 },
} satisfies Record<string, Limit>;

/**
 * Records the attempt and says whether it is over the limit. Recording first
 * means a caller cannot benefit from racing: both of two simultaneous requests
 * are counted before either is judged.
 */
export async function overLimit(
  bucket: keyof typeof LIMITS,
  subject: string,
): Promise<boolean> {
  const { max, windowMinutes } = LIMITS[bucket];

  try {
    await query("INSERT INTO rate_limits (bucket, subject) VALUES ($1, $2)", [
      bucket,
      subject,
    ]);

    const rows = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM rate_limits
        WHERE bucket = $1 AND subject = $2
          AND at > now() - make_interval(mins => $3)`,
      [bucket, subject, windowMinutes],
    );

    // Opportunistic cleanup; the table is only ever a rolling window.
    await query("DELETE FROM rate_limits WHERE at < now() - interval '24 hours'");

    return Number(rows[0]?.count ?? 0) > max;
  } catch (error) {
    // A throttle that errors must not become a wall in front of the whole app.
    console.error("[rate-limit] check failed, allowing through", error);
    return false;
  }
}
