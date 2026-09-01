"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

import { ButtonLink, cx } from "./ui";

const PUBLIC_NAV = [
  { href: "/roles", label: "Browse roles" },
  { href: "/faq", label: "FAQ" },
] as const;
const OWNER_NAV = [{ href: "/dashboard", label: "Casting dashboard" }] as const;

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const nav = user ? [...PUBLIC_NAV, ...OWNER_NAV] : PUBLIC_NAV;

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
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  active ? "bg-raised text-text" : "text-muted hover:text-text",
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
              <ButtonLink href="/roles/new" size="sm">
                Post a role
              </ButtonLink>
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
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
              >
                Sign in
              </Link>
              <ButtonLink href="/roles/new" size="sm">
                Post a role
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
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
