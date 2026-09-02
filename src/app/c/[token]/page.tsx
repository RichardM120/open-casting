import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineBadge } from "@/components/deadline-badge";
import { Badge, Eyebrow } from "@/components/ui";
import { ageRange, formatDateTime, isOpen, notYetOpen, roleWindow } from "@/lib/format";
import { canPreview } from "@/lib/preview";
import { listSessionRoles } from "@/lib/roles";
import { getSessionByToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * A production's casting call. This is the only page an applicant ever sees, and
 * the share token in the URL is the whole of the authorisation, so it is kept
 * out of search results rather than relying on nobody linking to it.
 */
export async function generateMetadata({
  params,
}: PageProps<"/c/[token]">): Promise<Metadata> {
  const session = await getSessionByToken((await params).token);
  return {
    title: session ? `${session.name} casting` : "Casting call not found",
    description: session?.synopsis.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function CastingCallPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const session = await getSessionByToken(token);
  if (!session) notFound();

  // A draft is not a casting call yet. Its owner can open the link to check
  // what applicants will see; to anyone else it does not exist.
  const preview = session.publishedAt === null;
  if (preview && !(await canPreview(session))) notFound();

  const roles = await listSessionRoles(session.id);
  const open = isOpen(session);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      {preview ? (
        <p className="mb-8 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm leading-relaxed text-text">
          <strong>Draft preview.</strong> This is exactly what an applicant sees, except that the
          form is not there. Nobody else can open this link until you publish it.
        </p>
      ) : null}

      <Eyebrow>Casting call</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {session.name}
      </h1>
      <p className="mt-2 text-lg text-muted">{session.company}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <DeadlineBadge session={session} />
        <Badge tone="outline">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
        </Badge>
      </div>

      <p className="mt-6 max-w-prose leading-relaxed text-muted">{session.synopsis}</p>

      <p className="mt-6 max-w-prose rounded-xl border border-line bg-raised px-4 py-3 text-sm leading-relaxed text-muted">
        {preview
          ? "Not published. Publish it from your dashboard and this link starts working."
          : session.closedAt
            ? `Casting closed on ${formatDateTime(session.closedAt)}. The brief stays up for reference.`
            : notYetOpen(session)
              ? `Submissions open on ${formatDateTime(session.opensAt)}. Read the roles now and have a tape ready.`
              : open
                ? `Submissions are open until ${formatDateTime(session.closesAt)}. Pick the one role that fits you best. It is one submission per person for this production, whichever role you go for.`
                : `Submissions closed on ${formatDateTime(session.closesAt)}. The brief stays up for reference.`}
      </p>

      {roles.length > 0 ? (
        <ul className="mt-10 flex flex-col gap-4">
          {roles.map((role) => (
            <li key={role.id}>
              <Link
                href={`/c/${token}/${role.slug}`}
                className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{role.productionType}</Badge>
                  {role.selfTape ? <Badge tone="outline">Self-tape</Badge> : null}
                  <DeadlineBadge session={roleWindow(role)} />
                </div>

                <h2 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-accent">
                  {role.title}
                </h2>
                <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                  {role.characterBrief}
                </p>

                <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-4">
                  <Meta label="Location" value={role.location} />
                  <Meta label="Playing age" value={ageRange(role.ageMin, role.ageMax)} />
                  <Meta label="Rate" value={role.rate} />
                  <Meta label="Shoot dates" value={role.shootDates} />
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-line-strong p-7 text-sm text-muted">
          The roles for this production have not been posted yet. Keep the link, because they
          will appear here.
        </p>
      )}

      <p className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-faint">
        You were sent this link by the production casting it. It is not listed anywhere and there
        is nothing else to browse. Open Casting is the tool they use to run this call, not a job
        board.
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="truncate text-text" title={value}>
        {value}
      </dd>
    </div>
  );
}
