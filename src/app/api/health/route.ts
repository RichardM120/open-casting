import { NextResponse } from "next/server";

import { databaseStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Says whether the deployment can reach its database, and nothing else.
 *
 * A misconfigured database turns every page into an opaque 500, and a hosted
 * platform's error page tells you only that one happened. This answers the one
 * question worth asking first, without needing the runtime logs. It reports the
 * *name* of the environment variable in use, never its value, and no data.
 */
export async function GET() {
  const status = await databaseStatus();
  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
