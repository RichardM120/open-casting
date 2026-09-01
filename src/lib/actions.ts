"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { record, describeChanges } from "./activity";
import { requireUser } from "./auth";
import { isOpen } from "./format";
import { clientAddress, overLimit } from "./rate-limit";
import { submittedValues, type FormState } from "./form-state";
import {
  createRole,
  deleteRoleAsAdmin,
  getRole,
  getVisibleRole,
  setRoleClosed,
  updateRole,
} from "./roles";
import {
  DuplicateSubmissionError,
  createSubmission,
  setSubmissionStatus,
  submissionContext,
} from "./submissions";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "./types";
import { findAccount, setAccountSuspended } from "./users";
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
  if (!isOpen(role)) {
    return invalid({}, "Submissions for this role have closed.", formData);
  }

  if (await overLimit("submission", await clientAddress())) {
    return invalid(
      {},
      "That is a lot of submissions from one place in a short time. Try again in an hour.",
      formData,
    );
  }

  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const { acceptTerms, ...submission } = parsed.data;

  // The role decides whether terms must be accepted, not the form that was
  // posted — otherwise dropping the checkbox from the request would skip it.
  if (role.disclaimer && !acceptTerms) {
    return invalid(
      { acceptTerms: "Please confirm you have read the terms for this role" },
      "You need to accept the terms for this role before submitting.",
      formData,
    );
  }

  try {
    await createSubmission({
      ...submission,
      roleId,
      // The wording is copied as it stands now, so editing the role later
      // cannot change what this person agreed to.
      acceptedTerms: role.disclaimer || null,
      acceptedAt: role.disclaimer ? new Date().toISOString() : null,
    });
  } catch (error) {
    // The unique index is the authority here, so two simultaneous submissions
    // cannot both slip past a check-then-insert.
    if (error instanceof DuplicateSubmissionError) {
      return invalid(
        { email: "You have already submitted for this role" },
        "We already have a submission from that email address.",
        formData,
      );
    }
    throw error;
  }

  await record({
    action: "submission.received",
    actorId: null,
    actorName: submission.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });

  revalidateEverything();

  return {
    status: "success",
    message: `Thanks ${submission.name.split(" ")[0]} — your submission is with ${role.castingDirector}.`,
    errors: {},
    values: {},
  };
}

export async function postRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Checked here as well as on the page: the page redirect is for the person,
  // this is what actually stops an unauthenticated request writing a role.
  const user = await requireUser("/roles/new");

  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const role = await createRole(parsed.data, user.id);
  await record({
    action: "role.posted",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });
  revalidateEverything();
  redirect(`/dashboard/roles/${role.id}?posted=1`);
}

function isSubmissionStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

export async function updateSubmissionStatus(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard");
  const id = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isSubmissionStatus(status)) return;

  // Silently a no-op when the submission hangs off a role this account cannot see.
  const changed = await setSubmissionStatus(id, status, user);
  if (changed) {
    const context = await submissionContext(id);
    await record({
      action: "submission.status",
      actorId: user.id,
      actorName: user.name,
      role: context ? { id: context.roleId, title: context.roleTitle } : undefined,
      ownerId: context?.ownerId ?? null,
      company: context?.company ?? null,
      detail: `${context?.name ?? "a submission"} → ${status}`,
    });
  }
  revalidateEverything();
}

/* ------------------------------------------------------------ moderation -- */

export async function editRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("roleId") ?? "");
  const user = await requireUser(`/dashboard/roles/${id}/edit`);

  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const before = await getVisibleRole(id, user);

  // Returns null when the role is not one this account may touch.
  const role = await updateRole(id, parsed.data, user);
  if (!role) {
    return invalid({}, "That role is no longer yours to edit.", formData);
  }

  await record({
    action: "role.edited",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
    detail: before ? describeChanges(before, role) : "",
  });

  revalidateEverything();
  redirect(`/dashboard/roles/${role.id}?saved=1`);
}

/** Closes a role early, or puts it back. Anyone who can see it can do this. */
export async function toggleRoleClosed(formData: FormData): Promise<void> {
  const id = String(formData.get("roleId") ?? "");
  const closed = formData.get("closed") === "1";
  const user = await requireUser(`/dashboard/roles/${id}`);

  if (!id) return;

  const role = await getVisibleRole(id, user);
  if (!role || !(await setRoleClosed(id, closed, user))) return;

  await record({
    action: closed ? "role.closed" : "role.reopened",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
  });
  revalidateEverything();
}

/**
 * Removes a role and every submission made to it. Admin only, and the
 * confirmation has to be ticked — this destroys other people's data.
 */
export async function removeRole(formData: FormData): Promise<void> {
  const id = String(formData.get("roleId") ?? "");
  const user = await requireUser("/dashboard");

  if (user.role !== "admin" || formData.get("confirm") !== "on" || !id) return;

  // Described before it goes: afterwards there is nothing left to describe. The
  // entry survives the delete because role_id is ON DELETE SET NULL and the
  // title, owner and company are copied onto it.
  const role = await getRole(id);
  if (!role) return;

  await record({
    action: "role.removed",
    actorId: user.id,
    actorName: user.name,
    role,
    ownerId: role.ownerId,
    company: role.company,
    detail: `${role.production} · ${role.company}`,
  });

  await deleteRoleAsAdmin(id);
  revalidateEverything();
  redirect("/dashboard?removed=1");
}

/** Suspends or restores an account. Admin only. */
export async function toggleAccountSuspended(formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  const suspended = formData.get("suspended") === "1";
  const user = await requireUser("/dashboard/accounts");

  // An admin locking themselves out would leave nobody able to undo it.
  if (user.role !== "admin" || !id || id === user.id) return;

  const account = await findAccount(id);
  if (!account || !(await setAccountSuspended(id, suspended))) return;

  // No role, owner or company: account events stay visible to admins only.
  await record({
    action: suspended ? "account.suspended" : "account.restored",
    actorId: user.id,
    actorName: user.name,
    detail: `${account.name} · ${account.company}`,
  });
  revalidateEverything();
}
