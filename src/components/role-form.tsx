"use client";

import { useActionState } from "react";

import { editRole, postRole } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import {
  PAY_TYPES,
  PRODUCTION_TYPES,
  UNION_STATUSES,
  type CastingSession,
  type Role,
} from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, Checkbox, ErrorSummary, Field, Input, Select, Textarea } from "./ui";

const LABELS: Record<string, string> = {
  production: "Production title",
  productionType: "Production type",
  synopsis: "Synopsis",
  castingDirector: "Casting director",
  company: "Company",
  title: "Role name",
  characterBrief: "Character brief",
  requirements: "Requirements",
  ageMin: "Playing age from",
  ageMax: "Playing age to",
  location: "Location",
  shootDates: "Shoot dates",
  payType: "How it pays",
  rate: "Rate",
  unionStatus: "Union status",
  sessionId: "Casting session",
  disclaimer: "Terms for performers",
};

/**
 * One form for posting and editing. In edit mode the fields fall back to the
 * role's current values, and the action rewrites in place rather than creating.
 */
export function RoleForm({
  role,
  sessions,
  defaultSessionId,
}: {
  role?: Role;
  /** The sessions this account may post into. Empty is handled by the page. */
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
          production: role.production,
          productionType: role.productionType,
          synopsis: role.synopsis,
          castingDirector: role.castingDirector,
          company: role.company,
          title: role.title,
          characterBrief: role.characterBrief,
          requirements: role.requirements.join("\n"),
          ageMin: String(role.ageMin),
          ageMax: String(role.ageMax),
          location: role.location,
          shootDates: role.shootDates,
          payType: role.payType,
          rate: role.rate,
          unionStatus: role.unionStatus,
          sessionId: role.sessionId,
          disclaimer: role.disclaimer,
          selfTape: role.selfTape ? "on" : "",
        }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
      {state.status === "error" ? <ErrorSummary errors={errors} labels={LABELS} /> : null}

      <Fieldset
        legend="Casting session"
        description={
          role
            ? "The session that dates this role. Roles do not move between sessions — submissions are recorded against the session they were made into."
            : "The production this role is cast for. The session decides when the role accepts submissions, so there is no closing date to set here."
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
              . Change the dates on the session, not here.
            </p>
          </div>
        ) : (
          <Field
            label="Casting session"
            htmlFor="sessionId"
            hint="Every role in a session opens and closes with it."
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
                Choose a casting session
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} — {formatDate(session.opensAt)} to{" "}
                  {formatDate(session.closesAt)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Fieldset>

      <Fieldset
        legend="The production"
        description="What is being made, and who is casting it."
      >
        <Field label="Production title" htmlFor="production" error={errors.production}>
          <Input
            id="production"
            name="production"
            placeholder="Saltmarsh"
            defaultValue={values.production ?? ""}
            required
          />
        </Field>
        <Field label="Production type" htmlFor="productionType" error={errors.productionType}>
          <Select
            id="productionType"
            name="productionType"
            defaultValue={values.productionType ?? "Feature Film"}
          >
            {PRODUCTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Synopsis"
          htmlFor="synopsis"
          hint="A sentence or two. Performers use this to decide whether it is for them."
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
        <Field label="Casting director" htmlFor="castingDirector" error={errors.castingDirector}>
          <Input
            id="castingDirector"
            name="castingDirector"
            defaultValue={values.castingDirector ?? ""}
            required
          />
        </Field>
        <Field label="Company" htmlFor="company" error={errors.company}>
          <Input id="company" name="company" defaultValue={values.company ?? ""} required />
        </Field>
      </Fieldset>

      <Fieldset legend="The role" description="Who you are looking for, and what it asks of them.">
        <Field
          label="Role name"
          htmlFor="title"
          hint="As it appears in the script, plus the size of the part."
          error={errors.title}
          className="sm:col-span-2"
        >
          <Input
            id="title"
            name="title"
            placeholder="NELL — Lead"
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
          hint="One per line. Skills, availability, anything non-negotiable."
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

      <Fieldset legend="Practicalities" description="The detail performers need before they tape.">
        <Field label="Location" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            placeholder="Essex, UK"
            defaultValue={values.location ?? ""}
            required
          />
        </Field>
        <Field label="Shoot dates" htmlFor="shootDates" error={errors.shootDates}>
          <Input
            id="shootDates"
            name="shootDates"
            placeholder="12 Oct – 6 Nov 2026"
            defaultValue={values.shootDates ?? ""}
            required
          />
        </Field>
        <Field label="How it pays" htmlFor="payType" error={errors.payType}>
          <Select id="payType" name="payType" defaultValue={values.payType ?? "Paid"}>
            {PAY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Rate"
          htmlFor="rate"
          hint="Be specific. Vague money puts good people off."
          error={errors.rate}
        >
          <Input
            id="rate"
            name="rate"
            placeholder="£950/week + travel"
            defaultValue={values.rate ?? ""}
            required
          />
        </Field>
        <Field label="Union status" htmlFor="unionStatus" error={errors.unionStatus}>
          <Select id="unionStatus" name="unionStatus" defaultValue={values.unionStatus ?? "Either"}>
            {UNION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
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
        legend="Terms for performers"
        description={
          role
            ? "Shown on the listing, and performers must tick to accept. Changing them does not alter what anyone has already accepted — that was recorded with their submission."
            : "Optional. Shown on the listing, and performers must tick to accept them before they can submit."
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
            placeholder="Usage is UK, all media, 12 months. The day rate does not include the buyout…"
          />
        </Field>
      </Fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? (role ? "Saving…" : "Posting…") : role ? "Save changes" : "Post the role"}
        </Button>
        <ButtonLink
          href={role ? `/dashboard/roles/${role.id}` : "/dashboard"}
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
