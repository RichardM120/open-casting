"use client";

import { useActionState } from "react";

import { createCastingSession, editCastingSession } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import type { CastingSession } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  name: "Production",
  synopsis: "Synopsis",
  company: "Company",
  opensAt: "Submissions open",
  closesAt: "Submissions close",
  productionEndsAt: "Production finishes",
};

/**
 * One form for opening a casting session and for editing one. The dates here
 * govern every role in the session — that is the whole point of the session, so
 * the form says it rather than leaving it to be discovered.
 */
export function SessionForm({
  session,
  defaultCompany,
}: {
  session?: CastingSession;
  defaultCompany?: string;
}) {
  const [state, formAction, pending] = useActionState(
    session ? editCastingSession : createCastingSession,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // What was just submitted wins, so a failed save does not discard the edit.
  const values: Record<string, string> =
    state.status === "idle" && session
      ? {
          name: session.name,
          synopsis: session.synopsis,
          company: session.company,
          opensAt: session.opensAt,
          closesAt: session.closesAt,
          productionEndsAt: session.productionEndsAt,
        }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      {state.status === "error" ? (
        <>
          {state.message ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
            >
              {state.message}
            </p>
          ) : null}
          <ErrorSummary errors={errors} labels={LABELS} />
        </>
      ) : null}

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">The production</legend>
        <p className="text-sm text-muted">
          The name performers will see above every role in this session.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Production" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              placeholder="Saltmarsh"
              defaultValue={values.name ?? ""}
              required
            />
          </Field>
          <Field label="Company" htmlFor="company" error={errors.company}>
            <Input
              id="company"
              name="company"
              defaultValue={values.company ?? defaultCompany ?? ""}
              required
            />
          </Field>
          <Field
            label="Synopsis"
            htmlFor="synopsis"
            hint="A sentence or two about the production. Shown on every role in the session."
            error={errors.synopsis}
            className="sm:col-span-2"
          >
            <Textarea
              id="synopsis"
              name="synopsis"
              rows={3}
              defaultValue={values.synopsis ?? ""}
              required
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">The casting window</legend>
        <p className="text-sm text-muted">
          Every role in this session accepts submissions between these two dates and at no other
          time. Both days are included, and the times are UTC.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Submissions open"
            htmlFor="opensAt"
            hint="Roles are listed before this, but the form is not shown."
            error={errors.opensAt}
          >
            <Input
              id="opensAt"
              name="opensAt"
              type="date"
              defaultValue={values.opensAt ?? ""}
              required
            />
          </Field>
          <Field
            label="Submissions close"
            htmlFor="closesAt"
            hint="You can close the session by hand before this if you have what you need."
            error={errors.closesAt}
          >
            <Input
              id="closesAt"
              name="closesAt"
              type="date"
              defaultValue={values.closesAt ?? ""}
              required
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
        <legend className="px-2 text-sm font-semibold tracking-tight">
          When the production finishes
        </legend>
        <p className="max-w-prose text-sm text-muted">
          The date the shoot or run wraps — not when casting closes. Everything performers send
          you is destroyed 30 days after it, which is what your agreement and their terms both
          promise them. You will be emailed 14 days and 48 hours beforehand.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Production finishes"
            htmlFor="productionEndsAt"
            hint="Change it if the schedule moves; the deletion date follows."
            error={errors.productionEndsAt}
          >
            <Input
              id="productionEndsAt"
              name="productionEndsAt"
              type="date"
              defaultValue={values.productionEndsAt ?? ""}
              required
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={pending}>
          {pending
            ? session
              ? "Saving…"
              : "Opening…"
            : session
              ? "Save changes"
              : "Open the session"}
        </Button>
        <ButtonLink
          href={session ? `/dashboard/sessions/${session.id}` : "/dashboard/sessions"}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
