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

export const SUBMISSION_STATUSES = [
  "New",
  "Shortlisted",
  "Callback",
  "Declined",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * A client: a company paying for Open Casting.
 *
 * The top of the hierarchy. Accounts belong to a client, and what the client
 * bought lives here rather than on each account, so a customer is managed in
 * one place. Suspending a client locks out every account under it.
 */
export type Client = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingEmail: string;
  billingReference: string;
  address: string;
  notes: string;
  tier: Tier | null;
  /** Null means no ceiling, as it does on an account. */
  maxSessions: number | null;
  maxRolesPerSession: number | null;
  /** yyyy-mm-dd, or null for no end date. */
  accessUntil: string | null;
  suspendedAt: string | null;
  createdAt: string;
};

/**
 * One production and its casting window. A production casts as a unit rather
 * than role by role, so the roles posted into it open and close with it and
 * carry its name, type, synopsis and company.
 */
export type HeroKind = "banner" | "logo";

export type CastingSession = {
  id: string;
  slug: string;
  name: string;
  productionType: ProductionType;
  synopsis: string;
  ownerId: string | null;
  /**
   * The agency that owns this, which is what producer visibility matches on.
   * Not the production company, which is a line on the production.
   */
  company: string;
  /** Who is making it. A line on the form, never shown to an applicant. */
  productionCompany: string;
  /** An optional image on the applicant's page, or null. */
  heroUrl: string | null;
  /** How that image is shown: across the top as a banner, or centred as a logo. */
  heroKind: HeroKind;
  /**
   * ISO timestamps. Submissions are accepted from opensAt up to closesAt. The
   * casting director enters both in UK time; they are stored as instants.
   */
  opensAt: string;
  closesAt: string;
  /** Set when closed ahead of closesAt. ISO timestamp, or null. */
  closedAt: string | null;
  /**
   * Null until the casting director publishes it. A draft is not live whatever
   * its dates say, and its share link opens for nobody but its owner.
   */
  publishedAt: string | null;
  /** Set when the applicants' details were destroyed under the retention policy. */
  purgedAt: string | null;
  /**
   * yyyy-mm-dd. When the production itself finishes, which is what the
   * retention clock runs from rather than the casting close. A shoot can run
   * for months after its casting call shut, and the material is needed until
   * it wraps.
   */
  productionEndsAt: string;
  /**
   * The unguessable half of the share link. Applicants reach a production only
   * by holding this, as there is no public index, so it is never rendered
   * anywhere an applicant could see another production's.
   */
  publicToken: string;
  createdAt: string;
};

export type Role = {
  id: string;
  slug: string;
  title: string;
  /**
   * Copied from the production when the role is posted and kept in step when
   * the production is edited. The production is the authority; these are here
   * so a role reads as a whole on its own.
   */
  production: string;
  productionType: ProductionType;
  synopsis: string;
  company: string;
  characterBrief: string;
  requirements: string[];
  location: string;
  selfTape: boolean;
  ageMin: number;
  ageMax: number;
  /** yyyy-mm-dd. When it shoots, once known: null until the dates are fixed; the end is null for a single day. */
  shootStartsAt: string | null;
  shootEndsAt: string | null;
  /** The name of the account that posted it. */
  castingDirector: string;
  /** Terms the applicant must accept to submit. Empty when none are set. */
  disclaimer: string;
  /** Set when closed ahead of the production's closing time. ISO timestamp, or null. */
  closedAt: string | null;
  /** The account that posted it. Null only for rows predating accounts. */
  ownerId: string | null;
  /** The production it belongs to, which owns its live dates. */
  sessionId: string;
  /** ISO timestamp. */
  postedAt: string;
};

/** Under this, a submission must come from a parent or legal guardian. */
export const ADULT_AGE = 18;

export type Submission = {
  id: string;
  roleId: string;
  /** The production the role belongs to. One submission per person per production. */
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  age: number;
  reelUrl: string;
  profileUrl: string;
  /** Uploaded with the submission, held privately, deleted with it. */
  photoUrl: string | null;
  videoUrl: string | null;
  coverNote: string;
  status: SubmissionStatus;
  /**
   * The role's terms exactly as they read when this was submitted, and when
   * they were accepted. Null when the role carried no terms.
   */
  acceptedTerms: string | null;
  acceptedAt: string | null;
  /** Which version of the platform's Terms of Submission was accepted. */
  termsVersion: string | null;
  /** Set only for an under-18: who consented, and when. */
  guardianName: string | null;
  guardianEmail: string | null;
  guardianConsentAt: string | null;
  /** ISO timestamp. */
  submittedAt: string;
};

/**
 * A sample role as written in the seed file: it names its production and the
 * production's details are filled in from that when the database is seeded.
 * The owner is attached at bootstrap.
 */
export type SeedRole = Omit<
  Role,
  "ownerId" | "production" | "productionType" | "synopsis" | "company"
>;

/**
 * A sample production. The owner is attached when it is seeded, and the sample
 * productions are seeded already published, since a draft nobody can open
 * would make for a poor first look at the tool.
 */
export type SeedSession = Omit<
  CastingSession,
  "ownerId" | "closedAt" | "createdAt" | "publishedAt" | "purgedAt"
>;

/**
 * What an account may see on the dashboard.
 *  - director: the productions they run, and nothing else
 *  - producer: every production under their company
 *  - admin:    everything
 *
 * `admin` is deliberately absent from SIGNUP_ROLES. It is granted only by the
 * ADMIN_EMAILS environment variable, never chosen by whoever is registering.
 */
export const USER_ROLES = ["director", "producer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SIGNUP_ROLES = ["director", "producer"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

/** The MSA's fee schedule, as the thing an account is actually sold. */
export const TIERS = {
  indie: { label: "Indie", submissions: 500 },
  commercial: { label: "Commercial", submissions: 2500 },
  series: { label: "Series / Feature", submissions: 10000 },
  enterprise: { label: "Enterprise", submissions: null },
} as const;

export type Tier = keyof typeof TIERS;
export const TIER_KEYS = Object.keys(TIERS) as Tier[];

export const ROLE_LABELS: Record<UserRole, string> = {
  director: "Casting director",
  producer: "Producer",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<SignupRole, string> = {
  director: "Runs productions, posts roles into them and reviews what comes in.",
  producer: "Sees every production under the company, and everything posted into them.",
};

export type Database = {
  sessions: SeedSession[];
  /** Roles with their production's details filled in, ready to insert. */
  roles: Omit<Role, "ownerId">[];
  submissions: Submission[];
};
