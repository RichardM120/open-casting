import { z } from "zod";

import { fromLocalInput, londonDate } from "./format";
import { PRODUCTION_TYPES, SIGNUP_ROLES, TIER_KEYS, ADULT_AGE } from "./types";
import { APPLICANT_ASKS, ASK_KEYS, DEFAULT_REQUIRED_FIELDS, type AskKey } from "./types";

const trimmed = z.string().trim();
const optionalUrl = trimmed
  .max(300)
  .refine((value) => value === "" || /^https?:\/\/\S+\.\S+/.test(value), {
    message: "Enter a full link starting with http:// or https://",
  });

export const submissionSchema = z.object({
  name: trimmed.min(2, "Enter your name").max(80),
  email: z
    .string()
    .trim()
    .max(120)
    .default("")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address",
    ),
  // The phone, where they are based and the cover note are required only
  // when the role says so, which the action checks against the role rather
  // than the form. Given, each still has to be a real one.
  phone: trimmed.max(40).refine((value) => value === "" || value.length >= 6, "Enter a contact number"),
  location: trimmed
    .max(80)
    .refine((value) => value === "" || value.length >= 2, "Where are you based?"),
  age: z.coerce
    .number({ message: "Enter your age in years" })
    .int("Enter your age in whole years")
    .min(5, "Enter an age of 5 or over")
    .max(100, "Enter an age of 100 or under"),
  reelUrl: optionalUrl,
  profileUrl: optionalUrl,
  coverNote: trimmed
    .max(1200, "Keep the cover note under 1200 characters")
    .refine(
      (value) => value === "" || value.length >= 20,
      "Tell the casting director a little more. Twenty characters is the minimum",
    ),
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
})
  // An adult is their own contact. A child's contact is the parent or guardian,
  // whose details the action checks for, with a fuller explanation than a
  // field error can carry, so they are not repeated here.
  .superRefine((value, ctx) => {
    if (value.age >= ADULT_AGE && !value.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter your email address" });
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * What a role needs to say for itself. Everything about the production it sits
 * in (the name, the type, the synopsis, the company, the dates) comes from the
 * production, so the form does not ask for it twice.
 */
/** An empty box means "no limit", which is different from zero. */
const optionalCount = trimmed
  .max(6)
  .refine((value) => value === "" || /^\d+$/.test(value), "Enter a whole number, or leave blank")
  .refine((value) => value === "" || Number(value) >= 1, "Enter 1 or more, or leave blank")
  .transform((value) => (value === "" ? null : Number(value)));

const optionalDate = trimmed
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a date, or leave blank")
  .transform((value) => (value === "" ? null : value));

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
    shootStartsAt: optionalDate,
    shootEndsAt: optionalDate,
    sessionId: trimmed.min(1, "Choose the production this role belongs to"),
    disclaimer: trimmed.max(2000, "Keep the terms under 2000 characters"),
    // Built by the action from the form's radios; see readRequiredFields.
    requiredFields: z.array(z.enum(ASK_KEYS)),
  })
  .refine(
    (value) => !value.shootEndsAt || !value.shootStartsAt || value.shootEndsAt >= value.shootStartsAt,
    {
    path: ["shootEndsAt"],
    message: "The last shoot day cannot be before the first",
  })
  // A last day on its own says nothing; either both are set or neither is.
  .refine((value) => !(value.shootEndsAt && !value.shootStartsAt), {
    path: ["shootStartsAt"],
    message: "Choose the first shoot day as well, or leave both blank",
  })
  .refine((value) => value.ageMax >= value.ageMin, {
    path: ["ageMax"],
    message: "The maximum age must be the same as or above the minimum",
  });

export type RoleInput = z.infer<typeof roleSchema>;

/**
 * The role form posts one radio per ask, `ask_phone` and so on, set to
 * "required" or "optional". A form that sent none of them gets the default,
 * which is what the form always asked for.
 */
export function readRequiredFields(entries: Record<string, unknown>): AskKey[] {
  if (!APPLICANT_ASKS.some((ask) => `ask_${ask.key}` in entries)) {
    return [...DEFAULT_REQUIRED_FIELDS];
  }
  return APPLICANT_ASKS.filter((ask) => entries[`ask_${ask.key}`] === "required").map(
    (ask) => ask.key,
  );
}

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

export const limitsSchema = z.object({
  tier: z.enum(TIER_KEYS as [string, ...string[]]).optional(),
  maxSessions: optionalCount,
  maxRolesPerSession: optionalCount,
  accessUntil: optionalDate,
});

/** A client: the company paying for Open Casting. Filled in by the owner. */
export const clientSchema = z.object({
  name: trimmed.min(2, "Name the client").max(80),
  contactName: trimmed.max(80),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address, or leave blank",
    ),
  contactPhone: trimmed.max(40),
  billingEmail: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address, or leave blank",
    ),
  billingReference: trimmed.max(80),
  address: trimmed.max(300),
  notes: trimmed.max(1000, "Keep the notes under 1000 characters"),
  ...limitsSchema.shape,
  // The client form offers "No plan set", which arrives as an empty string.
  // limitsSchema's tier is a bare enum, so it has to be widened here.
  tier: trimmed
    .refine(
      (value) => value === "" || (TIER_KEYS as string[]).includes(value),
      "Choose a plan, or leave it unset",
    )
    .transform((value) => (value === "" ? undefined : value)),
});

export type ClientInput = z.infer<typeof clientSchema>;

/**
 * What the administrator fills in to make somebody an account. There is no
 * password field: one is generated and shown once, so a weak shared password
 * is not something anyone can choose here.
 */
export const newAccountSchema = z.object({
  name: trimmed.min(2, "Enter their name").max(80),
  // The account's company comes from the client it belongs to, so it is chosen
  // rather than typed: a typed name is what let one account land in another
  // client's view of the dashboard.
  clientId: trimmed.min(1, "Choose the client this account belongs to"),
  email: trimmed.max(120).pipe(z.email("Enter a valid email address")),
  role: z.enum(SIGNUP_ROLES, { message: "Choose what they will be able to see" }),
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
    productionCompany: trimmed.max(80, "Keep the production company under 80 characters"),
    // Checked against the store in the action, not here: which store, and
    // whose folder, is not the form's to say.
    heroUrl: z.string().trim().max(600).optional().default(""),
    heroKind: z.enum(["banner", "logo"]).optional().default("banner"),
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
