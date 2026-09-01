import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { listSessionRoles } from "@/lib/roles";
import { getVisibleSession } from "@/lib/sessions";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/sessions/[id]/edit">): Promise<Metadata> {
  const user = await currentUser();
  const session = user ? await getVisibleSession((await params).id, user) : null;
  return { title: session ? `Edit — ${session.name}` : "Session not found" };
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
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href={`/dashboard/sessions/${session.id}`}
        className="text-sm text-muted transition-colors hover:text-text"
      >
        ← Back to the production
      </Link>

      <div className="mt-6">
        <Eyebrow>Casting session</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Edit {session.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Changes go live immediately. Moving the dates moves{" "}
          {roles.length === 1 ? "the role" : `all ${roles.length} roles`} in this session with
          them, so check before you shorten the window — anyone mid-submission loses the form.
        </p>
      </div>

      <div className="mt-10">
        <SessionForm session={session} />
      </div>
    </div>
  );
}
