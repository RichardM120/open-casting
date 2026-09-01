import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/deadline-badge";
import { SubmissionForm, SubmissionsClosed } from "@/components/submission-form";
import { Badge, Eyebrow } from "@/components/ui";
import { ageRange, formatDate, formatRelative, isOpen, notYetOpen, roleWindow } from "@/lib/format";
import { canPreview } from "@/lib/preview";
import { getSessionRole } from "@/lib/roles";
import { getSessionByToken } from "@/lib/sessions";
import { listSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/c/[token]/[roleId]">): Promise<Metadata> {
  const { token, roleId } = await params;
  const session = await getSessionByToken(token);
  const role = session ? await getSessionRole(session.id, roleId) : null;
  return {
    title: role ? `${role.title} — ${role.production}` : "Role not found",
    description: role?.characterBrief.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function RolePage({ params }: PageProps<"/c/[token]/[roleId]">) {
  const { token, roleId } = await params;

  // The token authorises, and the role is looked up inside the production it
  // names — so one production's link cannot reach another's role at all.
  const session = await getSessionByToken(token);
  const role = session ? await getSessionRole(session.id, roleId) : null;
  if (!session || !role) notFound();

  // An unpublished production is visible to its own side only, as a preview.
  if (session.publishedAt === null && !(await canPreview(session))) notFound();

  const submissions = await listSubmissions(role.id);
  const window = roleWindow(role);
  const open = isOpen(window);
  const upcoming = notYetOpen(window);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link
        href={`/c/${token}`}
        className="text-sm text-muted transition-colors hover:text-text"
      >
        ← All roles for {role.session.name}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{role.productionType}</Badge>
            {role.selfTape ? <Badge tone="outline">Self-tape accepted</Badge> : null}
            <DeadlineBadge session={window} />
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {role.title}
          </h1>
          <p className="mt-2 text-lg text-muted">
            {role.production} · cast by {role.castingDirector} at {role.company}
          </p>

          <p className="mt-4 max-w-prose rounded-xl border border-line bg-raised px-4 py-3 text-sm leading-relaxed text-muted">
            Part of the <strong className="text-text">{role.session.name}</strong> casting
            session, which takes submissions from {formatDate(role.session.opensAt)} to{" "}
            {formatDate(role.session.closesAt)}
            {role.session.closedAt
              ? `, and was closed early on ${formatDate(role.session.closedAt)}`
              : ""}
            . One submission per person per production, whichever role you go for.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3">
            <Detail label="Location" value={role.location} />
            <Detail label="Playing age" value={ageRange(role.ageMin, role.ageMax)} />
            <Detail label="Union" value={role.unionStatus} />
            <Detail label="Pay" value={role.payType} />
            <Detail label="Rate" value={role.rate} />
            <Detail label="Shoot dates" value={role.shootDates} />
            <Detail label="Opens" value={formatDate(role.session.opensAt)} />
            <Detail label="Closes" value={formatDate(role.session.closesAt)} />
            <Detail label="Posted" value={formatRelative(role.postedAt)} />
            <Detail
              label="Submissions"
              value={`${submissions.length} so far`}
            />
          </dl>

          <Section title="The production">
            <p>{role.synopsis}</p>
          </Section>

          <Section title="The character">
            <p>{role.characterBrief}</p>
          </Section>

          {role.requirements.length > 0 ? (
            <Section title="What the role needs">
              <ul className="flex flex-col gap-2.5">
                {role.requirements.map((requirement) => (
                  <li key={requirement} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    {requirement}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {open ? (
            <SubmissionForm
              roleId={role.id}
              roleTitle={role.title}
              session={role.session.name}
              closesOn={formatDate(role.session.closesAt)}
              disclaimer={role.disclaimer}
              backTo={`/c/${token}`}
            />
          ) : (
            <SubmissionsClosed
              session={role.session.name}
              opensOn={upcoming ? formatDate(role.session.opensAt) : undefined}
              backTo={`/c/${token}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}
