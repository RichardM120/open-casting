import type { Metadata } from "next";
import Link from "next/link";

import { DeadlineBadge } from "@/components/role-card";
import { Badge, ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isOpen } from "@/lib/format";
import { listVisibleRoles } from "@/lib/roles";
import { countsByRole } from "@/lib/submissions";

// Counts and listings come from the database on every request, so this page is
// never prerendered — a deploy build does not need a reachable database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Casting dashboard",
  description: "Every role you have posted and every submission against it.",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const [roles, counts] = await Promise.all([
    listVisibleRoles(user),
    countsByRole(user),
  ]);

  const totals = roles.reduce(
    (accumulator, role) => {
      const count = counts.get(role.id);
      return {
        open: accumulator.open + (isOpen(role.deadline) ? 1 : 0),
        submissions: accumulator.submissions + (count?.total ?? 0),
        shortlisted: accumulator.shortlisted + (count?.Shortlisted ?? 0),
        toRead: accumulator.toRead + (count?.New ?? 0),
      };
    },
    { open: 0, submissions: 0, shortlisted: 0, toRead: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Casting dashboard</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Your roles</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {user.role === "admin"
              ? "Every role on the board, across all companies."
              : user.role === "producer"
                ? `Every role posted under ${user.company}, across productions.`
                : "The roles you have posted, with what has come in against them."}{" "}
            Open a role to read the submissions.
          </p>
        </div>
        <ButtonLink href="/roles/new">Post a role</ButtonLink>
      </div>

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Roles open" value={totals.open} />
        <Stat label="Submissions" value={totals.submissions} />
        <Stat label="Still to read" value={totals.toRead} tone="accent" />
        <Stat label="Shortlisted" value={totals.shortlisted} tone="positive" />
      </dl>

      {roles.length > 0 ? (
        <ul className="mt-10 flex flex-col gap-3">
          {roles.map((role) => {
            const count = counts.get(role.id);
            return (
              <li key={role.id}>
                <Link
                  href={`/dashboard/roles/${role.id}`}
                  className="group flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium transition-colors group-hover:text-accent">
                      {role.title}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {role.production} · {role.location}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {count?.New ? <Badge tone="accent">{count.New} to read</Badge> : null}
                    {count?.Shortlisted ? (
                      <Badge tone="positive">{count.Shortlisted} shortlisted</Badge>
                    ) : null}
                    <Badge tone="outline">
                      {count?.total ?? 0} {count?.total === 1 ? "submission" : "submissions"}
                    </Badge>
                    <DeadlineBadge deadline={role.deadline} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="No roles posted yet"
            description="Put a casting call up and submissions will collect here."
            action={<ButtonLink href="/roles/new">Post a role</ButtonLink>}
          />
        </div>
      )}

    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "accent" | "positive";
}) {
  const colour =
    value === 0 ? "text-text" : tone === "accent" ? "text-accent" : tone === "positive" ? "text-positive" : "text-text";

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-3xl font-semibold tracking-tight ${colour}`}>{value}</dd>
    </div>
  );
}
