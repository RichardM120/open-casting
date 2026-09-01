"use client";

import { useActionState } from "react";

import { unlockSite } from "@/lib/gate-actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

import { Button, Field, Input } from "./ui";

export function GateForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(unlockSite, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label="Passcode" htmlFor="passcode" error={state.errors.passcode}>
        <Input id="passcode" name="passcode" type="password" autoFocus required />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Checking…" : "Enter"}
      </Button>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
