import { NextResponse } from "next/server";

import { record } from "@/lib/activity";
import { currentUser } from "@/lib/auth";
import { exportFor } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/**
 * Everything held about one email address, as a JSON bundle, in answer to a
 * subject access request. Admin only, and a 404 rather than a 403 for anyone
 * else, as everywhere else here.
 *
 * Files are named in the bundle rather than packed into it: they are private
 * blobs, and handing over a link that works for anyone would be a worse
 * answer than sending them separately.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return new NextResponse(null, { status: 404 });

  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) return new NextResponse(null, { status: 404 });

  const bundle = await exportFor(email);
  await record({
    action: "data.exported",
    actorId: user.id,
    actorName: user.name,
    detail: `Subject access bundle for ${email}`,
  });

  const slug = email.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
