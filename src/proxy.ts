import { NextResponse, type NextRequest } from "next/server";

import { GATE_COOKIE, gateEnabled, gateExempt } from "@/lib/gate";
import { verifyContext, verifyValue } from "@/lib/token";

/**
 * What each area needs. The proxy can only turn requests away — it cannot let
 * anyone in, because the page and the action behind it check the database
 * again regardless. See `src/lib/token.ts` for why that division exists.
 */
const GUARDED: { prefix: string; role?: "admin" }[] = [
  { prefix: "/dashboard/accounts", role: "admin" },
  { prefix: "/dashboard" },
];

/**
 * Security headers, and a Content Security Policy with a per-request nonce.
 *
 * The nonce is what makes `script-src` strict: an injected script has no way to
 * guess it. Every page is dynamically rendered, which is what a fresh nonce per
 * request requires.
 */
export async function proxy(request: NextRequest) {
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

  const path = request.nextUrl.pathname;

  // The walled garden comes before everything, casting links included: the
  // point of it is that this deployment serves the public nothing at all.
  if (gateEnabled() && !gateExempt(path)) {
    const secret = process.env.AUTH_SECRET?.trim();
    const through =
      secret && (await verifyValue(request.cookies.get(GATE_COOKIE)?.value, secret)) === "open";

    if (!through) {
      const gate = new URL("/gate", request.url);
      gate.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(gate);
    }
  }

  const guard = GUARDED.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`));

  if (guard) {
    const secret = process.env.AUTH_SECRET?.trim();

    // No key means no way to check the signature. Fail closed: sending someone
    // to sign in is recoverable, waving them through is not.
    const context = secret
      ? await verifyContext(request.cookies.get("oc_ctx")?.value, secret)
      : null;

    if (!context) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(login);
    }

    // A role this area does not admit is a 404, the same answer the page gives,
    // so the proxy does not become a way to enumerate what exists.
    if (guard.role && context.role !== guard.role) {
      return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
    }
  }

  const response = NextResponse.next({ request: { headers } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  // On every response, not only pages that remember to set it in metadata.
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
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
