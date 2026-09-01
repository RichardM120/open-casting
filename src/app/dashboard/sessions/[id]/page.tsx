import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/role-card";
import { Badge, Button, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { removeSession, toggleSessionClosed } from "@/lib/actions";
import { currentUser, requireUser } from "@/lib/auth";
import { formatDate, isOpen, notYetOpen } from "@/lib/format";
import { listSessionRoles } from "@/lib/roles";
import { getVisibleSession } from "@/lib/sessions";
import { countsByRole } from "@/lib/submissions";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/sessions/[id]">): Promise<Metadata> {
  const user = await currentUser();
  const session = user ? await getVisibleSession((await params).id, user) : null;
  return { title: session ? `Casting session — ${session.name}` : "Session not found" };
}

export default async function SessionPage({
  params,
  searchParams,
}: PageProps<"/dashboard/sessions/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/sessions/${id}`);

  // A session this account may not see is a 404, not a 403 — the same rule as
  // roles, so guessing ids tells you nothing about which ones exist.
  const session = await getVisibleSession(id, user);
  if (!session) notFound();

  const [roles, counts, query] = await Promise.all([
    listSessionRoles(id),
    countsByRole(user),
    searchParams,
  ]);

  const submissions = roles.reduce(
    (total, role) => total + (counts.get(role.id)?.total ?? 0),
    0,
  );
  const open = isOpen(session);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/dashboard/sessions"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        ← All casting sessions
      </Link>

      {query.created === "1" || query.saved === "1" ? (
        <p className="mt-6 rounded-xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive">
          {query.created === "1"
            ? "Casting session opened. Post the roles for it below."
            : "Changes saved. Every role in this session follows the new dates."}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Casting session</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{session.name}</h1>
          <p className="mt-2 text-muted">
            {session.company} · open {formatDate(session.opensAt)} to{" "}
            {formatDate(session.closesAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge session={session} />
          <ButtonLink href={`/dashboard/sessions/${session.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <form action={toggleSessionClosed}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="closed" value={session.closedAt ? "0" : "1"} />
            <Button type="submit" variant="secondary" size="sm">
              {session.closedAt ? "Reopen" : "Close early"}
            </Button>
          </form>
          <ButtonLink href={`/roles/new?session=${session.id}`} size="sm">
            Post a role
          </ButtonLink>
        </div>
      </div>

      <p className="mt-6 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
        {session.closedAt
          ? `Closed early on ${formatDate(session.closedAt)}. Every role in this session stopped taking submissions at that moment.`
          : notYetOpen(session)
            ? `Not open yet. The roles below are listed, but nobody can submit until ${formatDate(session.opensAt)}.`
            : open
              ? `Accepting submissions until the end of ${formatDate(session.closesAt)}. A performer may submit to this session once, whichever role they go for.`
              : `Past its closing date. The roles stay up for reference and take no new submissions.`}
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Badge tone="outline">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
        </Badge>
        <Badge tone={submissions ? "accent" : "outline"}>
          {submissions} {submissions === 1 ? "submission" : "submissions"}
        </Badge>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">{session.synopsis}</p>

      {roles.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3">
          {roles.map((role) => {
            const count = counts.get(role.id);
            return (
              <li key={role.id}>
                <Link
                  href={`/dashboard/roles/${role.id}`}
                  className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium transition-colors group-hover:text-accent">
                      {role.title}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {role.location} · {role.payType}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {count?.New ? <Badge tone="accent">{count.New} to read</Badge> : null}
                    <Badge tone="outline">
                      {count?.total ?? 0} {count?.total === 1 ? "submission" : "submissions"}
                    </Badge>
                    {role.closedAt ? <Badge tone="outline">Closed early</Badge> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No roles in this session yet"
            description="Post the roles you are casting for this production. They inherit the session's dates, so you do not set a closing date per role."
            action={
              <ButtonLink href={`/roles/new?session=${session.id}`} size="sm">
                Post a role
              </ButtonLink>
            }
          />
        </div>
      )}

      {user.role === "admin" ? (
        <details className="mt-10 rounded-2xl border border-danger/30 bg-surface p-6">
          <summary className="cursor-pointer text-sm font-medium text-danger">
            Remove this casting session
          </summary>
          <form action={removeSession} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              This deletes the session,{" "}
              <strong className="text-text">
                all {roles.length} {roles.length === 1 ? "role" : "roles"} in it
              </strong>{" "}
              and{" "}
              <strong className="text-text">
                all {submissions} {submissions === 1 ? "submission" : "submissions"}
              </strong>{" "}
              made to them, including the contact details performers gave. It cannot be undone.
              To stop new submissions without destroying anything, use{" "}
              <strong className="text-text">Close early</strong> instead.
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
              <input type="checkbox" name="confirm" required className="size-4 accent-accent" />
              I understand this permanently deletes the roles and their submissions too.
            </label>
            <div>
              <Button type="submit" variant="danger" size="sm">
                Remove session, roles and submissions
              </Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}
