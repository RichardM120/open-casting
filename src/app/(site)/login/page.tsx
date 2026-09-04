import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth-form";
import { Eyebrow, SPOTLIGHT, cx } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to run your casting.",
  robots: { index: false, follow: false },
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
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
      {/* Form first on a phone: whoever is signing in came to sign in. */}
      <div className="order-1 lg:order-2">
        <Eyebrow>Open Casting</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The same sign-in for administrators, casting directors and production teams. What you
          can see follows from your account.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Applicants never sign in. If you were sent a casting link, open that instead.
        </p>

        <div className={cx(SPOTLIGHT, "mt-8 p-7")}>
          <SignInForm next={next} google={googleConfigured()} notice={error} />
        </div>
      </div>

      <aside className="order-2 lg:order-1">
        <Eyebrow>What this is</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
          One casting call, run from one place.
        </h2>
        <p className="mt-4 max-w-prose leading-relaxed text-muted">
          Open Casting is the tool a casting team runs an open call with. It is not a job board:
          nothing to browse, nothing to join. Post the roles, send one link, and read everything
          that comes back in one list.
        </p>

        <dl className="mt-8 flex flex-col gap-6">
          <Point term="A casting call at a time">
            Open a call, post its roles, set the times once. Every role opens and closes together,
            and an applicant submits once, not once per part.
          </Point>
          <Point term="One link to circulate">
            Publishing gives you one unguessable link. Put it in a post, a mailout, wherever the
            call should reach. It opens your casting call and nothing else.
          </Point>
          <Point term="Nothing to join">
            Applicants never register or sign in. Under-18s go through a parent or guardian, who
            confirms it on the form.
          </Point>
          <Point term="Deleted when it is done">
            Submissions are destroyed thirty days after the production finishes: names, numbers,
            notes. You keep the record of what you ran, not the people&rsquo;s details.
          </Point>
        </dl>

        <p className="mt-8 text-sm leading-relaxed text-faint">
          Accounts are made by the administrator, so there is nothing to register for. If you
          need one, ask whoever runs your casting.
        </p>
      </aside>
    </div>
  );
}

/** One thing the tool does, said in a sentence rather than a slogan. */
function Point({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-line pl-4">
      <dt className="text-sm font-semibold tracking-tight text-text">{term}</dt>
      <dd className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">{children}</dd>
    </div>
  );
}
