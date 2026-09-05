import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Contextual help, the same shape on every screen: what this page is for and
 * what to do on it, folded away behind one line so it is there when someone is
 * lost and out of the way when they are not. `faq` links to the longer answer.
 */
export function HelpNote({
  title,
  faq,
  faqLabel = "More in the guide",
  children,
}: {
  title: string;
  faq?: string;
  faqLabel?: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-6 rounded-xl border border-line bg-surface text-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-muted transition-colors hover:text-text [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-brand"
        >
          ?
        </span>
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-xs text-faint group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-faint group-open:inline">Hide</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-line px-4 py-3 leading-relaxed text-muted [&_strong]:text-text">
        {children}
        {faq ? (
          <p>
            <Link
              href={faq}
              className="inline-flex min-h-11 items-center rounded-sm text-brand underline underline-offset-4 hover:text-brand-hover sm:min-h-0"
            >
              {faqLabel}
            </Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
