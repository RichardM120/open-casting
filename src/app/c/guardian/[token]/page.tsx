import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConfirmGuardian } from "@/components/guardian-confirm";
import { Badge, CARD, Eyebrow, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { CONFIRM_DAYS, awaiting } from "@/lib/guardian";
import { reportAddress } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm a submission",
  robots: { index: false, follow: false },
};

/**
 * The page a parent or guardian lands on from their own email.
 *
 * It is deliberately not a link that confirms by being opened. They see whose
 * submission it is, what it was for, who will read it and how long it is kept
 * — and then decide. A mail scanner following the link confirms nothing.
 */
export default async function GuardianPage({ params }: PageProps<"/c/guardian/[token]">) {
  const { token } = await params;
  const pending = await awaiting(token);

  // Already confirmed, already deleted, or never real: the same page either
  // way. Which links exist is not something to confirm to a stranger.
  if (!pending) notFound();

  const reportTo = reportAddress();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Eyebrow>A submission needs you</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Did you agree to this?
      </h1>
      <p className="mt-4 max-w-prose leading-relaxed text-text">
        Somebody has sent a submission in {pending.name}&rsquo;s name and named you as their
        parent or guardian. Nothing has been shown to {pending.company}, and nothing will be
        unless you say so here.
      </p>

      <section className={cx(CARD, "mt-8")} aria-labelledby="what-heading">
        <h2 id="what-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          What was sent
        </h2>
        <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Row term="Who it is for">
            {pending.name}, aged {pending.age}
          </Row>
          <Row term="The part">{pending.roleTitle}</Row>
          <Row term="The casting call">{pending.sessionName}</Row>
          <Row term="Who would read it">{pending.company}</Row>
          <Row term="You were named as">{pending.guardianName}</Row>
          <Row term="Sent">{formatDateTime(pending.submittedAt)}</Row>
        </dl>
      </section>

      <section className={cx(CARD, "mt-6")} aria-labelledby="agree-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="agree-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
            If you confirm
          </h2>
          <Badge tone="accent">Your decision</Badge>
        </div>
        <ul className="mt-4 flex max-w-prose flex-col gap-2.5 text-sm leading-relaxed text-text">
          <li>
            {pending.company} may read {pending.name}&rsquo;s details and see any photograph or
            tape sent, to consider them for this part and nothing else.
          </li>
          <li>Their details are never sold, never used for marketing and never used to train AI.</li>
          <li>
            Everything is destroyed automatically after the production finishes. You can ask for
            it to go sooner at any time.
          </li>
        </ul>

        <ConfirmGuardian token={token} name={pending.name} />
      </section>

      <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted">
        If you did not expect this, do nothing. Without your confirmation the submission is never
        shown to anybody, and everything sent is deleted {CONFIRM_DAYS} days after it arrived.
        {reportTo ? (
          <>
            {" "}
            To have it removed now, write to{" "}
            <a
              href={`mailto:${reportTo}`}
              className="text-brand underline underline-offset-4 hover:text-brand-hover"
            >
              {reportTo}
            </a>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="mt-1 wrap-anywhere text-text">{children}</dd>
    </div>
  );
}
