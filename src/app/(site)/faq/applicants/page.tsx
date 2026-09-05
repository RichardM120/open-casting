import type { Metadata } from "next";
import Link from "next/link";

import { FaqItem, FaqSection, FieldGlossary, NotLegalAdvice } from "@/components/faq";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata: Metadata = {
  title: "FAQ for applicants",
  description:
    "What each field on a casting call and a submission means, what submitting commits you to, and what happens to your details.",
};

export default function ApplicantFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={[{ href: "/faq", label: "All FAQs" }, { label: "For applicants" }]} />

      <div className="mt-6">
        <Eyebrow>For applicants</Eyebrow>
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
            No. You submit through the link the production sent you, and that is all you need.
            Accounts are only for the people casting.
          </p>
        </FaqItem>
        <FaqItem q="Does it cost anything?">
          <p>
            No, ever. If anyone asks you to pay to be seen for a role you found here, it is not
            us. Tell us.
          </p>
        </FaqItem>
        <FaqItem q="Do I need an agent?">
          <p>
            No. You submit directly, and the casting director reads your submission alongside
            everyone else&rsquo;s. If you do have one, tell them you have submitted so you do not
            go in twice.
          </p>
        </FaqItem>
        <FaqItem q="Can I submit more than once for the same production?">
          <p>
            No: one submission per email address per production. If five roles are up, pick the
            one that fits you best. To correct something, email the casting director rather than
            submitting again.
          </p>
        </FaqItem>
        <FaqItem q="A role is listed but there is no form. Why?">
          <p>
            It has not opened for submissions yet, or it has closed; the page says which, with
            the opening time if that is still to come. Roles go up early on purpose, so you have
            time to read the brief and prepare a tape.
          </p>
        </FaqItem>
        <FaqItem q="Will I hear back?">
          <p>
            Only if they want to take it further. Casting directors read every submission but
            rarely reply to all of them. That is normal, and not a judgement on your work.
          </p>
        </FaqItem>
        <FaqItem q="How long do you keep my details?">
          <p>
            Thirty days after the production finishes &mdash; not when casting closes &mdash;
            your name, email, phone, location, age, links and cover note are deleted. Not hidden,
            deleted. The production and its roles survive, so the casting director keeps a record
            of what they ran with nobody&rsquo;s details in it.
          </p>
          <p>
            It runs on a schedule, so it happens whether or not anyone remembers. You can also ask
            to be erased sooner: see{" "}
            <Link href="/legal/submission-terms">the Terms of Submission</Link>.
          </p>
        </FaqItem>
        <FaqItem q="What happens to my details?">
          <p>
            They go to the casting director who posted the role, and to anyone at their company
            with access to their dashboard. Never sold, never shared with other productions,
            never used to market anything to you.
          </p>
          <p>
            The production decides how long it keeps them, and good terms say so. Look on the role
            before you submit.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="What the casting call is telling you"
        intro="These are the fields on every role, and what they commit the production to."
      >
        <FieldGlossary
        items={[
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
                "When the work happens. Only submit if you are genuinely free for all of it.",
            },
            {
              term: "Opens and closes",
              means:
                "The production's casting window, in UK time. The form appears at the opening time and goes at the closing time \u2014 the moment your submission has to have arrived, not the moment you start it, so give a video a few minutes. A casting director may also close early, and the roles then stay up for reference without a form.",
            },
          ]}
        />
      </FaqSection>

      <FaqSection
        title="What you are filling in"
        intro="Every field on the submission form, and why it is being asked for."
      >
        <FieldGlossary
        items={[
            {
              term: "Full name",
              means: "As you would be credited. Use your professional name if you have one.",
            },
            {
              term: "Email",
              means:
                "How they contact you, and how the site stops one person submitting twice for the same production.",
            },
            {
              term: "Phone",
              means: "Used for recalls and last-minute schedule changes, which are common.",
            },
            {
              term: "Based in",
              means:
                "Whether you can work as a local. Some productions cover travel and accommodation, some do not; the role should say.",
            },
            {
              term: "Where you are resident",
              means:
                "Asked only when a role needs it: the country you live in, because some castings are open to residents of one country only. Not your address.",
            },
            {
              term: "Height",
              means:
                "Asked only when a role needs it. Give it in centimetres or in feet and inches; the casting team sees both.",
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
              term: "Videos",
              means:
                "Some roles ask for one or more videos, each with its own brief and sometimes a length limit. A tape over the limit is refused when you choose it, before anything is sent. Filming guidance sits beside the upload.",
            },
            {
              term: "Available for the shoot dates",
              means:
                "A role with shoot dates asks you to confirm you are free for all of them. Only tick it if you are: pulling out late is what makes casting directors stop running open calls.",
            },
            {
              term: "A question about heritage, faith or health",
              means:
                "A few parts are written for someone of a particular heritage, faith or disability, and the law allows those roles to ask. The question carries its own consent, separate from the terms. The answer is held apart from the rest of your submission, read only by the casting director who posted the role and the site administrator, and deleted 30 days after casting closes.",
            },
            {
              term: "Do you have an agent?",
              means:
                "Some calls ask this first. If you are represented and the call is for unrepresented actors, you are pointed to your agent, and nothing about you is taken.",
            },
            {
              term: "Terms for this role",
              means: (
                <>
                  Some roles carry terms set by the casting director. You tick to accept before
                  submitting, and the wording is recorded against your submission exactly as it read
                  then, so it cannot be changed afterwards.
                </>
              ),
            },
          ]}
        />
      </FaqSection>

      <FaqSection title="Being careful">
        <FaqItem q="Why can I not search for other roles?">
          <p>
            Because Open Casting is not a job board. It is the tool a production runs its own
            casting with, so there is no index and no way to browse from one production to
            another. A call reaches you because someone circulated it.
          </p>
          <p>So keep the link. If you lose it, ask whoever sent it: we cannot look it up.</p>
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
            It must be in the brief up front, never sprung on you later. A professional
            production will have an intimacy coordinator and a nudity rider in the contract. If it
            is not in the brief, ask before you tape.
          </p>
        </FaqItem>
        <FaqItem q="I am under 18, or submitting for someone who is">
          <p>
            A parent or guardian submits and must be present throughout. The production must get
            a child performance licence from the local authority and provide a registered
            chaperone. If they seem unaware of that, it tells you something.
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
