"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createAccount } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { ROLE_DESCRIPTIONS, SIGNUP_ROLES, type Client } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ErrorSummary, Field, Input, Select } from "./ui";

const LABELS: Record<string, string> = {
  name: "Their name",
  clientId: "Client",
  email: "Email",
  role: "What they can see",
};

const ROLE_HEADINGS: Record<(typeof SIGNUP_ROLES)[number], string> = {
  director: "Casting director",
  producer: "Producer",
};

/**
 * The only way an account comes into being. The password is generated, not
 * chosen, and shown once, so it is worth something and there is no habit of
 * everyone sharing the same one.
 */
export function NewAccountForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createAccount, IDLE_FORM_STATE);
  const { errors, values } = state;
  const formRef = useErrorFocus(state.status, errors);

  const created = state.status === "success" ? state.data : undefined;

  return (
    <div className="flex flex-col gap-6">
      {created ? (
        <div role="status" className="rounded-xl border border-positive/40 bg-positive-soft p-4 sm:p-6">
          <p className="text-sm font-medium text-positive">{state.message}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Send them these. The password is shown once and is not stored anywhere readable. If
            it is lost, the account needs a new one.
          </p>
          <dl className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-ink p-4 font-mono text-sm">
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-faint">email</dt>
              <dd className="break-all">{created.email}</dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-faint">password</dt>
              <dd className="break-all text-brand select-all">{created.password}</dd>
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
            label="Client"
            htmlFor="clientId"
            hint="The company paying for this account. It sets what they are allowed to run."
            error={errors.clientId}
          >
            <Select
              id="clientId"
              name="clientId"
              defaultValue={values.clientId ?? clients[0]?.id ?? ""}
              required
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
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

        <p className="rounded-xl border border-line bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
          The plan, the ceilings and the access date come from the client, so every account
          under it gets the same. Change them on{" "}
          <Link href="/admin/clients" className="text-brand underline-offset-4 hover:underline">
            the client
          </Link>
          .
        </p>

        <div className="mt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create the account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
