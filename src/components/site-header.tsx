"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

import { ButtonLink, cx } from "./ui";

// Nothing to browse: signed out, there is only the way in and the help pages.
const PUBLIC_NAV = [{ href: "/faq", label: "FAQ" }] as const;

/**
 * The casting director's section: the productions, which is where the roles and
 * submissions live, and the record of what has been done. Roles are reached
 * through their production rather than from a list of their own, so there is
 * one place to look.
 */
const CASTING_NAV = [
  { href: "/dashboard", label: "Casting calls" },
  { href: "/dashboard/activity", label: "Activity" },
] as const;

/**
 * The one action in the nav. It sits after FAQ, set apart, because it starts
 * something rather than going somewhere.
 */
const NEW_CALL = { href: "/dashboard/sessions/new", label: "New casting call", action: true } as const;

/** The owner's section: who is paying, who they are, and what the site did. */
const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/activity", label: "Activity" },
] as const;

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  // Two sections, and the nav shows the one you are in rather than both at
  // once. Which section you are in is the path, not the role: an admin doing
  // their own casting is in the casting director's section and wants its nav.
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const nav = user
    ? inAdmin && user.role === "admin"
      ? [...ADMIN_NAV, ...PUBLIC_NAV]
      : [...CASTING_NAV, ...PUBLIC_NAV, NEW_CALL]
    : PUBLIC_NAV;

  /** The most specific match wins, so /dashboard/activity does not light up /dashboard too. */
  const current = nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <Aperture />
          <span>
            Open<span className="text-accent">Casting</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {nav.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  "action" in item
                    ? "ml-4 border border-accent/60 text-accent hover:bg-accent-soft"
                    : active
                      ? "bg-raised text-text"
                      : "text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted md:inline" title={user.email}>
                {user.company}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <ButtonLink href="/login" size="sm">
                Sign in
              </ButtonLink>
            </>
          )}
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto border-t border-line px-5 py-2 sm:hidden"
      >
        {nav.map((item) => {
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                active ? "bg-raised text-text" : "text-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Aperture() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-accent">
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2.75 6.5 12l5.5 9.25M21.25 12H10.25M2.75 12l5.5-9.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
