import type { FieldErrors } from "./validation";

/**
 * Shared shape for `useActionState` forms. It lives outside `actions.ts`
 * because a "use server" module may only export async functions.
 *
 * `values` echoes what was submitted. React resets an uncontrolled form once
 * its action resolves, so a form that failed validation has to re-seed its own
 * fields from here or the performer loses everything they typed.
 */
export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  errors: FieldErrors;
  values: Record<string, string>;
};

export const IDLE_FORM_STATE: FormState = {
  status: "idle",
  message: "",
  errors: {},
  values: {},
};

/** Reads the submitted text fields back out, so a failed form can refill itself. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
