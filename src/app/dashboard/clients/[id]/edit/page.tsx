import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/client-form";
import { Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { getVisibleClient } from "@/lib/clients";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/clients/[id]/edit">): Promise<Metadata> {
  const user = await currentUser();
  const client = user ? await getVisibleClient((await params).id, user) : null;
  return { title: client ? `Edit ${client.name}` : "Client not found" };
}

export default async function EditClientPage({
  params,
}: PageProps<"/dashboard/clients/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/clients/${id}/edit`);

  const client = await getVisibleClient(id, user);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/dashboard/clients"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        &larr; Clients
      </Link>

      <div className="mt-6">
        <Eyebrow>Client</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Edit {client.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Renaming a client changes it everywhere it appears on your dashboard. Nothing an
          applicant has already seen changes, because none of this reaches them.
        </p>
      </div>

      <div className="mt-10">
        <ClientForm client={client} />
      </div>
    </div>
  );
}
