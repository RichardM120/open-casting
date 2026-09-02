import type { Metadata } from "next";
import Link from "next/link";

import { ActivityList } from "@/components/activity-list";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { clientUsage, listClients } from "@/lib/clients";
import { listAccounts } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  description: "The clients paying for Open Casting, the accounts under them, and the trail.",
};

/** Where the owner starts: the state of the service, rather than one casting. */
export default async function AdminPage() {
  const user = await requireUser("/admin");
  const [clients, usage, accounts, activity] = await Promise.all([
    listClients(),
    clientUsage(),
    listAccounts(),
    listActivity(user, { limit: 8 }),
  ]);

  const totals = clients.reduce(
    (running, client) => {
      const used = usage.get(client.id);
      return {
        live: running.live + (client.suspendedAt === null ? 1 : 0),
        productions: running.productions + (used?.productions ?? 0),
        submissions: running.submissions + (used?.submissions ?? 0),
      };
    },
    { live: 0, productions: 0, submissions: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Eyebrow>Admin</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Open Casting, as a service
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Who is paying, what they are on, and what the site is doing. Your own casting work is in
        the{" "}
        <Link href="/dashboard" className="text-accent underline-offset-4 hover:underline">
          casting director section
        </Link>
        .
      </p>

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clients" value={`${totals.live} of ${clients.length} active`} />
        <Stat label="Accounts" value={accounts.length} />
        <Stat label="Productions" value={totals.productions} />
        <Stat label="Submissions" value={totals.submissions} />
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/admin/clients">Clients</ButtonLink>
        <ButtonLink href="/admin/accounts" variant="secondary">
          Accounts
        </ButtonLink>
        <ButtonLink href="/admin/activity" variant="secondary">
          Activity
        </ButtonLink>
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Latest activity</h2>
          <Link
            href="/admin/activity"
            className="text-sm text-muted transition-colors hover:text-text"
          >
            All of it
          </Link>
        </div>
        <div className="mt-4">
          <ActivityList
            entries={activity}
            emptyDescription="Nothing has happened on the site yet."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}
