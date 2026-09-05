import Link from "next/link";

import { formatDate } from "@/lib/format";
import { DEFAULT_INCLUSION_STATEMENT, retentionOf, type CastingSession } from "@/lib/types";

import { CARD, SectionHead, STACK, cx } from "./ui";

/** The casting call's inclusive casting statement, or the default one; nothing when cleared. */
export function InclusionStatement({ session }: { session: CastingSession }) {
  const text = session.inclusionStatement ?? DEFAULT_INCLUSION_STATEMENT;
  if (!text) return null;
  return (
    <section aria-labelledby="who-can-apply" className={cx(CARD, "mt-10")}>
      <SectionHead id="who-can-apply" title="Who can apply" />
      <p className="mt-4 max-w-prose leading-relaxed text-text">{text}</p>
    </section>
  );
}

/**
 * What an applicant is entitled to be told before they send anything, in the
 * words that apply to this casting call rather than a link to a policy: who
 * holds their details, what for, on what basis, for how long, and what they
 * can do about it. Two sentences say the whole of it; the six points are
 * behind a "more" control, a native <details>, so the page stays short and
 * the detail is one tap away rather than a link away.
 */
export function YourData({
  session,
  reportTo,
}: {
  session: CastingSession;
  /** Where to write about the data, when the operator has given an address. */
  reportTo: string | null;
}) {
  // The call's own retention, which is the site's rule unless the client
  // bought something else when it was opened.
  const days = retentionOf(session);
  const purge = formatDate(
    new Date(Date.parse(`${session.productionEndsAt}T12:00:00Z`) + days * 86400000).toISOString(),
  );
  return (
    <section aria-labelledby="your-data" className={cx(CARD, STACK)}>
      <SectionHead id="your-data" title="Your data" />
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
        {session.company} holds what you send and uses it only to consider you for this call. It
        is destroyed on {purge}, {days} days after the production finishes, and you can see it,
        correct it or have it deleted at any time.
      </p>
      <details className="group mt-1 text-sm" data-more="your-data">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center font-medium text-brand underline underline-offset-4 hover:text-brand-hover sm:min-h-10 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">&hellip; more</span>
          <span className="hidden group-open:inline">Less</span>
          <span className="sr-only"> about your data</span>
        </summary>
        <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Row term="Who holds it">
          {session.company}, the team running this call, is the data controller. Open Casting
          stores it for them and does nothing else with it.
        </Row>
        <Row term="What it is for">
          Considering you for the roles in this call, and nothing else. Never sold, never used for
          marketing, never used to train AI.
        </Row>
        <Row term="The basis for keeping it">
          Your consent, given when you send the form; for an applicant under 18, their parent or
          guardian gives it. Withdraw it at any time and your submission is deleted.
        </Row>
        <Row term="How long it is kept">
          Until {days} days after the production finishes. On {purge} everything you sent is
          destroyed automatically, unless you ask for it sooner.
        </Row>
        <Row term="Your rights">
          To see what is held about you, correct it, have it deleted, restrict or object to its
          use, and take a copy of it.
        </Row>
        <Row term="How to ask, or complain">
          Ask the casting team, or write to{" "}
          {reportTo ? (
            <a href={`mailto:${reportTo}`} className="text-brand underline underline-offset-4 hover:text-brand-hover">
              {reportTo}
            </a>
          ) : (
            "Open Casting"
          )}
          . If you are not satisfied you can complain to the Information Commissioner&apos;s
          Office at ico.org.uk.
        </Row>
        </dl>
        <p className="mt-4 text-muted">
          The full{" "}
          <Link href="/legal/submission-terms" className="text-brand underline underline-offset-4 hover:text-brand-hover">
            Terms of Submission
          </Link>{" "}
          say the same at length.
        </p>
      </details>
    </section>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-text">{term}</dt>
      <dd className="mt-1 leading-relaxed text-muted">{children}</dd>
    </div>
  );
}
