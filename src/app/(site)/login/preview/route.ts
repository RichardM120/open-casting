import { redirect } from "next/navigation";

import { startSession } from "@/lib/auth";
import { gateEnabled } from "@/lib/gate";
import { ensurePreviewAdmin } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * The walled-off footer's Admin: one click into the admin overview, as a
 * stand-in administrator with a made-up name, made on first use. Behind the
 * wall sign-in checks nothing anyway, so this is the same permission spelled
 * shorter. With the wall down it is the real sign-in, pointed at the admin
 * overview, and the stand-in's sessions stop working with the wall.
 */
export async function GET() {
  if (!gateEnabled()) redirect("/login?next=%2Fadmin");
  const admin = await ensurePreviewAdmin();
  await startSession(admin.id, "admin");
  redirect("/admin");
}
