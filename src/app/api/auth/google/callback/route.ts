import { NextResponse } from "next/server";

import { startSession } from "@/lib/auth";
import {
  OAuthError,
  consumeHandshake,
  exchangeCode,
  fetchGoogleProfile,
} from "@/lib/oauth";
import { syncAdminRole, upsertGoogleUser } from "@/lib/users";

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
    const user = await syncAdminRole(await upsertGoogleUser(profile));
    await startSession(user.id);

    return NextResponse.redirect(new URL(next, url.origin));
  } catch (error) {
    if (error instanceof OAuthError) return backToLogin(url.origin, error.message);
    console.error("[oauth] google callback failed", error);
    return backToLogin(url.origin, "Google sign-in failed. Try again, or use a password.");
  }
}
