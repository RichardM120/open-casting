import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth-form";
import { Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to post roles and read your submissions.",
};

/** Only same-site paths, so `?next=` cannot bounce anyone off to another host. */
function safeNext(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  return path && /^\/(?!\/)/.test(path) ? path : "/dashboard";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);

  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <Eyebrow>For casting directors</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Performers do not need an account — browsing and submitting are open to everyone. This
        is for the people casting.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-7">
        <SignInForm next={next} google={googleConfigured()} notice={error} />
      </div>
    </div>
  );
}
