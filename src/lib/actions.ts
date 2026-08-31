"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isOpen } from "./format";
import { submittedValues, type FormState } from "./form-state";
import { createRole, getRole } from "./roles";
import { reset } from "./store";
import { createSubmission, hasSubmitted, setSubmissionStatus } from "./submissions";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "./types";
import { fieldErrors, roleSchema, submissionSchema, type FieldErrors } from "./validation";

function invalid(
  errors: FieldErrors,
  message: string,
  formData: FormData,
): FormState {
  return { status: "error", message, errors, values: submittedValues(formData) };
}

/**
 * Roles and submissions surface on almost every page — counts on the home page,
 * cards on the listing, tables on the dashboard — so any write invalidates the
 * lot rather than trying to enumerate which pages moved.
 */
function revalidateEverything(): void {
  revalidatePath("/", "layout");
}

export async function submitApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const roleId = String(formData.get("roleId") ?? "");
  const role = await getRole(roleId);

  if (!role) {
    return invalid({}, "That role is no longer listed.", formData);
  }
  if (!isOpen(role.deadline)) {
    return invalid({}, "Submissions for this role have closed.", formData);
  }

  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  if (await hasSubmitted(roleId, parsed.data.email)) {
    return invalid(
      { email: "You have already submitted for this role" },
      "We already have a submission from that email address.",
      formData,
    );
  }

  await createSubmission({ ...parsed.data, roleId });
  revalidateEverything();

  return {
    status: "success",
    message: `Thanks ${parsed.data.name.split(" ")[0]} — your submission is with ${role.castingDirector}.`,
    errors: {},
    values: {},
  };
}

export async function postRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const role = await createRole(parsed.data);
  revalidateEverything();
  redirect(`/dashboard/roles/${role.id}?posted=1`);
}

function isSubmissionStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

export async function updateSubmissionStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isSubmissionStatus(status)) return;

  await setSubmissionStatus(id, status);
  revalidateEverything();
}

/** Puts the demo data back, so the prototype can be handed round and reused. */
export async function resetDemoData(): Promise<void> {
  await reset();
  revalidateEverything();
  redirect("/dashboard");
}
