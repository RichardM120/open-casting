import type { ReactNode } from "react";

/**
 * One folded section under a form's "Advanced options": a title, a line
 * saying what it is set to, and the fields behind them. The fields are in the
 * form whether the fold is open or not, so the defaults are always posted.
 * `open` only ever opens a fold, never closes one: a form passes true when the
 * fold holds a setting that is not the default, or an error after a refused
 * save, and whatever the person opens or closes after that stays as they left
 * it. `id` is what a suite reaches a fold by.
 */
export function Fold({
  id,
  title,
  summary,
  open,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details
      data-more={id}
      open={open}
      className="group rounded-2xl border border-line-strong bg-raised shadow-card"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold tracking-tight text-text">{title}</span>
        <span className="text-sm text-muted group-open:hidden">{summary}</span>
        <span className="ml-auto text-xs text-faint group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-faint group-open:inline">Hide</span>
      </summary>
      <div
        role="group"
        aria-label={title}
        className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-6"
      >
        {children}
      </div>
    </details>
  );
}
