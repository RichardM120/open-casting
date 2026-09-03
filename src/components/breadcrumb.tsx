import Link from "next/link";

export type Crumb = { href?: string; label: string };

/**
 * Where you are, at the top of the screen, as the trail that led here: each
 * step before the current page is a link back to it. It replaces the single
 * back link that used to sit under the help note, where it was easy to miss.
 */
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-2">
              {index > 0 ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-3.5 shrink-0 text-line-strong"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 3 5 5-5 5" />
                </svg>
              ) : null}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="inline-flex min-h-8 items-center rounded-sm underline-offset-4 transition-colors hover:text-text hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "inline-flex min-h-8 items-center font-medium text-text" : "inline-flex min-h-8 items-center"}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
