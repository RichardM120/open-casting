import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { storeAuth, uploadsEnabled } from "@/lib/blob";
import { getVisibleRole } from "@/lib/roles";
import { findSubmissionByMediaUrl } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/**
 * The one way an applicant's photo or video is read back. Blobs are private,
 * so the store will not serve them to a browser; this route fetches one and
 * streams it, after checking that whoever is asking may see the submission it
 * belongs to. The same rule as the role page: a director sees their own, a
 * producer their client's, an admin any.
 *
 * A file that is not one of ours, or one the viewer may not see, is a 404,
 * not a 403: which files exist is not something to confirm.
 *
 * A Range header is passed through, so a video player can seek rather than
 * having to play a tape from the start. When the store answers with a part,
 * the part is what the browser gets.
 */
export async function GET(request: Request) {
  if (!uploadsEnabled()) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url).searchParams.get("u");
  if (!url) return new NextResponse(null, { status: 404 });

  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 404 });

  const submission = await findSubmissionByMediaUrl(url);
  if (!submission) return new NextResponse(null, { status: 404 });
  if (!(await getVisibleRole(submission.roleId, user))) {
    return new NextResponse(null, { status: 404 });
  }

  const range = request.headers.get("range");
  const file = await get(url, {
    ...storeAuth(),
    access: "private",
    headers: range ? { range } : undefined,
  });
  if (!file || !file.stream) return new NextResponse(null, { status: 404 });

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range"]) {
    const value = file.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept-ranges", "bytes");
  // Personal data: never cached anywhere shared, and never framed elsewhere.
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");

  const status = file.headers.get("content-range") ? 206 : 200;
  return new NextResponse(file.stream, { status, headers });
}
