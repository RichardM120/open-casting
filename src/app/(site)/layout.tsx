import type { ReactNode } from "react";

import { SectionShell } from "@/components/section-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { adminAlerts } from "@/lib/admin-alerts";
import { currentUser } from "@/lib/auth";

/**
 * Everything but the applicant's pages: the header, the page, the footer, in
 * the palette of whichever section the reader is in.
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  // What is waiting behind the administrator's groups, for the dots on the
  // bar. Only for an administrator, and only counts — a director has no admin
  // section for it to describe, and there is one administrator, not a crowd.
  const alerts = user?.role === "admin" ? await adminAlerts(user) : null;

  return (
    <SectionShell>
      {/* Lets a keyboard past the header, which otherwise has to be tabbed
          through on every page. Visible only once focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SiteHeader
        user={user}
        alerts={alerts ? Object.fromEntries(alerts.groups) : null}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      {/* Signed in, a phone has a tab bar along the bottom; the footer keeps clear of it. */}
      <SiteFooter user={user} padForTabs={user !== null} />
    </SectionShell>
  );
}
