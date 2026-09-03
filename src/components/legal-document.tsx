import type { LegalDocument } from "@/content/legal";

import { Eyebrow } from "./ui";

/** One agreement, rendered in full. Nobody accepts what they cannot read. */
export function LegalText({ document }: { document: LegalDocument }) {
  return (
    <article className="text-[15px] leading-relaxed text-muted">
      <Eyebrow>Version {document.version}</Eyebrow>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text">
        {document.title}
      </h2>

      {document.intro.map((paragraph) => (
        <p key={paragraph} className="mt-3 max-w-prose">
          {paragraph}
        </p>
      ))}

      {document.clauses.map((clause) => (
        <section key={clause.heading} className="mt-8">
          <h3 className="text-sm font-semibold tracking-tight text-text">{clause.heading}</h3>
          {clause.body.map((paragraph) => (
            <p key={paragraph} className="mt-2.5 max-w-prose">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

/** The same thing, boxed and scrollable, for reading inside a form. */
export function LegalScroller({ document }: { document: LegalDocument }) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-line bg-ink p-4 sm:p-6">
      <LegalText document={document} />
    </div>
  );
}
