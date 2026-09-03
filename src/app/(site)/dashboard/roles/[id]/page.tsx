import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";
import { notFound } from "next/navigation";

import { ActivityList } from "@/components/activity-list";
import { DeadlineBadge } from "@/components/deadline-badge";
import { StatusBadge } from "@/components/status-badge";
import { SubmissionStatusControl } from "@/components/submission-status-control";
import { Badge, Button, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { removeRole, toggleRoleClosed } from "@/lib/actions";
import { listActivity } from "@/lib/activity";
import { currentUser, requireUser } from "@/lib/auth";
import {
  ageRange,
  formatDate,
  formatDateTime,
  formatRelative,
  isOpen,
  roleWindow,
} from "@/lib/format";
import { getVisibleRole } from "@/lib/roles";
import { shareSlug } from "@/lib/sessions";
import { PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { ProfilePhoto } from "@/components/profile-photo";
import { mediaSrc } from "@/lib/media";
import { countsForRole, listSubmissions } from "@/lib/submissions";
import type { Submission } from "@/lib/types";
import { Breadcrumb } from "@/components/breadcrumb";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/roles/[id]">): Promise<Metadata> {
  const user = await currentUser();
  const role = user ? await getVisibleRole((await params).id, user) : null;
  return { title: role ? role.title : "Role not found" };
}

export default async function RoleSubmissionsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/roles/[id]">) {
  const user = await requireUser(`/dashboard/roles/${(await params).id}`);
  const { id } = await params;

  // A role this account may not see is a 404, not a 403: someone guessing ids
  // should not be able to tell which ones exist.
  const role = await getVisibleRole(id, user);
  if (!role) notFound();

  const [counts, activity, query] = await Promise.all([
    countsForRole(id),
    listActivity(user, { roleId: id, limit: 30 }),
    searchParams,
  ]);
  // Pages of twenty-five, newest first; a page past the end shows the last.
  const pages = Math.max(1, Math.ceil(counts.total / PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const submissions = await listSubmissions(id, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const justPosted = query.posted === "1";
  const justSaved = query.saved === "1";
  const open = isOpen(roleWindow(role));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { href: `/dashboard/sessions/${role.sessionId}`, label: role.production }, { label: role.title }]} />
      <SetupProgress stage={role.session.publishedAt ? 4 : 3} sessionId={role.sessionId} />
      <HelpNote title="What to do on this screen" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Submissions to this role arrive here. Move people through <strong>New</strong>, <strong>Shortlisted</strong>, <strong>Callback</strong> and <strong>Declined</strong> as you work; nothing is emailed to them automatically.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Their details are deleted thirty days after the production finishes. Export anything you need before then.' }} />
      </HelpNote>

      {justPosted || justSaved ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          {justPosted
            ? role.session.publishedAt
              ? "Role posted. It is on the casting call's link now."
              : "Role posted. Publish the casting call when you are ready for applicants to see it."
            : "Changes saved."}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{role.production}</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{role.title}</h1>
          <p className="mt-2 text-muted">
            {role.location} · playing age {ageRange(role.ageMin, role.ageMax)} · closes{" "}
            {formatDateTime(role.session.closesAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge session={roleWindow(role)} />
          <ButtonLink
            href={`/c/${shareSlug(role.session)}/${role.slug}`}
            variant="secondary"
            size="sm"
          >
            View as an applicant
          </ButtonLink>
          <ButtonLink href={`/dashboard/roles/${role.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <form action={toggleRoleClosed}>
            <input type="hidden" name="roleId" value={role.id} />
            <input type="hidden" name="closed" value={role.closedAt ? "0" : "1"} />
            <Button type="submit" variant="secondary" size="sm">
              {role.closedAt ? "Reopen" : "Close early"}
            </Button>
          </form>
        </div>
      </div>

      {!open ? (
        <p className="mt-6 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
          {role.closedAt
            ? `Closed early on ${formatDateTime(role.closedAt)}. The role stays up for reference and takes no new submissions.`
            : role.session.closedAt
              ? `${role.production} was closed early on ${formatDateTime(role.session.closedAt)}, which closed every role in it.`
              : "Outside the casting call's casting window. The role stays up for reference and takes no new submissions."}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Badge tone="outline">{counts.total} total</Badge>
        <Count value={counts.New} label="new" tone="neutral" />
        <Count value={counts.Shortlisted} label="shortlisted" tone="accent" />
        <Count value={counts.Callback} label="callback" tone="positive" />
        <Count value={counts.Declined} label="declined" tone="danger" />
      </div>

      {submissions.length > 0 ? (
        <>
          <ul className="mt-8 flex flex-col gap-4">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </ul>
          <Pagination
            page={page}
            total={counts.total}
            pageSize={PAGE_SIZE}
            href={(n) => (n > 1 ? `/dashboard/roles/${id}?page=${n}` : `/dashboard/roles/${id}`)}
          />
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No submissions yet"
            description="They will appear here as they come in, newest first."
            action={
              <ButtonLink
                href={`/c/${shareSlug(role.session)}/${role.slug}`}
                variant="secondary"
                size="sm"
              >
                View as an applicant
              </ButtonLink>
            }
          />
        </div>
      )}

      <section className="mt-14">
        <Eyebrow>History</Eyebrow>
        <h2 className="mt-2 mb-6 text-xl font-semibold tracking-tight">
          Everything that happened to this role
        </h2>
        <ActivityList
          entries={activity}
          emptyDescription="Nothing has been recorded against this role yet."
        />
      </section>

      {user.role === "admin" ? (
        <details className="mt-10 rounded-2xl border border-danger/30 bg-surface p-6">
          <summary className="cursor-pointer text-sm font-medium text-danger">
            Remove this role
          </summary>
          <form action={removeRole} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="roleId" value={role.id} />
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              This deletes the role and{" "}
              <strong className="text-text">
                all {counts.total} {counts.total === 1 ? "submission" : "submissions"}
              </strong>{" "}
              made to it, including the contact details applicants gave. It cannot be undone.
              To stop new submissions without destroying anything, use{" "}
              <strong className="text-text">Close early</strong> instead.
            </p>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
              <input type="checkbox" name="confirm" required className="size-4 accent-accent" />
              I understand this permanently deletes the submissions too.
            </label>
            <div>
              <Button type="submit" variant="danger" size="sm">
                Remove role and submissions
              </Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}

/** A count of zero is not news, so it stays grey rather than shouting in colour. */
function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "neutral" | "accent" | "positive" | "danger";
}) {
  return (
    <Badge tone={value === 0 ? "outline" : tone}>
      {value} {label}
    </Badge>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-start gap-4">
        {/* The status first, where a thumb lands, so a decision is one tap away. */}
        <SubmissionStatusControl submissionId={submission.id} status={submission.status} />
        <ProfilePhoto url={submission.photoUrl} name={submission.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-medium">{submission.name}</h2>
            <StatusBadge status={submission.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {submission.location} · {submission.age} · submitted{" "}
            {formatRelative(submission.submittedAt)}
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
        {submission.coverNote}
      </p>

      {submission.videoUrl ? (
        // Nothing is fetched until the director presses play: a long list of
        // tapes should not pull every one of them down on the way in.
        <video
          controls
          preload="none"
          src={mediaSrc(submission.videoUrl)}
          className="mt-4 max-h-80 w-full max-w-xl rounded-xl border border-line bg-black"
        >
          <a href={mediaSrc(submission.videoUrl)}>Watch the video</a>
        </video>
      ) : null}

      {submission.acceptedTerms ? (
        <details className="mt-4 rounded-xl border border-line bg-raised p-4">
          <summary className="cursor-pointer text-xs text-muted">
            Accepted your terms on {formatDate(submission.acceptedAt ?? submission.submittedAt)}
          </summary>
          <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-faint">
            {submission.acceptedTerms}
          </p>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
        <a
          href={`mailto:${submission.email}`}
          className="text-brand underline-offset-4 hover:underline"
        >
          {submission.email}
        </a>
        <span className="text-muted">{submission.phone}</span>
        {submission.reelUrl ? (
          <ExternalLink href={submission.reelUrl}>Showreel</ExternalLink>
        ) : null}
        {submission.profileUrl ? (
          <ExternalLink href={submission.profileUrl}>Profile</ExternalLink>
        ) : null}
        {submission.videoUrl ? (
          <ExternalLink href={mediaSrc(submission.videoUrl)}>Video</ExternalLink>
        ) : null}
      </div>
    </li>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
    >
      {children} ↗
    </a>
  );
}
