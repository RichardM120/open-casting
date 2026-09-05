import type { Metadata } from "next";
import Link from "next/link";

import { ActivityList } from "@/components/activity-list";
import { AdminAlertBar } from "@/components/admin-alert-bar";
import { AdminIcon } from "@/components/admin-icons";
import { AlertDot } from "@/components/alert-dot";
import { Button, ButtonLink, CARD, CARD_GROUP, Eyebrow, STACK, SectionHead, cx } from "@/components/ui";
import { testFileStore } from "@/lib/actions";
import { ADMIN_GROUPS } from "@/lib/admin-nav";
import { adminAlerts } from "@/lib/admin-alerts";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { describeStore, uploadsEnabled } from "@/lib/blob";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  description: "The clients paying for Open Casting, the accounts under them, and the trail.",
};

/**
 * Where the owner starts.
 *
 * Two questions, in that order. Is there anything for me to do — answered by
 * the bar at the top before anything is opened, which is why it stands where
 * the "what this screen is for" note used to. And, if not, how is the service
 * doing — answered by a tile per page, each led by its own mark, carrying the
 * one figure that page is worth opening for and a dot when something behind
 * it is waiting. Nine screens, read at a glance, without opening any of them.
 */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser("/admin");
  const [alerts, activity, query] = await Promise.all([
    adminAlerts(user),
    listActivity(user, { limit: 8 }),
    searchParams,
  ]);
  const store = uploadsEnabled();
  const why = typeof query.why === "string" ? query.why : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <AdminAlertBar alerts={alerts.all} scope="the service" />

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Open Casting, as a service
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Who is paying, what they are on, and what the site is doing. Your own casting work is in
          the{" "}
          <Link href="/dashboard" className="text-brand underline underline-offset-4 hover:text-brand-hover">
            casting director section
          </Link>
          .
        </p>
      </div>

      {/* Every page in the section as a tile, in the order of the bar above,
          so the two agree about where things are. */}
      {ADMIN_GROUPS.filter((group) => group.pages.length > 0).map((group) => (
        <section
          key={group.href}
          className={cx(CARD_GROUP, STACK)}
          aria-labelledby={`group-${group.label.toLowerCase()}`}
        >
          <SectionHead
            id={`group-${group.label.toLowerCase()}`}
            title={group.label}
            line={group.pages.map((page) => page.label).join(" · ")}
          />
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {group.pages.map((page) => {
              const insight = alerts.pages.get(page.href);
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    data-tile={page.href}
                    className={cx(
                      "group flex h-full items-start gap-4 rounded-xl border bg-surface p-4 transition-colors sm:p-5",
                      insight?.urgency === "now"
                        ? "border-danger/50 hover:border-danger"
                        : insight?.urgency === "soon"
                          ? "border-amber/50 hover:border-amber"
                          : "border-line hover:border-accent",
                    )}
                  >
                    <span
                      className={cx(
                        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
                        insight?.urgency === "now"
                          ? "bg-danger-soft text-danger"
                          : insight?.urgency === "soon"
                            ? "bg-amber-soft text-amber"
                            : "bg-accent-soft text-brand",
                      )}
                    >
                      <AdminIcon name={page.icon} className="size-5" />
                      {insight?.urgency ? (
                        <AlertDot
                          on="corner"
                          count={insight.alerts}
                          urgency={insight.urgency}
                          label={`${insight.alerts} waiting on ${page.label}`}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tracking-tight transition-colors group-hover:text-brand">
                        {page.label}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium text-text">
                        {insight?.figure ?? ""}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {page.line}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className={cx(CARD, STACK)} aria-labelledby="store-heading">
        <SectionHead
          id="store-heading"
          title="File store"
          line={
            store
              ? `Connected through a ${describeStore()}. Applicants can attach a photo and a video to a submission. Files are private, read back only through the dashboard, and go with the submission.`
              : describeStore() === "not connected"
                ? "Not connected. The form offers no uploads until a Vercel Blob store is connected to this project's Production environment and the site is redeployed."
                : `Not connected: ${describeStore()}.`
          }
          aside={
            <>
              <ButtonLink href="/admin/storage" variant="secondary" size="sm">
                What is stored
              </ButtonLink>
              {store ? (
                <form action={testFileStore}>
                  <Button type="submit" variant="secondary" size="sm">
                    Test the store
                  </Button>
                </form>
              ) : null}
            </>
          }
        />
        {query.store === "ok" ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive"
          >
            Wrote a private test file, read it back and deleted it
            {typeof query.ms === "string" ? ` in ${query.ms} ms` : ""}. The store works from this
            deployment.
          </p>
        ) : null}
        {query.store === "failed" ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            The store did not work: {why || "no reason was given."}
          </p>
        ) : null}
      </section>

      <section className={cx(CARD_GROUP, STACK)} aria-labelledby="latest-heading">
        <SectionHead
          id="latest-heading"
          title="Latest activity"
          line="The last few things that happened on the site, newest first."
          aside={
            <ButtonLink href="/admin/activity" variant="secondary" size="sm">
              See all activity
            </ButtonLink>
          }
        />
        <div className="mt-5">
          <ActivityList
            entries={activity}
            emptyDescription="Nothing has happened on the site yet."
          />
        </div>
      </section>
    </div>
  );
}
