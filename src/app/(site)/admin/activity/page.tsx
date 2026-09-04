import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { CARD, cx, Eyebrow, SectionHead } from "@/components/ui";
import { countActivity, listActivity } from "@/lib/activity";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity" };

/**
 * The site-wide trail. The same list a director sees of their own work, which
 * is scoped by the viewer's role rather than by which page asked for it, so an
 * admin reaching it from here gets everything.
 */
export default async function AdminActivityPage({
  searchParams,
}: PageProps<"/admin/activity">) {
  const user = await requireUser("/admin/activity");
  const [query, total] = await Promise.all([searchParams, countActivity(user)]);

  // Fifty a page. A trail is only ever added to, so the whole of it would be
  // one query that grows without limit and a page nobody can reach the end of.
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const entries = await listActivity(user, {
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={adminTrail("/admin/activity")} />
      <AdminTabs pathname="/admin/activity" />
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'Everything on the site, across every client, including account changes. It is the record, and it is not editable.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>History</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Activity</h1>
        <p className="mt-3 max-w-prose text-muted">
          Everything on the site, across every client, including account changes.
        </p>
      </div>

      <section className={cx(CARD, "mt-8")} aria-labelledby="record-heading">
        <SectionHead
          id="record-heading"
          title="The record"
          line={`${total} ${total === 1 ? "entry" : "entries"}, newest first, and nothing here can be edited.`}
        />
        <div className="mt-5">
          <ActivityList
            entries={entries}
            emptyDescription="Nothing has happened on the site yet."
          />
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={LIST_PAGE_SIZE}
          href={(n) => (n > 1 ? `/admin/activity?page=${n}` : "/admin/activity")}
        />
      </section>
    </div>
  );
}
