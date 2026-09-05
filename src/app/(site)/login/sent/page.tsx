import type { Metadata } from "next";

import { ButtonLink, Eyebrow } from "@/components/ui";
import { CHALLENGE_WINDOW_MINUTES } from "@/lib/mfa";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

export default async function LinkSentPage({ searchParams }: PageProps<"/login/sent">) {
  const params = await searchParams;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-20">
      <Eyebrow>One more step</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Check your email</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Your password was right. Because this account can see and change other people&rsquo;s
        work, we have sent a one-time link{to ? ` to ${to}` : ""}: it works once, expires in{" "}
        {CHALLENGE_WINDOW_MINUTES} minutes, and asking for another cancels it.
      </p>
      <div className="mt-8">
        <ButtonLink href="/login" variant="secondary" size="sm">
          Back to sign in
        </ButtonLink>
      </div>
    </div>
  );
}
