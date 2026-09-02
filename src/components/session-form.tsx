"use client";

import { useActionState, useState } from "react";

import { createCastingSession, editCastingSession } from "@/lib/actions";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { PRODUCTION_TYPES, type CastingSession } from "@/lib/types";

import { DateTimeField } from "./date-time-field";
import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Select, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  name: "Casting call",
  productionCompany: "Production company",
  productionType: "Production type",
  synopsis: "Synopsis",
  opensAt: "Submissions open",
  closesAt: "Submissions close",
  productionEndsAt: "Production finishes",
};

/**
 * One form for opening a casting call and for editing one. The dates and times
 * here govern every role in the casting call, which is the whole point of
 * putting them here rather than on each role, so the form says so.
 */
/** The picked moment, read back in words, or nothing until one is picked. */
function Picked({ value }: { value: string }) {
  if (!value) return null;
  const instant = fromLocalInput(value);
  if (Number.isNaN(Date.parse(instant))) return null;
  return (
    <p className="mt-1.5 text-xs text-muted" aria-live="polite">
      Set to <strong className="font-medium text-text">{formatDateTime(instant)}</strong>, UK time.
    </p>
  );
}

export function SessionForm({ session }: { session?: CastingSession }) {
  const [state, formAction, pending] = useActionState(
    session ? editCastingSession : createCastingSession,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // The picker asks before it commits, and the chosen moment is then echoed
  // under the field in words: what was picked, read back as a date and time.
  const [opens, setOpens] = useState<string | null>(null);
  const [closes, setCloses] = useState<string | null>(null);

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
        <legend className="px-2 text-sm font-semibold tracking-tight">The casting call</legend>
        <p className="text-sm text-muted">
          What applicants see above every role you post into it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Casting call" htmlFor="name" error={errors.name}>
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
            hint="A sentence or two about the casting call. It appears on every role."
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
          Every role in this casting call takes submissions from the opening time until the
          closing time, and at no other time. Times are UK time.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Submissions open"
            htmlFor="opensAt"
            hint="Roles can be seen before this, but the form does not appear until then."
            error={errors.opensAt}
          >
            <DateTimeField
              id="opensAt"
              name="opensAt"
              label="Submissions open"
              mode="datetime"
              defaultValue={values.opensAt ?? ""}
              defaultTime="09:00"
              onChange={setOpens}
              required
            />
            <Picked value={opens ?? values.opensAt ?? ""} />
          </Field>
          <Field
            label="Submissions close"
            htmlFor="closesAt"
            hint="You can close early once you have what you need."
            error={errors.closesAt}
          >
            <DateTimeField
              id="closesAt"
              name="closesAt"
              label="Submissions close"
              mode="datetime"
              defaultValue={values.closesAt ?? ""}
              defaultTime="23:59"
              align="end"
              onChange={setCloses}
              required
            />
            <Picked value={closes ?? values.closesAt ?? ""} />
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
            <DateTimeField
              id="productionEndsAt"
              name="productionEndsAt"
              label="Production finishes"
              mode="date"
              defaultValue={values.productionEndsAt ?? ""}
              required
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : session ? "Save changes" : "Save and continue"}
        </Button>
        <ButtonLink
          href={session ? `/dashboard/sessions/${session.id}` : "/dashboard"}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
        {session ? null : (
          <p className="basis-full text-xs leading-relaxed text-muted">
            Saved as a draft. Nothing is shown to applicants until you publish, and you can come
            back to it from Casting calls at any time.
          </p>
        )}
      </div>
    </form>
  );
}
