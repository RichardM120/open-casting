import Link from "next/link";

import { cx } from "./ui";

/** How many submissions a page shows. A casting call can run to hundreds. */
export const PAGE_SIZE = 25;

/**
 * How many rows a long administrative list shows: accounts, clients, the
 * activity trail. Longer than a page of submissions because the rows are one
 * line each, and short enough that a list of hundreds is not one scroll.
 */
export const LIST_PAGE_SIZE = 50;

/** The page asked for in a query string: a whole number from one, or one. */
export function pageNumber(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Page controls for a long list: what is showing, and links to the pages
 * either side and at both ends. Nothing at all when everything fits on one
 * page, so a short list never grows a footer it does not need. `href` builds
 * a page's URL, so the caller keeps whatever else the query string carries.
 */
export function Pagination({
  page,
  total,
  pageSize,
  href,
  label = "Pages",
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const link =
    "inline-flex min-w-9 items-center justify-center rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-text";
  const still = "inline-flex items-center rounded-full px-3 py-1.5 text-sm text-faint";

  return (
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted">
        Showing {first} to {last} of {total}
      </p>
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={link}>
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={still}>
              Previous
            </span>
          )}
        </li>
        {windowOf(page, pages).map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-faint">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={href(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={cx(link, entry === page ? "border-accent bg-accent-soft text-text" : "")}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} rel="next" className={link}>
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className={still}>
              Next
            </span>
          )}
        </li>
      </ol>
    </nav>
  );
}

/** The first page, the last, the current one and its neighbours, with gaps marked. */
function windowOf(page: number, pages: number): Array<number | "gap"> {
  const wanted = [1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages);
  const sorted = [...new Set(wanted)].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push("gap");
    out.push(n);
    previous = n;
  }
  return out;
}
