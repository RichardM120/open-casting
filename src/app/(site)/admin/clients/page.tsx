import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { notFound } from "next/navigation";

import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { clientUsage, listClients } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { TIERS } from "@/lib/types";
import { Breadcrumb } from "@/components/breadcrumb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients",
  description: "The companies paying for Open Casting, and what each is on.",
};

/**
 * The owner's list of customers. Everything above a casting call starts here: a
 * client is taken on, its accounts are made under it, and what it bought is
 * what those accounts are allowed to do.
 */
export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const user = await requireUser("/admin/clients");
  if (user.role !== "admin") notFound();

  const [clients, usage, params] = await Promise.all([
    listClients(),
    clientUsage(),
    searchParams,
  ]);

  const live = clients.filter((client) => client.suspendedAt === null).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/admin", label: "Admin" }, { label: "Clients" }]} />
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'One row per company paying for Open Casting. Open a client to see its accounts, what it is using against what it bought, and to suspend or restore it.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Take on a new client before making its accounts; an account cannot exist without one.' }} />
      </HelpNote>

      {params.removed ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted"
        >
          The client was removed.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Clients</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Who pays for Open Casting
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            One row per company on the service. Open a client to see its accounts, what it is
            using against what it bought, and to stop or restart it.
          </p>
        </div>
        <ButtonLink href="/admin/clients/new">New client</ButtonLink>
      </div>

      {clients.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No clients yet"
            description="Take on the first company paying for Open Casting, then make its accounts."
            action={<ButtonLink href="/admin/clients/new">New client</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted">
            {live} of {clients.length} {clients.length === 1 ? "client is" : "clients are"}{" "}
            active.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {clients.map((client) => {
              const used = usage.get(client.id);
              return (
                <li
                  key={client.id}
                  className="rounded-2xl border border-line bg-surface p-4 sm:p-6 transition-colors hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="block truncate font-medium transition-colors hover:text-brand"
                      >
                        {client.name}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {client.tier ? TIERS[client.tier].label : "No plan set"}
                        {client.contactName ? ` · ${client.contactName}` : ""}
                        {client.accessUntil ? ` · until ${formatDate(client.accessUntil)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {client.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}
                      <Badge tone="outline">
                        {used?.accounts ?? 0} {used?.accounts === 1 ? "account" : "accounts"}
                      </Badge>
                      <Badge tone="outline">
                        {used?.productions ?? 0}
                        {client.maxSessions === null ? "" : ` of ${client.maxSessions}`}{" "}
                        {used?.productions === 1 ? "casting call" : "casting calls"}
                      </Badge>
                      <Badge tone="outline">
                        {used?.submissions ?? 0}{" "}
                        {used?.submissions === 1 ? "submission" : "submissions"}
                      </Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
