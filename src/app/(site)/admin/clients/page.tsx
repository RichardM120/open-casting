import type { Metadata } from "next";
import Link from "next/link";
import { AdminAlertBar } from "@/components/admin-alert-bar";
import { notFound } from "next/navigation";

import { Badge, ButtonLink, CARD_GROUP, cx, Eyebrow, ROW_MAIN, SectionHead, STACK } from "@/components/ui";
import { adminAlerts, alertsFor } from "@/lib/admin-alerts";
import { requireUser } from "@/lib/auth";
import { clientUsage, countClients, listClients } from "@/lib/clients";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { formatDate } from "@/lib/format";
import { TIERS } from "@/lib/types";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";

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
  const alerts = await adminAlerts(user);
  if (user.role !== "admin") notFound();

  const [usage, params, counted] = await Promise.all([
    clientUsage(),
    searchParams,
    countClients(),
  ]);
  const { total, live } = counted;

  // Fifty a page, as everywhere else a list can run long.
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(params.page), pages);
  const clients = await listClients({
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/clients")} />
      <AdminTabs pathname="/admin/clients" alerts={alerts} />
      <AdminAlertBar alerts={alertsFor(alerts, "/admin/clients")} scope="clients" />

      {params.removed ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-line-strong bg-raised p-4 text-sm text-muted"
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
            One row per company on the service. Open one to see its accounts and what it is using
            against what it bought.
          </p>
        </div>
        <ButtonLink href="/admin/clients/new">New client</ButtonLink>
      </div>

      <section className={cx(CARD_GROUP, STACK)} aria-labelledby="clients-heading">
        <SectionHead
          id="clients-heading"
          title="Clients"
          line={
            total === 0
              ? "No clients yet. Take on the first company paying for Open Casting, then make its accounts."
              : `${live} of ${total} ${total === 1 ? "client is" : "clients are"} active.`
          }
        />
        {clients.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {clients.map((client) => {
              const used = usage.get(client.id);
              return (
                <li
                  key={client.id}
                  className="relative rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className={ROW_MAIN}>
                      {/* The name's link is stretched over the card, so the
                          target under a thumb is the whole row rather than
                          one line of text in it. */}
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="block truncate font-medium transition-colors after:absolute after:inset-0 after:rounded-xl hover:text-brand"
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
        ) : null}
        <Pagination
          page={page}
          total={total}
          pageSize={LIST_PAGE_SIZE}
          href={(n) => (n > 1 ? `/admin/clients?page=${n}` : "/admin/clients")}
        />
      </section>
    </div>
  );
}
