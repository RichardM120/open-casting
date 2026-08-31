"use client";

import { useActionState } from "react";

import { submitApplication } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { Button, ButtonLink, Field, Input, Select, Textarea } from "./ui";

export function SubmissionForm({ roleId, roleTitle }: { roleId: string; roleTitle: string }) {
  const [state, formAction, pending] = useActionState(submitApplication, IDLE_FORM_STATE);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-7">
        <p className="text-xs font-semibold tracking-[0.18em] text-positive uppercase">
          Submission sent
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{state.message}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You will hear back through the email address you gave. Nothing else is needed for{" "}
          {roleTitle} — submitting twice does not help.
        </p>
        <div className="mt-6">
          <ButtonLink href="/roles" variant="secondary" size="sm">
            Browse more roles
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { errors, values } = state;

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-surface p-7">
      <h2 className="text-xl font-semibold tracking-tight">Submit for this role</h2>
      <p className="mt-2 text-sm text-muted">
        Free to submit, and no agent needed. Everything here goes straight to the casting
        director.
      </p>

      <input type="hidden" name="roleId" value={roleId} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={values.name ?? ""} required />
        </Field>
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
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={values.phone ?? ""}
            required
          />
        </Field>
        <Field label="Based in" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            placeholder="City, country"
            defaultValue={values.location ?? ""}
            required
          />
        </Field>
        <Field label="Age" htmlFor="age" error={errors.age}>
          <Input
            id="age"
            name="age"
            type="number"
            min={5}
            max={100}
            defaultValue={values.age ?? ""}
            required
          />
        </Field>
        <Field label="Union status" htmlFor="unionStatus" error={errors.unionStatus}>
          <Select id="unionStatus" name="unionStatus" defaultValue={values.unionStatus ?? "Non-Union"}>
            <option value="Union">Union</option>
            <option value="Non-Union">Non-Union</option>
          </Select>
        </Field>
        <Field
          label="Showreel link"
          htmlFor="reelUrl"
          hint="Optional. Vimeo, YouTube or anywhere else."
          error={errors.reelUrl}
          className="sm:col-span-2"
        >
          <Input
            id="reelUrl"
            name="reelUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.reelUrl ?? ""}
          />
        </Field>
        <Field
          label="Profile link"
          htmlFor="profileUrl"
          hint="Optional. Spotlight, Backstage, your own site."
          error={errors.profileUrl}
          className="sm:col-span-2"
        >
          <Input
            id="profileUrl"
            name="profileUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.profileUrl ?? ""}
          />
        </Field>
        <Field
          label="Cover note"
          htmlFor="coverNote"
          hint="A short paragraph. Why you, for this part."
          error={errors.coverNote}
          className="sm:col-span-2"
        >
          <Textarea
            id="coverNote"
            name="coverNote"
            rows={5}
            defaultValue={values.coverNote ?? ""}
            required
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send submission"}
        </Button>
        {state.status === "error" ? (
          <p className="text-sm text-danger" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Shown in place of the form once a role has closed. */
export function SubmissionsClosed() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-7">
      <h2 className="text-lg font-semibold tracking-tight">Submissions have closed</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        This call is kept up so you can see what was asked for. Have a look at what is open now.
      </p>
      <div className="mt-5">
        <ButtonLink href="/roles" variant="secondary" size="sm">
          Browse open roles
        </ButtonLink>
      </div>
    </div>
  );
}
