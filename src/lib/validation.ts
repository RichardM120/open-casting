import { z } from "zod";

import { fromLocalInput, londonDate } from "./format";
import { PRODUCTION_TYPES, SIGNUP_ROLES, TIER_KEYS } from "./types";

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
  reelUrl: optionalUrl,
  profileUrl: optionalUrl,
  coverNote: trimmed
    .min(20, "Tell the casting director a little more. Twenty characters is the minimum")
    .max(1200, "Keep the cover note under 1200 characters"),
  // Only present, and only required, when the role carries terms. The action
  // checks it against the role rather than trusting the form.
  acceptTerms: z.coerce.boolean().optional(),

  // The platform's own terms, which apply to every submission whether or not
  // the casting director set any of their own.
  acceptSubmissionTerms: z.coerce.boolean().optional(),

  // Only asked for, and only required, when the age given is under 18. The
  // action decides that from the age, not from whether the fields were sent.
  guardianName: trimmed.max(80).optional(),
  guardianEmail: trimmed.max(120).optional(),
  guardianConsent: z.coerce.boolean().optional(),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * What a role needs to say for itself. Everything about the production it sits
 * in (the name, the type, the synopsis, the company, the dates) comes from the
 * production, so the form does not ask for it twice.
 */
export const roleSchema = z
  .object({
    title: trimmed.min(2, "Name the role").max(80),
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
    rate: trimmed.min(2, "Say what the role pays").max(120),
    shootDates: trimmed.min(2, "When does it shoot?").max(120),
    sessionId: trimmed.min(1, "Choose the production this role belongs to"),
    disclaimer: trimmed.max(2000, "Keep the terms under 2000 characters"),
  })
  .refine((value) => value.ageMax >= value.ageMin, {
    path: ["ageMax"],
    message: "The maximum age must be the same as or above the minimum",
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

/** An empty box means "no limit", which is different from zero. */
const optionalCount = trimmed
  .max(6)
  .refine((value) => value === "" || /^\d+$/.test(value), "Enter a whole number, or leave blank")
  .refine((value) => value === "" || Number(value) >= 1, "Enter 1 or more, or leave blank")
  .transform((value) => (value === "" ? null : Number(value)));

const optionalDate = trimmed
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a date, or leave blank")
  .transform((value) => (value === "" ? null : value));

export const limitsSchema = z.object({
  tier: z.enum(TIER_KEYS as [string, ...string[]]).optional(),
  maxSessions: optionalCount,
  maxRolesPerSession: optionalCount,
  accessUntil: optionalDate,
});

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
  ...limitsSchema.shape,
});

export type NewAccountInput = z.infer<typeof newAccountSchema>;

export const signUpSchema = z.object({
  name: trimmed.min(2, "Enter your name").max(80),
  company: trimmed.min(2, "Name your company or agency").max(80),
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  password,
  // Admin is absent by design. It comes from ADMIN_EMAILS, never from the form.
  role: z.enum(SIGNUP_ROLES, { message: "Choose how you will use Open Casting" }),
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

/**
 * A date and time as a datetime-local field sends it. It is read as UK time and
 * comes out the other side as a UTC timestamp, which is what gets stored.
 */
function localDateTime(message: string) {
  return trimmed
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, message)
    .transform(fromLocalInput);
}

export const sessionSchema = z
  .object({
    name: trimmed.min(2, "Name the production").max(80),
    productionType: z.enum(PRODUCTION_TYPES, { message: "Choose a production type" }),
    synopsis: trimmed.min(20, "Describe the production in a sentence or two").max(600),
    company: trimmed.min(2, "Name the company").max(80),
    opensAt: localDateTime("Choose when submissions open"),
    closesAt: localDateTime("Choose when submissions close"),
    productionEndsAt: trimmed.regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Enter when the production finishes",
    ),
  })
  .refine((value) => Date.parse(value.closesAt) > Date.parse(value.opensAt), {
    path: ["closesAt"],
    message: "Submissions have to close after they open",
  })
  .refine((value) => Date.parse(value.closesAt) > Date.now(), {
    path: ["closesAt"],
    message: "Choose a closing time in the future",
  })
  .refine((value) => value.productionEndsAt >= londonDate(value.closesAt), {
    path: ["productionEndsAt"],
    message: "The production cannot finish before casting closes",
  });

export type SessionInput = z.infer<typeof sessionSchema>;
