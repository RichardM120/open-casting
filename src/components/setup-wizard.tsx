"use client";

import Link from "next/link";
import { useActionState } from "react";

import { finishSetup, saveProfile } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { useErrorFocus } from "./use-error-focus";
import { Button, ErrorSummary, Field, Input, cx } from "./ui";

const LABELS = { name: "Your name", company: "Company or agency" };

export function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, index) => index + 1).map((n) => (
        <li
          key={n}
          aria-current={n === step ? "step" : undefined}
          className={cx(
            "h-1 flex-1 rounded-full transition-colors",
            n <= step ? "bg-accent" : "bg-line",
          )}
        />
      ))}
    </ol>
  );
}

/** Step one. Also where a Google sign-up gets a real company name for the first time. */
export function ProfileStep({ user, nextStep }: { user: SessionUser; nextStep: number }) {
  const [state, formAction, pending] = useActionState(saveProfile, IDLE_FORM_STATE);
  const { errors, values } = state;
  const formRef = useErrorFocus(state.status, errors);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="nextStep" value={nextStep} />
      {state.status === "error" ? <ErrorSummary errors={errors} labels={LABELS} /> : null}

      <Field label="Your name" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={values.name ?? user.name}
          required
        />
      </Field>
      <Field
        label="Company or agency"
        htmlFor="company"
        hint="Shown on every role you post. Producers at the same company see each other's roles, so spell it the same way your colleagues do."
        error={errors.company}
      >
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          defaultValue={values.company ?? user.company}
          required
        />
      </Field>

      <div className="mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}

export function FinishStep({ to, label }: { to: string; label: string }) {
  return (
    <form action={finishSetup} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="to" value={to} />
      <Button type="submit">{label}</Button>
      <Link href="/dashboard" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        Skip to the dashboard
      </Link>
    </form>
  );
}
