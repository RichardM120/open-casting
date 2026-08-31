import type { Metadata } from "next";
import { Suspense } from "react";

import { RoleCard } from "@/components/role-card";
import { RoleFilters } from "@/components/role-filters";
import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { hasActiveFilters, listRoles, parseRoleFilters } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Browse roles",
  description: "Every open casting call, with the rate, dates and closing date up front.",
};

export default async function RolesPage({ searchParams }: PageProps<"/roles">) {
  const filters = parseRoleFilters(await searchParams);
  const roles = await listRoles(filters);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Eyebrow>Open casting calls</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Browse roles</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Closing soonest first. Everything you need to decide whether to spend an evening on a
        tape is on the card.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="h-40 rounded-2xl border border-line bg-surface" />}>
          <RoleFilters resultCount={roles.length} />
        </Suspense>
      </div>

      {roles.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Nothing matches that yet"
            description={
              hasActiveFilters(filters)
                ? "Try widening the filters — or tick “include closed roles” to see what has recently been cast."
                : "There are no open roles at the moment. New calls appear here as soon as they are posted."
            }
            action={
              <ButtonLink href="/roles" variant="secondary" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        </div>
      )}
    </div>
  );
}
