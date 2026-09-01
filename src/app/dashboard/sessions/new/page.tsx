import type { Metadata } from "next";
import Link from "next/link";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Open a casting session",
  description: "Set the production and the dates its roles accept submissions between.",
};

export default async function NewSessionPage() {
  const user = await requireUser("/dashboard/sessions/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/dashboard/sessions"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        ← All casting sessions
      </Link>

      <div className="mt-6">
        <Eyebrow>For casting directors</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Open a casting session
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          One session per production. It holds the dates, and every role you post into it accepts
          submissions only while the session is open. Post the roles once it exists.
        </p>
      </div>

      <div className="mt-10">
        <SessionForm defaultCompany={user.company} />
      </div>
    </div>
  );
}
