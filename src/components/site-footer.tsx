import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>Open Casting — a prototype. Every role and performer here is invented.</p>
        <div className="flex gap-5">
          <Link href="/roles" className="transition-colors hover:text-text">
            Browse roles
          </Link>
          <Link href="/roles/new" className="transition-colors hover:text-text">
            Post a role
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-text">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
