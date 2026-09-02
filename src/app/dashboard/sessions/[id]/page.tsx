import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/deadline-badge";
import { ShareLink } from "@/components/share-link";
import { Badge, Button, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { publishCastingSession, removeSession, toggleSessionClosed } from "@/lib/actions";
import { currentUser, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, isOpen, notYetOpen } from "@/lib/format";
import { listSessionRoles } from "@/lib/roles";
import { requestOrigin } from "@/lib/origin";
import { RETENTION_DAYS, daysUntilPurge, purgeDate } from "@/lib/retention";
import { getVisibleSession, shareSlug } from "@/lib/sessions";
import { countsByRole } from "@/lib/submissions";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/sessions/[id]">): Promise<Metadata> {
  const user = await currentUser();
  const session = user ? await getVisibleSession((await params).id, user) : null;
  return { title: session ? session.name : "Casting call not found" };
}

export default async function SessionPage({
  params,
  searchParams,
}: PageProps<"/dashboard/sessions/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/sessions/${id}`);

  // A casting call this account may not see is a 404, not a 403. The same rule as
  // roles, so guessing ids tells you nothing about which ones exist.
  const session = await getVisibleSession(id, user);
  if (!session) notFound();

  const [roles, counts, query, origin] = await Promise.all([
    listSessionRoles(id),
    countsByRole(user),
    searchParams,
    requestOrigin(),
  ]);
  const shareUrl = `${origin}/c/${shareSlug(session)}`;

  const submissions = roles.reduce(
    (total, role) => total + (counts.get(role.id)?.total ?? 0),
    0,
  );
  const open = isOpen(session);
  const draft = session.publishedAt === null;

  const flash =
    query.published === "1"
      ? "Published. The link below is live, so send it wherever you want the call to go."
      : query.created === "1"
        ? "Casting call saved as a draft. Post the roles for it, then publish when you are ready. You can come back to it from Casting calls at any time."
        : query.saved === "1"
          ? "Changes saved. Every role in this casting call follows the new times."
          : query.removed === "1"
            ? "The role was removed, along with its submissions."
            : null;

  const rolesSection = (
    <>
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
                      {role.location}
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
            title="No roles in this casting call yet"
            description="Post the roles you are casting. They open and close with the casting call, so there is no closing date to set per role."
            action={
              <ButtonLink href={`/dashboard/roles/new?session=${session.id}`} size="sm">
                Post a role
              </ButtonLink>
            }
          />
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <SetupProgress stage={draft ? (roles.length === 0 ? 2 : 3) : 4} />
      <HelpNote title="What to do on this screen" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: '<strong>Post the roles</strong> first. Then <strong>publish</strong>: that is the moment the share link starts working, and it cannot be undone.' }} />
        <p dangerouslySetInnerHTML={{ __html: "Send the link wherever you want the call to go. To stop a call, close it early; removing it deletes the applicants' details." }} />
      </HelpNote>
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Casting calls
      </Link>

      {flash ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          {flash}
        </p>
      ) : null}

      {query.error === "empty" ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          Post at least one role before publishing. A link that opens on an empty casting call is
          worse than no link.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{session.productionType}</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{session.name}</h1>
          <p className="mt-2 text-muted">
            {session.productionCompany ? `${session.productionCompany} · ` : ""}open{" "}
            {formatDateTime(session.opensAt)} to{" "}
            {formatDateTime(session.closesAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={draft ? "accent" : "positive"}>{draft ? "Draft" : "Published"}</Badge>
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
          <ButtonLink
            href={`/dashboard/roles/new?session=${session.id}`}
            size="sm"
            variant={draft ? "primary" : "secondary"}
          >
            Post a role
          </ButtonLink>
        </div>
      </div>

      <p className="mt-6 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
        {session.closedAt
          ? `Closed early on ${formatDateTime(session.closedAt)}. Every role in this casting call stopped taking submissions at that moment.`
          : notYetOpen(session)
            ? `Not open yet. The roles below can be seen, but nobody can submit until ${formatDateTime(session.opensAt)}.`
            : open
              ? `Accepting submissions until ${formatDateTime(session.closesAt)}. An applicant may submit to this casting call once, whichever role they go for.`
              : `Past its closing time. The roles stay up for reference and take no new submissions.`}
      </p>

      {draft ? rolesSection : null}

      {draft ? (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft p-6">
          <h2 className="text-lg font-semibold tracking-tight">Not published yet</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Nobody can open this but you. Check it over as an applicant will see it, and publish
            when you are happy. That is the moment the link starts working. Everything here is
            saved as you go, so you can leave and come back from Casting calls whenever you like.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
            <Ready done={roles.length > 0}>
              {roles.length > 0
                ? `${roles.length} ${roles.length === 1 ? "role" : "roles"} posted`
                : "No roles posted yet. You need at least one."}
            </Ready>
            <Ready done>
              Open {formatDateTime(session.opensAt)} to {formatDateTime(session.closesAt)}
            </Ready>
            <Ready done={session.synopsis.length > 0}>Synopsis written</Ready>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form action={publishCastingSession}>
              <input type="hidden" name="sessionId" value={session.id} />
              <Button type="submit" disabled={roles.length === 0}>
                Publish this casting call
              </Button>
            </form>
            <ButtonLink href={`/c/${shareSlug(session)}`} variant="secondary" size="sm">
              Preview as an applicant
            </ButtonLink>
            <ButtonLink href="/dashboard?draft=1" variant="ghost" size="sm">
              Save and finish later
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Publishing cannot be undone. Once the link is out on a post or in a mailout it is out
            of your hands, and unpublishing would only break it for the people who already have
            it. To stop a call, use <strong className="text-muted">Close early</strong> instead.
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft p-6">
          <h2 className="text-lg font-semibold tracking-tight">The link for applicants</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Send this to anyone you want to submit: an Instagram post, a mailout, an agent
            circular. It opens {session.name} and nothing else. There is no listing on Open
            Casting to browse, so this link is the whole of the casting call, and anyone holding
            it can submit while the casting call is open.
          </p>
          <div className="mt-4">
            <ShareLink url={shareUrl} />
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Badge tone="outline">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
        </Badge>
        <Badge tone={submissions ? "accent" : "outline"}>
          {submissions} {submissions === 1 ? "submission" : "submissions"}
        </Badge>
      </div>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">{session.synopsis}</p>

      <p className="mt-4 max-w-prose rounded-xl border border-line bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
        {session.purgedAt
          ? `The applicants' details were removed on ${formatDate(session.purgedAt)}, ${RETENTION_DAYS} days after this casting call finished. The roles and the counts are kept; the names, addresses and notes are gone.`
          : `This production finishes on ${formatDate(session.productionEndsAt)}. Applicants' details are destroyed ${RETENTION_DAYS} days later, on ${formatDate(purgeDate(session.productionEndsAt))}${
              daysUntilPurge(session.productionEndsAt) <= 14
                ? `, which is ${daysUntilPurge(session.productionEndsAt)} days away`
                : ""
            }. Export anything you need before then. The casting call and its roles are kept.`}
      </p>

      {draft ? null : rolesSection}

      {user.role === "admin" ? (
        <details className="mt-10 rounded-2xl border border-danger/30 bg-surface p-6">
          <summary className="cursor-pointer text-sm font-medium text-danger">
            Remove this casting call
          </summary>
          <form action={removeSession} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              This deletes the casting call,{" "}
              <strong className="text-text">
                all {roles.length} {roles.length === 1 ? "role" : "roles"} in it
              </strong>{" "}
              and{" "}
              <strong className="text-text">
                all {submissions} {submissions === 1 ? "submission" : "submissions"}
              </strong>{" "}
              made to them, including the contact details applicants gave. It cannot be undone.
              To stop new submissions without destroying anything, use{" "}
              <strong className="text-text">Close early</strong> instead.
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
              <input type="checkbox" name="confirm" required className="size-4 accent-accent" />
              I understand this permanently deletes the roles and their submissions too.
            </label>
            <div>
              <Button type="submit" variant="danger" size="sm">
                Remove casting call, roles and submissions
              </Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}

/** A ready-to-publish line: what is done, and what is still missing. */
function Ready({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden="true" className={done ? "text-positive" : "text-danger"}>
        {done ? "✓" : "✗"}
      </span>
      <span className={done ? "" : "text-danger"}>{children}</span>
    </li>
  );
}
