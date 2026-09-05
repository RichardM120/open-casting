import type { Metadata } from "next";

import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";

import { RoleForm } from "@/components/role-form";
import { uploadsEnabled } from "@/lib/blob";
import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listVisibleSessions } from "@/lib/sessions";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata: Metadata = {
  title: "Post a role",
  description: "Put a role up with the brief and the dates spelled out.",
};

export default async function NewRolePage({ searchParams }: PageProps<"/dashboard/roles/new">) {
  const user = await requireUser("/dashboard/roles/new");
  const [sessions, query] = await Promise.all([listVisibleSessions(user), searchParams]);

  // A role has to belong to a casting call, so there is nothing to fill in until
  // one exists. Saying so beats a form with an empty, required dropdown.
  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { label: "New role" }]} />
        <SetupProgress stage={2} />
        <HelpNote title="What this screen is for" faq="/faq/casting-directors">
          <p dangerouslySetInnerHTML={{ __html: 'A role is the brief and the practicalities: who you are looking for, where it shoots and when. Its submission dates come from the casting call, not from here.' }} />
          <p dangerouslySetInnerHTML={{ __html: 'Terms you set here must be accepted by everyone who submits to this role.' }} />
        </HelpNote>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">Post a role</h1>
        <div className="mt-10">
          <EmptyState
            title="Open a casting call first"
            description="Roles belong to a casting call, which holds the dates they take submissions between. Open one and you can post its roles straight after."
            action={<ButtonLink href="/dashboard/sessions/new">New casting call</ButtonLink>}
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { href: `/dashboard/sessions/${production.id}`, label: production.name }, { label: "New role" }]} />
      <SetupProgress stage={2} sessionId={requested} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'A role is the brief and the practicalities: who you are looking for, where it shoots and when. Its submission dates come from the casting call, not from here.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'Terms you set here must be accepted by everyone who submits to this role.' }} />
      </HelpNote>
      <div className="mt-6">
        <Eyebrow>{production.name}</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Post a role</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Name the part, describe it, and say where and when it shoots. It goes live under{" "}
          {user.company} when its casting call opens.
        </p>
      </div>

      <div className="mt-10">
        <RoleForm sessions={sessions} defaultSessionId={defaultSessionId} uploads={uploadsEnabled()} />
      </div>
    </div>
  );
}
