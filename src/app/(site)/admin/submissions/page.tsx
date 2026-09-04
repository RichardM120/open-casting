import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";
import { HelpNote } from "@/components/help-note";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge, Button, CARD, cx, Eyebrow, Field, Input, SectionHead } from "@/components/ui";
import { removeSubmission, setSubmissionMediaFlagged } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { mediaSrc } from "@/lib/media";
import { countAllSubmissions, listAllSubmissions } from "@/lib/submissions";
import { ADULT_AGE, SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Submissions",
  description: "Every submission on the site, with its photo and tapes.",
};

const isStatus = (value: unknown): value is SubmissionStatus =>
  typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
const isOnly = (value: unknown): value is "flagged" | "minors" | "media" =>
  value === "flagged" || value === "minors" || value === "media";

/**
 * Every submission on the site, newest first, whoever it was sent to.
 *
 * The moderation screen: what came in, what it carries, and whether it is
 * something to hold back. Opening a row shows the photo and the tapes, played
 * through the app's own route as everywhere else, with the applicant's
 * details and their guardian's where there is one. Holding the media back
 * stops the casting team fetching it without moving or deleting anything, so
 * a wrong call is undone by clearing the flag.
 */
export default async function AdminSubmissionsPage({
  searchParams,
}: PageProps<"/admin/submissions">) {
  const user = await requireUser("/admin/submissions");
  if (user.role !== "admin") notFound();

  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : null;
  const only = isOnly(query.only) ? query.only : null;
  const sessionId = typeof query.session === "string" && query.session ? query.session : null;
  const open = typeof query.open === "string" ? query.open : null;
  const filter = { status, only, sessionId };

  const counts = await countAllSubmissions({ sessionId });
  const matching = status
    ? counts.byStatus[status]
    : only === "flagged"
      ? counts.flagged
      : only === "minors"
        ? counts.minors
        : only === "media"
          ? counts.withMedia
          : counts.total;
  const pages = Math.max(1, Math.ceil(matching / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const submissions = await listAllSubmissions({
    ...filter,
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  const href = (changes: Record<string, string | null>) => {
    const search = new URLSearchParams();
    const current: Record<string, string | null> = {
      status,
      only,
      session: sessionId,
      ...changes,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) search.set(key, value);
    }
    const tail = search.toString();
    return `/admin/submissions${tail ? `?${tail}` : ""}`;
  };
  const pageHref = (n: number) => {
    const base = href({});
    if (n <= 1) return base;
    return `${base}${base.includes("?") ? "&" : "?"}page=${n}`;
  };

  const chips: { label: string; count: number; on: boolean; to: string }[] = [
    { label: "All", count: counts.total, on: status === null && only === null, to: href({ status: null, only: null }) },
    ...SUBMISSION_STATUSES.map((entry) => ({
      label: entry,
      count: counts.byStatus[entry],
      on: status === entry,
      to: href({ status: entry, only: null }),
    })),
    { label: "Held back", count: counts.flagged, on: only === "flagged", to: href({ status: null, only: "flagged" }) },
    { label: "Under 18", count: counts.minors, on: only === "minors", to: href({ status: null, only: "minors" }) },
    { label: "With a file", count: counts.withMedia, on: only === "media", to: href({ status: null, only: "media" }) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={adminTrail("/admin/submissions")} />
      <AdminTabs pathname="/admin/submissions" />
      <HelpNote title="What this screen is for">
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Every submission on the site, newest first. Open one to see the photo and the tapes, the applicant&rsquo;s details, and their guardian&rsquo;s where they are under 18.',
          }}
        />
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Holding a photo or tape back stops the casting team fetching it. Nothing is moved or deleted, so clearing the flag puts it back.',
          }}
        />
      </HelpNote>

      {query.done ? (
        <p
          role="status"
          className={cx(
            "mt-6 rounded-2xl border px-4 py-3 text-sm",
            query.done === "removed"
              ? "border-danger/40 bg-danger-soft text-danger"
              : "border-line bg-positive-soft text-positive",
          )}
        >
          {query.done === "flagged"
            ? "Held back. The casting team cannot fetch that photo or those tapes until it is cleared."
            : query.done === "cleared"
              ? "Released. The casting team can see it again."
              : "The submission and its files are gone. That cannot be undone."}
        </p>
      ) : null}

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Submissions</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {counts.total} across every casting call. {counts.withMedia} carry a file,{" "}
          {counts.minors} are from someone under {ADULT_AGE}, {counts.flagged} held back.
        </p>
      </div>

      <section className={cx(CARD, "mt-8")} aria-labelledby="feed-heading">
        <SectionHead
          id="feed-heading"
          title="The feed"
          line={
            matching === 0
              ? "Nothing matches."
              : `${matching} ${matching === 1 ? "submission" : "submissions"}, newest first.`
          }
        />

        <nav aria-label="Narrow the feed" className="mt-5 flex flex-wrap gap-2 text-sm">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.to}
              aria-current={chip.on ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center rounded-full border px-4 py-2 whitespace-nowrap transition-colors",
                chip.on
                  ? "border-accent bg-accent-soft font-medium text-text"
                  : "border-line text-muted hover:border-accent hover:text-text",
              )}
            >
              {chip.label} · {chip.count}
            </Link>
          ))}
        </nav>

        {submissions.length > 0 ? (
          <>
            <ul className="mt-5 flex flex-col gap-3">
              {submissions.map((submission) => {
                const minor = submission.age < ADULT_AGE;
                const videos = submission.videos.length
                  ? submission.videos
                  : submission.videoUrl
                    ? [{ slot: "tape", url: submission.videoUrl, name: "" }]
                    : [];
                const files = (submission.photoUrl ? 1 : 0) + videos.length;
                const showing = open === submission.id;
                return (
                  <li
                    key={submission.id}
                    className={cx(
                      "rounded-xl border bg-surface p-4 sm:p-5",
                      submission.mediaFlaggedAt ? "border-danger/50" : "border-line",
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                      <ProfilePhoto
                        url={submission.mediaFlaggedAt ? null : submission.photoUrl}
                        name={submission.name}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium wrap-anywhere">{submission.name}</span>
                          <Badge tone={submission.status === "New" ? "accent" : "outline"}>
                            {submission.status}
                          </Badge>
                          {minor ? <Badge tone="amber">Under {ADULT_AGE}</Badge> : null}
                          {submission.mediaFlaggedAt ? <Badge tone="danger">Media held back</Badge> : null}
                          {files > 0 ? (
                            <Badge tone="outline">
                              {files} {files === 1 ? "file" : "files"}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted wrap-anywhere">
                          <Link
                            href={`/dashboard/roles/${submission.roleId}`}
                            className="underline-offset-4 hover:text-brand hover:underline"
                          >
                            {submission.roleTitle}
                          </Link>{" "}
                          · {submission.sessionName} · {submission.company}
                        </p>
                      </div>
                      <p className="text-sm whitespace-nowrap text-muted">
                        {formatRelative(submission.submittedAt)}
                      </p>
                      <Link
                        href={showing ? href({}) : `${href({})}${href({}).includes("?") ? "&" : "?"}open=${submission.id}`}
                        scroll={false}
                        className="text-sm text-brand underline-offset-4 hover:underline"
                      >
                        {showing ? "Close" : "Open"}
                      </Link>
                    </div>

                    {showing ? (
                      <div className="mt-4 border-t border-line pt-4">
                        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                          <Detail label="Email" value={submission.email} />
                          <Detail label="Phone" value={submission.phone} />
                          <Detail label="Based in" value={submission.location} />
                          <Detail label="Age" value={String(submission.age)} />
                          <Detail label="Resident in" value={submission.residency} />
                          <Detail label="Submitted" value={formatDateTime(submission.submittedAt)} />
                          {minor ? (
                            <>
                              <Detail label="Parent or guardian" value={submission.guardianName ?? ""} />
                              <Detail label="Guardian's email" value={submission.guardianEmail ?? ""} />
                            </>
                          ) : null}
                          <Detail label="Showreel" value={submission.reelUrl} />
                          <Detail label="Profile" value={submission.profileUrl} />
                        </dl>

                        {submission.coverNote ? (
                          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
                            {submission.coverNote}
                          </p>
                        ) : null}

                        {submission.mediaFlaggedAt ? (
                          <p className="mt-4 rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
                            Held back on {formatDateTime(submission.mediaFlaggedAt)}
                            {submission.mediaFlagReason ? `: ${submission.mediaFlagReason}` : ""}. The
                            casting team cannot fetch it; you can.
                          </p>
                        ) : null}

                        {submission.photoUrl ? (
                          <figure className="mt-4">
                            <figcaption className="text-xs font-medium text-muted">Photo</figcaption>
                            {/* eslint-disable-next-line @next/next/no-img-element -- our own authenticated route */}
                            <img
                              src={mediaSrc(submission.photoUrl)}
                              alt={`${submission.name}'s photo`}
                              className="mt-1.5 max-h-72 w-auto max-w-full rounded-xl border border-line bg-surface"
                            />
                          </figure>
                        ) : null}

                        {videos.map((video) => (
                          <figure key={video.url} className="mt-4">
                            <figcaption className="text-xs font-medium text-muted">
                              {video.name || video.slot}
                            </figcaption>
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

                        <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-line pt-4">
                          {submission.mediaFlaggedAt ? (
                            <form action={setSubmissionMediaFlagged}>
                              <input type="hidden" name="submissionId" value={submission.id} />
                              <input type="hidden" name="flagged" value="0" />
                              <Button type="submit" variant="secondary" size="sm">
                                Release the media
                              </Button>
                            </form>
                          ) : (
                            <form action={setSubmissionMediaFlagged} className="flex flex-wrap items-end gap-3">
                              <input type="hidden" name="submissionId" value={submission.id} />
                              <input type="hidden" name="flagged" value="1" />
                              <Field
                                label="Why hold it back"
                                htmlFor={`reason-${submission.id}`}
                                required={false}
                                className="min-w-56"
                              >
                                <Input id={`reason-${submission.id}`} name="reason" />
                              </Field>
                              <Button type="submit" variant="danger" size="sm">
                                Hold the media back
                              </Button>
                            </form>
                          )}
                        </div>

                        <details className="mt-4 text-sm" data-more={`remove-${submission.id}`}>
                          <summary className="cursor-pointer text-danger underline-offset-4 hover:underline">
                            Remove this submission
                          </summary>
                          <form
                            action={removeSubmission}
                            className="mt-3 flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4"
                          >
                            <input type="hidden" name="submissionId" value={submission.id} />
                            <p className="text-sm leading-relaxed text-text">
                              This deletes {submission.name}&rsquo;s details, their cover note and
                              every file they sent. The casting team loses it too, and there is
                              nothing to restore it from.
                            </p>
                            <label className="flex items-start gap-2.5 text-sm">
                              <input
                                type="checkbox"
                                name="confirm"
                                required
                                className="mt-0.5 size-4 shrink-0 accent-danger"
                              />
                              <span>I understand this cannot be undone.</span>
                            </label>
                            <Button type="submit" variant="danger" size="sm" className="self-start">
                              Remove submission and files
                            </Button>
                          </form>
                        </details>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} total={matching} pageSize={LIST_PAGE_SIZE} href={pageHref} />
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {counts.total === 0
              ? "Nothing has been submitted yet."
              : "Nothing matches. Choose All to see everything."}
          </p>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-text wrap-anywhere">{value}</dd>
    </div>
  );
}
