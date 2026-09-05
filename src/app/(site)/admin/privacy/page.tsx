import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";
import { AdminAlertBar } from "@/components/admin-alert-bar";
import { Badge, Button, CARD, CARD_GROUP, cx, Eyebrow, Field, Input, ROW_MAIN, SectionHead, Select, STACK, Textarea } from "@/components/ui";
import { closeAccessRequest, eraseApplicant, logAccessRequest, runRetentionSweep } from "@/lib/actions";
import { adminAlerts, alertsFor } from "@/lib/admin-alerts";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { RETENTION_DAYS, recentSweeps, sweepAge, sweepDryRun } from "@/lib/monitoring";
import { REQUEST_KINDS, REQUEST_KIND_KEYS, RESPONSE_DAYS, heldFor, listRequests } from "@/lib/privacy";
import { SPECIAL_RETENTION_DAYS } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Requests about somebody's own data, erasure, and what is deleted when.",
};

/**
 * The page for doing what the law requires when somebody asks.
 *
 * Three things, in the order they come up: requests that have arrived and the
 * month there is to answer them; a search by email showing everything held
 * about one person, with a bundle to hand over and a way to delete the lot;
 * and the rules that delete things on their own, with what the next sweep
 * would take before it takes it.
 */
export default async function PrivacyPage({ searchParams }: PageProps<"/admin/privacy">) {
  const user = await requireUser("/admin/privacy");
  const alerts = await adminAlerts(user);
  if (user.role !== "admin") notFound();

  const query = await searchParams;
  const who = typeof query.who === "string" ? query.who.trim() : "";

  const [open, answered, held, dry, sweeps] = await Promise.all([
    listRequests({ open: true }),
    listRequests({ open: false }),
    who ? heldFor(who) : Promise.resolve(null),
    sweepDryRun(),
    recentSweeps(1),
  ]);
  const closed = answered.filter((request) => request.closedAt !== null).slice(0, 10);
  const age = sweepAge(sweeps[0]);
  const overdue = open.filter((request) => request.daysLeft < 0).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/privacy")} />
      <AdminTabs pathname="/admin/privacy" alerts={alerts} />
      <AdminAlertBar alerts={alertsFor(alerts, "/admin/privacy")} scope="privacy" />

      {query.logged ? (
        <Note tone="good">Logged. There are {RESPONSE_DAYS} days to answer it.</Note>
      ) : null}
      {query.closed ? <Note tone="good">Marked answered.</Note> : null}
      {query.swept ? (
        <Note tone="good">
          The sweep ran. {query.swept} {query.swept === "1" ? "casting call" : "casting calls"} had
          their applicants&rsquo; details destroyed.
        </Note>
      ) : null}
      {query.erased ? (
        <Note tone="bad">
          Erased. {query.erased} {query.erased === "1" ? "submission" : "submissions"} and every
          file with them are gone, on every casting call.
        </Note>
      ) : null}
      {query.bad === "email" ? <Note tone="bad">That is not an email address.</Note> : null}
      {query.bad === "match" ? (
        <Note tone="bad">The address typed to confirm did not match. Nothing was deleted.</Note>
      ) : null}

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Privacy</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Requests about somebody&rsquo;s own data, erasure, and what is deleted on its own.
        </p>
      </div>

      <section className={cx(CARD_GROUP, STACK)} aria-labelledby="requests-heading">
        <SectionHead
          id="requests-heading"
          title="Requests"
          line={
            open.length === 0
              ? "Nothing outstanding."
              : `${open.length} to answer, ${RESPONSE_DAYS} days from the day each arrived.`
          }
          aside={overdue > 0 ? <Badge tone="danger">{overdue} past the month</Badge> : null}
        />

        {open.length > 0 ? (
          <ul data-requests="open" className="mt-5 flex flex-col gap-3">
            {open.map((request) => (
              <li key={request.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className={ROW_MAIN}>
                    <p className="font-medium wrap-anywhere">{request.email}</p>
                    <p className="mt-1 text-sm text-muted">
                      {REQUEST_KINDS[request.kind].label} · asked{" "}
                      {formatRelative(request.requestedAt)}
                      {request.note ? ` · ${request.note}` : ""}
                    </p>
                  </div>
                  <Badge tone={request.daysLeft < 0 ? "danger" : request.daysLeft <= 7 ? "amber" : "outline"}>
                    {request.daysLeft < 0
                      ? `${Math.abs(request.daysLeft)} days over`
                      : `${request.daysLeft} days left`}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/privacy?who=${encodeURIComponent(request.email)}`}
                      className="inline-flex min-h-11 items-center rounded-full border sm:min-h-10 border-line-strong bg-surface px-4 py-2 text-sm transition-colors hover:border-accent hover:text-brand"
                    >
                      Look them up
                    </Link>
                    <form action={closeAccessRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Mark answered
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <form action={logAccessRequest} className="mt-5 grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
          <p className="text-sm text-muted sm:col-span-2">
            Log one as it arrives. The answer goes back by email; this is the record that it was
            asked and when.
          </p>
          <Field label="Their email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="What they asked for" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue="access" required>
              {REQUEST_KIND_KEYS.map((kind) => (
                <option key={kind} value={kind}>
                  {REQUEST_KINDS[kind].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" htmlFor="note" required={false} className="sm:col-span-2">
            <Textarea id="note" name="note" rows={2} placeholder="How they asked, and anything to remember." />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Log the request</Button>
          </div>
        </form>

        {closed.length > 0 ? (
          <details className="mt-4 text-sm" data-more="answered">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-brand underline underline-offset-4 hover:text-brand-hover sm:min-h-0">
              {closed.length} answered
            </summary>
            <ul data-requests="answered" className="mt-3 flex flex-col gap-2 text-muted">
              {closed.map((request) => (
                <li key={request.id} className="wrap-anywhere">
                  <span className="text-text">{request.email}</span> ·{" "}
                  {REQUEST_KINDS[request.kind].short} · answered{" "}
                  {formatDate((request.closedAt ?? request.requestedAt).slice(0, 10))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="lookup-heading">
        <SectionHead
          id="lookup-heading"
          title="What is held about one person"
          line="By email, across every casting call. The bundle answers what is held; erasing removes it."
        />
        <form method="get" action="/admin/privacy" className="mt-5 flex flex-wrap items-end gap-3">
          <Field label="Their email" htmlFor="who" className="min-w-64 flex-1">
            <Input id="who" name="who" type="email" defaultValue={who} required />
          </Field>
          <Button type="submit" variant="secondary">
            Look them up
          </Button>
        </form>

        {held ? (
          held.submissions.length === 0 ? (
            <p className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
              Nothing is held about <span className="text-text">{held.email}</span>. That is the
              answer to a request: no submission on any casting call.
            </p>
          ) : (
            <>
              <div className="relative mt-5 -mx-4 overflow-x-auto border-y border-line bg-surface sm:mx-0 sm:rounded-xl sm:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="px-4 py-3 font-medium">Casting call</th>
                      <th scope="col" className="px-4 py-3 font-medium">Role</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Carries</th>
                      <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {held.submissions.map((entry) => (
                      <tr key={entry.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          {entry.sessionName}
                          <span className="block text-xs text-muted">{entry.company}</span>
                        </td>
                        <td className="px-4 py-3">{entry.roleTitle}</td>
                        <td className="px-4 py-3">{entry.status}</td>
                        <td className="px-4 py-3 text-muted">
                          {[
                            entry.photo ? "a photo" : "",
                            entry.videos ? `${entry.videos} ${entry.videos === 1 ? "tape" : "tapes"}` : "",
                            entry.specialAnswer ? "an answer about a protected characteristic" : "",
                          ]
                            .filter(Boolean)
                            .join(", ") || "no files"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {formatDateTime(entry.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={`/admin/privacy/export?email=${encodeURIComponent(held.email)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                  Bundle what is held
                </a>
                <p className="text-sm text-muted">
                  Everything on the rows above as JSON. {held.media.length}{" "}
                  {held.media.length === 1 ? "file is" : "files are"} named in it and handed over
                  separately.
                </p>
              </div>

              <details className="mt-5 text-sm" data-more="erase">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-danger underline-offset-4 hover:underline sm:min-h-0">
                  Erase everything held about them
                </summary>
                <form
                  action={eraseApplicant}
                  className="mt-3 flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4"
                >
                  <input type="hidden" name="email" value={held.email} />
                  <p className="text-sm leading-relaxed text-text">
                    This deletes {held.submissions.length}{" "}
                    {held.submissions.length === 1 ? "submission" : "submissions"} and{" "}
                    {held.media.length} {held.media.length === 1 ? "file" : "files"}, on every
                    casting call at once. The casting teams lose them too, and there is nothing to
                    restore them from.
                  </p>
                  <Field label="Type their address to confirm" htmlFor="confirmEmail">
                    <Input id="confirmEmail" name="confirmEmail" required />
                  </Field>
                  <label className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" name="confirm" required className="mt-0.5 size-4 shrink-0 accent-danger" />
                    <span>I understand this cannot be undone.</span>
                  </label>
                  <Button type="submit" variant="danger" size="sm" className="self-start">
                    Erase everything held about them
                  </Button>
                </form>
              </details>
            </>
          )
        ) : null}
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="rules-heading">
        <SectionHead
          id="rules-heading"
          title="What goes on its own"
          line="The site's rules, which delete without anybody asking. A client may be on different numbers, and every casting call keeps the ones it was opened with."
          aside={
            <Badge tone={age === null ? "amber" : age >= 2 ? "danger" : "positive"}>
              {age === null ? "Sweep never run" : age === 0 ? "Swept today" : `Swept ${age} days ago`}
            </Badge>
          }
        />
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm font-medium">Applicants&rsquo; details</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Destroyed {RETENTION_DAYS} days after the production finishes, with their photos and
              tapes. The casting call and its roles are kept. A client can be put on a different
              number, and each call keeps the one it was opened with.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm font-medium">Answers about a protected characteristic</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Deleted {SPECIAL_RETENTION_DAYS} days after casting closes, which is sooner: the
              answer was needed to decide, and the decision is made by then. This one can be set
              per client too.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm font-medium">Files nothing points at</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              Cleared once they are a day old. An upload whose form was never sent leaves one
              behind.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm font-medium">Warnings</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              The casting team is emailed 14 days and 48 hours before their applicants&rsquo;
              details go, so nothing is lost by surprise.
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl border border-line-strong bg-surface p-4 sm:p-5">
          <p className="text-sm font-medium">If the sweep ran now</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {dry.sessions === 0 && dry.specialAnswers === 0 ? (
              "Nothing is due. Everything held is still inside its retention period."
            ) : (
              <>
                {dry.sessions} {dry.sessions === 1 ? "casting call" : "casting calls"} would have
                their applicants&rsquo; details destroyed, which is {dry.submissions}{" "}
                {dry.submissions === 1 ? "submission" : "submissions"}, and {dry.specialAnswers}{" "}
                {dry.specialAnswers === 1 ? "answer" : "answers"} about a protected characteristic
                would go.
              </>
            )}
          </p>
          <form action={runRetentionSweep} className="mt-4">
            <Button type="submit" variant={dry.sessions > 0 ? "danger" : "secondary"} size="sm">
              Run the sweep now
            </Button>
          </form>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            The scheduled job does this every night. Running it by hand is for when it has not.
          </p>
        </div>
      </section>
    </div>
  );
}

function Note({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={cx(
        "mt-6 rounded-2xl border px-4 py-3 text-sm",
        tone === "good"
          ? "border-line bg-positive-soft text-positive"
          : "border-danger/40 bg-danger-soft text-danger",
      )}
    >
      {children}
    </p>
  );
}
