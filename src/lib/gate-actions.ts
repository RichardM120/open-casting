"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authSecret, currentUser } from "./auth";
import { GATE_COOKIE, GATE_DAYS, gateOperable, gatePasscode } from "./gate";
import { submittedValues, type FormState } from "./form-state";
import { clientAddress, overLimit } from "./rate-limit";
import { signValue } from "./token";

/**
 * Opens the pre-launch gate for this browser.
 *
 * Throttled by address like every other guessable secret here: one shared
 * passcode with no throttle is a passcode anyone can walk through given an
 * afternoon.
 */
export async function unlockSite(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const expected = gatePasscode();
  if (!expected) redirect("/");

  if (await overLimit("gate", await clientAddress())) {
    return {
      status: "error",
      message: "Too many attempts from here. Try again later.",
      errors: {},
      values: submittedValues(formData),
    };
  }

  const given = String(formData.get("passcode") ?? "");
  if (given !== expected) {
    return {
      status: "error",
      message: "That passcode is not right.",
      errors: { passcode: "Check it and try again" },
      values: {},
    };
  }

  // The right passcode, and still no way through: the cookie cannot be signed.
  // Said plainly, as sign-in does, rather than thrown — a generic error page
  // sends whoever is setting this up looking for a fault that is not there.
  if (!gateOperable()) {
    return {
      status: "error",
      message:
        "The passcode is right, but this deployment cannot open its gate yet. Tell the administrator: AUTH_SECRET is missing.",
      errors: {},
      values: {},
    };
  }

  const expires = new Date(Date.now() + GATE_DAYS * 86_400_000);
  (await cookies()).set(GATE_COOKIE, await signValue("open", GATE_DAYS * 86_400, authSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  const next = String(formData.get("next") ?? "/");
  const destination = /^\/(?!\/)/.test(next) ? next : "/";

  // One hop rather than two. The proxy would bounce a signed-out visitor off a
  // guarded path the moment they arrived, and the router does not correct the
  // address bar when a server action's redirect is itself redirected — so the
  // browser would sit on /dashboard showing the sign-in page. Sending them
  // where they are actually going avoids both.
  if (destination.startsWith("/dashboard") && !(await currentUser())) {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  redirect(destination);
}
