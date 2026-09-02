import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";

/**
 * The owner's section. The proxy turns a director away before this runs; this
 * checks again because the proxy can only refuse, never admit, and a page that
 * trusts it would be one misconfigured matcher away from being open.
 *
 * A 404 rather than a 403: whether this deployment has an admin area at all is
 * not something a director needs confirmed.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser("/admin");
  if (user.role !== "admin") notFound();

  return children;
}
