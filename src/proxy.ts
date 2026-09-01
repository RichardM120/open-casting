import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers, and a Content Security Policy with a per-request nonce.
 *
 * The nonce is what makes `script-src` strict: an injected script has no way to
 * guess it. Every page is dynamically rendered, which is what a fresh nonce per
 * request requires.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' is only for React's development error reconstruction.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    // next/font self-hosts Geist, so no external font origin is needed.
    "font-src 'self'",
    // The submission and role forms post to this origin only.
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Nothing here uses a camera, microphone or location.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // `.app` is HSTS-preloaded anyway; this states it for any other host.
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  return response;
}

export const config = {
  matcher: [
    {
      // robots.txt is text/plain with nothing to execute, and the browser's own
      // plain-text viewer styles it inline — so a policy there protects nothing
      // and reports a violation the page did not cause.
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
