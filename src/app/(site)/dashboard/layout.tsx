import { redirect } from "next/navigation";

import { MSA } from "@/content/legal";
import { hasAccepted } from "@/lib/agreements";
import { requireUser } from "@/lib/auth";

/**
 * The agreement gate. Setup asks for it, but setup can be navigated past, and
 * an agreement that is only enforced by the path someone happened to take is
 * not enforced. Every dashboard page goes through here.
 *
 * The administrator operates the service rather than buying it, so there is
 * nothing for them to accept.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");

  if (user.role !== "admin" && !(await hasAccepted(user.id, MSA))) {
    redirect("/welcome");
  }

  return children;
}
