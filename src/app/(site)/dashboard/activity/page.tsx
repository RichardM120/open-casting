import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { CARD, cx, Eyebrow, SectionHead } from "@/components/ui";
import { countActivity, listActivity } from "@/lib/activity";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata: Metadata = { title: "Activity" };

const SCOPE = {
  director: "Everything that has happened on the casting calls and roles you posted.",
  producer: "Everything across every casting call and role under your company.",
  admin: "Everything on the site, including account changes.",
} as const;

export default async function ActivityPage({
  searchParams,
}: PageProps<"/dashboard/activity">) {
  const user = await requireUser("/dashboard/activity");
  const [query, total] = await Promise.all([searchParams, countActivity(user)]);

  // Fifty a page, as everywhere else a list can run long.
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const entries = await listActivity(user, {
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { label: "Activity" }]} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Everything that has happened on your casting calls and roles, newest first. Nothing here is editable; it is the record.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>History</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Activity</h1>
        <p className="mt-3 max-w-prose text-muted">{SCOPE[user.role]}</p>
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
            emptyDescription="Open a casting call, and everything that happens to it is recorded here."
          />
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={LIST_PAGE_SIZE}
          href={(n) => (n > 1 ? `/dashboard/activity?page=${n}` : "/dashboard/activity")}
        />
      </section>
    </div>
  );
}
