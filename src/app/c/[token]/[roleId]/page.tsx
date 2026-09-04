import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplicantMasthead } from "@/components/applicant-masthead";
import { InclusionStatement, YourData } from "@/components/applicant-notices";
import { reportAddress } from "@/lib/site";
import { aboutFor, consentTextFor } from "@/lib/special";
import { DEFAULT_TAPE_GUIDANCE, SPECIAL_RETENTION_DAYS, retentionOf } from "@/lib/types";
import { formatSeconds } from "@/lib/video";
import { DeadlineBadge } from "@/components/deadline-badge";
import { SubmissionForm, SubmissionsClosed } from "@/components/submission-form";
import { Badge, CARD, cx, SectionHead } from "@/components/ui";
import {
  ageRange,
  formatDateTime,
  formatRelative,
  isOpen,
  notYetOpen,
  roleWindow,
  shootWindow,
} from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { uploadsEnabled } from "@/lib/blob";
import { canPreview } from "@/lib/preview";
import { ShareLink } from "@/components/share-link";
import { getSessionRole, slotsFor } from "@/lib/roles";
import { getSessionByToken, shareSlug } from "@/lib/sessions";
import { countsForSession } from "@/lib/submissions";
import { Breadcrumb } from "@/components/breadcrumb";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/c/[token]/[roleId]">): Promise<Metadata> {
  const { token, roleId } = await params;
  const session = await getSessionByToken(token);
  const role = session ? await getSessionRole(session.id, roleId) : null;
  return {
    title: role ? `${role.title}, ${role.production}` : "Role not found",
    description: role?.characterBrief.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function RolePage({ params }: PageProps<"/c/[token]/[roleId]">) {
  const { token, roleId } = await params;

  // The token authorises, and the role is looked up inside the casting call it
  // names, so one casting call's link cannot reach another's role at all.
  const session = await getSessionByToken(token);
  const role = session ? await getSessionRole(session.id, roleId) : null;
  if (!session || !role) notFound();

  // The casting side sees this page too, before and after publishing, with a
  // banner an applicant never gets: the state, and the link to send out.
  const owner = await canPreview(session);
  if (session.publishedAt === null && !owner) notFound();
  const shareUrl = owner ? `${await requestOrigin()}/c/${shareSlug(session)}` : null;

  const window = roleWindow(role);
  // A capped call stops taking submissions once it is met, whatever its
  // closing time says, so the form goes and the reason is given.
  // This call's own clocks, which are the site's rules unless the client
  // bought something else when it was opened.
  const specialDays = session.specialRetentionDays ?? SPECIAL_RETENTION_DAYS;
  const counts = session.submissionCap === null ? null : await countsForSession(session.id);
  const full = counts !== null && counts.total >= session.submissionCap!;
  const open = isOpen(window) && !full;
  const upcoming = notYetOpen(window);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <ApplicantMasthead heroUrl={session.heroUrl} heroKind={session.heroKind} name={session.name} />
      <Breadcrumb
        trail={[{ href: `/c/${token}`, label: `All roles for ${role.session.name}` }, { label: role.title }]}
      />

      {owner && shareUrl ? (
        <section className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={session.publishedAt ? "positive" : "accent"}>
              {session.publishedAt ? "Published" : "Draft"}
            </Badge>
            <p className="text-sm text-text">
              {session.publishedAt
                ? "This is what applicants see. Share the link below wherever you want the call to go: a post, a story, a mailout."
                : "Only you can see this. Publish the casting call and this link starts working."}
            </p>
          </div>
          <div className="mt-3">
            <ShareLink url={shareUrl} />
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{role.productionType}</Badge>
            <Badge tone={role.paid ? "positive" : "amber"}>{role.paid ? "Paid" : "Unpaid"}</Badge>
            {role.selfTape ? <Badge tone="outline">Self-tape accepted</Badge> : null}
            <DeadlineBadge session={window} />
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {role.title}
          </h1>
          <p className="mt-2 text-lg text-text">
            {role.production} · cast by {role.castingDirector} at {role.company}
          </p>

          <p className="mt-4 max-w-prose leading-relaxed text-text">
            Part of <strong className="text-text">{role.session.name}</strong>, which takes
            submissions from {formatDateTime(role.session.opensAt)} to{" "}
            {formatDateTime(role.session.closesAt)}
            {role.session.closedAt
              ? `, and was closed early on ${formatDateTime(role.session.closedAt)}`
              : ""}
            . One submission per person per casting call, whichever role you go for.
          </p>

          <section className={cx(CARD, "mt-8")} aria-labelledby="details-heading">
          <SectionHead id="details-heading" title="Details" line="Where, when, and who it is for." />
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            <Detail label="Location" value={role.location} />
            <Detail label="Playing age" value={ageRange(role.ageMin, role.ageMax)} />
            <Detail label="Shoot dates" value={shootWindow(role)} />
            <Detail label="Opens" value={formatDateTime(role.session.opensAt)} />
            <Detail label="Closes" value={formatDateTime(role.session.closesAt)} />
            <Detail label="Posted" value={formatRelative(role.postedAt)} />
          </dl>
          </section>

          <Section title="The casting call">
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

          {uploadsEnabled() && !role.hiddenFields.includes("video") && role.mediaSlots.length > 0 ? (
            <Section title="What to send">
              <ol className="flex flex-col gap-4">
                {role.mediaSlots.map((slot, index) => (
                  <li key={slot.key} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">
                        {slot.label}
                        {slot.maxSeconds ? (
                          <span className="font-normal text-muted"> · up to {formatSeconds(slot.maxSeconds)}</span>
                        ) : null}
                        {!slot.required ? <span className="font-normal text-muted"> · optional</span> : null}
                      </p>
                      {slot.brief ? <p className="mt-1 whitespace-pre-line">{slot.brief}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <InclusionStatement session={session} />
          <YourData session={session} reportTo={reportAddress()} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {open ? (
            <SubmissionForm
              uploads={uploadsEnabled()}
              token={token}
              sessionId={session.id}
              roleId={role.id}
              roleTitle={role.title}
              session={role.session.name}
              closesOn={formatDateTime(role.session.closesAt)}
              disclaimer={role.disclaimer}
              required={role.requiredFields}
              hidden={role.hiddenFields}
              agentRoute={session.agentRoute}
              availability={role.shootStartsAt ? shootWindow(role) : null}
              slots={slotsFor(role)}
              tapeGuidance={session.tapeGuidance ?? DEFAULT_TAPE_GUIDANCE}
              retentionDays={retentionOf(session)}
              special={
                role.specialQuestion
                  ? {
                      kind: role.specialQuestion.kind,
                      about: aboutFor(role.specialQuestion.kind),
                      question: role.specialQuestion.question,
                      days: specialDays,
                      consentText: consentTextFor(role.specialQuestion, role.company, specialDays),
                    }
                  : null
              }
              backTo={`/c/${token}`}
            />
          ) : (
            <SubmissionsClosed
              session={role.session.name}
              opensOn={upcoming ? formatDateTime(role.session.opensAt) : undefined}
              full={full}
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
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-text">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cx(CARD, "mt-8")}>
      <SectionHead title={title} />
      <div className="mt-4 max-w-prose leading-relaxed text-text">{children}</div>
    </section>
  );
}
