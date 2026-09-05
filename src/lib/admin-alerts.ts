/**
 * What is waiting on the administrator, in one place.
 *
 * The admin section is ten pages and most days none of them needs anything.
 * Reading ten screens to find that out is the work this removes: everything
 * that wants a decision — a subject request running out of time, a deletion
 * that has not happened, an email that did not send, media somebody flagged —
 * is counted here once and shown wherever the administrator already is: a dot
 * on the tile and on the navigation, a bar across the top of the summary.
 *
 * Two levels of pressing. `now` is something the law, a promise to an
 * applicant, or a broken deployment says should already have happened, and it
 * turns the dot red. `soon` is something to see before it becomes that, and it
 * is amber. Anything else is not an alert: a number that is merely large is
 * for the tile to show, not for a dot.
 *
 * Every count here is a `count(*)`, and the page they point at is where the
 * thing is actually dealt with. Nothing is decided here.
 */
import { countClients } from "./clients";
import { groupFor } from "./admin-nav";
import { emailConfigured } from "./email";
import { uploadsEnabled } from "./blob";
import { countActivity, countAudit } from "./activity";
import type { SessionUser } from "./auth";
import { countMessages } from "./notifications";
import { countOpenRequests, RESPONSE_DAYS } from "./privacy";
import { recentSweeps, retentionCounts, sweepAge } from "./monitoring";
import { countAllCalls } from "./sessions";
import { countAllSubmissions } from "./submissions";
import { countAccounts } from "./users";

/** How stale the nightly sweep may get before it is a problem, in days. */
export const SWEEP_STALE_DAYS = 2;

export type Urgency = "now" | "soon";

export type Alert = {
  /** The page it is dealt with on. */
  href: string;
  /** What is waiting, said as the thing to do about it. */
  say: string;
  /** How many, for the count on the dot. One for a state rather than a queue. */
  count: number;
  urgency: Urgency;
};

export type PageInsight = {
  href: string;
  /** The one figure this page is worth opening for. */
  figure: string;
  /** How many alerts sit on it, and the worst of them. */
  alerts: number;
  urgency: Urgency | null;
};

