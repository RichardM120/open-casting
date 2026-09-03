import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { currentUser } from "@/lib/auth";

/** Everything but the applicant's pages: the header, the page, the footer. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  return (
    <>
      {/* Lets a keyboard past the header, which otherwise has to be tabbed
          through on every page. Visible only once focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SiteHeader user={user} />
      <main id="main" className="flex-1">
        {children}
      </main>
      {/* Signed in, a phone has a tab bar along the bottom; the footer keeps clear of it. */}
      <SiteFooter padForTabs={user !== null} />
    </>
  );
}
