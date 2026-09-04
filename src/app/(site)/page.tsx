import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { HowItWorks } from "@/components/how-it-works";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Open Casting" },
  description: "The private tool a casting team runs an open call with.",
  robots: { index: false, follow: false },
};

/**
 * The way in, and nothing else. Open Casting is not a public board: there is no
 * listing to browse and no way to register. Someone either has an account, made
 * for them by the administrator, or they were sent a link to one casting call.
 * The page leads with the five steps and ends on the way in, as the design
 * canvas has it; there is no hero above them.
 */
export default async function HomePage() {
  // Already signed in, so the sign-in page is not what they wanted.
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <HowItWorks />

      <div className="mt-16 rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Sent a casting link?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Applicants never sign in. Open the link you were sent: it goes straight to the roles and
          the form. There is nothing here to search, by design. A call is only circulated by the
          team casting it.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/faq/applicants" className="text-brand underline-offset-4 hover:underline">
            What the fields on a casting call mean
          </Link>
        </p>
      </div>
    </div>
  );
}
