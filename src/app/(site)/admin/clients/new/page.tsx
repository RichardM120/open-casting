import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/client-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { Breadcrumb } from "@/components/breadcrumb";
import { adminTrail } from "@/lib/admin-nav";

export const metadata: Metadata = {
  title: "New client",
  description: "Take on a company paying for Open Casting.",
};

export default async function NewClientPage() {
  const user = await requireUser("/admin/clients/new");
  if (user.role !== "admin") notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/clients", [{ label: "New client" }])} />
      <HelpNote title="What this screen is for">
        <p dangerouslySetInnerHTML={{ __html: 'The company, who to talk to, where the invoice goes, and what they bought. Their accounts come next and inherit all of it.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>New client</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Take on a client
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          The company, who to talk to, where the invoice goes, and what they are on.
        </p>
      </div>

      <div className="mt-10">
        <ClientForm />
      </div>
    </div>
  );
}
