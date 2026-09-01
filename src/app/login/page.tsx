import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth-form";
import { Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to run your casting.",
  robots: { index: false, follow: false },
};

/**
 * Both ways in from the home page land here, because there is one set of
 * credentials and one check — an account is an admin or it is not, and the
 * database says which. `as` only changes what the page says it is for, so
 * somebody arriving from the admin card is not left wondering whether they
 * are in the right place.
 */
const AUDIENCE = {
  admin: {
    eyebrow: "Administrator",
    blurb:
      "Accounts, every production on the system, and anything posted under them.",
  },
  team: {
    eyebrow: "Casting director or production team",
    blurb:
      "Your productions, the roles you have posted, and the submissions made against them.",
  },
} as const;

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
  const as = Array.isArray(params.as) ? params.as[0] : params.as;
  const audience = as === "admin" ? AUDIENCE.admin : AUDIENCE.team;

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <Eyebrow>{audience.eyebrow}</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{audience.blurb}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Performers never sign in. If you were sent a casting link, open that instead.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-7">
        <SignInForm next={next} google={googleConfigured()} notice={error} />
      </div>
    </div>
  );
}
