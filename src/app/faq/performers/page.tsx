import type { Metadata } from "next";
import Link from "next/link";

import { FaqItem, FaqSection, FieldGlossary, NotLegalAdvice } from "@/components/faq";
import { ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ for performers",
  description:
    "What each field on a casting call and a submission means, what submitting commits you to, and what happens to your details.",
};

export default function PerformerFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/faq" className="text-sm text-muted transition-colors hover:text-text">
        &larr; All FAQs
      </Link>

      <div className="mt-6">
        <Eyebrow>For performers</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Submitting for a role
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          What the words on a casting call mean, what you are agreeing to when you submit, and
          what happens to your details afterwards.
        </p>
      </div>

      <FaqSection title="The basics">
        <FaqItem q="Do I need an account?">
          <p>
            No, and there is nothing to register for. You submit through the link the production
            sent you, and that link is all you need. Accounts are only for the people casting, so
            they can post roles and read what comes in.
          </p>
        </FaqItem>
        <FaqItem q="Does it cost anything?">
          <p>
            No. There is no fee to submit and no subscription. If anyone ever asks you to pay to
            be seen for a role you found here, that is not us. Tell us.
          </p>
        </FaqItem>
        <FaqItem q="Do I need an agent?">
          <p>
            No. You submit directly, and the casting director sees your submission alongside
            everyone else&rsquo;s. If you do have an agent, tell them you have submitted so you
            do not go in twice.
          </p>
        </FaqItem>
        <FaqItem q="Can I submit more than once for the same production?">
          <p>
            No. It is one submission per email address per production. If a production has five
            roles up, you pick the one that fits you best and submit for that. Submitting for all
            five is not possible, and would not help if it were.
          </p>
          <p>
            If you need to correct something, email the casting director directly rather than
            submitting again.
          </p>
        </FaqItem>
        <FaqItem q="A role is listed but there is no form. Why?">
          <p>
            The production has not opened for submissions yet, or it has closed. The page tells
            you which, and gives the date and time submissions open if that is still to come.
            Roles go up before they open on purpose, so you have time to read the brief and
            prepare a tape.
          </p>
        </FaqItem>
        <FaqItem q="Will I hear back?">
          <p>
            Only if they want to take it further. Casting directors read every submission but
            almost never reply to all of them. That is normal and is not a judgement on your
            work. Every role shows when its production opens and closes.
          </p>
        </FaqItem>
        <FaqItem q="How long do you keep my details?">
          <p>
            Thirty days after the production finishes, and not when casting closes, your name,
            email, phone number, location, age, links and cover note are deleted. Not hidden,
            deleted. What survives is the production and its roles, so the casting director
            keeps a record of what they ran, with nobody&rsquo;s personal data in it.
          </p>
          <p>
            That happens whether or not anyone remembers to do it, because it is on a schedule.
            You can also ask for your data to be erased sooner. See{" "}
            <Link href="/legal/submission-terms">the Terms of Submission</Link>.
          </p>
        </FaqItem>
        <FaqItem q="What happens to my details?">
          <p>
            Your name, email, phone number, location, age, links and cover note go to the casting
            director who posted the role, and to anyone at their company with access to their
            dashboard. They are not sold, not shared with other productions, and not used to
            market anything to you.
          </p>
          <p>
            The production decides how long it keeps them. A well-written set of terms will say
            so. Look for it on the role before you submit.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="What the casting call is telling you"
        intro="These are the fields on every role, and what they commit the production to."
      >
        <div />
      </FaqSection>

      <FieldGlossary
        items={[
          {
            term: "Rate",
            means:
              "Every role on Open Casting is paid. The rate says how much and on what basis: per day, per week, per session. It usually does not include a buyout unless it says so. Get it in writing before the first day.",
          },
          {
            term: "Buyout and usage",
            means: (
              <>
                Common on commercials. The <em>rate</em> pays you for the day; the{" "}
                <em>buyout</em> pays for the right to use the footage: where, in what media, and
                for how long. &ldquo;UK, all media, 12 months&rdquo; means exactly that, and the
                fee should reflect it. A buyout negotiated &ldquo;separately&rdquo; is not agreed
                until it is agreed.
              </>
            ),
          },
          {
            term: "Playing age",
            means:
              "The range they believe you could convincingly play, not your actual age. Submit if you are inside it, whatever your date of birth.",
          },
          {
            term: "Self-tape",
            means:
              "You may record and send your audition rather than attend in person. You are not usually paid for the time or cost of making one.",
          },
          {
            term: "Shoot dates",
            means:
              "When the work happens. Only submit if you are genuinely free for all of it. Pulling out late is what makes casting directors stop using open calls.",
          },
          {
            term: "Opens and closes",
            means:
              "The production's casting window, in UK time. The form appears at the opening time and goes at the closing time. A casting director may also close early once they have what they need, and the roles then stay up for reference without a form.",
          },
        ]}
      />

      <FaqSection
        title="What you are filling in"
        intro="Every field on the submission form, and why it is being asked for."
      >
        <div />
      </FaqSection>

      <FieldGlossary
        items={[
          {
            term: "Full name",
            means: "As you would be credited. Use your professional name if you have one.",
          },
          {
            term: "Email",
            means:
              "How they will contact you, and how the site stops one person submitting twice for the same production.",
          },
          {
            term: "Phone",
            means: "Used for recalls and last-minute schedule changes, which are common.",
          },
          {
            term: "Based in",
            means:
              "Whether you can work as a local. Some productions cover travel and accommodation and some do not. The role should say.",
          },
          {
            term: "Age",
            means: (
              <>
                Your actual age in years, not your playing age. If you are under 16, a parent or
                guardian must submit for you, and the production needs a local authority licence
                and a chaperone before you can work.
              </>
            ),
          },
          {
            term: "Showreel link",
            means:
              "Optional. A link to footage on Vimeo, YouTube, or anywhere else. Make sure it is not private or password-locked.",
          },
          { term: "Profile link", means: "Optional. Spotlight, Backstage, or your own site." },
          {
            term: "Cover note",
            means:
              "A short paragraph on why you, for this part. Specific beats general, so refer to the brief.",
          },
          {
            term: "Terms for this role",
            means: (
              <>
                Some roles carry terms set by the casting director. Where they do, you must tick
                to accept before submitting, and the wording is recorded against your submission
                exactly as it read at that moment, so it cannot be changed afterwards.
              </>
            ),
          },
        ]}
      />

      <FaqSection title="Being careful">
        <FaqItem q="Why can I not search for other roles?">
          <p>
            Because Open Casting is not a job board. It is the tool a production uses to run its
            own casting, so there is no index of everything on it and no way to browse from one
            production to another. A casting call reaches you because someone circulated it.
          </p>
          <p>
            That also means the link is worth keeping. If you lose it, ask whoever sent it. We
            cannot look it up for you.
          </p>
        </FaqItem>
        <FaqItem q="How do I know a casting call is genuine?">
          <p>
            Every role names the casting director and the company. Look them up. Real casting
            directors do not ask for money, do not ask for bank details before you are cast, and
            do not audition people in private homes or hotel rooms.
          </p>
        </FaqItem>
        <FaqItem q="What if a role asks for nudity or intimate content?">
          <p>
            That must be stated in the brief up front, never sprung on you later. On a
            professional production there will be an intimacy coordinator and a nudity rider in
            the contract. If it is not in the brief, ask before you tape.
          </p>
        </FaqItem>
        <FaqItem q="I am under 18, or submitting for someone who is">
          <p>
            A parent or guardian submits and must be present throughout. The production is
            responsible for obtaining a child performance licence from the local authority and
            for providing a registered chaperone. If a production seems unaware of this, that
            tells you something.
          </p>
        </FaqItem>
      </FaqSection>

      <NotLegalAdvice />

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/">Back to the start</ButtonLink>
        <ButtonLink href="/faq/casting-directors" variant="secondary">
          FAQ for casting directors
        </ButtonLink>
      </div>
    </div>
  );
}
