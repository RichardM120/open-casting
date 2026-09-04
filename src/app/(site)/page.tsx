import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { HowItWorks } from "@/components/how-it-works";
import { CARD, SectionHead, cx } from "@/components/ui";
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

      <section className={cx(CARD, "mt-16")} aria-labelledby="link-heading">
        <SectionHead
          id="link-heading"
          title="Sent a casting link?"
          line="Applicants never sign in. Open the link you were sent: it goes straight to the roles and the form, and a call is only ever circulated by the team casting it."
        />
        <p className="mt-4 text-sm">
          <Link href="/faq/applicants" className="text-brand underline-offset-4 hover:underline">
            What the fields on a casting call mean
          </Link>
        </p>
      </section>
    </div>
  );
}
