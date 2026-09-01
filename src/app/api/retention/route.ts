import { NextResponse } from "next/server";

import { purgeExpiredSubmissions } from "@/lib/retention";

export const dynamic = "force-dynamic";

/**
 * The scheduled retention sweep. Vercel Cron calls this daily (see vercel.json)
 * with `CRON_SECRET` in the Authorization header.
 *
 * Guarded because it deletes: anyone able to call it could not read anything,
 * but they could destroy a casting director's shortlist ahead of time. Without
 * a secret configured it refuses rather than running open, since an unguarded
 * delete endpoint is worse than a sweep that has not been set up.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const purged = await purgeExpiredSubmissions();
  return NextResponse.json(
    {
      ok: true,
      sessions: purged.length,
      submissions: purged.reduce((total, entry) => total + entry.submissions, 0),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Vercel Cron issues GET; the work is the same. */
export const GET = POST;
