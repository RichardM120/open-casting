import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";

import { ActivityList } from "@/components/activity-list";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { testFileStore } from "@/lib/actions";
import { listActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { describeStore, uploadsEnabled } from "@/lib/blob";
import { clientUsage, listClients } from "@/lib/clients";
import { listAccounts } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  description: "The clients paying for Open Casting, the accounts under them, and the trail.",
};

/** Where the owner starts: the state of the service, rather than one casting. */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser("/admin");
  const [clients, usage, accounts, activity, query] = await Promise.all([
    listClients(),
    clientUsage(),
    listAccounts(),
    listActivity(user, { limit: 8 }),
    searchParams,
  ]);
  const store = uploadsEnabled();
  const why = typeof query.why === "string" ? query.why : "";

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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'The service as a whole: who is paying, what they are using, and what has happened. Your own casting work lives in the casting director section.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'The file store card says whether applicants can attach photos and videos, and can prove the store works from this deployment.' }} />
      </HelpNote>
      <Eyebrow>Admin</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Open Casting, as a service
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Who is paying, what they are on, and what the site is doing. Your own casting work is in
        the{" "}
        <Link href="/dashboard" className="text-brand underline-offset-4 hover:underline">
          casting director section
        </Link>
        .
      </p>

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clients" value={`${totals.live} of ${clients.length} active`} />
        <Stat label="Accounts" value={accounts.length} />
        <Stat label="Casting calls" value={totals.productions} />
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

      <section className="mt-10 rounded-2xl border border-line-strong bg-raised p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">File store</h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
              {store
                ? `Connected through a ${describeStore()}. Applicants can attach a photo and a video to a submission. Files are private, read back only through the dashboard, and go with the submission.`
                : describeStore() === "not connected"
                  ? "Not connected. The form offers no uploads until a Vercel Blob store is connected to this project's Production environment and the site is redeployed."
                  : `Not connected: ${describeStore()}.`}
            </p>
          </div>
          {store ? (
            <form action={testFileStore}>
              <Button type="submit" variant="secondary" size="sm">
                Test the store
              </Button>
            </form>
          ) : null}
        </div>
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
    <div className="rounded-2xl border border-line-strong bg-raised p-4 sm:p-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}
