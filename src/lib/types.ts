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

/**
 * One production's casting window. Roles belong to a session and open and close
 * with it, because a production casts as a unit rather than role by role.
 */
export type CastingSession = {
  id: string;
  slug: string;
  name: string;
  synopsis: string;
  ownerId: string | null;
  company: string;
  /** yyyy-mm-dd. Live from the start of opensAt to the end of closesAt. */
  opensAt: string;
  closesAt: string;
  /** Set when closed ahead of closesAt. ISO timestamp, or null. */
  closedAt: string | null;
  /**
   * Null until the casting director publishes it. A draft is not live whatever
   * its dates say, and its share link opens for nobody but its owner.
   */
  publishedAt: string | null;
  /** Set when the performers' details were destroyed under the retention policy. */
  purgedAt: string | null;
  /**
   * The unguessable half of the share link. Performers reach a production only
   * by holding this — there is no public index — so it is never rendered
   * anywhere a performer could see another production's.
   */
  publicToken: string;
  createdAt: string;
};

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
  /**
   * Mirrors the session's closing date. The session is the authority; this is
   * kept in step on write so the column never contradicts it.
   */
  deadline: string;
  castingDirector: string;
  company: string;
  /** Terms the performer must accept to submit. Empty when none are set. */
  disclaimer: string;
  /** Set when closed ahead of its deadline. ISO timestamp, or null. */
  closedAt: string | null;
  /** The account that posted it. Null only for rows predating accounts. */
  ownerId: string | null;
  /** The casting session it belongs to, which owns its live dates. */
  sessionId: string;
  /** ISO timestamp. */
  postedAt: string;
};

export type Submission = {
  id: string;
  roleId: string;
  /** The casting session the role belonged to. One submission per person per session. */
  sessionId: string;
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
 * Seed content is written before any account or session exists; the bootstrap
 * assigns the owner and the backfill derives the session from the production.
 */
export type SeedRole = Omit<Role, "ownerId" | "sessionId" | "deadline">;

/**
 * A demo casting session. The owner is attached when it is seeded, and the
 * sample productions are seeded already published — a draft nobody can open
 * would make for a poor first look at the tool.
 */
export type SeedSession = Omit<
  CastingSession,
  "ownerId" | "closedAt" | "createdAt" | "publishedAt" | "purgedAt"
>;

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
  sessions: SeedSession[];
  /** Assembled with the session they belong to, and its closing date. */
  roles: (SeedRole & { sessionId: string; deadline: string })[];
  submissions: Submission[];
};
