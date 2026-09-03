import type { ReactNode } from "react";

import Link from "next/link";

import { reportAddress } from "@/lib/site";

/**
 * The applicant's pages stand alone: no site navigation, no footer of links,
 * a warm cream ground with the copy in charcoal. Someone holding a share link has one casting call to
 * read and one form to fill in, and nowhere else on the site to be.
 */
export default function ApplicantLayout({ children }: { children: ReactNode }) {
  const reportTo = reportAddress();
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
      >
        Skip to content
      </a>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-4xl px-4 py-8 text-sm sm:px-6">
        {/*
          Open calls draw imitators that charge a fee, and the people they
          catch are the unrepresented ones this page is for. So every casting
          page says, in the same place, that this is free and the only way in.
        */}
        <p className="max-w-prose font-medium leading-relaxed text-text">
          Free to apply. Nobody is ever charged to submit through Open Casting, and this page is
          the only place to apply for this casting call.
        </p>
        <p className="mt-1 max-w-prose leading-relaxed text-muted">
          If you find this call somewhere else, or anyone asks you for a fee to apply, it is not
          approved
          {reportTo ? (
            <>
              : report it to{" "}
              <a href={`mailto:${reportTo}`} className="text-brand underline-offset-4 hover:underline">
                {reportTo}
              </a>
              .
            </>
          ) : (
            "."
          )}
        </p>
        <p className="mt-6 font-semibold tracking-[0.08em] text-text uppercase">Open Casting</p>
        <p className="mt-2 max-w-prose leading-relaxed text-muted">
          Every submission made through this page is covered by UK GDPR and by the{" "}
          <Link
            href="/legal/submission-terms"
            className="text-brand underline-offset-4 hover:underline"
          >
            Terms of Submission
          </Link>
          , the legal terms and conditions that apply to it.
        </p>
      </footer>
    </div>
  );
}
