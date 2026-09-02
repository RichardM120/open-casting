import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { DeadlineBadge } from "@/components/deadline-badge";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { formatDateTime, isOpen, roleWindow } from "@/lib/format";
import { listVisibleRoles, type ListedRole } from "@/lib/roles";
import { listVisibleSessions, sessionStats } from "@/lib/sessions";
import { countsByRole } from "@/lib/submissions";

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
  const [sessions, stats, roles, counts, activity, params] = await Promise.all([
    listVisibleSessions(user),
    sessionStats(user),
    listVisibleRoles(user),
    countsByRole(user),
    listActivity(user, { limit: 8 }),
    searchParams,
  ]);

  const rolesBySession = new Map<string, ListedRole[]>();
  for (const role of roles) {
    rolesBySession.set(role.sessionId, [...(rolesBySession.get(role.sessionId) ?? []), role]);
  }

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
  const atLimit = user.maxSessions !== null && sessions.length >= user.maxSessions;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Every casting call you can see, with its roles underneath. Open one to post roles, publish it, and read what has come in.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Start a new one from <strong>New casting call</strong> in the navigation.' }} />
      </HelpNote>
      {user.onboardedAt ? null : (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-accent-soft p-5">
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
          className="mb-8 rounded-2xl border border-line bg-surface p-4 text-sm text-muted"
        >
          The casting call was removed, along with its roles and their submissions.
        </p>
      ) : null}

      {params.draft ? (
        <p
          role="status"
          className="mb-8 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm text-text"
        >
          Saved as a draft. Nothing is shown to applicants until you publish it, and you can pick
          it up again from the list below whenever you like.
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
            Each one has its own casting window and share link. Post roles into it, and open a
            role to read what has come in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {atLimit ? null : (
            <ButtonLink href="/dashboard/sessions/new">New casting call</ButtonLink>
          )}
        </div>
      </div>

      {atLimit ? (
        <p className="mt-8 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
          Your account covers {user.maxSessions}{" "}
          {user.maxSessions === 1 ? "casting call" : "casting calls"} and you have used{" "}
          {user.maxSessions === 1 ? "it" : "them all"}. Ask the administrator to extend it if you
          need another.
        </p>
      ) : null}

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open now" value={totals.open} />
        <Stat label="Roles" value={totals.roles} />
        <Stat label="Submissions" value={totals.submissions} />
        <Stat label="Still to read" value={totals.toRead} tone="accent" />
      </dl>

      {sessions.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {totals.open} of {sessions.length}{" "}
            {sessions.length === 1 ? "casting call is" : "casting calls are"} accepting submissions
            now.
            {drafts > 0
              ? ` ${drafts} ${drafts === 1 ? "is a draft" : "are drafts"} and not yet published, so nobody can open ${drafts === 1 ? "its" : "their"} link.`
              : ""}
            {user.maxSessions !== null
              ? ` Your account covers ${user.maxSessions} ${user.maxSessions === 1 ? "casting call" : "casting calls"}.`
              : ""}
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {sessions.map((session) => {
              const count = stats.get(session.id);
              const sessionRoles = rolesBySession.get(session.id) ?? [];
              return (
                <li
                  key={session.id}
                  className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/sessions/${session.id}`}
                        className="block truncate font-medium transition-colors hover:text-accent"
                      >
                        {session.name}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {session.productionType}
                        {session.productionCompany ? ` · ${session.productionCompany}` : ""} ·{" "}
                        {formatDateTime(session.opensAt)} to {formatDateTime(session.closesAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {session.publishedAt === null ? (
                        <>
                          <Badge tone="accent">Draft</Badge>
                          <Link
                            href={`/dashboard/sessions/${session.id}`}
                            className="text-sm text-accent underline-offset-4 hover:underline"
                          >
                            Continue setting up
                          </Link>
                        </>
                      ) : null}
                      {count?.unread ? <Badge tone="accent">{count.unread} to read</Badge> : null}
                      <Badge tone="outline">
                        {count?.submissions ?? 0}{" "}
                        {count?.submissions === 1 ? "submission" : "submissions"}
                      </Badge>
                      <DeadlineBadge session={session} />
                    </div>
                  </div>

                  {sessionRoles.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                      {sessionRoles.map((role) => {
                        const roleCount = counts.get(role.id);
                        const open = isOpen(roleWindow(role));
                        return (
                          <li key={role.id}>
                            <Link
                              href={`/dashboard/roles/${role.id}`}
                              className={`inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:border-line-strong hover:text-accent ${open ? "text-text" : "text-muted"}`}
                            >
                              <span>{role.title}</span>
                              <span className="text-xs text-faint">
                                {roleCount?.New
                                  ? `${roleCount.New} to read`
                                  : `${roleCount?.total ?? 0} ${roleCount?.total === 1 ? "submission" : "submissions"}`}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
                      No roles yet.{" "}
                      <Link
                        href={`/dashboard/roles/new?session=${session.id}`}
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        Post the first role
                      </Link>
                    </p>
                  )}
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
    value === 0 ? "text-text" : tone === "accent" ? "text-accent" : tone === "positive" ? "text-positive" : "text-text";

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-3xl font-semibold tracking-tight ${colour}`}>{value}</dd>
    </div>
  );
}
