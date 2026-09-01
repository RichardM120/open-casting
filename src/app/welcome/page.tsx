import type { Metadata } from "next";
import Link from "next/link";

import { FinishStep, ProfileStep, StepIndicator } from "@/components/setup-wizard";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Set up your account" };

/** What each role can see and do, said plainly on the way in. */
const WHAT_YOU_SEE: Record<UserRole, { heading: string; points: string[]; cta: { href: string; label: string } }> = {
  director: {
    heading: "You will see the roles you post, and nothing else",
    points: [
      "Start by opening a casting session for the production — it holds the dates, and the roles you post into it open and close with it.",
      "Every submission made to your roles lands in one list, newest first.",
      "Move people through New, Shortlisted, Callback and Declined as you work.",
      "Colleagues with a casting director account cannot see your roles. A producer at your company can.",
      "Nothing is emailed to performers automatically — their address is on every submission.",
    ],
    cta: { href: "/dashboard/sessions/new", label: "Open your first casting session" },
  },
  producer: {
    heading: "You will see every role posted under your company",
    points: [
      "Roles from all your casting directors, across productions, in one place.",
      "Each production is a casting session that owns its dates; its roles open and close together.",
      "You can read and act on their submissions, and edit or close their roles.",
      "Matching is on the company name, so it has to be spelled the same way.",
      "You can post roles of your own too.",
    ],
    cta: { href: "/dashboard", label: "Go to the dashboard" },
  },
  admin: {
    heading: "You can see and moderate everything on the board",
    points: [
      "Every casting session, every role in it, and every submission made to them.",
      "Suspend an account and they are signed out at once and cannot sign back in. Their roles stay up.",
      "Removing a role, or a whole casting session, permanently deletes the performers' contact details with it. Closing early is the reversible option.",
      "Every action is recorded in the activity trail, including yours.",
    ],
    cta: { href: "/dashboard/accounts", label: "Review the accounts" },
  },
};

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const user = await requireUser("/welcome");
  const raw = (await searchParams).step;
  const step = Math.min(3, Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  const guide = WHAT_YOU_SEE[user.role];

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Eyebrow>Setting up</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {step === 1
          ? `Welcome, ${user.name.split(" ")[0]}`
          : step === 2
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
        <StepIndicator step={step} total={3} />
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-7">
        {step === 1 ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">Check your details</h2>
            <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
              These appear on the roles you post, so performers know who is casting.
            </p>
            <ProfileStep user={user} nextStep={2} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">What that means</h2>
            <ul className="mt-5 flex flex-col gap-3">
              {guide.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/welcome?step=3">Continue</ButtonLink>
              <ButtonLink href="/welcome?step=1" variant="ghost" size="sm">
                Back
              </ButtonLink>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">Worth reading first</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The{" "}
              <Link
                href="/faq/casting-directors"
                className="text-accent underline-offset-4 hover:underline"
              >
                casting director guide
              </Link>{" "}
              covers what each field on a role commits you to — rate against buyout, usage,
              union status — and how to write terms performers will actually read.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              One thing to know now: submissions carry names, emails and phone numbers. Under UK
              GDPR your production is the controller of that data. Say in your role&rsquo;s terms
              how long you keep it.
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
