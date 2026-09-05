import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";
import { AdminAlertBar } from "@/components/admin-alert-bar";
import { Badge, CARD, CARD_GROUP, Eyebrow, STACK, SectionHead, cx } from "@/components/ui";
import { adminAlerts, alertsFor } from "@/lib/admin-alerts";
import { requireUser } from "@/lib/auth";
import { countOrphanedMedia, describeStore, storeUsage, uploadsEnabled } from "@/lib/blob";
import { clientUsage, listClients } from "@/lib/clients";
import { emailConfigured } from "@/lib/email";
import { formatBytes, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  RETENTION_DAYS,
  databaseUsage,
  recentSweeps,
  retentionSchedule,
  siteCounts,
  sweepAge,
} from "@/lib/monitoring";
import { allMediaUrls } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Storage",
  description: "What the site is holding, and what is due to be deleted.",
};

/** The tables worth naming; the rest are plumbing and are summed as one line. */
const NAMED: Record<string, string> = {
  submissions: "Submissions",
  special_answers: "Answers about a protected characteristic",
  activity: "Activity trail",
  sessions_casting: "Casting calls",
  roles: "Roles",
  users: "Accounts",
  clients: "Clients",
  sessions: "Sign-in sessions",
};

/**
 * What the site is holding and what is about to happen to it: the file store
 * by kind, the database by table, every casting call's destruction date with
 * the days left on it, and the handful of things that are wrong if they are
 * ever not true. It is the page to open when asking "is this all still
 * working", so nothing on it is behind a fold.
 */
