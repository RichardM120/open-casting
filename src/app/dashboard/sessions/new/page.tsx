import type { Metadata } from "next";
import Link from "next/link";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New production",
  description: "Set up a production and the times its roles take submissions between.",
};

export default async function NewSessionPage() {
  await requireUser("/dashboard/sessions/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Productions
      </Link>

      <div className="mt-6">
        <Eyebrow>New production</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Open a production
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          One production, however many roles. It holds the opening and closing times, and every
          role you post into it takes submissions only between them. Post the roles once it
          exists.
        </p>
      </div>

      <div className="mt-10">
        <SessionForm />
      </div>
    </div>
  );
}
