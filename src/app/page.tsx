import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink, Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Open Casting" },
  description: "The private tool a production uses to run its casting.",
  robots: { index: false, follow: false },
};

/**
 * The way in, and nothing else. Open Casting is not a public board: there is no
 * listing to browse and no way to register. Someone either has an account, made
 * for them by the administrator, or they were sent a link to one production.
 */
export default async function HomePage() {
  // Already signed in, so the sign-in page is not what they wanted.
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl px-5 py-20 md:py-28">
      <Eyebrow>Open Casting</Eyebrow>
      <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
        Sign in to run your casting.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
        Set up a production, post its roles, and read every submission in one place. Accounts are
        created by the administrator, so there is nothing to register for.
      </p>

      <div className="mt-10">
        <ButtonLink href="/login">Sign in</ButtonLink>
      </div>

      <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
        One sign-in for everyone on the casting side. What you can see follows from your
        account, not from which door you came through: an administrator lands on every
        production on the system, a casting director on their own.
      </p>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-7">
        <h2 className="text-lg font-semibold tracking-tight">Sent a casting link?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Applicants do not sign in and do not need an account. Open the link the production sent
          you and it goes straight to their roles and the submission form. There is no listing
          here to search, by design: a casting call is circulated by the people casting it.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/faq/applicants" className="text-accent underline-offset-4 hover:underline">
            What the fields on a casting call mean
          </Link>
        </p>
      </div>
    </div>
  );
}
