import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";
import { notFound } from "next/navigation";

import { RoleForm } from "@/components/role-form";
import { uploadsEnabled } from "@/lib/blob";
import { Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { getVisibleRole } from "@/lib/roles";
import { listVisibleSessions } from "@/lib/sessions";
import { Breadcrumb } from "@/components/breadcrumb";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/roles/[id]/edit">): Promise<Metadata> {
  const user = await currentUser();
  const role = user ? await getVisibleRole((await params).id, user) : null;
  return { title: role ? `Edit ${role.title}` : "Role not found" };
}

export default async function EditRolePage({
  params,
}: PageProps<"/dashboard/roles/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/roles/${id}/edit`);

  const role = await getVisibleRole(id, user);
  if (!role) notFound();

  const sessions = await listVisibleSessions(user);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { href: `/dashboard/sessions/${role.sessionId}`, label: role.production }, { href: `/dashboard/roles/${role.id}`, label: role.title }, { label: "Edit" }]} />
      <SetupProgress stage={3} sessionId={role.sessionId} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Edits show on the public page immediately. Changing the terms does not change what people who already submitted agreed to.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>{role.production}</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Edit {role.title}
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Changes go live straight away. Anyone who has already submitted keeps the terms they
          accepted at the time.
        </p>
      </div>

      <div className="mt-10">
        <RoleForm role={role} sessions={sessions} uploads={uploadsEnabled()} />
      </div>
    </div>
  );
}