export default async function StoragePage() {
  const user = await requireUser("/admin/storage");
  const alerts = await adminAlerts(user);
  if (user.role !== "admin") notFound();

  const [store, database, counts, schedule, sweeps, clients, usage] = await Promise.all([
    storeUsage(),
    databaseUsage(),
    siteCounts(),
    retentionSchedule(),
    recentSweeps(),
    listClients(),
    clientUsage(),
  ]);
  // Counted after the store, and only when there is a store to count in.
  const orphans = store ? await countOrphanedMedia(await allMediaUrls()) : null;

  const last = sweeps[0];
  const age = sweepAge(last);
  const overdue = schedule.due.filter((entry) => entry.daysAway < 0);
  const soon = schedule.due.filter((entry) => entry.daysAway >= 0 && entry.daysAway <= 14);

  const named = database.tables.filter((table) => table.table in NAMED);
  const rest = database.tables.filter((table) => !(table.table in NAMED));
  const restBytes = rest.reduce((total, table) => total + table.bytes, 0);

  // Anything true here is worth acting on today. Anything absent is working.
  const alarms: { tone: "danger" | "amber"; text: string }[] = [];
  if (!uploadsEnabled()) {
    alarms.push({ tone: "danger", text: "No file store is connected, so photos and tapes cannot be taken at all." });
  } else if (store === null) {
    alarms.push({ tone: "danger", text: "The file store is configured but could not be read just now." });
  }
  if (!emailConfigured()) {
    alarms.push({ tone: "danger", text: "No mail provider is configured: nobody is warned before their applicants' details are destroyed, and an administrator cannot sign in." });
  }
  if (age === null) {
    alarms.push({ tone: "amber", text: "The nightly retention sweep has never run on this database. Applicants' details are destroyed by it, so nothing is being deleted." });
  } else if (age >= 2) {
    alarms.push({ tone: "danger", text: `The retention sweep last ran ${age} days ago. It should run every night.` });
  }
  if (overdue.length > 0) {
    alarms.push({ tone: "danger", text: `${overdue.length} ${overdue.length === 1 ? "casting call is" : "casting calls are"} past the day their applicants' details should have been destroyed.` });
  }
  if (orphans && orphans > 0) {
    alarms.push({ tone: "amber", text: `${orphans} ${orphans === 1 ? "file has" : "files have"} no submission pointing at them. The nightly sweep deletes any older than a day.` });
  }
  if (store && store.other.files > 0) {
    alarms.push({ tone: "amber", text: `${store.other.files} ${store.other.files === 1 ? "file is" : "files are"} in the store outside the folders the app writes to.` });
  }

  const slices = store
    ? [
        { label: "Header images", slice: store.heroes, of: "on casting calls" },
        { label: "Applicants' photos", slice: store.photos, of: "one per submission" },
        { label: "Applicants' tapes", slice: store.videos, of: "up to three per submission" },
        { label: "Anything else", slice: store.other, of: "nothing should be here" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/storage")} />
      <AdminTabs pathname="/admin/storage" alerts={alerts} />
      <AdminAlertBar alerts={alertsFor(alerts, "/admin/storage")} scope="what is stored" />

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Storage</h1>
        <p className="mt-3 max-w-2xl text-muted">
          What is held, what it takes up, and what is due to be deleted.
        </p>
      </div>

      {alarms.length > 0 ? (
        <section
          className="mt-8 rounded-2xl border-2 border-danger bg-surface p-4 shadow-card sm:p-6"
          aria-labelledby="attention-heading"
        >
          <SectionHead
            id="attention-heading"
            title="Needs attention"
            line="Everything on this list is worth doing something about today."
          />
          <ul className="mt-4 flex flex-col gap-2">
            {alarms.map((alarm) => (
              <li key={alarm.text} className="flex gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className={cx(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    alarm.tone === "danger" ? "bg-danger" : "bg-amber",
                  )}
                />
                <span className="text-text">{alarm.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section
          className={cx(CARD, STACK)}
          aria-labelledby="attention-heading"
        >
          <SectionHead
            id="attention-heading"
            title="Nothing needs attention"
            line="The store and the mail provider are connected, the nightly sweep is running, and nothing is overdue."
          />
        </section>
      )}

      <section className={cx(CARD, STACK)} aria-labelledby="files-heading">
        <SectionHead
          id="files-heading"
          title="The file store"
          line={
            store
              ? `${formatBytes(store.total.bytes)} across ${store.total.files} ${store.total.files === 1 ? "file" : "files"}. ${describeStore()}.`
              : `Nothing to measure. ${describeStore()}.`
          }
          aside={
            store ? (
              <Badge tone={store.total.files > 0 ? "positive" : "outline"}>
                {store.total.files > 0 ? "In use" : "Empty"}
              </Badge>
            ) : (
              <Badge tone="danger">Unavailable</Badge>
            )
          }
        />
        {store ? (
          <>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {slices.map(({ label, slice, of }) => (
                <div key={label} className="rounded-xl border border-line bg-surface p-4">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatBytes(slice.bytes)}
                  </dd>
                  <dd className="mt-1 text-xs text-faint">
                    {slice.files} {slice.files === 1 ? "file" : "files"} &middot; {of}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Files are deleted with the submission they belong to, and the whole of a casting
              call&rsquo;s go on the day below.
              {store.oldest
                ? ` The oldest was uploaded ${formatRelative(store.oldest)}, the newest ${formatRelative(store.newest ?? store.oldest)}.`
                : ""}
              {orphans !== null
                ? ` ${orphans === 0 ? "Nothing is" : `${orphans} ${orphans === 1 ? "file is" : "files are"}`} in the store without a submission pointing at ${orphans === 1 ? "it" : "them"}.`
                : ""}
            </p>
          </>
        ) : null}
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="database-heading">
        <SectionHead
          id="database-heading"
          title="The database"
          line={`${formatBytes(database.bytes)} in all, indexes included. ${counts.submissions} ${counts.submissions === 1 ? "submission" : "submissions"} across ${counts.sessions} ${counts.sessions === 1 ? "casting call" : "casting calls"}.`}
        />
        <div className="relative mt-4 -mx-4 overflow-x-auto border-y border-line bg-surface sm:mx-0 sm:rounded-xl sm:border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th scope="col" className="px-4 py-3 font-medium">What</th>
                <th scope="col" className="px-4 py-3 font-medium">Rows</th>
                <th scope="col" className="px-4 py-3 font-medium">On disk</th>
              </tr>
            </thead>
            <tbody>
              {named.map((table) => (
                <tr key={table.table} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{NAMED[table.table]}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {exact(table.table, counts)?.toLocaleString("en-GB") ?? table.rows.toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatBytes(table.bytes)}</td>
                </tr>
              ))}
              {rest.length > 0 ? (
                <tr className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-muted">
                    Everything else ({rest.length} {rest.length === 1 ? "table" : "tables"})
                  </td>
                  <td className="px-4 py-3 text-faint">&mdash;</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">
                    {formatBytes(restBytes)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="retention-heading">
        <SectionHead
          id="retention-heading"
          title="Due to be deleted"
          line={`Applicants' details are destroyed ${RETENTION_DAYS} days after the production finishes, unless the client is on a different number. ${schedule.due.length === 0 ? "Nothing is holding any." : `${schedule.due.length} ${schedule.due.length === 1 ? "casting call is" : "casting calls are"} still holding some.`}`}
          aside={
            soon.length > 0 || overdue.length > 0 ? (
              <Badge tone={overdue.length > 0 ? "danger" : "amber"}>
                {overdue.length > 0
                  ? `${overdue.length} overdue`
                  : `${soon.length} within 14 days`}
              </Badge>
            ) : null
          }
        />
        {schedule.due.length > 0 ? (
          <div className="relative mt-4 -mx-4 overflow-x-auto border-y border-line bg-surface sm:mx-0 sm:rounded-xl sm:border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Casting call</th>
                  <th scope="col" className="px-4 py-3 font-medium">Holding</th>
                  <th scope="col" className="px-4 py-3 font-medium">Production finishes</th>
                  <th scope="col" className="px-4 py-3 font-medium">Details destroyed</th>
                </tr>
              </thead>
              <tbody>
                {schedule.due.map((entry) => (
                  <tr key={entry.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/sessions/${entry.id}`}
                        className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
                      >
                        {entry.name}
                      </Link>
                      <span className="block text-xs text-muted">{entry.company}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {entry.submissions} {entry.submissions === 1 ? "submission" : "submissions"}
                      {entry.photos + entry.videos > 0
                        ? `, ${entry.photos} with a photo, ${entry.videos} with a tape`
                        : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDate(entry.productionEndsAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(entry.purgeOn)}
                      <span className="block text-xs">
                        <Countdown days={entry.daysAway} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No casting call is holding applicants&rsquo; details at the moment.
          </p>
        )}

        {schedule.purged.length > 0 ? (
          <details className="group mt-4 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-brand underline underline-offset-4 hover:text-brand-hover sm:min-h-0">
              {schedule.purged.length}{" "}
              {schedule.purged.length === 1 ? "casting call has" : "casting calls have"} already
              had theirs destroyed
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {schedule.purged.map((entry) => (
                <li key={entry.id} className="text-muted">
                  <span className="text-text">{entry.name}</span> &middot; {entry.company} &middot;
                  destroyed {formatDate(entry.purgedAt!.slice(0, 10))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className={cx(CARD, STACK)} aria-labelledby="sweep-heading">
        <SectionHead
          id="sweep-heading"
          title="The nightly sweep"
          line="It sends the warnings, destroys what is due, and clears files nothing points at. Everything above depends on it running."
          aside={
            <Badge tone={age === null ? "amber" : age >= 2 ? "danger" : "positive"}>
              {age === null ? "Never run" : age === 0 ? "Ran today" : `${age} ${age === 1 ? "day" : "days"} ago`}
            </Badge>
          }
        />
        {sweeps.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {sweeps.map((sweep) => (
              <li key={sweep.ranAt} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-medium">{formatDateTime(sweep.ranAt)}</p>
                <p className="mt-1 text-sm text-muted">
                  {sweep.sessions} {sweep.sessions === 1 ? "casting call" : "casting calls"}{" "}
                  destroyed, {sweep.submissions}{" "}
                  {sweep.submissions === 1 ? "submission" : "submissions"} with{" "}
                  {sweep.specialAnswers === 1 ? "1 answer" : `${sweep.specialAnswers} answers`} about
                  a protected characteristic, {sweep.orphanedFiles}{" "}
                  {sweep.orphanedFiles === 1 ? "stray file" : "stray files"} cleared,{" "}
                  {sweep.warned} {sweep.warned === 1 ? "warning" : "warnings"} sent. Took{" "}
                  {(sweep.ms / 1000).toFixed(1)} seconds.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
            No run has been recorded on this database. The sweep is a scheduled job that calls{" "}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs">/api/retention</code> with
            the cron secret; until it runs, nothing is deleted on its own.
          </p>
        )}
      </section>

      <section className={cx(CARD_GROUP, STACK)} aria-labelledby="clients-heading">
        <SectionHead
          id="clients-heading"
          title="Against what they bought"
          line="How close each client is to the ceilings on their plan. A client with no ceiling is not listed."
          aside={
            <Link
              href="/admin/clients"
              className="inline-flex min-h-11 items-center rounded-sm text-sm text-brand underline underline-offset-4 hover:text-brand-hover sm:min-h-0"
            >
              All clients
            </Link>
          }
        />
        {clients.some((client) => client.maxSessions !== null) ? (
          <ul className="mt-5 flex flex-col gap-3">
            {clients
              .filter((client) => client.maxSessions !== null)
              .map((client) => {
                const used = usage.get(client.id);
                const share = Math.min(100, Math.round(((used?.productions ?? 0) / client.maxSessions!) * 100));
                return (
                  <li key={client.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-medium underline-offset-4 hover:text-brand hover:underline"
                      >
                        {client.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {used?.productions ?? 0} of {client.maxSessions} casting calls &middot;{" "}
                        {used?.submissions ?? 0}{" "}
                        {used?.submissions === 1 ? "submission" : "submissions"}
                      </p>
                    </div>
                    {/* An SVG, because a width in a style attribute is refused
                        by the page's own Content Security Policy. */}
                    <svg
                      role="img"
                      aria-label={`${share}% of what they bought`}
                      viewBox="0 0 100 6"
                      preserveAspectRatio="none"
                      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line"
                    >
                      <rect
                        x="0"
                        y="0"
                        height="6"
                        width={Math.max(1, share)}
                        rx="3"
                        className={cx(
                          share >= 90 ? "fill-danger" : share >= 70 ? "fill-amber" : "fill-positive",
                        )}
                      />
                    </svg>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No client has a ceiling set, so there is nothing to run out of.
          </p>
        )}
      </section>
    </div>
  );
}

/** How long until the details go, or how long they are overdue by. */
function Countdown({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="text-danger">
        {Math.abs(days)} {Math.abs(days) === 1 ? "day" : "days"} overdue
      </span>
    );
  }
  if (days === 0) return <span className="text-danger">today</span>;
  return (
    <span className={days <= 14 ? "text-amber" : "text-muted"}>
      in {days} {days === 1 ? "day" : "days"}
    </span>
  );
}

/**
 * The counted figure for a table, where one exists. Postgres's own row estimate
 * is what the planner last recorded and can be stale or missing entirely, which
 * is fine for sizing and wrong to print.
 */
function exact(table: string, counts: Awaited<ReturnType<typeof siteCounts>>): number | null {
  switch (table) {
    case "submissions":
      return counts.submissions;
    case "special_answers":
      return counts.specialAnswers;
    case "activity":
      return counts.activity;
    case "sessions_casting":
      return counts.sessions;
    case "roles":
      return counts.roles;
    case "users":
      return counts.accounts;
    case "clients":
      return counts.clients;
    default:
      return null;
  }
}
