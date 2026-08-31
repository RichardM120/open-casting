import type { Metadata } from "next";

import { RoleForm } from "@/components/role-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Post a role",
  description: "Put a casting call up with the brief, the rate and the dates spelled out.",
};

export default async function NewRolePage() {
  const user = await requireUser("/roles/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Eyebrow>For casting directors</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Post a role</h1>
      <p className="mt-3 max-w-2xl text-muted">
        The more of this you fill in properly, the fewer wrong submissions you read. It goes live
        as soon as you post it, under {user.company}.
      </p>

      <div className="mt-10">
        <RoleForm />
      </div>
    </div>
  );
}
