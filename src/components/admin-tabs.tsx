import Link from "next/link";

import { groupFor, pageFor } from "@/lib/admin-nav";

import { cx } from "./ui";

/**
 * The pages inside one group of the administrator's section, as a row under
 * the heading.
 *
 * The bar above holds four groups, which is all a phone can carry; this is
 * how the pages inside one are reached. It scrolls sideways in its own well
 * rather than wrapping, so the row stays one line however narrow the screen.
 * A group with one page shows nothing: a tab row of one is furniture.
 */
export function AdminTabs({ pathname }: { pathname: string }) {
  const group = groupFor(pathname);
  if (!group || group.pages.length < 2) return null;
  const current = pageFor(pathname);

  return (
    <nav aria-label={`${group.label} pages`} className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 text-sm">
        {group.pages.map((page) => {
          const on = current?.href === page.href;
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full border px-4 py-2 whitespace-nowrap transition-colors sm:min-h-10",
                  on
                    ? "border-accent bg-accent-soft font-medium text-text"
                    : "border-line text-muted hover:border-accent hover:text-text",
                )}
              >
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
