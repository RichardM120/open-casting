import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";
import { notFound } from "next/navigation";

import { ActivityList } from "@/components/activity-list";
import { DeadlineBadge } from "@/components/deadline-badge";
import { StatusBadge } from "@/components/status-badge";
import { SubmissionStatusControl } from "@/components/submission-status-control";
import { Badge, Button, ButtonLink, CARD, cx, Eyebrow, ROW_MAIN, SectionHead, STACK } from "@/components/ui";
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
import { formatHeight } from "@/lib/height";
import { specialAnswersFor, submissionsWithSpecialAnswers } from "@/lib/special";
import { SPECIAL_RETENTION_DAYS } from "@/lib/types";
import { getVisibleRole } from "@/lib/roles";
import { shareSlug } from "@/lib/sessions";
import { PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { ProfilePhoto } from "@/components/profile-photo";
import { mediaSrc } from "@/lib/media";
import { countsForRole, listSubmissions } from "@/lib/submissions";
import type { MediaSlot, SpecialAnswer, SpecialQuestion, Submission } from "@/lib/types";
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
  // Answers about a protected characteristic: the text for whoever may read
  // it, and only the fact of an answer for anyone else.
  const answers = role ? await specialAnswersFor(role, user) : new Map<string, SpecialAnswer>();
  const answered = role?.specialQuestion ? await submissionsWithSpecialAnswers(role.id) : new Set<string>();
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
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

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className={ROW_MAIN}>
          <Eyebrow>{role.production}</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{role.title}</h1>
          <p className="mt-2 text-muted">
            {role.location} · playing age {ageRange(role.ageMin, role.ageMax)} · closes{" "}
            {formatDateTime(role.session.closesAt)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DeadlineBadge session={roleWindow(role)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <section className={cx(CARD, STACK)} aria-labelledby="submissions-heading">
        <SectionHead
          id="submissions-heading"
          title="Submissions"
          line={
            !open
              ? role.closedAt
                ? `Closed early on ${formatDateTime(role.closedAt)}. The role stays up for reference and takes no new submissions.`
                : role.session.closedAt
                  ? `${role.production} was closed early on ${formatDateTime(role.session.closedAt)}, which closed every role in it.`
                  : "Outside the casting call's casting window. The role stays up for reference and takes no new submissions."
              : counts.total === 0
                ? "None yet. They appear here as they come in, newest first."
                : `${counts.total} in total, newest first. Move each one through New, Shortlisted, Callback and Declined as you work.`
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="outline">{counts.total} total</Badge>
          <Count value={counts.New} label="new" tone="neutral" />
          <Count value={counts.Shortlisted} label="shortlisted" tone="accent" />
          <Count value={counts.Callback} label="callback" tone="positive" />
          <Count value={counts.Declined} label="declined" tone="danger" />
        </div>
        {submissions.length > 0 ? (
          <>
            <ul className="mt-5 flex flex-col gap-3">
              {submissions.map((submission) => (
                <SubmissionCard
                  slots={role.mediaSlots}
                  question={role.specialQuestion}
                  special={answers.get(submission.id) ?? null}
                  answered={answered.has(submission.id)}
                  specialDays={role.session.specialRetentionDays ?? SPECIAL_RETENTION_DAYS}
                  key={submission.id}
                  submission={submission}
                />
              ))}
            </ul>
            <Pagination
              page={page}
              total={counts.total}
              pageSize={PAGE_SIZE}
              href={(n) => (n > 1 ? `/dashboard/roles/${id}?page=${n}` : `/dashboard/roles/${id}`)}
            />
          </>
        ) : null}
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="history-heading">
        <SectionHead id="history-heading" title="History" line="Everything that happened to this role, newest first." />
        <div className="mt-5">
          <ActivityList
            entries={activity}
            emptyDescription="Nothing has been recorded against this role yet."
          />
        </div>
      </section>

      {user.role === "admin" ? (
        <details className="mt-10 rounded-2xl border border-danger/30 bg-raised p-6">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-danger sm:min-h-0">
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
              <input type="checkbox" name="confirm" required className="size-5 accent-accent sm:size-4" />
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

function SubmissionCard({
  submission,
  slots,
  question,
  special,
  answered,
  specialDays,
}: {
  submission: Submission;
  slots: MediaSlot[];
  /** The role's question about a protected characteristic, if it asks one. */
  question: SpecialQuestion | null;
  /** The answer, for a viewer allowed to read it. */
  special: SpecialAnswer | null;
  /** Whether an answer exists, for a viewer who may not read it. */
  answered: boolean;
  /** How long the answer survives casting closing, on this casting call. */
  specialDays: number;
}) {
  // Every video sent, or the one a submission from before there were slots holds.
  const videos = submission.videos.length
    ? submission.videos
    : submission.videoUrl
      ? [{ slot: "tape", url: submission.videoUrl, name: "" }]
      : [];
  const labelFor = (key: string) =>
    slots.find((slot) => slot.key === key)?.label ?? (key === "tape" ? "Self-tape or showreel" : "Video");
  return (
    <li className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      {/*
        On a phone the applicant comes first, across the whole card, and the
        status control sits on its own row beneath: beside the control and
        the photo, the name and where they are had a third of the card and
        broke a word to a line. From sm up the control leads the row, where
        a thumb lands, so a decision is one tap away.
      */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <SubmissionStatusControl
          submissionId={submission.id}
          status={submission.status}
          className="order-last sm:order-none"
        />
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <ProfilePhoto url={submission.photoUrl} name={submission.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="min-w-0 font-medium wrap-anywhere">{submission.name}</h3>
              <StatusBadge status={submission.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {[
                submission.location,
                submission.residency ? `resident in ${submission.residency}` : "",
                submission.heightCm ? formatHeight(submission.heightCm) : "",
                String(submission.age),
                `submitted ${formatRelative(submission.submittedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {submission.coverNote ? (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
          {submission.coverNote}
        </p>
      ) : null}

      {question && (special || answered) ? (
        <div className="mt-4 max-w-prose rounded-xl border border-line bg-raised p-4 text-sm">
          <p className="text-xs font-medium text-muted">{question.question}</p>
          {special ? (
            <p className="mt-1 text-text">{special.answer}</p>
          ) : (
            <p className="mt-1 text-muted">
              Answered. Only the account that posted the role, and the site administrator, can read
              it.
            </p>
          )}
          <p className="mt-2 text-xs text-faint">
            Special category data, held apart from the rest and deleted {specialDays} days after
            casting closes.
          </p>
        </div>
      ) : null}

      {videos.map((video) => (
        // Nothing is fetched until the director presses play: a long list of
        // tapes should not pull every one of them down on the way in.
        <figure key={video.url} className="mt-4">
          <figcaption className="text-xs font-medium text-muted">{labelFor(video.slot)}</figcaption>
          <video
            controls
            preload="none"
            src={mediaSrc(video.url)}
            className="mt-1.5 max-h-80 w-full max-w-xl rounded-xl border border-line bg-black"
          >
            <a href={mediaSrc(video.url)}>Watch the video</a>
          </video>
        </figure>
      ))}

      {submission.acceptedTerms ? (
        <details className="mt-4 rounded-xl border border-line bg-raised p-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-muted sm:min-h-0">
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
          className="min-w-0 text-brand underline-offset-4 wrap-anywhere hover:underline"
        >
          {submission.email}
        </a>
        {submission.phone ? <span className="text-muted">{submission.phone}</span> : null}
        {submission.available ? (
          <span className="text-positive">Available for the shoot dates</span>
        ) : null}
        {submission.reelUrl ? (
          <ExternalLink href={submission.reelUrl}>Showreel</ExternalLink>
        ) : null}
        {submission.profileUrl ? (
          <ExternalLink href={submission.profileUrl}>Profile</ExternalLink>
        ) : null}
        {videos.map((video) => (
          <ExternalLink key={video.url} href={mediaSrc(video.url)}>
            {videos.length > 1 ? labelFor(video.slot) : "Video"}
          </ExternalLink>
        ))}
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
