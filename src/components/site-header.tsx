"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

import { Lockup } from "./logo";
import { ButtonLink, cx } from "./ui";

type IconName =
  | "calls"
  | "activity"
  | "faq"
  | "new"
  | "overview"
  | "clients"
  | "accounts"
  | "storage"
  | "projects"
  | "submissions"
  | "privacy"
  | "audit";

type Item = {
  href: string;
  label: string;
  /** A shorter label for the phone's tab bar, where four or five share a row. */
  short?: string;
  icon: IconName;
  action?: boolean;
};

// Nothing to browse: signed out, there is only the way in and the help pages.
const PUBLIC_NAV: Item[] = [{ href: "/faq", label: "FAQ", icon: "faq" }];

/**
 * The casting director's section: the casting calls, which is where the roles
 * and submissions live, and the record of what has been done. Roles are
 * reached through their casting call rather than from a list of their own, so
 * there is one place to look.
 */
const CASTING_NAV: Item[] = [
  { href: "/dashboard", label: "Casting calls", icon: "calls" },
  { href: "/dashboard/activity", label: "Activity", icon: "activity" },
];

/**
 * The one action in the nav. It sits after FAQ, set apart and in gold, because
 * it starts something rather than going somewhere.
 */
const NEW_CALL: Item = {
  href: "/dashboard/sessions/new",
  label: "New casting call",
  short: "New call",
  icon: "new",
  action: true,
};

/** The owner's section: who is paying, who they are, and what the site did. */
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/clients", label: "Clients", icon: "clients" },
  { href: "/admin/projects", label: "Projects", icon: "projects" },
  { href: "/admin/submissions", label: "Submissions", short: "Subs", icon: "submissions" },
  { href: "/admin/accounts", label: "Accounts", icon: "accounts" },
  { href: "/admin/storage", label: "Storage", icon: "storage" },
  { href: "/admin/privacy", label: "Privacy", icon: "privacy" },
  { href: "/admin/activity", label: "Activity", icon: "activity" },
  { href: "/admin/audit-logs", label: "Audit", icon: "audit" },
];

/** Terracotta would not show as a focus ring on the terracotta bar; white does. */
const FOCUS = "focus-visible:outline-white";

/**
 * The terracotta bar. White on terracotta reads at better than 6:1; the one
 * gold element is the action, which is the thing the eye should find first.
 *
 * On a desktop the navigation sits in the bar. On a phone it is a tab bar
 * along the bottom of the screen, within reach of a thumb, and the bar above
 * keeps to one row so it does not take the screen with it as it sticks.
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  // Two sections, and the nav shows the one you are in rather than both at
  // once. Which section you are in is the path, not the role: an admin doing
  // their own casting is in the casting director's section and wants its nav.
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const nav: Item[] = user
    ? inAdmin && user.role === "admin"
      ? [...ADMIN_NAV, ...PUBLIC_NAV]
      : [...CASTING_NAV, ...PUBLIC_NAV, NEW_CALL]
    : PUBLIC_NAV;

  /** The most specific match wins, so /dashboard/activity does not light up /dashboard too. */
  const current = nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const linkClass = (item: Item) =>
    cx(
      "inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors",
      FOCUS,
      item.action
        ? "ml-2 bg-accent font-medium text-accent-ink hover:bg-accent-hover"
        : current === item.href
          ? "bg-white/15 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white",
    );

  return (
    <header className="sticky top-0 z-20 bg-brand text-brand-ink shadow-md shadow-black/10">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4 py-2 sm:min-h-16 sm:gap-6 sm:px-6">
        <Link href="/" className={cx("flex items-center rounded-xl", FOCUS)}>
          <Lockup />
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

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-white/75 md:inline" title={user.email}>
                {user.company}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className={cx(
                    "min-h-10 rounded-full px-3 py-2 text-sm whitespace-nowrap text-white/85 transition-colors hover:bg-white/10 hover:text-white",
                    FOCUS,
                  )}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            // Signed out, a phone shows only the way in up here; the one other
            // link, FAQ, is in the footer's Help column and on the home page.
            <ButtonLink href="/login" size="sm" className="whitespace-nowrap">
              Sign in
            </ButtonLink>
          )}
        </div>
      </div>

      {user ? (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/15 bg-brand pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgb(0_0_0/0.12)] sm:hidden"
        >
          {nav.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-none font-medium transition-colors",
                  FOCUS,
                  item.action || active ? "text-white" : "text-white/75 hover:text-white",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    item.action ? "bg-accent text-accent-ink" : active ? "bg-white/20" : "",
                  )}
                >
                  <Icon name={item.icon} />
                </span>
                <span className="max-w-full truncate">{item.short ?? item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}

/** One stroke weight and one grid, so the tabs read as a set. */
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    calls: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    activity: "M3 12h4l3-8 4 16 3-8h4",
    faq: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
    new: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8",
    overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    clients: "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M3 21h18",
    accounts: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M17 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM21.5 19a5 5 0 0 0-5.5-4.8",
    storage: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
    projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    submissions: "M4 5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 5l8 6 8-6M9 21h6",
    privacy: "M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6zM9.5 12l1.8 1.8 3.4-3.6",
    audit: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
