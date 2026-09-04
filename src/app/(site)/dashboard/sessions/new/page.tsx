import type { Metadata } from "next";
import { HelpNote } from "@/components/help-note";
import { SetupProgress } from "@/components/setup-progress";

import { SessionForm } from "@/components/session-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { uploadsEnabled } from "@/lib/blob";
import { Breadcrumb } from "@/components/breadcrumb";

export const metadata: Metadata = {
  title: "New casting call",
  description: "Set up a casting call and the times its roles take submissions between.",
};

export default async function NewSessionPage() {
  const user = await requireUser("/dashboard/sessions/new");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/dashboard", label: "Casting calls" }, { label: "New casting call" }]} />
      <SetupProgress stage={1} />
      <HelpNote title="What this screen is for" faq="/faq/casting-directors">
        <p dangerouslySetInnerHTML={{ __html: 'A casting call holds the opening and closing times. Every role you post into it takes submissions only between them, so set the window here and not per role.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'The production company is yours to see and is never shown to applicants. Once the call exists, post its roles.' }} />
        <p dangerouslySetInnerHTML={{ __html: 'It is saved as a draft the moment you continue. Leave and come back to it from <strong>Casting calls</strong> whenever you like; nothing is shown to applicants until you publish.' }} />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>New casting call</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Set up a casting call
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          One casting call, however many roles: it holds the opening and closing times, and it
          saves as a draft as you go.
        </p>
      </div>

      <div className="mt-10">
        <SessionForm uploads={uploadsEnabled()} userId={user.id} />
      </div>
    </div>
  );
}
