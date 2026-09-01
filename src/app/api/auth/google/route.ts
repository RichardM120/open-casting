import { NextResponse } from "next/server";

import { redirectTo } from "@/lib/redirect";
import { beginGoogleSignIn, googleConfigured } from "@/lib/oauth";

/** Only same-site paths, so `?next=` cannot bounce anyone off to another host. */
function safeNext(value: string | null): string {
  return value && /^\/(?!\/)/.test(value) ? value : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Relative, like every other redirect back into the app: `url.origin` here is
  // the server's internal address, which behind a proxy is a different origin
  // from the one the browser is on. Google's own URL below stays absolute
  // because it genuinely is somewhere else.
  if (!googleConfigured()) {
    return redirectTo("/login?error=google-unavailable");
  }

  const destination = await beginGoogleSignIn(url, safeNext(url.searchParams.get("next")));
  return NextResponse.redirect(destination);
}
