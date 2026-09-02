import Link from "next/link";

import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5">
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
          <Link href="/admin" className="transition-colors hover:text-text">
            Admin
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-text">
            Casting director
          </Link>
          <Link href="/faq/applicants" className="transition-colors hover:text-text">
            Applicant FAQ
          </Link>
          <Link href="/faq/casting-directors" className="transition-colors hover:text-text">
            Casting FAQ
          </Link>
          <Link href="/legal/submission-terms" className="transition-colors hover:text-text">
            Terms of Submission
          </Link>
          <Link href="/legal/agreement" className="transition-colors hover:text-text">
            Agreement
          </Link>
        </div>
      </div>
    </footer>
  );
}
