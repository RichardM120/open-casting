import type { Metadata } from "next";
import Link from "next/link";

import { FaqItem, FaqSection, FieldGlossary, NotLegalAdvice } from "@/components/faq";
import { ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ for casting directors",
  description:
    "What each field on a role commits you to, who can see your submissions, and how to write terms applicants will accept.",
};

export default function CastingDirectorFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/faq" className="text-sm text-muted transition-colors hover:text-text">
        &larr; All FAQs
      </Link>

      <div className="mt-6">
        <Eyebrow>For casting directors</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Running a casting call
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          What each field commits you to, who else can see what comes in, and how to write terms
          that are worth having.
        </p>
      </div>

      <FaqSection title="Accounts and access">
        <FaqItem q="Who can see my submissions?">
          <p>There are three kinds of account, and they see different things:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong className="text-text">Casting director:</strong> only the productions and
              roles you posted, and the submissions against them.
            </li>
            <li>
              <strong className="text-text">Producer:</strong> every production posted under the
              same company name, whoever posted it.
            </li>
            <li>
              <strong className="text-text">Admin:</strong> everything on the site, and the only
              account that can create other accounts.
            </li>
          </ul>
          <p>
            A colleague at your company with a casting director account cannot see your
            productions. If you need them to, they need a producer account.
          </p>
        </FaqItem>
        <FaqItem q="Do applicants need an account?">
          <p>
            No, and deliberately so. Asking applicants to register is the fastest way to lose the
            people an open call exists to reach.
          </p>
        </FaqItem>
        <FaqItem q="How do applicants find my roles?">
          <p>
            You send them the link. Every production has one, on its page in your dashboard, and
            it opens that production and nothing else. There is no public listing on Open Casting
            and no search, so the call goes exactly as far as you circulate it: an agent mailout,
            a social post, a notice board, whatever you would normally use.
          </p>
          <p>
            Anyone holding the link can submit while the production is open. Treat it as you would
            the call sheet. It is not secret, but it is not something to leave lying about either.
          </p>
        </FaqItem>
        <FaqItem q="Who can get an account?">
          <p>
            Whoever the administrator sets one up for. Nobody can register themselves, which keeps
            the account list to the people actually working on your productions. Ask the
            administrator and they will send you the details.
          </p>
        </FaqItem>
        <FaqItem q="Can I edit or take down a role after posting?">
          <p>
            Yes. Edit a role from its page on your dashboard, and use{" "}
            <strong className="text-text">Close early</strong> on its production to stop
            submissions before the closing time. Closing deletes nothing. The roles stay visible
            for reference and the submissions stay in your dashboard.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="Productions"
        intro="A production is one project with however many roles in it. It holds the times submissions run between, and its roles open and close with it."
      >
        <FaqItem q="Why do I open a production before posting a role?">
          <p>
            Because a production casts as a unit. It holds the name, the synopsis, the
            production company and the opening and closing times, and every role you post into
            it follows them. That
            is one thing to change when a schedule moves, not one per role, and it makes it
            impossible for two roles on the same production to disagree about when casting
            closes.
          </p>
          <p>
            <Link href="/dashboard/sessions/new">Open a production</Link>, then post its roles.
          </p>
        </FaqItem>
        <FaqItem q="When does my link start working?">
          <p>
            When you publish. A new production is a draft: you post its roles, open the link
            yourself to check it reads the way you want, and publish when you are happy. Until
            then the link opens for you and for nobody else.
          </p>
          <p>
            Publishing cannot be undone, because once a link is on a post or in a mailout it is
            out of your hands. To stop a call, use <strong className="text-text">Close early</strong>{" "}
            instead. The roles stay up and the submissions stay yours.
          </p>
        </FaqItem>
        <FaqItem q="How long do you keep the submissions?">
          <p>
            Thirty days after the production finishes, the applicants&rsquo; details are deleted:
            names, email addresses, phone numbers, links, cover notes. The clock runs from the
            production end date you set, not from when casting closed, because a shoot can run for
            months after the call shut. The production, its roles and the counts are kept.
          </p>
          <p>
            It runs on a schedule rather than waiting for anyone to remember, and the date is on
            the production&rsquo;s page. You are emailed 14 days and 48 hours beforehand. Take
            what you need before then, because it cannot be recovered afterwards.
          </p>
        </FaqItem>
        <FaqItem q="When is the submission form actually shown?">
          <p>
            Only while the production is open: from its opening time to its closing time, both in
            UK time, and only if it has not been closed early. Before the opening time the roles
            are listed and readable, so applicants can prepare, but the form is not there. After
            it closes, the same.
          </p>
        </FaqItem>
        <FaqItem q="Can somebody submit for two roles on the same production?">
          <p>
            No. One submission per email address per production, whichever role they go for. It
            is the same rule a production would apply in the room, and it stops one person filling
            a shortlist.
          </p>
          <p>
            The database enforces it, not the form, so it holds even if two submissions arrive at
            the same moment.
          </p>
        </FaqItem>
        <FaqItem q="Can I move a role to a different production?">
          <p>
            No. Moving one would change the times a role was posted under and separate it from
            the submissions already made to its production. Post the role again on the right
            production, and close the old one if it should not be up.
          </p>
        </FaqItem>
        <FaqItem q="What does changing a production's times do?">
          <p>
            It moves every role in that production at once. Extending is safe. Shortening takes
            the form away from anyone part-way through filling it in, so give notice where you
            can.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="What each field commits you to"
        intro="Applicants make real decisions on the strength of these: turning down other work, travelling, spending an evening on a tape."
      >
        <div />
      </FaqSection>

      <FieldGlossary
        items={[
          {
            term: "Production and synopsis",
            means:
              "Set once, on the production, and shown on every role in it. Give enough for someone to decide whether it is for them. A synopsis that says nothing gets submissions from people who have not read it.",
          },
          {
            term: "Character brief",
            means:
              "Who they are, not just what they look like. This is the field that decides the quality of what you get back.",
          },
          {
            term: "Requirements",
            means:
              "Anything genuinely non-negotiable: a skill, a licence, availability for a specific block. Listing preferences here as requirements narrows your pool for no gain.",
          },
          {
            term: "Playing age",
            means:
              "The range you would believe on screen or stage. It is not a proxy for actual age, and framing it as one will lose you people who could play it.",
          },
          {
            term: "Rate",
            means: (
              <>
                Every role on Open Casting is paid, so this is the one line applicants read
                first. Be specific. &ldquo;Competitive&rdquo; and &ldquo;TBC&rdquo; read as
                &ldquo;low&rdquo; and cost you good submissions. State the basis (day, week,
                session) and whether a buyout is included or separate.
              </>
            ),
          },
          {
            term: "Self-tape",
            means:
              "Ticking this says you will accept a tape instead of an in-person audition. If you will only see people in the room, leave it off rather than disappoint people who have made one.",
          },
          {
            term: "Shoot dates",
            means:
              "Real dates, including any fitting or rehearsal day. People turn down other work on the strength of this.",
          },
          {
            term: "Opens and closes",
            means: (
              <>
                These belong to the production, so a role has no window of its own. It opens and
                closes with everything else on that production, at the times you set, in UK
                time. Allow enough time for a tape to be made: a three-day window on a self-tape
                role gets you whoever happened to be free.
              </>
            ),
          },
          {
            term: "Terms for applicants",
            means: (
              <>
                Optional. Where you set them, applicants must tick to accept before they can
                submit, and the wording is stored against their submission exactly as it read at
                that moment, so editing the role later cannot change what somebody agreed to.
              </>
            ),
          },
        ]}
      />

      <FaqSection title="Writing the terms">
        <FaqItem q="What should I put in them?">
          <p>
            The things an applicant would otherwise have to ask, and the ones you would rather not
            argue about later:
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Usage and buyout: territory, media and duration, and whether the rate covers it.</li>
            <li>That submitting creates no engagement and no obligation on either side.</li>
            <li>
              Whether self-tape time or travel to an audition is paid. Usually it is not, so say
              so.
            </li>
            <li>How long you keep submissions and when you delete them.</li>
            <li>
              Anything unusual: nudity or intimate content, stunts, animals, night shoots, a
              specific skill test.
            </li>
          </ul>
          <p>
            Keep it short and in plain English. A wall of legalese on an open call gets accepted
            without being read, which is worth nothing to you.
          </p>
        </FaqItem>
        <FaqItem q="Do the terms replace a contract?">
          <p>
            No. They set expectations before anyone spends time on a tape. The engagement itself
            still needs a proper contract, and anything material (money, usage, intimate content)
            belongs there too.
          </p>
        </FaqItem>
        <FaqItem q="What about applicants under 18?">
          <p>
            You are responsible for obtaining a child performance licence from the relevant local
            authority and for providing a registered chaperone. Say so in the terms, and expect a
            parent or guardian to submit on the applicant&rsquo;s behalf.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection title="The submissions you receive">
        <FaqItem q="What are my obligations for the data?">
          <p>
            Submissions contain names, email addresses, phone numbers and ages. That is personal
            data, and under UK GDPR your production is the controller of it. In practice that
            means using it only for this casting, not passing it to other productions, keeping it
            no longer than you need it, and being able to delete someone&rsquo;s details if they
            ask.
          </p>
          <p>
            Saying in your terms how long you keep it is the simplest way to be straight about
            this.
          </p>
        </FaqItem>
        <FaqItem q="What do the statuses mean?">
          <p>
            <strong className="text-text">New</strong> is unread.{" "}
            <strong className="text-text">Shortlisted</strong>,{" "}
            <strong className="text-text">Callback</strong> and{" "}
            <strong className="text-text">Declined</strong> are yours to use as you work through.
            They are for your own tracking. Nothing is sent to the applicant when you change one.
          </p>
        </FaqItem>
        <FaqItem q="Are applicants told when they are declined?">
          <p>
            No. Nothing on this site emails applicants. If you want to let people know, do it
            yourself. The email address is on every submission, and it is the single thing
            applicants most often say they wish happened.
          </p>
        </FaqItem>
      </FaqSection>

      <NotLegalAdvice />

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/dashboard/sessions/new">Open a production</ButtonLink>
        <ButtonLink href="/faq/applicants" variant="secondary">
          FAQ for applicants
        </ButtonLink>
      </div>
    </div>
  );
}
