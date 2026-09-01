import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewAccountForm } from "@/components/new-account-form";
import { Badge, Button, Eyebrow } from "@/components/ui";
import { toggleAccountSuspended } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import { listAccounts } from "@/lib/users";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUser("/dashboard/accounts");

  // A 404 rather than a message: a non-admin should not learn this page exists.
  if (user.role !== "admin") notFound();

  const accounts = await listAccounts();
  const suspended = accounts.filter((account) => account.suspended_at).length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        ← Dashboard
      </Link>

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Accounts</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          {suspended > 0 ? `, ${suspended} suspended` : ""}. Nobody can register themselves —
          every account here was made on this page. Suspending signs someone out immediately and
          blocks them from signing back in; their roles stay up.
        </p>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-6 md:p-7">
        <h2 className="text-lg font-semibold tracking-tight">Create an account</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          For a casting director or a production team. You will be given a password to pass on;
          it is shown once.
        </p>
        <div className="mt-6">
          <NewAccountForm />
        </div>
      </section>

      <ul className="mt-10 flex flex-col gap-3">
        {accounts.map((account) => {
          const isSuspended = Boolean(account.suspended_at);
          return (
            <li
              key={account.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="truncate font-medium">{account.name}</p>
                  <Badge tone={account.role === "admin" ? "accent" : "outline"}>
                    {ROLE_LABELS[account.role]}
                  </Badge>
                  {isSuspended ? <Badge tone="danger">Suspended</Badge> : null}
                  {account.id === user.id ? <Badge tone="neutral">You</Badge> : null}
                </div>
                <p className="truncate text-sm text-muted">
                  {account.company} · {account.email}
                </p>
              </div>

              <p className="text-sm text-muted">
                {account.roles} {account.roles === 1 ? "role" : "roles"} ·{" "}
                {account.submissions} {account.submissions === 1 ? "submission" : "submissions"}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
