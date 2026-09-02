"use client";

import { useActionState } from "react";

import { editRole, postRole } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import type { CastingSession, Role } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, Checkbox, ErrorSummary, Field, Input, Select, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  sessionId: "Casting call",
  title: "Role name",
  characterBrief: "Character brief",
  requirements: "Requirements",
  ageMin: "Playing age from",
  ageMax: "Playing age to",
  location: "Location",
  shootStartsAt: "First shoot day",
  shootEndsAt: "Last shoot day",
  disclaimer: "Terms for applicants",
};

/**
 * One form for posting and editing. In edit mode the fields fall back to the
 * role's current values, and the action rewrites in place rather than creating.
 * Nothing about the casting call is asked for here: a role takes its casting call's
 * name, type, synopsis, company and dates from the casting call it is posted into.
 */
export function RoleForm({
  role,
  sessions,
  defaultSessionId,
}: {
  role?: Role;
  /** The casting calls this account may post into. Empty is handled by the page. */
  sessions: CastingSession[];
  defaultSessionId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    role ? editRole : postRole,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // What was just submitted wins, so a failed save does not discard the edit;
  // otherwise the role as it stands.
  const values: Record<string, string> =
    state.status === "idle" && role
      ? {
          title: role.title,
          characterBrief: role.characterBrief,
          requirements: role.requirements.join("\n"),
          ageMin: String(role.ageMin),
          ageMax: String(role.ageMax),
          location: role.location,
          shootStartsAt: role.shootStartsAt,
          shootEndsAt: role.shootEndsAt ?? "",
          sessionId: role.sessionId,
          disclaimer: role.disclaimer,
          selfTape: role.selfTape ? "on" : "",
        }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
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

      <Fieldset
        legend="Casting call"
        description={
          role
            ? "A role stays with the casting call it was posted into, because submissions are recorded against it."
            : "The role takes its casting call details and its opening and closing times from here."
        }
      >
        {role ? (
          <div className="sm:col-span-2">
            <input type="hidden" name="sessionId" value={role.sessionId} />
            <p className="text-sm text-muted">
              Part of{" "}
              <a
                href={`/dashboard/sessions/${role.sessionId}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {sessions.find((session) => session.id === role.sessionId)?.name ??
                  role.production}
              </a>
              . Change its times on the casting call, not here.
            </p>
          </div>
        ) : (
          <Field
            label="Casting call"
            htmlFor="sessionId"
            hint="Every role in a casting call opens and closes with it."
            error={errors.sessionId}
            className="sm:col-span-2"
          >
            <Select
              id="sessionId"
              name="sessionId"
              defaultValue={values.sessionId ?? defaultSessionId ?? ""}
              required
            >
              <option value="" disabled>
                Choose a casting call
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}: {formatDateTime(session.opensAt)} to{" "}
                  {formatDateTime(session.closesAt)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Fieldset>

      <Fieldset legend="The role" description="Who you are looking for, and what the part asks of them.">
        <Field
          label="Role name"
          htmlFor="title"
          hint="As it appears in the script, with the size of the part."
          error={errors.title}
          className="sm:col-span-2"
        >
          <Input
            id="title"
            name="title"
            placeholder="Nell (Lead)"
            defaultValue={values.title ?? ""}
            required
          />
        </Field>
        <Field
          label="Character brief"
          htmlFor="characterBrief"
          error={errors.characterBrief}
          className="sm:col-span-2"
        >
          <Textarea
            id="characterBrief"
            name="characterBrief"
            rows={5}
            defaultValue={values.characterBrief ?? ""}
            required
          />
        </Field>
        <Field
          label="Requirements"
          htmlFor="requirements"
          hint="One per line. Skills, availability, anything that is not negotiable."
          error={errors.requirements}
          className="sm:col-span-2"
        >
          <Textarea
            id="requirements"
            name="requirements"
            rows={4}
            defaultValue={values.requirements ?? ""}
            placeholder={"Confident in open water\nAvailable for three weeks on location"}
          />
        </Field>
        <Field label="Playing age from" htmlFor="ageMin" error={errors.ageMin}>
          <Input
            id="ageMin"
            name="ageMin"
            type="number"
            min={5}
            max={100}
            defaultValue={values.ageMin ?? 18}
            required
          />
        </Field>
        <Field label="Playing age to" htmlFor="ageMax" error={errors.ageMax}>
          <Input
            id="ageMax"
            name="ageMax"
            type="number"
            min={5}
            max={100}
            defaultValue={values.ageMax ?? 35}
            required
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Practicalities" description="What applicants need to know before they tape.">
        <Field label="Location" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            placeholder="Essex, UK"
            defaultValue={values.location ?? ""}
            required
          />
        </Field>
        <Field
          label="First shoot day"
          htmlFor="shootStartsAt"
          error={errors.shootStartsAt}
        >
          <Input
            id="shootStartsAt"
            name="shootStartsAt"
            type="date"
            defaultValue={values.shootStartsAt ?? ""}
            required
          />
        </Field>
        <Field
          label="Last shoot day"
          htmlFor="shootEndsAt"
          hint="Leave blank if it shoots on one day."
          error={errors.shootEndsAt}
        >
          <Input
            id="shootEndsAt"
            name="shootEndsAt"
            type="date"
            defaultValue={values.shootEndsAt ?? ""}
          />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            name="selfTape"
            label="Self-tapes accepted"
            defaultChecked={role ? role.selfTape : state.status === "idle" || values.selfTape === "on"}
          />
        </div>
      </Fieldset>

      <Fieldset
        legend="Terms for applicants"
        description={
          role
            ? "Shown on the listing, and applicants tick to accept them. Changing them does not alter what anyone has already accepted, as that was recorded with their submission."
            : "Optional. Shown on the listing, and applicants tick to accept them before they can submit."
        }
      >
        <Field
          label="Terms"
          htmlFor="disclaimer"
          hint="Usage and buyout, what submitting does and does not commit either side to, how long you keep their details. Leave blank for none."
          error={errors.disclaimer}
          className="sm:col-span-2"
        >
          <Textarea
            id="disclaimer"
            name="disclaimer"
            rows={5}
            defaultValue={values.disclaimer ?? ""}
            placeholder="Usage is UK, all media, 12 months. The day rate does not include the buyout."
          />
        </Field>
      </Fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? (role ? "Saving" : "Posting") : role ? "Save changes" : "Post the role"}
        </Button>
        <ButtonLink
          href={role ? `/dashboard/roles/${role.id}` : `/dashboard/sessions/${defaultSessionId ?? ""}`}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-6 md:p-7">
      <legend className="px-2 text-sm font-semibold tracking-tight">{legend}</legend>
      <p className="text-sm text-muted">{description}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
