import type { Metadata } from "next";
import Link from "next/link";

import { removeClient } from "@/lib/actions";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { clientProductionCounts, listVisibleClients } from "@/lib/clients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients",
  description: "The companies you cast for, and the productions under each.",
};

/**
 * The client list. Clients sit above productions, so this is where a new piece
 * of work starts: add the client, then open its production.
 */
export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const user = await requireUser("/dashboard/clients");
  const [clients, counts, params] = await Promise.all([
    listVisibleClients(user),
    clientProductionCounts(user),
    searchParams,
  ]);

  const notice = params.created
    ? "The client was added. You can open its first production now."
    : params.saved
      ? "The client was saved."
      : params.removed
        ? "The client was removed."
        : params.inuse
          ? "That client still has productions under it. Remove those first, or move them to another client."
          : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Productions
      </Link>

      {notice ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted"
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Clients</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {user.role === "director" ? "Your clients" : "Clients"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            The companies you cast for. Every production belongs to one, which is how the
            dashboard stays sorted once you are running more than a couple. Applicants never see
            any of this.
          </p>
        </div>
        <ButtonLink href="/dashboard/clients/new">New client</ButtonLink>
      </div>

      {clients.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No clients yet"
            description="Add the company you are casting for, then open its first production."
            action={<ButtonLink href="/dashboard/clients/new">New client</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-3">
          {clients.map((client) => {
            const productions = counts.get(client.id) ?? 0;
            return (
              <li
                key={client.id}
                className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{client.name}</p>
                    {client.notes ? (
                      <p className="mt-1 text-sm text-muted">{client.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="outline">
                      {productions} {productions === 1 ? "production" : "productions"}
                    </Badge>
                    <ButtonLink
                      href={`/dashboard/clients/${client.id}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </ButtonLink>
                    {productions === 0 ? (
                      <form action={removeClient}>
                        <input type="hidden" name="clientId" value={client.id} />
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger-soft"
                        >
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
