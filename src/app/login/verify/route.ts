import { sessionCookies } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { consumeChallenge } from "@/lib/mfa";
import { findAccount } from "@/lib/users";

export const dynamic = "force-dynamic";

const REASONS = {
  unknown: "That sign-in link is not one we issued. Ask for a new one.",
  expired: "That sign-in link has expired. Sign in again for a new one.",
  used: "That sign-in link has already been used. Sign in again for a new one.",
} as const;

/**
 * The second half of a sign-in: opening the emailed link is what starts the
 * session. A GET, because that is what opening a link is — safe only because
 * the token is one-time and short-lived, and spent inside a single UPDATE.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const result = await consumeChallenge(token);
  if (!result.ok) {
    return redirectTo(`/login?error=${encodeURIComponent(REASONS[result.reason])}`);
  }

  // Re-read the account: it could have been suspended or had its access ended
  // in the minutes between the password and the link.
  const user = await findAccount(result.userId);
  if (!user || user.suspended_at) {
    return redirectTo(
      `/login?error=${encodeURIComponent("That account is no longer active.")}`,
    );
  }
  if (user.access_until && user.access_until < new Date().toISOString().slice(0, 10)) {
    return redirectTo(
      `/login?error=${encodeURIComponent(`Access to this account ended on ${user.access_until}.`)}`,
    );
  }

  // Only same-site paths: `next` came out of the database, but it went in from
  // a form field, so it is not to be trusted with an origin.
  const next = /^\/(?!\/)/.test(result.next) ? result.next : "/dashboard";
  const response = redirectTo(next);

  for (const cookie of await sessionCookies(user.id, user.role)) {
    response.cookies.set(cookie);
  }
  return response;
}
