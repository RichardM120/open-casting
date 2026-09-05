import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";
import { notFound } from "next/navigation";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { uploadsEnabled } from "@/lib/blob";
import { listSessionRoles } from "@/lib/roles";
import { getVisibleSession } from "@/lib/sessions";
import { Breadcrumb } from "@/components/breadcrumb";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/sessions/[id]/edit">): Promise<Metadata> {
  const user = await currentUser();
  const session = user ? await getVisibleSession((await params).id, user) : null;
  return { title: session ? `Edit ${session.name}` : "Casting call not found" };
}

export default async function EditSessionPage({
  params,
}: PageProps<"/dashboard/sessions/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/sessions/${id}/edit`);

  const session = await getVisibleSession(id, user);
  if (!session) notFound();

  const roles = await listSessionRoles(id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { href: `/dashboard/sessions/${session.id}`, label: session.name }, { label: "Edit" }]} />
      <SetupProgress stage={1} sessionId={session.id} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'Changes go live straight away, and moving the times moves every role in the call with them. Shortening the window drops anyone mid-submission.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>Casting call</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Edit {session.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Changes go live straight away, and moving the times moves{" "}
          {roles.length === 1 ? "the role" : `all ${roles.length} roles`} in this casting call with
          them.
        </p>
      </div>

      <div className="mt-10">
        <SessionForm session={session} uploads={uploadsEnabled()} userId={user.id} />
      </div>
    </div>
  );
}
