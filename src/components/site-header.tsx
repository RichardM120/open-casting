"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

import { Logo } from "./logo";
import { ButtonLink, cx } from "./ui";

// Nothing to browse: signed out, there is only the way in and the help pages.
const PUBLIC_NAV = [{ href: "/faq", label: "FAQ" }] as const;

/**
 * The casting director's section: the casting calls, which is where the roles
 * and submissions live, and the record of what has been done. Roles are
 * reached through their casting call rather than from a list of their own, so
 * there is one place to look.
 */
const CASTING_NAV = [
  { href: "/dashboard", label: "Casting calls" },
  { href: "/dashboard/activity", label: "Activity" },
] as const;

/**
 * The one action in the nav. It sits after FAQ, set apart and in gold, because
 * it starts something rather than going somewhere.
 */
const NEW_CALL = { href: "/dashboard/sessions/new", label: "New casting call", action: true } as const;

/** The owner's section: who is paying, who they are, and what the site did. */
const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/activity", label: "Activity" },
] as const;

/**
 * The terracotta bar. White on terracotta reads at better than 6:1; the one
 * gold element is the action, which is the thing the eye should find first.
 */
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

  const linkClass = (item: { href: string; action?: boolean }) =>
    cx(
      "rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
      item.action
        ? "ml-2 bg-accent font-medium text-accent-ink hover:bg-accent-hover"
        : current === item.href
          ? "bg-white/15 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white",
    );

  return (
    <header className="sticky top-0 z-20 bg-brand text-brand-ink shadow-md shadow-black/10">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-6 px-5 py-2">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white sm:gap-2.5 sm:text-base"
        >
          <Logo tone="onBrand" className="size-9 sm:size-7" />
          <span>Open Cast</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              className={linkClass(item)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-white/75 md:inline" title={user.email}>
                {user.company}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-full px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <ButtonLink href="/login" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>
      </div>

      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto border-t border-white/15 px-5 py-2 sm:hidden"
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? "page" : undefined}
            className={linkClass(item)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
