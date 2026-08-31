import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/role-card";
import { SubmissionForm, SubmissionsClosed } from "@/components/submission-form";
import { Badge, Eyebrow } from "@/components/ui";
import { ageRange, formatDate, formatRelative, isOpen } from "@/lib/format";
import { getRole } from "@/lib/roles";
import { listSubmissions } from "@/lib/submissions";

export async function generateMetadata({
  params,
}: PageProps<"/roles/[id]">): Promise<Metadata> {
  const role = await getRole((await params).id);
  if (!role) return { title: "Role not found" };

  return {
    title: `${role.title} — ${role.production}`,
    description: role.characterBrief.slice(0, 160),
  };
}

export default async function RolePage({ params }: PageProps<"/roles/[id]">) {
  const { id } = await params;
  const role = await getRole(id);
  if (!role) notFound();

  const submissions = await listSubmissions(role.id);
  const open = isOpen(role);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link
        href="/roles"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        ← All roles
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{role.productionType}</Badge>
            {role.selfTape ? <Badge tone="outline">Self-tape accepted</Badge> : null}
            <DeadlineBadge role={role} />
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {role.title}
          </h1>
          <p className="mt-2 text-lg text-muted">
            {role.production} · cast by {role.castingDirector} at {role.company}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3">
            <Detail label="Location" value={role.location} />
            <Detail label="Playing age" value={ageRange(role.ageMin, role.ageMax)} />
            <Detail label="Union" value={role.unionStatus} />
            <Detail label="Pay" value={role.payType} />
            <Detail label="Rate" value={role.rate} />
            <Detail label="Shoot dates" value={role.shootDates} />
            <Detail label="Closes" value={formatDate(role.deadline)} />
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
              disclaimer={role.disclaimer}
            />
          ) : (
            <SubmissionsClosed />
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
