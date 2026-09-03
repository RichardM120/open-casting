import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { Eyebrow } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Activity" };

const SCOPE = {
  director: "Everything that has happened on the casting calls and roles you posted.",
  producer: "Everything across every casting call and role under your company.",
  admin: "Everything on the site, including account changes.",
} as const;

export default async function ActivityPage() {
  const user = await requireUser("/dashboard/activity");
  const entries = await listActivity(user, { limit: 200 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Everything that has happened on your casting calls and roles, newest first. Nothing here is editable; it is the record.' }} />
      </HelpNote>
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Casting calls
      </Link>

      <div className="mt-6">
        <Eyebrow>History</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Activity</h1>
        <p className="mt-3 max-w-prose text-muted">{SCOPE[user.role]}</p>
      </div>

      <div className="mt-10">
        <ActivityList
          entries={entries}
          emptyDescription="Open a casting call, and everything that happens to it is recorded here."
        />
      </div>
    </div>
  );
}
