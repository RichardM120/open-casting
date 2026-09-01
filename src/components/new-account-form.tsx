"use client";

import { useActionState } from "react";

import { createAccount } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { ROLE_DESCRIPTIONS, SIGNUP_ROLES } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ErrorSummary, Field, Input, Select } from "./ui";

const LABELS: Record<string, string> = {
  name: "Their name",
  company: "Company or agency",
  email: "Email",
  role: "What they can see",
  maxSessions: "Productions",
  maxRolesPerSession: "Roles per production",
  accessUntil: "Access until",
};

const ROLE_HEADINGS: Record<(typeof SIGNUP_ROLES)[number], string> = {
  director: "Casting director",
  producer: "Producer",
};

/**
 * The only way an account comes into being. The password is generated, not
 * chosen, and shown once — so it is worth something, and so there is no habit
 * of everyone sharing the same one.
 */
export function NewAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, IDLE_FORM_STATE);
  const { errors, values } = state;
  const formRef = useErrorFocus(state.status, errors);

  const created = state.status === "success" ? state.data : undefined;

  return (
    <div className="flex flex-col gap-5">
      {created ? (
        <div role="status" className="rounded-xl border border-positive/40 bg-positive-soft p-5">
          <p className="text-sm font-medium text-positive">{state.message}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Send them these. The password is shown once and is not stored anywhere readable — if
            it is lost, the account needs a new one.
          </p>
          <dl className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-ink p-4 font-mono text-sm">
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-faint">email</dt>
              <dd className="break-all">{created.email}</dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-faint">password</dt>
              <dd className="break-all text-accent select-all">{created.password}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-faint">
            They will be asked to set their name and company on the way in, and can change them
            later.
          </p>
        </div>
      ) : null}

      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Their name" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" defaultValue={values.name ?? ""} required />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email ?? ""}
              required
            />
          </Field>
          <Field
            label="Company or agency"
            htmlFor="company"
            hint="Producers see every role under a matching company name, so spell it consistently."
            error={errors.company}
          >
            <Input id="company" name="company" defaultValue={values.company ?? ""} required />
          </Field>
          <Field
            label="What they can see"
            htmlFor="role"
            hint={ROLE_DESCRIPTIONS[(values.role as "director" | "producer") ?? "director"]}
            error={errors.role}
          >
            <Select id="role" name="role" defaultValue={values.role ?? "director"}>
              {SIGNUP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_HEADINGS[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="rounded-xl border border-line bg-raised p-5">
          <legend className="px-2 text-sm font-medium">What the arrangement covers</legend>
          <p className="text-xs leading-relaxed text-muted">
            Leave any of these blank for no limit. They are enforced when the account tries to
            post, not merely displayed, and you can change them later.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Productions" htmlFor="maxSessions" error={errors.maxSessions}>
              <Input
                id="maxSessions"
                name="maxSessions"
                inputMode="numeric"
                placeholder="No limit"
                defaultValue={values.maxSessions ?? ""}
              />
            </Field>
            <Field
              label="Roles per production"
              htmlFor="maxRolesPerSession"
              error={errors.maxRolesPerSession}
            >
              <Input
                id="maxRolesPerSession"
                name="maxRolesPerSession"
                inputMode="numeric"
                placeholder="No limit"
                defaultValue={values.maxRolesPerSession ?? ""}
              />
            </Field>
            <Field
              label="Access until"
              htmlFor="accessUntil"
              hint="They cannot sign in after this."
              error={errors.accessUntil}
            >
              <Input
                id="accessUntil"
                name="accessUntil"
                type="date"
                defaultValue={values.accessUntil ?? ""}
              />
            </Field>
          </div>
        </fieldset>

        <div className="mt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create the account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
