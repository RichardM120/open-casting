import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/client-form";
import { Badge, Button, ButtonLink, CARD, cx, Eyebrow, SectionHead } from "@/components/ui";
import { removeClient, toggleClientSuspended } from "@/lib/actions";
import { currentUser, requireUser } from "@/lib/auth";
import { clientUsage, getClient } from "@/lib/clients";
import { formatDate, formatMoney } from "@/lib/format";
import { BILLING_PERIODS, ROLE_LABELS, TIERS } from "@/lib/types";
import { listAccounts } from "@/lib/users";
import { Breadcrumb } from "@/components/breadcrumb";
import { adminTrail } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/admin/clients/[id]">): Promise<Metadata> {
  const user = await currentUser();
  const client = user?.role === "admin" ? await getClient((await params).id) : null;
  return { title: client ? client.name : "Client not found" };
}

/** Everything about one customer: who they are, what they bought, what they use. */
export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/admin/clients/${id}`);
  if (user.role !== "admin") notFound();

  const client = await getClient(id);
  if (!client) notFound();

  const [accounts, usage, query] = await Promise.all([
    listAccounts(id),
    clientUsage(),
    searchParams,
  ]);
  const used = usage.get(id);

  const notice = query.created
    ? "The client was added. Make its accounts next."
    : query.saved
      ? "The client was saved."
      : query.suspended
        ? "The client is suspended. Everyone under it has been signed out."
        : query.restored
          ? "The client is active again."
          : query.inuse
            ? "That client still has accounts or casting calls. Suspend it instead, or remove those first."
            : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={adminTrail("/admin/clients", [{ label: client.name }])} />
      <HelpNote title="What to do on this screen">
        <p dangerouslySetInnerHTML={{ __html: 'Change what this client is on here: the plan, the ceilings and the access date. Every account under them inherits it, so there is nothing to set per account.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Suspending locks every account out at once and is reversible. Removing is only possible once nothing is left under the client.' }} />
      </HelpNote>

      {notice ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-line-strong bg-raised p-4 text-sm text-muted"
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Client</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{client.name}</h1>
          <p className="mt-2 text-muted">
            {client.tier ? TIERS[client.tier].label : "No plan set"} · on since{" "}
            {formatDate(client.createdAt)}
            {client.accessUntil ? ` · access until ${formatDate(client.accessUntil)}` : ""}
          </p>
        </div>
        {client.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}
      </div>

      <section className={cx(CARD, "mt-8")} aria-labelledby="usage-heading">
      <SectionHead id="usage-heading" title="Usage" line="What this client is using against what it bought." />
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accounts" value={used?.accounts ?? 0} />
        <Stat
          label="Casting calls"
          value={
            client.maxSessions === null
              ? String(used?.productions ?? 0)
              : `${used?.productions ?? 0} of ${client.maxSessions}`
          }
        />
        <Stat label="Roles" value={used?.roles ?? 0} />
        <Stat label="Submissions" value={used?.submissions ?? 0} />
      </dl>
      </section>

      <section className={cx(CARD, "mt-8")} aria-labelledby="accounts-heading">
        <SectionHead
          id="accounts-heading"
          title="Accounts"
          line="Everyone signing in under this client. They inherit its plan and its ceilings."
          aside={
            <ButtonLink href="/admin/accounts" variant="secondary" size="sm">
              Manage accounts
            </ButtonLink>
          }
        />
        {accounts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No accounts yet.{" "}
            <Link
              href="/admin/accounts"
              className="text-brand underline-offset-4 hover:underline"
            >
              Make the first one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="truncate text-sm text-muted">{account.email}</p>
                </div>
                <Badge tone="outline">{ROLE_LABELS[account.role]}</Badge>
                {account.suspended_at ? <Badge tone="danger">Suspended</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {client.contactName ||
      client.contactEmail ||
      client.contactPhone ||
      client.billingEmail ||
      client.billingReference ||
      client.vatNumber ||
      client.ratePence !== null ||
      client.paymentTermsDays !== null ||
      client.address ||
      client.notes ? (
        <section className={cx(CARD, "mt-8")} aria-labelledby="details-heading">
          <SectionHead
            id="details-heading"
            title="Details"
            line="Who to talk to, where the invoice goes, and what is on it."
          />
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail label="Contact" value={client.contactName} />
            <Detail label="Contact email" value={client.contactEmail} />
            <Detail label="Phone" value={client.contactPhone} />
            <Detail label="Where the invoice goes" value={client.billingEmail} />
            <Detail label="Purchase order or reference" value={client.billingReference} />
            <Detail label="VAT number" value={client.vatNumber} />
            <Detail
              label="What they pay"
              value={
                client.ratePence === null
                  ? ""
                  : `${formatMoney(client.ratePence)}${
                      client.billingPeriod ? ` ${BILLING_PERIODS[client.billingPeriod].label.toLowerCase()}` : ""
                    }`
              }
            />
            <Detail
              label="Payment terms"
              value={
                client.paymentTermsDays === null
                  ? ""
                  : `${client.paymentTermsDays} days from the invoice`
              }
            />
            <Detail label="Address" value={client.address} />
            <Detail label="Notes" value={client.notes} wide />
          </dl>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="plan-heading">
        <SectionHead
          id="plan-heading"
          title="What they are on"
          line="The plan, the ceilings and the access date. Every account under them inherits it."
        />
        <div className="mt-5">
          <ClientForm client={client} />
        </div>
      </section>

      <section className={cx(CARD, "mt-8")} aria-labelledby="stopping-heading">
        <SectionHead
          id="stopping-heading"
          title="Stopping this client"
          line="Suspending locks every account under this client out at once and is reversible; removing is possible only once nothing is left under it."
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action={toggleClientSuspended}>
            <input type="hidden" name="clientId" value={client.id} />
            {client.suspendedAt ? null : <input type="hidden" name="suspend" value="on" />}
            <Button type="submit" variant={client.suspendedAt ? "secondary" : "danger"} size="sm">
              {client.suspendedAt ? "Restore this client" : "Suspend this client"}
            </Button>
          </form>

          {(used?.accounts ?? 0) === 0 && (used?.productions ?? 0) === 0 ? (
            <form action={removeClient} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="confirm" className="size-4 accent-danger" />
                I am sure
              </label>
              <Button type="submit" variant="danger" size="sm">
                Remove this client
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
