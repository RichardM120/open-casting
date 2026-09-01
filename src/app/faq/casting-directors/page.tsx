import type { Metadata } from "next";
import Link from "next/link";

import { FaqItem, FaqSection, FieldGlossary, NotLegalAdvice } from "@/components/faq";
import { ButtonLink, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ for casting directors",
  description:
    "What each field on the post-a-role form commits you to, who can see your submissions, and how to write terms performers will accept.",
};

export default function CastingDirectorFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/faq" className="text-sm text-muted transition-colors hover:text-text">
        ← All FAQs
      </Link>

      <div className="mt-6">
        <Eyebrow>For casting directors</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Posting a role
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
              <strong className="text-text">Casting director</strong> — only the roles you posted,
              and the submissions against them.
            </li>
            <li>
              <strong className="text-text">Producer</strong> — every role posted under the same
              company name, across productions.
            </li>
            <li>
              <strong className="text-text">Admin</strong> — everything on the system, and the
              only account that can create other accounts.
            </li>
          </ul>
          <p>
            A colleague at your company with a casting director account cannot see your roles.
            If you need them to, they need a producer account.
          </p>
        </FaqItem>
        <FaqItem q="Do performers need an account?">
          <p>
            No, and deliberately so. An account requirement is the fastest way to lose the people
            an open call exists to reach.
          </p>
        </FaqItem>
        <FaqItem q="How do performers find my roles?">
          <p>
            You send them the link. Every casting session has one, on its page in your dashboard,
            and it opens that production and nothing else. There is no public listing on Open
            Casting and no search, so the call goes exactly as far as you circulate it — an
            agent mailout, a union board, a social post, whichever you would normally use.
          </p>
          <p>
            Anyone holding the link can submit while the session is open. Treat it as you would
            the call sheet: not secret, but not something to leave lying about either.
          </p>
        </FaqItem>
        <FaqItem q="Who can get an account?">
          <p>
            Whoever the administrator sets one up for. Nobody can register themselves, which is
            what keeps the account list to the people actually working on your productions.
            Ask the administrator and they will send you the credentials.
          </p>
        </FaqItem>
        <FaqItem q="Can I edit or take down a role after posting?">
          <p>
            Yes. Edit a role from its page on your dashboard, and use{" "}
            <strong className="text-text">Close early</strong> on its casting session to stop
            submissions before the closing date. Nothing is deleted by closing — the listing
            stays visible for reference and the submissions stay in your dashboard.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="Casting sessions"
        intro="A casting session is one production's casting window. Roles belong to a session rather than carrying their own dates."
      >
        <FaqItem q="Why do I open a session before posting a role?">
          <p>
            Because a production casts as a unit. The session holds the production name, the
            synopsis and the two dates submissions run between, and every role you post into it
            follows them. That is one date to change when a schedule moves, not one per role, and
            it makes it impossible for two roles on the same production to disagree about when
            casting closes.
          </p>
          <p>
            <Link href="/dashboard/sessions/new">Open a casting session</Link>, then post its
            roles.
          </p>
        </FaqItem>
        <FaqItem q="When does my link start working?">
          <p>
            When you publish. A new casting session is a draft: you post its roles, open the
            link yourself to check it reads the way you want, and publish when you are happy.
            Until then the link opens for you and for nobody else.
          </p>
          <p>
            Publishing cannot be undone, because once a link is on a post or in a mailout it is
            out of your hands. Use <strong className="text-text">Close early</strong> to stop a
            call instead — the listing stays up and the submissions stay yours.
          </p>
        </FaqItem>
        <FaqItem q="How long do you keep the submissions?">
          <p>
            Six months after the call closes, the performers&rsquo; details are deleted — names,
            addresses, phone numbers, links, cover notes. The production, its roles and the
            counts are kept, so you keep a record of what you ran.
          </p>
          <p>
            It runs on a schedule rather than waiting for anyone to remember, and the date is on
            the production&rsquo;s page. Act on what you need before it.
          </p>
        </FaqItem>
        <FaqItem q="When is the submission form actually shown?">
          <p>
            Only while the session is open: from the start of the opening date to the end of the
            closing date, in UTC, and only if the session has not been closed early. Before the
            opening date the roles are listed and readable — so performers can prepare — but the
            form is not there. After it closes, the same.
          </p>
        </FaqItem>
        <FaqItem q="Can somebody submit for two roles on the same production?">
          <p>
            No. One submission per email address per casting session, whichever role they go for.
            It is the same rule a production would apply in the room, and it stops one person
            filling a shortlist.
          </p>
          <p>
            The database enforces it, not the form, so it holds even if two submissions arrive at
            the same moment.
          </p>
        </FaqItem>
        <FaqItem q="Can I move a role to a different session?">
          <p>
            No. Moving one would change the dates a role was posted under and separate it from
            the submissions already made into its session. Post the role again in the right
            session, and close the old one if it should not be up.
          </p>
        </FaqItem>
        <FaqItem q="What does changing a session's dates do?">
          <p>
            It moves every role in that session at once. Extending is safe. Shortening takes the
            form away from anyone part-way through filling it in, so give notice where you can.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection
        title="What each field commits you to"
        intro="Performers make real decisions on the strength of these — turning down other work, travelling, spending an evening on a tape."
      >
        <div />
      </FaqSection>

      <FieldGlossary
        items={[
          {
            term: "Production and synopsis",
            means: "Enough for someone to decide whether it is for them. A synopsis that says nothing gets submissions from people who have not read it.",
          },
          {
            term: "Character brief",
            means: "Who they are, not just what they look like. This is the field that determines the quality of what you get back.",
          },
          {
            term: "Requirements",
            means: "Anything genuinely non-negotiable — a skill, a licence, availability for a specific block. Listing preferences here as requirements narrows your pool for no gain.",
          },
          {
            term: "Playing age",
            means: "The range you would believe on screen or stage. It is not a proxy for actual age, and framing it as one will lose you people who could play it.",
          },
          {
            term: "How it pays",
            means: (
              <>
                <strong className="text-text">Paid</strong> means a fee.{" "}
                <strong className="text-text">Deferred</strong> means later and conditionally —
                say out of what, and when. <strong className="text-text">Unpaid / Credit</strong>{" "}
                is honest for student and showreel work; be straight about expenses.
              </>
            ),
          },
          {
            term: "Rate",
            means: (
              <>
                Be specific. &ldquo;Competitive&rdquo; and &ldquo;TBC&rdquo; read as
                &ldquo;low&rdquo; and cost you good submissions. State the basis — day, week,
                session — and whether a buyout is included or separate.
              </>
            ),
          },
          {
            term: "Union status",
            means: "Union commits you to that agreement's minimums, hours and overtime. Either is right for most open calls and does not oblige you to engage anyone under union terms.",
          },
          {
            term: "Self-tape",
            means: "Ticking this says you will accept a tape instead of an in-person audition. If you will only see people in the room, leave it off rather than disappoint people who have made one.",
          },
          {
            term: "Shoot dates",
            means: "Real dates, including any fitting or rehearsal day. People turn down other work on the strength of this.",
          },
          {
            term: "Casting session",
            means: (
              <>
                The production this role is cast for. The session owns the dates, so a role has
                no closing date of its own — it opens and closes with everything else on that
                production. Allow enough time for a tape to be made: a three-day window on a
                self-tape role gets you whoever happened to be free.
              </>
            ),
          },
          {
            term: "Terms for performers",
            means: (
              <>
                Optional. Where you set them, performers must tick to accept before they can
                submit, and the wording is stored against their submission exactly as it read at
                that moment — so editing the role later cannot change what somebody agreed to.
              </>
            ),
          },
        ]}
      />

      <FaqSection title="Writing the terms">
        <FaqItem q="What should I put in them?">
          <p>The things a performer would otherwise have to ask, and the ones you would rather not be argued about later:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Usage and buyout — territory, media and duration, and whether the rate covers it.</li>
            <li>That submitting creates no engagement and no obligation on either side.</li>
            <li>Whether self-tape time or travel to an audition is paid. Usually it is not — say so.</li>
            <li>How long you keep submissions and when you delete them.</li>
            <li>Anything unusual: nudity or intimate content, stunts, animals, night shoots, a specific skill test.</li>
          </ul>
          <p>
            Keep it short and in plain English. A wall of legalese on an open call gets accepted
            without being read, which is worth nothing to you.
          </p>
        </FaqItem>
        <FaqItem q="Do the terms replace a contract?">
          <p>
            No. They set expectations before anyone spends time on a tape. The engagement itself
            still needs a proper contract, and anything material — money, usage, intimate content
            — belongs there too.
          </p>
        </FaqItem>
        <FaqItem q="What about performers under 18?">
          <p>
            You are responsible for obtaining a child performance licence from the relevant local
            authority and for providing a registered chaperone. Say so in the terms, and expect a
            parent or guardian to submit on the performer&rsquo;s behalf.
          </p>
        </FaqItem>
      </FaqSection>

      <FaqSection title="The submissions you receive">
        <FaqItem q="What are my obligations for the data?">
          <p>
            Submissions contain names, email addresses, phone numbers and ages — personal data,
            and under UK GDPR your production is the controller of it. In practice that means
            using it only for this casting, not passing it to other productions, keeping it no
            longer than you need it, and being able to delete someone&rsquo;s details if they
            ask.
          </p>
          <p>Saying in your terms how long you keep it is the simplest way to be straight about this.</p>
        </FaqItem>
        <FaqItem q="What do the statuses mean?">
          <p>
            <strong className="text-text">New</strong> is unread.{" "}
            <strong className="text-text">Shortlisted</strong>,{" "}
            <strong className="text-text">Callback</strong> and{" "}
            <strong className="text-text">Declined</strong> are yours to use as you work through.
            They are for your own tracking — nothing is sent to the performer when you change
            one.
          </p>
        </FaqItem>
        <FaqItem q="Are performers told when they are declined?">
          <p>
            No. Nothing on this site emails performers. If you want to let people know, do it
            yourself — the email address is on every submission, and it is the single thing
            performers most often say they wish happened.
          </p>
        </FaqItem>
      </FaqSection>

      <NotLegalAdvice />

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/dashboard/sessions/new">Open a casting session</ButtonLink>
        <ButtonLink href="/faq/performers" variant="secondary">
          FAQ for performers
        </ButtonLink>
      </div>
    </div>
  );
}
