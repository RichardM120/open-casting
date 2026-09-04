import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { formatDateTime, isOpen } from "@/lib/format";
import { callState, cardTone } from "@/lib/rag";
import { listVisibleSessions, sessionStats } from "@/lib/sessions";
import { countsBySession, type SubmissionCounts } from "@/lib/submissions";

// Counts and listings come from the database on every request, so this page is
// never prerendered, and a deploy build does not need a reachable database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Casting calls",
  description: "Every casting call you are casting, the roles in it, and what has come in.",
};

/**
 * The one page to start from. A casting call holds the dates and the roles, and
 * the roles hold the submissions, so the list goes casting call by casting call
 * with the roles shown under each rather than as a separate list to keep in
 * step with this one.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const [sessions, stats, bySession, activity, params] = await Promise.all([
    listVisibleSessions(user),
    sessionStats(user),
    countsBySession(user),
    listActivity(user, { limit: 8 }),
    searchParams,
  ]);

  const totals = sessions.reduce(
    (accumulator, session) => {
      const count = stats.get(session.id);
      return {
        open: accumulator.open + (isOpen(session) ? 1 : 0),
        roles: accumulator.roles + (count?.roles ?? 0),
        submissions: accumulator.submissions + (count?.submissions ?? 0),
        toRead: accumulator.toRead + (count?.unread ?? 0),
      };
    },
    { open: 0, roles: 0, submissions: 0, toRead: 0 },
  );

  const drafts = sessions.filter((session) => session.publishedAt === null).length;

  // Live first, then what is being reviewed, then what is counting down to
  // deletion, then what is still being set up.
  const ordered = sessions
    .map((session) => ({ session, state: callState(session) }))
    .sort((a, b) => a.state.rank - b.state.rank);
  const atLimit = user.maxSessions !== null && sessions.length >= user.maxSessions;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Every casting call you can see, with its numbers: submitted, still to review, shortlisted, called back, declined. Open one to post roles, publish it and read the submissions.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Start a new one from <strong>New casting call</strong> in the navigation.' }} />
      </HelpNote>
      {user.onboardedAt ? null : (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-accent-soft p-4 sm:p-6">
          <p className="text-sm text-text">
            Your account setup is not finished. It takes about a minute.
          </p>
          <ButtonLink href="/welcome" size="sm">
            Finish setting up
          </ButtonLink>
        </div>
      )}

      {params.removed ? (
        <p
          role="status"
          className="mb-8 rounded-2xl border border-line-strong bg-raised p-4 text-sm text-muted"
        >
          The casting call was removed, along with its roles and their submissions.
        </p>
      ) : null}

      {params.draft ? (
        <p
          role="status"
          className="mb-8 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm text-text"
        >
          Saved as a draft. Nothing is shown to applicants until you publish, and you can pick it
          up again from the list below.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Casting calls</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Your casting calls
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            {user.role === "admin"
              ? "Every casting call on the site, across all companies."
              : user.role === "producer"
                ? `Every casting call under ${user.company}.`
                : "The casting calls you are casting."}{" "}
            Each one has its own casting window and share link, and shows its numbers here. Open
            one to post roles, publish it, and read what has come in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {atLimit ? null : (
            <ButtonLink href="/dashboard/sessions/new">New casting call</ButtonLink>
          )}
        </div>
      </div>

      {atLimit ? (
        <p className="mt-8 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Your account covers {user.maxSessions}{" "}
          {user.maxSessions === 1 ? "casting call" : "casting calls"} and you have used{" "}
          {user.maxSessions === 1 ? "it" : "them all"}. Ask the administrator to extend it if you
          need another.
        </p>
      ) : null}

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-[repeat(4,11rem)]">
        <Stat label="Open now" value={totals.open} />
        <Stat label="Roles" value={totals.roles} />
        <Stat label="Submissions" value={totals.submissions} />
        <Stat label="Still to read" value={totals.toRead} tone="accent" />
      </dl>

      {sessions.length > 0 ? (
        <>
          <p className="mt-6 text-sm text-muted">
            {totals.open} of {sessions.length}{" "}
            {sessions.length === 1 ? "casting call is" : "casting calls are"} accepting submissions
            now.
            {drafts > 0
              ? ` ${drafts} ${drafts === 1 ? "is" : "are"} still in progress and not yet published, so nobody can open ${drafts === 1 ? "its" : "their"} link.`
              : ""}
            {user.maxSessions !== null
              ? ` Your account covers ${user.maxSessions} ${user.maxSessions === 1 ? "casting call" : "casting calls"}.`
              : ""}
          </p>

          <ul className="mt-4 flex flex-col gap-4">
            {ordered.map(({ session, state }) => {
              const count = stats.get(session.id);
              // The whole card is the way into the casting call: the name's
              // link stretches over the card with a pseudo-element, and the
              // few links that go elsewhere sit above it.
              return (
                <li
                  key={session.id}
                  data-state={state.key}
                  className={`relative rounded-2xl border border-line p-4 shadow-card transition-colors hover:border-accent sm:p-6 ${cardTone(state)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <Link
                          href={`/dashboard/sessions/${session.id}`}
                          className="text-xl font-semibold tracking-tight transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-brand sm:text-2xl"
                        >
                          {session.name}
                        </Link>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted">
                        {session.productionType}
                        {session.productionCompany ? ` · ${session.productionCompany}` : ""} ·{" "}
                        {formatDateTime(session.opensAt)} to {formatDateTime(session.closesAt)}
                      </p>
                      <p className="mt-1 text-xs text-muted">{state.line}</p>
                    </div>

                    {state.key === "draft" ? (
                      <Link
                        href={`/dashboard/sessions/${session.id}`}
                        className="relative z-10 text-sm text-brand underline-offset-4 hover:underline"
                      >
                        Continue setting up
                      </Link>
                    ) : null}
                  </div>

                  <Figures
                    roles={count?.roles ?? 0}
                    counts={bySession.get(session.id)}
                    sessionId={session.id}
                  />
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="No casting calls yet"
            description="Open a casting call, then post its roles into it. The casting call holds the dates, so the roles do not have to."
            action={<ButtonLink href="/dashboard/sessions/new">New casting call</ButtonLink>}
          />
        </div>
      )}

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>History</Eyebrow>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Recent activity</h2>
          </div>
          <ButtonLink href="/dashboard/activity" variant="secondary" size="sm">
            See all activity
          </ButtonLink>
        </div>

        <div className="mt-8">
          <ActivityList
            entries={activity}
            emptyDescription="Open a casting call, and everything that happens to it is recorded here."
          />
        </div>
      </section>
    </div>
  );
}

/**
 * One casting call's numbers, and nothing else: who has submitted is on the
 * casting call's own page. "To review" is what nobody has looked at yet.
 */
