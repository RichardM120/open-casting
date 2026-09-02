"use client";

import { useActionState } from "react";

import { createClientRecord, editClientRecord } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import type { Client } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Textarea } from "./ui";

const LABELS: Record<string, string> = { name: "Client", notes: "Notes" };

/** One form for adding a client and for editing one. */
export function ClientForm({ client }: { client?: Client }) {
  const [state, formAction, pending] = useActionState(
    client ? editClientRecord : createClientRecord,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  const values: Record<string, string> =
    state.status === "idle" && client
      ? { name: client.name, notes: client.notes }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
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
        <legend className="px-2 text-sm font-semibold tracking-tight">The client</legend>
        <p className="text-sm text-muted">
          Who you are casting for. This is yours alone: applicants never see it, on the share
          link or anywhere else.
        </p>
        <div className="mt-6 grid gap-4">
          <Field label="Client" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              placeholder="Wildseed Films"
              defaultValue={values.name ?? ""}
              required
            />
          </Field>
          <Field
            label="Notes"
            htmlFor="notes"
            hint="Optional. The contact there, how they like to work, a billing reference."
            error={errors.notes}
          >
            <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes ?? ""} />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : client ? "Save the client" : "Add the client"}
        </Button>
        <ButtonLink href="/dashboard/clients" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
