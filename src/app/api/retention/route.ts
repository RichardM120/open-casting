import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { claimPurgeWarnings, purgeExpiredSubmissions } from "@/lib/retention";

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

  // Warn before deleting, in that order: a production whose warning and purge
  // fall on the same sweep should still hear about it.
  const warnings = await claimPurgeWarnings();
  for (const warning of warnings) {
    await sendEmail({
      to: warning.email,
      subject:
        warning.days === 14
          ? `${warning.name}: performer details are deleted in 14 days`
          : `${warning.name}: performer details are deleted in 48 hours`,
      text: [
        `The casting data for ${warning.name} is scheduled for permanent deletion on ${warning.purgeOn}.`,
        "",
        `That is ${warning.submissions} ${warning.submissions === 1 ? "submission" : "submissions"} — names, contact details, notes and any links performers gave you.`,
        "",
        "Export anything you still need before then. After the deletion the production and its roles remain, but the personal data is gone and cannot be recovered.",
      ].join("\n"),
    });
  }

  const purged = await purgeExpiredSubmissions();
  return NextResponse.json(
    {
      ok: true,
      warned: warnings.length,
      sessions: purged.length,
      submissions: purged.reduce((total, entry) => total + entry.submissions, 0),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Vercel Cron issues GET; the work is the same. */
export const GET = POST;
