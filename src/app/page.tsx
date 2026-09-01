import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink, Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Casting",
  description: "The private tool a production uses to run its casting call.",
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
        created by the administrator — there is nothing to register for.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        <WayIn
          href="/login?as=admin"
          eyebrow="Administrator"
          title="Admin sign-in"
          description="Create and suspend accounts, see every production on the system, and moderate anything posted."
          cta="Sign in as admin"
        />
        <WayIn
          href="/login?as=team"
          eyebrow="Casting director or production team"
          title="Production sign-in"
          description="Open a casting session for your production, post its roles, and read the submissions that come in against them."
          cta="Sign in"
        />
      </div>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-7">
        <h2 className="text-lg font-semibold tracking-tight">Sent a casting link?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Performers do not sign in and do not need an account. Open the link the production sent
          you — it goes straight to their roles and the submission form. There is no listing here
          to search, by design: a casting call is circulated by the people casting it.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/faq/performers" className="text-accent underline-offset-4 hover:underline">
            What the fields on a casting call mean →
          </Link>
        </p>
      </div>
    </div>
  );
}

function WayIn({
  href,
  eyebrow,
  title,
  description,
  cta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-7">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-6">
        <ButtonLink href={href}>{cta}</ButtonLink>
      </div>
    </div>
  );
}
