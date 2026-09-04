"use client";

import { useActionState } from "react";

import { signIn } from "@/lib/auth-actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";

function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    <>
      <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line-strong bg-surface px-6 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-brand"
      >
        <GoogleMark />
        {label}
      </a>
      <div className="flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export function SignInForm({
  next,
  google,
  notice,
}: {
  next: string;
  google: boolean;
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState(signIn, IDLE_FORM_STATE);
  const { errors, values } = state;

  // A second factor was required and a link has gone out. There is nothing
  // useful left on this page, so the form gets out of the way.
  if (state.status === "success") {
    return (
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-positive uppercase">
          Check your email
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text">{state.message}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This account can see and change other people&rsquo;s work, so a password on its own is
          not enough to sign in to it.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {notice ? (
        <p className="rounded-xl border border-line bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {notice}
        </p>
      ) : null}

      {google ? <GoogleButton next={next} label="Continue with Google" /> : null}

      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values.email ?? ""}
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </SubmitButton>

      {state.status === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Accounts are made by the administrator. If you do not have one, ask whoever runs your
        casting.
      </p>
    </form>
  );
}
