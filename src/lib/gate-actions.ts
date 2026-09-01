"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authSecret } from "./auth";
import { GATE_COOKIE, GATE_DAYS, gatePasscode } from "./gate";
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

  const expires = new Date(Date.now() + GATE_DAYS * 86_400_000);
  (await cookies()).set(GATE_COOKIE, await signValue("open", GATE_DAYS * 86_400, authSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  const next = String(formData.get("next") ?? "/");
  redirect(/^\/(?!\/)/.test(next) ? next : "/");
}
