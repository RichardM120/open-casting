"use client";

import { useActionState } from "react";

import { postRole } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { PAY_TYPES, PRODUCTION_TYPES, UNION_STATUSES } from "@/lib/types";

import { Button, ButtonLink, Checkbox, Field, Input, Select, Textarea } from "./ui";

export function RoleForm() {
  const [state, formAction, pending] = useActionState(postRole, IDLE_FORM_STATE);
  const { errors, values } = state;

  return (
    <form action={formAction} className="flex flex-col gap-8">
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
        <Field label="Submissions close" htmlFor="deadline" error={errors.deadline}>
          <Input
            id="deadline"
            name="deadline"
            type="date"
            defaultValue={values.deadline ?? ""}
            required
          />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            name="selfTape"
            label="Self-tapes accepted"
            defaultChecked={state.status === "idle" || values.selfTape === "on"}
          />
        </div>
      </Fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post the role"}
        </Button>
        <ButtonLink href="/dashboard" variant="ghost" size="sm">
          Cancel
        </ButtonLink>
        {state.status === "error" ? (
          <p className="text-sm text-danger" role="alert">
            {state.message}
          </p>
        ) : null}
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
