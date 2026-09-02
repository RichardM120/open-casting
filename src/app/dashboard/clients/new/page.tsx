import type { Metadata } from "next";
import Link from "next/link";

import { ClientForm } from "@/components/client-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New client",
  description: "Add a company you cast for, then open its productions.",
};

export default async function NewClientPage() {
  await requireUser("/dashboard/clients/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/dashboard/clients"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        &larr; Clients
      </Link>

      <div className="mt-6">
        <Eyebrow>New client</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Add a client</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The company whose work this is. Once it exists you can open productions under it, and
          the dashboard will keep them together.
        </p>
      </div>

      <div className="mt-10">
        <ClientForm />
      </div>
    </div>
  );
}
