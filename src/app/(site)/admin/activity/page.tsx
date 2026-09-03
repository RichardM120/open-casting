import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { Eyebrow } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity" };

/**
 * The site-wide trail. The same list a director sees of their own work, which
 * is scoped by the viewer's role rather than by which page asked for it, so an
 * admin reaching it from here gets everything.
 */
export default async function AdminActivityPage() {
  const user = await requireUser("/admin/activity");
  const entries = await listActivity(user, { limit: 200 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'Everything on the site, across every client, including account changes. It is the record, and it is not editable.' }} />
      </HelpNote>
      <Link href="/admin" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Admin
      </Link>

      <div className="mt-6">
        <Eyebrow>History</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Activity</h1>
        <p className="mt-3 max-w-prose text-muted">
          Everything on the site, across every client, including account changes.
        </p>
      </div>

      <div className="mt-10">
        <ActivityList
          entries={entries}
          emptyDescription="Nothing has happened on the site yet."
        />
      </div>
    </div>
  );
}
