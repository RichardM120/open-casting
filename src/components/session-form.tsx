"use client";

import { useActionState } from "react";

import { createCastingSession, editCastingSession } from "@/lib/actions";
import { toLocalInput } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { PRODUCTION_TYPES, type CastingSession } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Select, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  name: "Production",
  productionCompany: "Production company",
  productionType: "Production type",
  synopsis: "Synopsis",
  opensAt: "Submissions open",
  closesAt: "Submissions close",
  productionEndsAt: "Production finishes",
};

/**
 * One form for opening a production and for editing one. The dates and times
 * here govern every role in the production, which is the whole point of
 * putting them here rather than on each role, so the form says so.
 */
export function SessionForm({ session }: { session?: CastingSession }) {
  const [state, formAction, pending] = useActionState(
    session ? editCastingSession : createCastingSession,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // What was just submitted wins, so a failed save does not discard the edit.
  // Stored instants are shown as UK time, which is how they were typed in.
  const values: Record<string, string> =
    state.status === "idle" && session
      ? {
          name: session.name,
          productionCompany: session.productionCompany,
          productionType: session.productionType,
          synopsis: session.synopsis,
          opensAt: toLocalInput(session.opensAt),
          closesAt: toLocalInput(session.closesAt),
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
          What applicants see above every role you post into it.
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
          <Field label="Production type" htmlFor="productionType" error={errors.productionType}>
            <Select
              id="productionType"
              name="productionType"
              defaultValue={values.productionType ?? PRODUCTION_TYPES[0]}
              required
            >
              {PRODUCTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Production company"
            htmlFor="productionCompany"
            hint="Who is making it. Yours to see, never shown to applicants. Optional."
            error={errors.productionCompany}
          >
            <Input
              id="productionCompany"
              name="productionCompany"
              placeholder="Wildseed Films"
              defaultValue={values.productionCompany ?? ""}
            />
          </Field>
          <Field
            label="Synopsis"
            htmlFor="synopsis"
            hint="A sentence or two about the production. It appears on every role."
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
          Every role in this production takes submissions from the opening time until the
          closing time, and at no other time. Times are UK time.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Submissions open"
            htmlFor="opensAt"
            hint="Roles can be seen before this, but the form does not appear until then."
            error={errors.opensAt}
          >
            <Input
              id="opensAt"
              name="opensAt"
              type="datetime-local"
              defaultValue={values.opensAt ?? ""}
              required
            />
          </Field>
          <Field
            label="Submissions close"
            htmlFor="closesAt"
            hint="You can close early once you have what you need."
            error={errors.closesAt}
          >
            <Input
              id="closesAt"
              name="closesAt"
              type="datetime-local"
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
          The date the shoot or run wraps, not the date casting closes. Everything applicants
          send you is deleted 30 days after it, which is what your agreement and their terms
          both promise. You will get an email 14 days and 48 hours beforehand.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Production finishes"
            htmlFor="productionEndsAt"
            hint="If the schedule moves, change this and the deletion date follows."
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
              ? "Saving"
              : "Opening"
            : session
              ? "Save changes"
              : "Open the production"}
        </Button>
        <ButtonLink
          href={session ? `/dashboard/sessions/${session.id}` : "/dashboard"}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
