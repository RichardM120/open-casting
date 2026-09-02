import Link from "next/link";

import { Logo } from "./logo";

/**
 * Cream on charcoal, the palette's dark ground. The mark keeps its terracotta
 * tile here, as the logo book has it on charcoal; the focus ring is gold,
 * because terracotta would not show against this ground.
 */
const LINK =
  "rounded-sm transition-colors hover:text-white focus-visible:outline-accent";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-text text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-ink/85">
          <Logo tone="onLight" size="sm" />
          <span>
            Open Casting is the tool a casting call runs its casting with. The sample casting
            calls on it are invented.
          </span>
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {/*
            Temporary, while the wall is up and there is no mail provider to
            send an administrator their second factor. Both still go through
            the usual checks: the admin section refuses anyone who is not one.
            Remove these two when sign-in is doing the routing.
          */}
          <Link href="/admin" className={LINK}>
            Admin
          </Link>
          <Link href="/dashboard" className={LINK}>
            Casting director
          </Link>
          <Link href="/faq/applicants" className={LINK}>
            Applicant FAQ
          </Link>
          <Link href="/faq/casting-directors" className={LINK}>
            Casting FAQ
          </Link>
          <Link href="/legal/submission-terms" className={LINK}>
            Terms of Submission
          </Link>
          <Link href="/legal/agreement" className={LINK}>
            Agreement
          </Link>
        </div>
      </div>
    </footer>
  );
}
