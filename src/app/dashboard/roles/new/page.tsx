import type { Metadata } from "next";

import Link from "next/link";

import { RoleForm } from "@/components/role-form";
import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listVisibleSessions } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "Post a role",
  description: "Put a role up with the brief, the rate and the dates spelled out.",
};

export default async function NewRolePage({ searchParams }: PageProps<"/dashboard/roles/new">) {
  const user = await requireUser("/dashboard/roles/new");
  const [sessions, query] = await Promise.all([listVisibleSessions(user), searchParams]);

  // A role has to belong to a production, so there is nothing to fill in until
  // one exists. Saying so beats a form with an empty, required dropdown.
  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/dashboard" className="text-sm text-muted hover:text-text">
          &larr; Productions
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">Post a role</h1>
        <div className="mt-10">
          <EmptyState
            title="Open a production first"
            description="Roles belong to a production, which holds the dates they take submissions between. Open one and you can post its roles straight afterwards."
            action={<ButtonLink href="/dashboard/sessions/new">New production</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const requested = typeof query.session === "string" ? query.session : undefined;
  const defaultSessionId = sessions.some((session) => session.id === requested)
    ? requested
    : sessions[0].id;
  const production = sessions.find((session) => session.id === defaultSessionId) ?? sessions[0];

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href={`/dashboard/sessions/${production.id}`}
        className="text-sm text-muted hover:text-text"
      >
        &larr; {production.name}
      </Link>
      <Eyebrow className="mt-6">New role</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Post a role</h1>
      <p className="mt-3 max-w-2xl text-muted">
        The clearer the brief, the fewer wrong submissions you read. The role goes live under{" "}
        {user.company} when its production opens.
      </p>
      <p className="mt-3 text-sm text-muted">
        <Link href="/faq/casting-directors" className="text-accent underline-offset-4 hover:underline">
          What each field commits you to
        </Link>
        , including the rate, the buyout, and how to write terms worth having.
      </p>

      <div className="mt-10">
        <RoleForm sessions={sessions} defaultSessionId={defaultSessionId} />
      </div>
    </div>
  );
}
