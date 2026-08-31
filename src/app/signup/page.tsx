import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth-form";
import { Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a casting account to post roles and collect submissions.",
};

function safeNext(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  return path && /^\/(?!\/)/.test(path) ? path : "/dashboard";
}

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <Eyebrow>For casting directors</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        You will see only the roles you post, and only the submissions made against them.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-7">
        <SignUpForm next={next} google={googleConfigured()} />
      </div>
    </div>
  );
}
