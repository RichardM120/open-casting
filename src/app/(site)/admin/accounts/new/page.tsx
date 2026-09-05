import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountSetupForm } from "@/components/account-setup-form";
import { Breadcrumb } from "@/components/breadcrumb";
import { adminTrail } from "@/lib/admin-nav";
import { HelpNote } from "@/components/help-note";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/clients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up an account",
  description: "A new account, and what their client is invoiced.",
};

/**
 * Setting an account up, on its own page rather than above the list: the
 * person, then the money behind them, which is the client's and applies to
 * every account under it. Making an account and settling the arrangement are
 * the same job, so they are on the same page.
 */
export default async function NewAccountPage() {
  const user = await requireUser("/admin/accounts/new");
  if (user.role !== "admin") notFound();

  const clients = await listClients();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/accounts", [{ label: "Set up an account" }])} />
      <HelpNote title="What this screen is for">
        <p
          dangerouslySetInnerHTML={{
            __html:
              'The person, and what their client is invoiced. The password is generated and shown once, so hand it over straight away: it cannot be retrieved.',
          }}
        />
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Invoicing and what they pay belong to the client, so they are filled in with what that client is on and every account under it shares them.',
          }}
        />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>Accounts</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Set up an account
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Who is signing in, where the invoice goes, and what they pay.
        </p>
      </div>

      <div className="mt-10">
        {clients.length === 0 ? (
          <p className="rounded-2xl border border-line-strong bg-raised p-4 text-sm text-muted sm:p-6">
            An account belongs to a client, so there is nothing to fill in yet.{" "}
            <Link href="/admin/clients/new" className="text-brand underline underline-offset-4 hover:text-brand-hover">
              Take on the first client
            </Link>
            , then come back.
          </p>
        ) : (
          <AccountSetupForm clients={clients} />
        )}
      </div>
    </div>
  );
}
