"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { endSession, pruneExpiredSessions, requireUser, startSession } from "./auth";
import { submittedValues, type FormState } from "./form-state";
import { decoyPasswordHash, verifyPassword } from "./password";
import {
  markOnboarded,
  syncAdminRole,
  updateProfile,
  THROTTLE_WINDOW_MINUTES,
  clearFailedLogins,
  findUserByEmail,
  isThrottled,
  recentFailures,
  recordFailedLogin,
} from "./users";
import {
  fieldErrors,
  profileSchema,
  signInSchema,
  type FieldErrors,
} from "./validation";

function invalid(errors: FieldErrors, message: string, formData: FormData): FormState {
  return { status: "error", message, errors, values: submittedValues(formData) };
}

/** Where to land after signing in. Only same-site paths, never an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return /^\/(?!\/)/.test(path) ? path : "/dashboard";
}

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  const { email, password } = parsed.data;

  if (isThrottled(await recentFailures(email))) {
    return invalid(
      {},
      `Too many failed attempts. Wait ${THROTTLE_WINDOW_MINUTES} minutes and try again.`,
      formData,
    );
  }

  const user = await findUserByEmail(email);

  // Hash against a decoy when the email is unknown, so both paths cost the same
  // and response time does not reveal which addresses have accounts.
  const correct = await verifyPassword(
    password,
    user?.password_hash ?? (await decoyPasswordHash()),
  );

  if (!user || !correct) {
    await recordFailedLogin(email);
    return invalid(
      {},
      "That email and password do not match an account.",
      formData,
    );
  }

  if (user.suspended_at) {
    return invalid(
      {},
      "This account has been suspended. Contact the site administrator.",
      formData,
    );
  }

  // The arrangement has an end date and it has passed. Said plainly, because
  // "wrong password" would send someone hunting for a problem they do not have.
  if (user.access_until && user.access_until < new Date().toISOString().slice(0, 10)) {
    return invalid(
      {},
      `Access to this account ended on ${user.access_until}. Contact the administrator to extend it.`,
      formData,
    );
  }

  await clearFailedLogins(email);
  await pruneExpiredSessions();
  // Picks up an ADMIN_EMAILS change since this account last signed in.
  await syncAdminRole(user);
  await startSession(user.id);

  // An account made by the administrator has never been through setup, and its
  // holder has only ever seen a password someone sent them. Take them through
  // it rather than dropping them on a dashboard with no context.
  redirect(user.onboarded_at ? safeNext(formData.get("next")) : "/welcome");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}

/* ------------------------------------------------------------ setup wizard -- */

export async function saveProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/welcome");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  await updateProfile(user.id, parsed.data);
  revalidatePath("/", "layout");
  redirect(`/welcome?step=${String(formData.get("nextStep") ?? "2")}`);
}

/** Marks setup done and drops the person where they can actually start. */
export async function finishSetup(formData: FormData): Promise<void> {
  const user = await requireUser("/welcome");
  await markOnboarded(user.id);
  revalidatePath("/", "layout");
  redirect(String(formData.get("to") ?? "/dashboard"));
}
