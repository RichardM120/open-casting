import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/role-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmissionStatusControl } from "@/components/submission-status-control";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { ageRange, formatDate, formatRelative, initials } from "@/lib/format";
import { getVisibleRole } from "@/lib/roles";
import { listSubmissions, summarise } from "@/lib/submissions";
import type { Submission } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/roles/[id]">): Promise<Metadata> {
  const user = await currentUser();
  const role = user ? await getVisibleRole((await params).id, user) : null;
  return { title: role ? `Submissions — ${role.title}` : "Role not found" };
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

  const [submissions, query] = await Promise.all([listSubmissions(id), searchParams]);
  const counts = summarise(submissions);
  const justPosted = query.posted === "1";

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        ← Dashboard
      </Link>

      {justPosted ? (
        <p className="mt-6 rounded-xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive">
          Role posted. It is live on the browse page now.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>{role.production}</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{role.title}</h1>
          <p className="mt-2 text-muted">
            {role.location} · playing age {ageRange(role.ageMin, role.ageMax)} · closes{" "}
            {formatDate(role.deadline)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge deadline={role.deadline} />
          <ButtonLink href={`/roles/${role.id}`} variant="secondary" size="sm">
            View public listing
          </ButtonLink>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Badge tone="outline">{counts.total} total</Badge>
        <Count value={counts.New} label="new" tone="neutral" />
        <Count value={counts.Shortlisted} label="shortlisted" tone="accent" />
        <Count value={counts.Callback} label="callback" tone="positive" />
        <Count value={counts.Declined} label="declined" tone="danger" />
      </div>

      {submissions.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-4">
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No submissions yet"
            description="They will appear here as they come in, newest first."
            action={
              <ButtonLink href={`/roles/${role.id}`} variant="secondary" size="sm">
                View the public listing
              </ButtonLink>
            }
          />
        </div>
      )}
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
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-medium text-muted"
        >
          {initials(submission.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-medium">{submission.name}</h2>
            <StatusBadge status={submission.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {submission.location} · {submission.age} · {submission.unionStatus} · submitted{" "}
            {formatRelative(submission.submittedAt)}
          </p>
        </div>

        <SubmissionStatusControl submissionId={submission.id} status={submission.status} />
      </div>

      <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
        {submission.coverNote}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
        <a
          href={`mailto:${submission.email}`}
          className="text-accent underline-offset-4 hover:underline"
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
