import { sessionCookies } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { sendEmail } from "@/lib/email";
import { CHALLENGE_WINDOW_MINUTES, createChallenge, needsSecondFactor } from "@/lib/mfa";
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

    // Google can prove who someone is; it cannot grant them an account. Signing
    // in this way works only for an address the administrator has already set
    // up — otherwise any Google address in the world would be a way in.
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

    // Google proves the address, not the second factor. An account that needs
    // one needs it here too, or this button is simply the way around it.
    if (needsSecondFactor(user)) {
      const token = await createChallenge(user.id, destination);
      const delivery = await sendEmail({
        to: user.email,
        subject: "Your Open Casting sign-in link",
        text: [
          "Someone signed in to Open Casting with your Google account and needs to confirm it is you.",
          "",
          `Open this link to finish signing in. It works once, and expires in ${CHALLENGE_WINDOW_MINUTES} minutes:`,
          "",
          `${url.origin}/login/verify?token=${encodeURIComponent(token)}`,
        ].join("\n"),
      });

      if (!delivery.delivered) {
        return backToLogin(url.origin, `The sign-in link could not be sent — ${delivery.reason}.`);
      }
      return redirectTo(`/login/sent?to=${encodeURIComponent(user.email)}`);
    }

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
