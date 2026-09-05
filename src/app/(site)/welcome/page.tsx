import type { Metadata } from "next";
import Link from "next/link";

import { AgreementStep, FinishStep, ProfileStep, StepIndicator } from "@/components/setup-wizard";
import { LegalScroller } from "@/components/legal-document";
import { MSA } from "@/content/legal";
import { hasAccepted } from "@/lib/agreements";
import { ButtonLink, CARD, Eyebrow, STACK, SectionHead, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Set up your account" };

/** What each role can see and do, said plainly on the way in. */
const WHAT_YOU_SEE: Record<UserRole, { heading: string; points: string[]; cta: { href: string; label: string } }> = {
  director: {
    heading: "You will see the casting calls you open, and nothing else",
    points: [
      "Start by opening a casting call. It holds the opening and closing times, and its roles follow them.",
      "Every submission made to your roles lands in one list, newest first.",
      "Move people through New, Shortlisted, Callback and Declined as you work.",
      "Colleagues with a casting director account cannot see your casting calls. A producer at your company can.",
      "Nothing is emailed to applicants automatically. Their address is on every submission.",
    ],
    cta: { href: "/dashboard/sessions/new", label: "Open your first casting call" },
  },
  producer: {
    heading: "You will see every casting call under your company",
    points: [
      "Casting calls from all your casting directors, and the roles in them, in one place.",
      "Each call owns its opening and closing times, and its roles follow them.",
      "You can read and act on their submissions, and edit or close their roles.",
      "Matching is on the company name, so it has to be spelled the same way.",
      "You can open calls and post roles of your own too.",
    ],
    cta: { href: "/dashboard", label: "Go to the dashboard" },
  },
  admin: {
    heading: "You can see and moderate everything on the site",
    points: [
      "Every casting call, every role in it, and every submission made to them.",
      "Suspend an account and they are signed out at once and cannot sign back in. Their casting calls stay up.",
      "Removing a role, or a whole casting call, permanently deletes the applicants' details with it. Closing early is the reversible option.",
      "Every action is recorded in the activity trail, including yours.",
    ],
    cta: { href: "/admin/accounts", label: "Review the accounts" },
  },
};

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const user = await requireUser("/welcome");
  const raw = (await searchParams).step;
  const guide = WHAT_YOU_SEE[user.role];

  // The administrator is the service provider, not a customer of it, so there is
  // no agreement for them to accept. Everyone else starts there.
  const needsAgreement = user.role !== "admin" && !(await hasAccepted(user.id, MSA));
  const total = user.role === "admin" ? 3 : 4;
  const offset = user.role === "admin" ? 0 : 1;

  const asked = Math.min(total, Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  // Nothing past the agreement is reachable until it is accepted.
  const step = needsAgreement ? 1 : Math.max(asked, offset + 1);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <Eyebrow>Setting up</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {needsAgreement
          ? `Welcome, ${user.name.split(" ")[0]}`
          : step === offset + 1
            ? `Welcome, ${user.name.split(" ")[0]}`
            : step === offset + 2
              ? guide.heading
              : "One last thing"}
      </h1>
      <p className="mt-3 text-muted">
        You are set up as a{" "}
        <strong className="text-text">{ROLE_LABELS[user.role].toLowerCase()}</strong>.
        {user.role === "admin"
          ? " That came from the site's admin list, not from anything you chose."
          : ""}
      </p>

      <div className="mt-8">
        <StepIndicator step={step} total={total} />
      </div>

      <div className={cx(CARD, STACK)}>
        {needsAgreement ? (
          <>
            <SectionHead
              title="Your agreement with opencasting.app"
              line="Who owns what, who is responsible for the submissions you collect, and how long applicants' details are kept. You are the data controller for everything applicants send you; we process it for you."
            />
            <div className="mt-5">
            <AgreementStep nextStep={offset + 1}>
              <LegalScroller document={MSA} />
            </AgreementStep>
            </div>
          </>
        ) : null}

        {!needsAgreement && step === offset + 1 ? (
          <>
            <SectionHead
              title="Check your details"
              line="These appear on the roles you post, so applicants know who is casting."
            />
            <div className="mt-5">
              <ProfileStep user={user} nextStep={offset + 2} />
            </div>
          </>
        ) : null}

        {!needsAgreement && step === offset + 2 ? (
          <>
            <SectionHead title="What that means" line="What your role lets you see and do." />
            <ul className="mt-5 flex flex-col gap-3">
              {guide.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={`/welcome?step=${offset + 3}`}>Continue</ButtonLink>
              <ButtonLink href={`/welcome?step=${offset + 1}`} variant="ghost" size="sm">
                Back
              </ButtonLink>
            </div>
          </>
        ) : null}

        {!needsAgreement && step === offset + 3 ? (
          <>
            <SectionHead title="Worth reading first" line="Two things before you start." />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              The{" "}
              <Link
                href="/faq/casting-directors"
                className="text-brand underline underline-offset-4 hover:text-brand-hover"
              >
                casting director guide
              </Link>{" "}
              covers what each field commits you to, including buyout and usage, and how to write
              terms applicants will actually read.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              One thing to know now: submissions carry names, emails and phone numbers. Under UK
              GDPR you are the controller of that data, so say in your role&rsquo;s terms how long
              you keep it.
            </p>
            <div className="mt-7">
              <FinishStep to={guide.cta.href} label={guide.cta.label} />
            </div>
          </>
        ) : null}
      </div>

      {user.onboardedAt ? null : (
        <p className="mt-6 text-center text-xs text-faint">
          You can come back to this from the dashboard until you finish it.
        </p>
      )}
    </div>
  );
}
