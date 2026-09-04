import type { ReactNode } from "react";

import { Eyebrow } from "./ui";

export function FaqSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14">
      <Eyebrow>{title}</Eyebrow>
      {intro ? <p className="mt-3 max-w-prose text-sm text-muted">{intro}</p> : null}
      <div className="mt-6 flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

/** Collapsed by default so a long page stays scannable. */
export function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line-strong bg-raised transition-colors open:border-accent">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-6 text-sm font-medium">
        {q}
        <span
          aria-hidden="true"
          className="shrink-0 text-faint transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-6 sm:pb-6 text-sm leading-relaxed text-muted [&_a]:text-brand [&_a]:underline-offset-4 hover:[&_a]:underline">
        {children}
      </div>
    </details>
  );
}

/** What a field on a form actually commits you to. */
export function FieldGlossary({
  items,
}: {
  items: { term: string; means: ReactNode }[];
}) {
  return (
    <dl className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line-strong bg-raised">
      {items.map((item) => (
        <div key={item.term} className="grid gap-1.5 p-4 sm:p-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-sm font-medium text-text">{item.term}</dt>
          <dd className="text-sm leading-relaxed text-muted">{item.means}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NotLegalAdvice() {
  return (
    <p className="mt-14 rounded-xl border border-line bg-surface p-4 sm:p-6 text-sm leading-relaxed text-muted">
      <strong className="text-text">This is plain-English guidance, not legal advice.</strong>{" "}
      It explains what the fields on this site mean and how they are normally used in UK film,
      television and theatre. It is not a contract, and it does not replace an agreement between
      an applicant and a production. If money, usage or a minor is involved, take proper advice
      from Equity, an agent, or a solicitor.
    </p>
  );
}
