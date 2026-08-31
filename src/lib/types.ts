/** Core domain types for the Open Casting app. */

export const PRODUCTION_TYPES = [
  "Feature Film",
  "Short Film",
  "TV Series",
  "Commercial",
  "Theatre",
  "Music Video",
  "Voice Over",
] as const;
export type ProductionType = (typeof PRODUCTION_TYPES)[number];

export const UNION_STATUSES = ["Union", "Non-Union", "Either"] as const;
export type UnionStatus = (typeof UNION_STATUSES)[number];

export const PAY_TYPES = ["Paid", "Deferred", "Unpaid / Credit"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export const SUBMISSION_STATUSES = [
  "New",
  "Shortlisted",
  "Callback",
  "Declined",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type Role = {
  id: string;
  slug: string;
  title: string;
  production: string;
  productionType: ProductionType;
  synopsis: string;
  characterBrief: string;
  requirements: string[];
  location: string;
  selfTape: boolean;
  ageMin: number;
  ageMax: number;
  payType: PayType;
  rate: string;
  unionStatus: UnionStatus;
  shootDates: string;
  /** ISO date, yyyy-mm-dd. Submissions close at the end of this day. */
  deadline: string;
  castingDirector: string;
  company: string;
  /** Terms the performer must accept to submit. Empty when none are set. */
  disclaimer: string;
  /** ISO timestamp. */
  postedAt: string;
};

export type Submission = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  age: number;
  unionStatus: Exclude<UnionStatus, "Either">;
  reelUrl: string;
  profileUrl: string;
  coverNote: string;
  status: SubmissionStatus;
  /**
   * The role's terms exactly as they read when this was submitted, and when
   * they were accepted. Null when the role carried no terms.
   */
  acceptedTerms: string | null;
  acceptedAt: string | null;
  /** ISO timestamp. */
  submittedAt: string;
};

/**
 * What an account may see on the dashboard.
 *  - director: the roles they posted, and nothing else
 *  - producer: every role posted under their company
 *  - admin:    everything
 *
 * `admin` is deliberately absent from SIGNUP_ROLES — it is granted only by the
 * ADMIN_EMAILS environment variable, never chosen by whoever is registering.
 */
export const USER_ROLES = ["director", "producer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SIGNUP_ROLES = ["director", "producer"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  director: "Casting director",
  producer: "Producer",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<SignupRole, string> = {
  director: "Post roles and review the submissions made against them.",
  producer: "See every role posted under your company, across productions.",
};

export type Database = {
  roles: Role[];
  submissions: Submission[];
};
