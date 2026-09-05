import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { notFound } from "next/navigation";

import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { Badge, Button, ButtonLink, CARD_GROUP, cx, Eyebrow, ROW_MAIN, SectionHead, STACK } from "@/components/ui";
import { toggleAccountSuspended } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, TIERS, type Tier } from "@/lib/types";
import { countAccounts, countSuspendedAccounts, listAccounts } from "@/lib/users";
import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  const user = await requireUser("/admin/accounts");

  // A 404 rather than a message: a non-admin should not learn this page exists.
  if (user.role !== "admin") notFound();

  const [query, total, suspended] = await Promise.all([
    searchParams,
    countAccounts(),
    countSuspendedAccounts(),
  ]);

  // Fifty a page, counted and fetched in the database: the list only grows.
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const accounts = await listAccounts(undefined, {
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/accounts")} />
      <AdminTabs pathname="/admin/accounts" />
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'Every account here belongs to a client and inherits its plan. Set one up with New account, which asks for the person and what their client is invoiced.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'A director sees only the casting calls they open. A producer sees every call under their client.' }} />
      </HelpNote>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Admin</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Accounts</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {total} {total === 1 ? "account" : "accounts"}
            {suspended > 0 ? `, ${suspended} suspended` : ""}. Nobody can register themselves, so
            every account here was set up by an administrator.
          </p>
        </div>
        <ButtonLink href="/admin/accounts/new">New account</ButtonLink>
      </div>

      <section className={cx(CARD_GROUP, STACK)} aria-labelledby="accounts-heading">
      <SectionHead
        id="accounts-heading"
        title="Accounts"
        line="Suspending signs someone out at once and blocks them from signing back in; their casting calls stay up."
      />
      <ul className="mt-5 flex flex-col gap-3">
        {accounts.map((account) => {
          const isSuspended = Boolean(account.suspended_at);
          return (
            <li
              key={account.id}
              className="rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className={ROW_MAIN}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {/* A name is wrapped, never cut: "ric…" names nobody. */}
                  <p className="min-w-0 font-medium wrap-anywhere">{account.name}</p>
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
                    className="text-brand underline underline-offset-4 hover:text-brand-hover"
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
      <Pagination
        page={page}
        total={total}
        pageSize={LIST_PAGE_SIZE}
        href={(n) => (n > 1 ? `/admin/accounts?page=${n}` : "/admin/accounts")}
      />
      </section>
    </div>
  );
}
