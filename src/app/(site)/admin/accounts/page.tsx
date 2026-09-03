import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { notFound } from "next/navigation";

import { NewAccountForm } from "@/components/new-account-form";
import { Badge, Button, Eyebrow } from "@/components/ui";
import { toggleAccountSuspended } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { ROLE_LABELS, TIERS, type Tier } from "@/lib/types";
import { listAccounts } from "@/lib/users";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUser("/admin/accounts");

  // A 404 rather than a message: a non-admin should not learn this page exists.
  if (user.role !== "admin") notFound();

  const [accounts, clients] = await Promise.all([listAccounts(), listClients()]);
  const suspended = accounts.filter((account) => account.suspended_at).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/admin", label: "Admin" }, { label: "Accounts" }]} />
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'Accounts belong to a client and inherit its plan. The password is generated and shown once, so hand it over straight away; it cannot be retrieved afterwards.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'A director sees only the casting calls they open. A producer sees every call under their client.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Accounts</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          {suspended > 0 ? `, ${suspended} suspended` : ""}. Nobody can register themselves, so
          every account here was made on this page. Suspending signs someone out immediately and
          blocks them from signing back in. Their casting calls stay up.
        </p>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-6 md:p-7">
        <h2 className="text-lg font-semibold tracking-tight">Create an account</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          For a casting director or a production team. You will be given a password to pass on;
          it is shown once.
        </p>
        <div className="mt-6">
          {clients.length === 0 ? (
            <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
              An account belongs to a client, so there is nothing to fill in yet.{" "}
              <Link
                href="/admin/clients/new"
                className="text-brand underline-offset-4 hover:underline"
              >
                Take on the first client
              </Link>
              , then come back.
            </p>
          ) : (
            <NewAccountForm clients={clients} />
          )}
        </div>
      </section>

      <ul className="mt-10 flex flex-col gap-3">
        {accounts.map((account) => {
          const isSuspended = Boolean(account.suspended_at);
          return (
            <li
              key={account.id}
              className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="truncate font-medium">{account.name}</p>
                  <Badge tone={account.role === "admin" ? "accent" : "outline"}>
                    {ROLE_LABELS[account.role]}
                  </Badge>
                  {account.tier && account.tier in TIERS ? (
                    <Badge tone="outline">{TIERS[account.tier as Tier].label}</Badge>
                  ) : null}
                  {isSuspended ? <Badge tone="danger">Suspended</Badge> : null}
                  {account.id === user.id ? <Badge tone="neutral">You</Badge> : null}
                </div>
                <p className="truncate text-sm text-muted">
                  {account.company} · {account.email}
                </p>
              </div>

              <p className="text-sm text-muted">
                {account.sessions}{" "}
                {account.sessions === 1 ? "casting call" : "casting calls"} ·{" "}
                {account.roles} {account.roles === 1 ? "role" : "roles"} ·{" "}
                {account.submissions} {account.submissions === 1 ? "submission" : "submissions"}
                {account.access_until ? ` · until ${account.access_until}` : ""}
              </p>

              {account.id === user.id ? (
                <p className="text-sm text-faint">Cannot suspend yourself</p>
              ) : (
                <form action={toggleAccountSuspended}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="hidden" name="suspended" value={isSuspended ? "0" : "1"} />
                  <Button
                    type="submit"
                    variant={isSuspended ? "secondary" : "danger"}
                    size="sm"
                  >
                    {isSuspended ? "Restore" : "Suspend"}
                  </Button>
                </form>
              )}
              </div>

              {account.role === "admin" || !account.client_id ? null : (
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                  What they may run comes from their client.{" "}
                  <Link
                    href={`/admin/clients/${account.client_id}`}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    Change it on {account.company}
                  </Link>
                  .
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
