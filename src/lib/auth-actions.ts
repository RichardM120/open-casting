"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { endSession, pruneExpiredSessions, requireUser, startSession } from "./auth";
import { submittedValues, type FormState } from "./form-state";
import { decoyPasswordHash, verifyPassword } from "./password";
import {
  EmailTakenError,
  markOnboarded,
  syncAdminRole,
  updateProfile,
  THROTTLE_WINDOW_MINUTES,
  clearFailedLogins,
  createUser,
  findUserByEmail,
  isThrottled,
  recentFailures,
  recordFailedLogin,
} from "./users";
import {
  fieldErrors,
  profileSchema,
  signInSchema,
  signUpSchema,
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

export async function signUp(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(
      fieldErrors(parsed.error),
      "Check the highlighted fields and try again.",
      formData,
    );
  }

  let user;
  try {
    user = await createUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return invalid(
        { email: "An account with that email already exists" },
        "That email is already registered — sign in instead.",
        formData,
      );
    }
    throw error;
  }

  await startSession(user.id);
  redirect("/welcome");
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

  await clearFailedLogins(email);
  await pruneExpiredSessions();
  // Picks up an ADMIN_EMAILS change since this account last signed in.
  await syncAdminRole(user);
  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
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