export type AdminAlerts = {
  /** Everything waiting, the pressing first. */
  all: Alert[];
  /** How many want something now, which is what the bar leads with. */
  now: number;
  /** A headline figure and an alert state for each page in the section. */
  pages: Map<string, PageInsight>;
  /** The same alert state rolled up to the four groups, for the navigation. */
  groups: Map<string, { alerts: number; urgency: Urgency | null }>;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Reads every page's counts at once. Called on an administrator's page views
 * only — a director never has an admin section for it to describe — and it is
 * all counts, so it costs about what one list page costs.
 */
export async function adminAlerts(viewer: SessionUser): Promise<AdminAlerts> {
  const [
    clients,
    accounts,
    calls,
    submissions,
    messages,
    requests,
    retention,
    sweeps,
    activity,
    audit,
  ] = await Promise.all([
    countClients(),
    countAccounts(),
    countAllCalls({}),
    countAllSubmissions({}),
    countMessages(),
    countOpenRequests(),
    retentionCounts(),
    recentSweeps(1),
    countActivity(viewer),
    countAudit(),
  ]);

  const alerts: Alert[] = [];
  const add = (href: string, urgency: Urgency, count: number, say: string) => {
    if (count > 0) alerts.push({ href, urgency, count, say });
  };

  /* -------------------------------------------------------------- privacy -- */
  // A subject request has a month in law. Past that it is already late, and
  // late is the one thing about it that cannot be undone.
  const late = requests.late;
  const inTime = requests.open - requests.late;
  add(
    "/admin/privacy",
    "now",
    late,
    `${plural(late, "request")} about somebody's own data ${late === 1 ? "is" : "are"} past the ${RESPONSE_DAYS}-day deadline`,
  );
  add(
    "/admin/privacy",
    "soon",
    inTime,
    `${plural(inTime, "request")} about somebody's own data to answer`,
  );

  /* -------------------------------------------------------------- storage -- */
  // Applicants were promised a date. A call still holding details past it is
  // the promise being broken, whatever the reason.
  add(
    "/admin/storage",
    "now",
    retention.overdue,
    `${plural(retention.overdue, "casting call")} still ${retention.overdue === 1 ? "holds" : "hold"} applicants' details past the date they were promised`,
  );
  add(
    "/admin/storage",
    "soon",
    retention.withinAWeek,
    `${plural(retention.withinAWeek, "casting call")} ${retention.withinAWeek === 1 ? "has" : "have"} details due to be destroyed within the week`,
  );

  const age = sweepAge(sweeps[0]);
  if (age === null) {
    add("/admin/storage", "now", 1, "the nightly deletion sweep has never run on this deployment");
  } else if (age > SWEEP_STALE_DAYS) {
    add("/admin/storage", "now", 1, `the nightly deletion sweep last ran ${plural(age, "day")} ago`);
  }
  if (!uploadsEnabled()) {
    add(
      "/admin/storage",
      "soon",
      1,
      "no file store is connected, so applicants cannot attach a photo or a tape",
    );
  }

  /* -------------------------------------------------------- notifications -- */
  if (!emailConfigured()) {
    add(
      "/admin/notifications",
      "now",
      1,
      "email is not configured, so nothing the app tries to send is going out",
    );
  }
  add(
    "/admin/notifications",
    "now",
    messages.failed,
    `${plural(messages.failed, "email")} did not send`,
  );

  /* --------------------------------------------------------- submissions -- */
  add(
    "/admin/submissions",
    "now",
    submissions.flagged,
    `${plural(submissions.flagged, "submission")} ${submissions.flagged === 1 ? "has" : "have"} media flagged for review`,
  );
  add(
    "/admin/submissions",
    "soon",
    submissions.waiting,
    `${plural(submissions.waiting, "submission")} from a child ${submissions.waiting === 1 ? "is" : "are"} waiting on a guardian`,
  );

  /* ------------------------------------------------------------- projects -- */
  add(
    "/admin/projects",
    "soon",
    calls.byState.full ?? 0,
    `${plural(calls.byState.full ?? 0, "casting call")} ${(calls.byState.full ?? 0) === 1 ? "has" : "have"} hit the cap and ${(calls.byState.full ?? 0) === 1 ? "is" : "are"} turning applicants away`,
  );

  /* -------------------------------------------------------------- clients -- */
  add(
    "/admin/clients",
    "now",
    clients.total - clients.live,
    `${plural(clients.total - clients.live, "client")} ${clients.total - clients.live === 1 ? "is" : "are"} suspended`,
  );

  // The pressing first, then the larger queue: an administrator with one
  // minute should spend it on the top line.
  alerts.sort((a, b) =>
    a.urgency === b.urgency ? b.count - a.count : a.urgency === "now" ? -1 : 1,
  );

  /* ---------------------------------------------- what each page is worth -- */
  const figures: Array<[string, string]> = [
    ["/admin/clients", `${clients.live} of ${plural(clients.total, "client")} active`],
    ["/admin/accounts", plural(accounts, "account")],
    ["/admin/projects", plural(calls.total, "casting call")],
    ["/admin/submissions", plural(submissions.total, "submission")],
    [
      "/admin/storage",
      retention.held === 0
        ? "nothing held to a date"
        : `${plural(retention.held, "call")} holding details`,
    ],
    [
      "/admin/privacy",
      requests.open === 0 ? "no open requests" : plural(requests.open, "open request"),
    ],
    [
      "/admin/notifications",
      messages.failed > 0
        ? `${plural(messages.failed, "email")} failed`
        : plural(messages.total, "email sent", "emails sent"),
    ],
    ["/admin/activity", plural(activity, "entry", "entries")],
    ["/admin/audit-logs", plural(audit, "entry", "entries")],
  ];

  const pages = new Map<string, PageInsight>();
  for (const [href, figure] of figures) {
    const mine = alerts.filter((alert) => alert.href === href);
    pages.set(href, {
      href,
      figure,
      alerts: mine.length,
      urgency: mine.some((alert) => alert.urgency === "now")
        ? "now"
        : mine.length > 0
          ? "soon"
          : null,
    });
  }

  const groups = new Map<string, { alerts: number; urgency: Urgency | null }>();
  for (const insight of pages.values()) {
    const group = groupFor(insight.href);
    if (!group) continue;
    const running = groups.get(group.href) ?? { alerts: 0, urgency: null };
    groups.set(group.href, {
      alerts: running.alerts + insight.alerts,
      urgency:
        running.urgency === "now" || insight.urgency === "now"
          ? "now"
          : (running.urgency ?? insight.urgency),
    });
  }

  return {
    all: alerts,
    now: alerts.filter((alert) => alert.urgency === "now").length,
    pages,
    groups,
  };
}

/**
 * The alerts on one page, for the bar at the top of it. A department screen
 * shows what belongs to it and nothing else; the summary shows the lot.
 */
export function alertsFor(alerts: AdminAlerts, href: string): Alert[] {
  return alerts.all.filter((alert) => alert.href === href);
}
