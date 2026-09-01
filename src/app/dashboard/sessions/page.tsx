import type { Metadata } from "next";
import Link from "next/link";

import { DeadlineBadge } from "@/components/deadline-badge";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, isOpen } from "@/lib/format";
import { listVisibleSessions, sessionStats } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Casting sessions",
  description: "Every production you are casting, and the window each one is open for.",
};

export default async function SessionsPage({
  searchParams,
}: PageProps<"/dashboard/sessions">) {
  const user = await requireUser("/dashboard/sessions");
  const [sessions, stats, params] = await Promise.all([
    listVisibleSessions(user),
    sessionStats(user),
    searchParams,
  ]);

  const open = sessions.filter((session) => isOpen(session)).length;
  const drafts = sessions.filter((session) => session.publishedAt === null).length;
  const atLimit = user.maxSessions !== null && sessions.length >= user.maxSessions;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      {params.removed ? (
        <p
          role="status"
          className="mb-8 rounded-2xl border border-line bg-surface p-4 text-sm text-muted"
        >
          The casting session was removed, along with its roles and their submissions.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Casting sessions</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Your productions
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            A session is one production&rsquo;s casting window. Every role inside it opens and
            closes together, and a performer submits to the session once rather than once per
            role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {atLimit ? null : (
            <ButtonLink href="/dashboard/sessions/new">New production</ButtonLink>
          )}
        </div>
      </div>

      {atLimit ? (
        <p className="mt-8 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
          Your account covers {user.maxSessions}{" "}
          {user.maxSessions === 1 ? "production" : "productions"} and you have used{" "}
          {user.maxSessions === 1 ? "it" : "them all"}. Ask the administrator to extend it if you
          need another.
        </p>
      ) : null}

      {sessions.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {open} of {sessions.length}{" "}
            {sessions.length === 1 ? "session is" : "sessions are"} accepting submissions now.
            {drafts > 0
              ? ` ${drafts} ${drafts === 1 ? "is a draft" : "are drafts"}, not yet published — nobody can open ${drafts === 1 ? "its" : "their"} link.`
              : ""}
            {user.maxSessions !== null
              ? ` Your account covers ${user.maxSessions} ${user.maxSessions === 1 ? "production" : "productions"}.`
              : ""}
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {sessions.map((session) => {
              const count = stats.get(session.id);
              return (
                <li key={session.id}>
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium transition-colors group-hover:text-accent">
                        {session.name}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {session.company} · {formatDate(session.opensAt)} –{" "}
                        {formatDate(session.closesAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {session.publishedAt === null ? <Badge tone="accent">Draft</Badge> : null}
                      <Badge tone="outline">
                        {count?.roles ?? 0} {count?.roles === 1 ? "role" : "roles"}
                      </Badge>
                      <Badge tone={count?.submissions ? "accent" : "outline"}>
                        {count?.submissions ?? 0}{" "}
                        {count?.submissions === 1 ? "submission" : "submissions"}
                      </Badge>
                      <DeadlineBadge session={session} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="No casting sessions yet"
            description="Open a production, then post its roles into it. The production holds the dates, so the roles do not have to."
            action={<ButtonLink href="/dashboard/sessions/new">New production</ButtonLink>}
          />
        </div>
      )}
    </div>
  );
}
