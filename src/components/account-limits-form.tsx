"use client";

import { useActionState } from "react";

import { updateAccountLimits } from "@/lib/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { Button, Field, Input } from "./ui";

/**
 * Changes what an account is allowed to run, after the fact. The same three
 * numbers as at creation, because the arrangement is the same thing whether it
 * is being struck or renegotiated.
 */
export function AccountLimitsForm({
  accountId,
  maxSessions,
  maxRolesPerSession,
  accessUntil,
}: {
  accountId: string;
  maxSessions: number | null;
  maxRolesPerSession: number | null;
  accessUntil: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateAccountLimits, IDLE_FORM_STATE);
  const { errors, values } = state;

  const current = state.status === "idle" ? {
    maxSessions: maxSessions === null ? "" : String(maxSessions),
    maxRolesPerSession: maxRolesPerSession === null ? "" : String(maxRolesPerSession),
    accessUntil: accessUntil ?? "",
  } : values;

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Productions" htmlFor={`ms-${accountId}`} error={errors.maxSessions}>
          <Input
            id={`ms-${accountId}`}
            name="maxSessions"
            inputMode="numeric"
            placeholder="No limit"
            defaultValue={current.maxSessions ?? ""}
          />
        </Field>
        <Field
          label="Roles each"
          htmlFor={`mr-${accountId}`}
          error={errors.maxRolesPerSession}
        >
          <Input
            id={`mr-${accountId}`}
            name="maxRolesPerSession"
            inputMode="numeric"
            placeholder="No limit"
            defaultValue={current.maxRolesPerSession ?? ""}
          />
        </Field>
        <Field label="Access until" htmlFor={`au-${accountId}`} error={errors.accessUntil}>
          <Input
            id={`au-${accountId}`}
            name="accessUntil"
            type="date"
            defaultValue={current.accessUntil ?? ""}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save limits"}
        </Button>
        {state.status === "success" ? (
          <p role="status" className="text-sm text-positive">
            {state.message}
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
