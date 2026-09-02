import { NextResponse } from "next/server";

import { record } from "@/lib/activity";
import { currentUser } from "@/lib/auth";
import { exportFilename, submissionsWorkbook } from "@/lib/export";
import { getVisibleSession } from "@/lib/sessions";
import { listSessionSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/**
 * A casting call's submissions as a spreadsheet, for download. The same rule
 * as the casting call's page: an account that may not see the call gets a
 * 404, not a file and not a 403. The export is recorded in the trail, since a
 * file of applicants' details leaving the site is worth a line.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const { id } = await params;
  const session = await getVisibleSession(id, user);
  if (!session) return new NextResponse(null, { status: 404 });

  const submissions = await listSessionSubmissions(id);
  const file = await submissionsWorkbook(session, submissions);

  await record({
    action: "data.exported",
    actorId: user.id,
    actorName: user.name,
    ownerId: session.ownerId,
    company: session.company,
    detail: `${session.name} · ${submissions.length} ${submissions.length === 1 ? "submission" : "submissions"} downloaded`,
  });

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${exportFilename(session)}"`,
      "cache-control": "private, no-store",
    },
  });
}
