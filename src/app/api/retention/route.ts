import { NextResponse } from "next/server";

import { sweepOrphanedMedia } from "@/lib/blob";
import { sendEmail } from "@/lib/email";
import { recordSweep } from "@/lib/monitoring";
import { claimPurgeWarnings, purgeExpiredSubmissions } from "@/lib/retention";
import { purgeSpecialAnswers } from "@/lib/special";
import { allMediaUrls } from "@/lib/submissions";

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

  const started = Date.now();
  // Warn before deleting, in that order: a production whose warning and purge
  // fall on the same sweep should still hear about it.
  const warnings = await claimPurgeWarnings();
  for (const warning of warnings) {
    await sendEmail({
      to: warning.email,
      subject:
        warning.days === 14
          ? `${warning.name}: applicant details are deleted in 14 days`
          : `${warning.name}: applicant details are deleted in 48 hours`,
      text: [
        `The casting data for ${warning.name} is scheduled for permanent deletion on ${warning.purgeOn}.`,
        "",
        `That is ${warning.submissions} ${warning.submissions === 1 ? "submission" : "submissions"}: names, contact details, notes and any links applicants gave you.`,
        "",
        "Export anything you still need before then. After the deletion the production and its roles remain, but the personal data is gone and cannot be recovered.",
      ].join("\n"),
    });
  }

  const purged = await purgeExpiredSubmissions();
  // Answers about a protected characteristic go sooner: their clock runs
  // from casting closing, not the production finishing.
  const specialAnswers = await purgeSpecialAnswers();

  // Files whose form never arrived. After the purge, so a file that belonged
  // to a submission just deleted is not held for another day by a stale list.
  const orphanedFiles = await sweepOrphanedMedia(await allMediaUrls());

  const ran = {
    warned: warnings.length,
    sessions: purged.length,
    submissions: purged.reduce((total, entry) => total + entry.submissions, 0),
    specialAnswers,
    orphanedFiles,
    ms: Date.now() - started,
  };
  // Recorded so the Storage page can say when this last ran. A sweep that
  // stopped being called looks exactly like a quiet week without it.
  await recordSweep(ran);

  return NextResponse.json(
    { ok: true, ...ran },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Vercel Cron issues GET; the work is the same. */
export const GET = POST;
