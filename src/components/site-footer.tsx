import Link from "next/link";

import { Logo } from "./logo";

/**
 * Cream on charcoal, the palette's dark ground, with the links in columns a
 * reader can scan and the legal line last. The mark keeps its terracotta tile
 * here, as the logo book has it on charcoal; the focus ring is gold, because
 * terracotta would not show against this ground.
 */
const LINK =
  "inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-accent";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Casting",
    links: [
      // Temporary, while the wall is up and there is no mail provider to send
      // an administrator their second factor. Both still go through the usual
      // checks: the admin section refuses anyone who is not one. Remove these
      // two when sign-in is doing the routing.
      { href: "/dashboard", label: "Casting director" },
      { href: "/admin", label: "Admin" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/faq/applicants", label: "Applicant FAQ" },
      { href: "/faq/casting-directors", label: "Casting FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/submission-terms", label: "Terms of Submission" },
      { href: "/legal/agreement", label: "Agreement" },
    ],
  },
];

export function SiteFooter({ padForTabs = false }: { padForTabs?: boolean }) {
  return (
    <footer className="mt-24 bg-text text-ink">
      <div
        className={`mx-auto max-w-6xl px-4 py-10 text-sm sm:px-6 sm:py-12 ${padForTabs ? "pb-24 sm:pb-12" : ""}`}
      >
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <p className="flex max-w-sm items-start gap-3 text-ink/85">
            <Logo tone="onLight" size="sm" />
            <span>
              Open Casting is the tool a casting call runs its casting with. The sample casting
              calls on it are invented.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold tracking-[0.18em] text-ink/60 uppercase">
                  {column.title}
                </p>
                <ul className="mt-2 flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-8 border-t border-ink/15 pt-6 text-xs text-ink/60">
          &copy; {new Date().getFullYear()} CW Casting Limited. Open Casting is a CW Casting
          Limited service.
        </p>
      </div>
    </footer>
  );
}
