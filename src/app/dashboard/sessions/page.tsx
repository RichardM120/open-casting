import type { Metadata } from "next";
import Link from "next/link";

import { DeadlineBadge } from "@/components/role-card";
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
          <ButtonLink href="/dashboard" variant="secondary">
            Roles
          </ButtonLink>
          <ButtonLink href="/dashboard/sessions/new">Open a session</ButtonLink>
        </div>
      </div>

      {sessions.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {open} of {sessions.length}{" "}
            {sessions.length === 1 ? "session is" : "sessions are"} accepting submissions now.
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
            description="Open a session for the production you are casting, then post its roles into it. The session holds the dates, so the roles do not have to."
            action={<ButtonLink href="/dashboard/sessions/new">Open a session</ButtonLink>}
          />
        </div>
      )}
    </div>
  );
}
