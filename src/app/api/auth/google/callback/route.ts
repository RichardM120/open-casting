import { NextResponse } from "next/server";

import { startSession } from "@/lib/auth";
import {
  OAuthError,
  consumeHandshake,
  exchangeCode,
  fetchGoogleProfile,
} from "@/lib/oauth";
import { linkGoogleUser, syncAdminRole } from "@/lib/users";

function backToLogin(origin: string, message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, origin),
  );
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
    await startSession(user.id);

    // A Google account has no company name until setup asks for one.
    const destination = user.onboarded_at ? next : "/welcome";
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch (error) {
    if (error instanceof OAuthError) return backToLogin(url.origin, error.message);
    console.error("[oauth] google callback failed", error);
    return backToLogin(url.origin, "Google sign-in failed. Try again, or use a password.");
  }
}
