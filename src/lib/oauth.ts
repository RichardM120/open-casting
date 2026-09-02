import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { gateEnabled } from "./gate";

/** Endpoints taken from Google's OpenID discovery document. */
const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_COOKIE = "oc_oauth_state";
const VERIFIER_COOKIE = "oc_oauth_verifier";
const NEXT_COOKIE = "oc_oauth_next";
const HANDSHAKE_MINUTES = 10;

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
};

export class OAuthError extends Error {}

/**
 * Google sign-in is optional; without credentials the button is not shown.
 *
 * It is also withdrawn entirely while the site is walled off. Google is the one
 * way in here that really does authenticate, and it refuses any address without
 * an account, so behind the wall it is a button that contradicts the sign-in
 * beside it and dead-ends whoever presses it. Both routes read this, so turning
 * it off here takes the button, `/api/auth/google` and the callback with it.
 */
export function googleConfigured(): boolean {
  if (gateEnabled()) return false;
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OAuthError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

/**
 * Must match a redirect URI registered on the Google client exactly. APP_URL
 * pins it; otherwise it follows the request, which is what makes preview
 * deployments work once their URL is registered too.
 */
export function redirectUri(requestUrl: URL): string {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return `${base || requestUrl.origin}/api/auth/google/callback`;
}

const HANDSHAKE_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: HANDSHAKE_MINUTES * 60,
};

/**
 * Starts the handshake. `state` defends against a forged callback, and the PKCE
 * verifier means an intercepted authorization code cannot be redeemed without
 * the secret this browser holds.
 */
export async function beginGoogleSignIn(requestUrl: URL, next: string): Promise<string> {
  const { clientId } = credentials();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const store = await cookies();
  store.set(STATE_COOKIE, state, HANDSHAKE_COOKIE);
  store.set(VERIFIER_COOKIE, verifier, HANDSHAKE_COOKIE);
  store.set(NEXT_COOKIE, next, HANDSHAKE_COOKIE);

  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Reads and clears the handshake cookies. They are good for one callback only. */
export async function consumeHandshake(state: string | null): Promise<{
  verifier: string;
  next: string;
}> {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  const next = store.get(NEXT_COOKIE)?.value ?? "/dashboard";

  store.delete(STATE_COOKIE);
  store.delete(VERIFIER_COOKIE);
  store.delete(NEXT_COOKIE);

  if (!state || !expectedState || !constantTimeEquals(state, expectedState)) {
    throw new OAuthError("The sign-in link has expired or did not come from us");
  }
  if (!verifier) throw new OAuthError("The sign-in link has expired");

  return { verifier, next };
}

export async function exchangeCode(
  code: string,
  verifier: string,
  requestUrl: URL,
): Promise<string> {
  const { clientId, clientSecret } = credentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(requestUrl),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OAuthError(`Google rejected the sign-in (${response.status})`);
  }

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new OAuthError("Google returned no access token");
  return token.access_token;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OAuthError(`Could not read the Google profile (${response.status})`);
  }

  const profile = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new OAuthError("Google returned an incomplete profile");
  }

  // Accounts are matched to existing ones by email. Trusting an address Google
  // has not verified would let anyone claim someone else's account.
  if (profile.email_verified !== true) {
    throw new OAuthError("That Google account has an unverified email address");
  }

  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name?.trim() || profile.email.split("@")[0],
  };
}
