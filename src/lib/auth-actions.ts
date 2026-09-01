"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MSA } from "@/content/legal";

import { recordAcceptance } from "./agreements";
import { sitePassword } from "./gate";
import { endSession, pruneExpiredSessions, requireUser, startSession } from "./auth";
import { sendEmail } from "./email";
import {
  CHALLENGE_WINDOW_MINUTES,
  createChallenge,
  needsSecondFactor,
  pruneExpiredChallenges,
} from "./mfa";
import { requestOrigin } from "./origin";
import { clientAddress, overLimit } from "./rate-limit";
import { submittedValues, type FormState } from "./form-state";
import { decoyPasswordHash, verifyPassword } from "./password";
import { randomBytes } from "node:crypto";

import {
  createUser,
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

  let user = await findUserByEmail(email);

  // The pre-launch door: any email plus the one shared password, with an
  // account made on the spot for an address that has none. Throttled by
  // address as well as by email, because a shared password with a per-email
  // throttle is no throttle at all — an attacker just varies the email.
  if (sitePassword() && password === sitePassword()) {
    if (await overLimit("signup", await clientAddress())) {
      return invalid({}, "Too many sign-ins from here. Try again later.", formData);
    }
    if (!user) {
      await createUser({
        name: email.split("@")[0],
        email,
        company: "Open Casting",
        password: randomBytes(24).toString("base64url"),
        role: "director",
      });
      user = await findUserByEmail(email);
    }
    if (user && !user.suspended_at) {
      await syncAdminRole(user);
      await startSession(user.id, user.role);
      redirect(user.onboarded_at ? safeNext(formData.get("next")) : "/welcome");
    }
  }

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
  await pruneExpiredChallenges();

  // Picks up an ADMIN_EMAILS change since this account last signed in — which
  // is also what can make this account need a second factor for the first time.
  const current = await syncAdminRole(user);

  // An account made by the administrator has never been through setup, and its
  // holder has only ever seen a password someone sent them. Take them through
  // it rather than dropping them on a dashboard with no context.
  const next = current.onboarded_at ? safeNext(formData.get("next")) : "/welcome";

  if (needsSecondFactor(current)) {
    return sendSignInLink(current.id, current.email, next, formData);
  }

  try {
    await startSession(current.id, current.role);
  } catch (error) {
    // Almost always AUTH_SECRET missing. Say so: a 500 here sends whoever is
    // trying to sign in hunting for a problem that is not theirs.
    console.error("[auth] could not start a session", error);
    return invalid({}, "This deployment is not configured for sign-in yet. Tell the administrator: AUTH_SECRET is missing.", formData);
  }
  redirect(next);
}

/**
 * The second factor: a one-time link, emailed. The password alone has not
 * started a session at this point and will not until the link is opened.
 *
 * Failing to send is reported as a failure rather than waved through. An
 * account that requires a second factor does not get to skip it because the
 * mail provider is down — that would make the requirement decorative.
 */
async function sendSignInLink(
  userId: string,
  email: string,
  next: string,
  formData: FormData,
): Promise<FormState> {
  const token = await createChallenge(userId, next);
  const link = `${await requestOrigin()}/login/verify?token=${encodeURIComponent(token)}`;

  const delivery = await sendEmail({
    to: email,
    subject: "Your Open Casting sign-in link",
    text: [
      "Someone signed in to Open Casting with your password and needs to confirm it is you.",
      "",
      `Open this link to finish signing in. It works once, and expires in ${CHALLENGE_WINDOW_MINUTES} minutes:`,
      "",
      link,
      "",
      "If this was not you, your password is known to somebody else — change it, and tell the administrator.",
    ].join("\n"),
  });

  if (!delivery.delivered) {
    return invalid(
      {},
      `Your password was accepted, but the sign-in link could not be sent — ${delivery.reason}. Nobody can sign in to this account until email is working.`,
      formData,
    );
  }

  return {
    status: "success",
    message: `Check ${email}. A one-time sign-in link is on its way, and expires in ${CHALLENGE_WINDOW_MINUTES} minutes.`,
    errors: {},
    values: {},
  };
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

/**
 * Records that this account accepts the Master Services Agreement, which is the
 * first thing setup asks and the gate on the rest of it.
 *
 * Accepted by the customer themselves rather than ticked on their behalf when
 * the account was made: an agreement someone else accepted for you is not much
 * of an agreement.
 */
export async function acceptAgreement(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/welcome");

  if (formData.get("accept") !== "on") {
    return invalid(
      { accept: "You need to accept the agreement to use the platform" },
      "Tick to confirm you accept the Master Services Agreement and Data Processing Schedule.",
      formData,
    );
  }

  await recordAcceptance(user.id, MSA);
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
