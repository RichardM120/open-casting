import { z } from "zod";

import { PAY_TYPES, PRODUCTION_TYPES, SIGNUP_ROLES, UNION_STATUSES } from "./types";

const trimmed = z.string().trim();
const optionalUrl = trimmed
  .max(300)
  .refine((value) => value === "" || /^https?:\/\/\S+\.\S+/.test(value), {
    message: "Enter a full link starting with http:// or https://",
  });

export const submissionSchema = z.object({
  name: trimmed.min(2, "Enter your name").max(80),
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  phone: trimmed.min(6, "Enter a contact number").max(40),
  location: trimmed.min(2, "Where are you based?").max(80),
  age: z.coerce
    .number({ message: "Enter your age in years" })
    .int("Enter your age in whole years")
    .min(5, "Enter an age of 5 or over")
    .max(100, "Enter an age of 100 or under"),
  unionStatus: z.enum(["Union", "Non-Union"], { message: "Choose a union status" }),
  reelUrl: optionalUrl,
  profileUrl: optionalUrl,
  coverNote: trimmed
    .min(20, "Tell the casting director a little more — 20 characters minimum")
    .max(1200, "Keep the cover note under 1200 characters"),
  // Only present, and only required, when the role carries terms. The action
  // checks it against the role rather than trusting the form.
  acceptTerms: z.coerce.boolean().optional(),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const roleSchema = z
  .object({
    title: trimmed.min(2, "Name the role").max(80),
    production: trimmed.min(2, "Name the production").max(80),
    productionType: z.enum(PRODUCTION_TYPES, { message: "Choose a production type" }),
    synopsis: trimmed.min(20, "Describe the production in a sentence or two").max(600),
    characterBrief: trimmed.min(20, "Describe the character").max(1200),
    requirements: trimmed
      .max(800)
      .transform((value) =>
        value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    location: trimmed.min(2, "Where is the work based?").max(80),
    selfTape: z.coerce.boolean(),
    ageMin: z.coerce.number({ message: "Enter a minimum age" }).int().min(5).max(100),
    ageMax: z.coerce.number({ message: "Enter a maximum age" }).int().min(5).max(100),
    payType: z.enum(PAY_TYPES, { message: "Choose how the role is paid" }),
    rate: trimmed.min(2, "State the rate, or say what is offered instead").max(120),
    unionStatus: z.enum(UNION_STATUSES, { message: "Choose a union status" }),
    shootDates: trimmed.min(2, "When does it shoot?").max(120),
    // The closing date belongs to the casting session, not the role.
    sessionId: trimmed.min(1, "Choose the casting session this role belongs to"),
    castingDirector: trimmed.min(2, "Who is casting?").max(80),
    company: trimmed.min(2, "Name the company").max(80),
    disclaimer: trimmed.max(2000, "Keep the terms under 2000 characters"),
  })
  .refine((value) => value.ageMax >= value.ageMin, {
    path: ["ageMax"],
    message: "Maximum age must be the same as or above the minimum",
  });

export type RoleInput = z.infer<typeof roleSchema>;

export type FieldErrors = Record<string, string>;

/** Flattens a Zod error into one message per field, which is all the forms show. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

/* ------------------------------------------------------------- accounts -- */

/**
 * Length is the requirement that actually helps. Composition rules push people
 * towards predictable substitutions without adding much.
 */
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Keep it under 200 characters");

/**
 * What the administrator fills in to make somebody an account. There is no
 * password field: one is generated and shown once, so a weak shared password
 * is not something anyone can choose here.
 */
export const newAccountSchema = z.object({
  name: trimmed.min(2, "Enter their name").max(80),
  company: trimmed.min(2, "Name their company or agency").max(80),
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  role: z.enum(SIGNUP_ROLES, { message: "Choose what they will be able to see" }),
});

export type NewAccountInput = z.infer<typeof newAccountSchema>;

export const signUpSchema = z.object({
  name: trimmed.min(2, "Enter your name").max(80),
  company: trimmed.min(2, "Name your company or agency").max(80),
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  password,
  // Admin is absent by design — it comes from ADMIN_EMAILS, never from the form.
  role: z.enum(SIGNUP_ROLES, { message: "Choose how you will use the board" }),
});

export const signInSchema = z.object({
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password").max(200),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export const profileSchema = z.object({
  name: trimmed.min(2, "Enter your name").max(80),
  company: trimmed.min(2, "Name your company or agency").max(80),
});

export const sessionSchema = z
  .object({
    name: trimmed.min(2, "Name the production").max(80),
    synopsis: trimmed.min(20, "Describe the production in a sentence or two").max(600),
    company: trimmed.min(2, "Name the company").max(80),
    opensAt: trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an opening date"),
    closesAt: trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a closing date"),
  })
  .refine((value) => value.closesAt >= value.opensAt, {
    path: ["closesAt"],
    message: "The closing date cannot be before the opening date",
  })
  .refine((value) => Date.parse(`${value.closesAt}T23:59:59Z`) > Date.now(), {
    path: ["closesAt"],
    message: "Choose a closing date in the future",
  });

export type SessionInput = z.infer<typeof sessionSchema>;
