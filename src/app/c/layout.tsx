import type { ReactNode } from "react";

import { Logo } from "@/components/logo";

/**
 * The applicant's pages stand alone: no site navigation, no footer of links,
 * a warm cream ground with the copy in charcoal. Someone holding a share link has one casting call to
 * read and one form to fill in, and nowhere else on the site to be.
 */
export default function ApplicantLayout({ children }: { children: ReactNode }) {
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
      <p className="mx-auto flex w-full max-w-4xl items-center gap-2.5 px-4 py-8 text-sm text-text sm:px-6">
        <Logo tone="onLight" size="sm" />
        <span>
          Run with Open Casting. This page is the whole of the casting call; there is nothing else
          here to browse.
        </span>
      </p>
    </div>
  );
}
