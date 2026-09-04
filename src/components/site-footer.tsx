import Link from "next/link";

import { companyDetails, reportAddress } from "@/lib/site";
import type { SessionUser } from "@/lib/auth";

import { Logo } from "./logo";

/**
 * Cream on charcoal, the palette's dark ground, with the links in columns a
 * reader can scan and the legal line last. The mark keeps its terracotta tile
 * here, as the logo book has it on charcoal; the focus ring is gold, because
 * terracotta would not show against this ground.
 *
 * The footer shows the way on from wherever the reader is. Signed out that is
 * the way in, the casting team's and the administrator's; signed in it is the
 * work, and the admin's section as well when they have one. It never offers a
 * link that would turn them away at the door: a director sees no Admin.
 */
const LINK =
  "inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-accent";

type Column = { title: string; links: { href: string; label: string }[] };

/** The columns for whoever is reading: the casting side first, then help, then legal. */
function columnsFor(user: SessionUser | null): Column[] {
  const casting: Column = user
    ? {
        title: "Your casting",
        links: [
          { href: "/dashboard", label: "Casting calls" },
          { href: "/dashboard/sessions/new", label: "New casting call" },
          { href: "/dashboard/activity", label: "Activity" },
          ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
        ],
      }
    : {
        title: "Casting",
        links: [
          { href: "/login", label: "Sign in" },
          { href: "/faq/casting-directors", label: "How it works" },
          // The administrator's door, straight to the sign-in that opens it.
          { href: "/login?next=%2Fadmin", label: "Admin" },
        ],
      };

  return [
    casting,
    {
      title: "Help",
      links: [
        { href: "/faq", label: "All guides" },
        { href: "/faq/applicants", label: "For applicants" },
        { href: "/faq/casting-directors", label: "For casting directors" },
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
}

export function SiteFooter({
  user = null,
  padForTabs = false,
}: {
  user?: SessionUser | null;
  padForTabs?: boolean;
}) {
  const columns = columnsFor(user);
  const contact = reportAddress();
  const company = companyDetails();

  return (
    <footer className="mt-24 bg-text text-ink">
      <div
        className={`mx-auto max-w-6xl px-4 py-10 text-sm sm:px-6 sm:py-12 ${padForTabs ? "pb-24 sm:pb-12" : ""}`}
      >
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            {/* A footer mark goes home; it is the one link a reader looks for by habit. */}
            <Link
              href="/"
              className={`${LINK} gap-3 font-semibold tracking-[0.08em] uppercase`}
            >
              <Logo tone="onLight" size="sm" />
              Open Casting
            </Link>
            <p className="mt-3 text-ink/85">
              The tool a casting team runs an open call with. The sample casting calls on it are
              invented.
            </p>
            {contact ? (
              <p className="mt-3 text-ink/85">
                Something wrong with a call?{" "}
                <a href={`mailto:${contact}`} className={`${LINK} underline underline-offset-4`}>
                  {contact}
                </a>
              </p>
            ) : null}
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => {
              const id = `footer-${column.title.toLowerCase().replace(/\W+/g, "-")}`;
              return (
                <div key={column.title}>
                  <h2
                    id={id}
                    className="text-xs font-semibold tracking-[0.18em] text-ink/60 uppercase"
                  >
                    {column.title}
                  </h2>
                  <ul aria-labelledby={id} className="mt-2 flex flex-col">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className={LINK}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        {/* What a limited company has to say about itself, in one quiet line. */}
        <div className="mt-8 flex flex-col gap-1 border-t border-ink/15 pt-6 text-xs text-ink/60">
          <p>
            &copy; {new Date().getFullYear()} {company.name}. Open Casting is one of its services.
          </p>
          {company.number || company.office ? (
            <p>
              Registered in England and Wales
              {company.number ? ` no. ${company.number}` : ""}
              {company.office ? `. Registered office: ${company.office}` : "."}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
