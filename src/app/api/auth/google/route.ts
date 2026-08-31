import { NextResponse } from "next/server";

import { beginGoogleSignIn, googleConfigured } from "@/lib/oauth";

/** Only same-site paths, so `?next=` cannot bounce anyone off to another host. */
function safeNext(value: string | null): string {
  return value && /^\/(?!\/)/.test(value) ? value : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google-unavailable", url.origin));
  }

  const destination = await beginGoogleSignIn(url, safeNext(url.searchParams.get("next")));
  return NextResponse.redirect(destination);
}
