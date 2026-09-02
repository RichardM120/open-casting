import type { Metadata } from "next";
import Link from "next/link";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New casting call",
  description: "Set up a casting call and the times its roles take submissions between.",
};

export default async function NewSessionPage() {
  await requireUser("/dashboard/sessions/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <SetupProgress stage={1} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'A casting call holds the opening and closing times. Every role you post into it takes submissions only between them, so set the window here and not per role.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'The production company is yours to see and is never shown to applicants. Once the call exists, post its roles.' }} />
      </HelpNote>
      <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
        &larr; Casting calls
      </Link>

      <div className="mt-6">
        <Eyebrow>New casting call</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Open a casting call
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          One casting call, however many roles. It holds the opening and closing times, and every
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
