import { sessionCookies } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import {
  OAuthError,
  consumeHandshake,
  exchangeCode,
  fetchGoogleProfile,
} from "@/lib/oauth";
import { linkGoogleUser, syncAdminRole } from "@/lib/users";

function backToLogin(_origin: string, message: string) {
  return redirectTo(`/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Google reports a refusal here rather than by failing the redirect.
  const denied = url.searchParams.get("error");
  if (denied) {
    return backToLogin(url.origin, "Google sign-in was cancelled");
  }

  try {
    // Always consumes the handshake cookies, so a replayed callback fails.
    const { verifier, next } = await consumeHandshake(url.searchParams.get("state"));

    const code = url.searchParams.get("code");
    if (!code) throw new OAuthError("Google did not return an authorization code");

    const profile = await fetchGoogleProfile(await exchangeCode(code, verifier, url));

    // Google proves who someone is; it does not hand out accounts. This links to
    // an account that already exists, or creates one only for an address named
    // in ADMIN_EMAILS — which the operator of the deployment has already
    // authorised. Any other Google address is refused.
    const linked = await linkGoogleUser(profile);
    if (!linked) {
      return backToLogin(
        url.origin,
        "There is no account for that Google address. Accounts are created by the administrator.",
      );
    }

    const user = await syncAdminRole(linked);
    if (user.suspended_at) {
      return backToLogin(url.origin, "This account has been suspended.");
    }

    // A Google account has no company name until setup asks for one.
    const destination = user.onboarded_at ? next : "/welcome";

    // No emailed link on this path, and the reason is worth stating: the link
    // would go to the same mailbox that just authenticated. Whoever holds the
    // Google account holds the inbox, so sending one adds friction and no
    // security — it is only a second factor when it reaches somewhere the first
    // factor does not. Password sign-in still requires it, because a password
    // and a mailbox are genuinely two different things.
    //
    // What this does rely on is Google having verified the address, which
    // `fetchGoogleProfile` refuses to proceed without.

    const response = redirectTo(destination);
    for (const cookie of await sessionCookies(user.id, user.role)) {
      response.cookies.set(cookie);
    }
    return response;
  } catch (error) {
    if (error instanceof OAuthError) return backToLogin(url.origin, error.message);
    console.error("[oauth] google callback failed", error);
    return backToLogin(url.origin, "Google sign-in failed. Try again, or use a password.");
  }
}
