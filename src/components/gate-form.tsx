"use client";

import { useActionState } from "react";

import { unlockSite } from "@/lib/gate-actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";

export function GateForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(unlockSite, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Passcode" htmlFor="passcode" error={state.errors.passcode}>
        <Input id="passcode" name="passcode" type="password" autoFocus required />
      </Field>

      <SubmitButton disabled={pending} className="w-full">
        {pending ? "Checking…" : "Enter"}
      </SubmitButton>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