function Figures({
  roles,
  counts,
  sessionId,
}: {
  roles: number;
  counts: SubmissionCounts | undefined;
  sessionId: string;
}) {
  if (roles === 0) {
    return (
      <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
        No roles yet.{" "}
        <Link
          href={`/dashboard/roles/new?session=${sessionId}`}
          className="relative z-10 text-brand underline-offset-4 hover:underline"
        >
          Post the first role
        </Link>
      </p>
    );
  }

  const figures: Array<{ key: string; label: string; value: number; accent?: boolean }> = [
    { key: "roles", label: "Roles", value: roles },
    { key: "submitted", label: "Submitted", value: counts?.total ?? 0 },
    { key: "to-review", label: "To review", value: counts?.New ?? 0, accent: true },
    { key: "shortlisted", label: "Shortlisted", value: counts?.Shortlisted ?? 0 },
    { key: "callback", label: "Callback", value: counts?.Callback ?? 0 },
    { key: "declined", label: "Declined", value: counts?.Declined ?? 0 },
  ];

  return (
    <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-6">
      {figures.map((figure) => (
        <div key={figure.key}>
          <dt className="text-xs text-muted">{figure.label}</dt>
          <dd
            data-figure={figure.key}
            className={`mt-0.5 text-lg font-semibold tabular-nums ${
              figure.accent && figure.value > 0 ? "text-brand" : "text-text"
            }`}
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One of the four tiles of totals: two by two on a phone, a row of four from
 * a tablet up. The label and the number sit close, so the tile is no taller
 * than it needs to be; as stacked cards the four took most of a phone's
 * first screen.
 */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "accent" | "positive";
}) {
  const colour =
    value === 0 ? "text-text" : tone === "accent" ? "text-brand" : tone === "positive" ? "text-positive" : "text-text";

  return (
    <div className="rounded-2xl border border-line-strong bg-raised p-4 shadow-card">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-semibold tracking-tight sm:text-3xl ${colour}`}>{value}</dd>
    </div>
  );
}
