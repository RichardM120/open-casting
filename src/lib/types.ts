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
  /** What they are invoiced each period, in whole pence. Null means not set. */
  ratePence: number | null;
  /** How often that figure is invoiced. Empty means not set. */
  billingPeriod: BillingPeriod | "";
  vatNumber: string;
  /** Days from the invoice to the due date. Null means not set. */
  paymentTermsDays: number | null;
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
  /** The most submissions it will take, across its roles. Null is no cap. */
  submissionCap: number | null;
  /** An optional image on the applicant's page, or null. */
  heroUrl: string | null;
  /** How that image is shown: across the top as a banner, or centred as a logo. */
  heroKind: HeroKind;
  /**
   * The inclusive casting statement shown to applicants. Null on a casting
   * call from before there was one, which shows the default; empty when the
   * director has cleared it.
   */
  inclusionStatement: string | null;
  /**
   * Shown to an applicant who says they have an agent, in place of the form:
   * where represented actors should go instead. Empty means no gate.
   */
  agentRoute: string;
  /**
   * How to tape, shown beside the upload. Null on a casting call from before
   * there was one, which shows the default; empty when cleared.
   */
  tapeGuidance: string | null;
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

/**
 * What an applicant can be asked for beyond their name, email and age, which
 * every role needs, and the terms, which every submission accepts. The casting
 * director decides per role which of these a submission has to carry.
 */
export const APPLICANT_ASKS = [
  { key: "phone", label: "Phone number" },
  { key: "location", label: "Where they are based" },
  { key: "residency", label: "Where they are resident" },
  { key: "height", label: "Height" },
  { key: "coverNote", label: "Cover note" },
  { key: "reelUrl", label: "Showreel link" },
  { key: "profileUrl", label: "Profile link" },
  { key: "photo", label: "Profile photo" },
  { key: "video", label: "Self-tape or showreel video" },
] as const;

export type AskKey = (typeof APPLICANT_ASKS)[number]["key"];

export const ASK_KEYS = APPLICANT_ASKS.map((ask) => ask.key) as [AskKey, ...AskKey[]];

/** What a role asks for unless the director says otherwise: what the form always asked. */
export const DEFAULT_REQUIRED_FIELDS: AskKey[] = ["phone", "location", "coverNote"];

/** What a role leaves out unless the director asks for it. */
export const DEFAULT_HIDDEN_FIELDS: AskKey[] = ["residency", "height"];

/** The one thing an applicant can say about where they are resident. */
export const RESIDENCIES = [
  "United Kingdom",
  "Ireland",
  "Elsewhere in Europe",
  "Outside Europe",
] as const;

/**
 * One video a role asks for: what it is, what to do in it, the longest it may
 * run, and whether it has to be there. A role with none set asks for one
 * general tape, DEFAULT_MEDIA_SLOT.
 */
export type MediaSlot = {
  key: string;
  label: string;
  brief: string;
  maxSeconds: number | null;
  required: boolean;
};

export const MAX_MEDIA_SLOTS = 3;

/** The lengths a director can cap a video at, in seconds. */
export const SLOT_LENGTHS = [30, 45, 60, 90, 120, 180, 300] as const;

export const DEFAULT_MEDIA_SLOT: MediaSlot = {
  key: "tape",
  label: "Self-tape or showreel",
  brief: "",
  maxSeconds: null,
  required: false,
};

/** A video an applicant sent, against the slot it was sent for. */
export type SubmissionVideo = { slot: string; url: string; name: string };

/**
 * How to tape, as every casting director writes it out from scratch and
 * every applicant has stopped reading by the time they press record. Shown
 * beside the upload instead, and editable per casting call.
 */
export const DEFAULT_TAPE_GUIDANCE = [
  "Film in landscape on a phone or a camera, with the lens at eye level about an arm's length away.",
  "Frame your head and shoulders, and look just beside the lens rather than at yourself on the screen.",
  "Find a quiet, well-lit room: daylight or a lamp in front of you, never behind you, and no music.",
  "Use a plain, neutral background and wear your own clothes, nothing with a logo or a pattern.",
  "Say your name and the role at the start, then go straight into the piece.",
  "Keep to the length asked for. If in doubt, shorter.",
].join("\n");

/**
 * The protected characteristics a role may ask about, and then only under a
 * recorded occupational requirement: heritage, faith and health are routine
 * casting criteria, and the law allows the question where the part genuinely
 * requires it. What is collected is special category data under UK GDPR, so
 * it is asked with its own consent, held apart, read by fewer people and
 * deleted sooner than the rest of a submission.
 */
export const SPECIAL_KINDS = [
  { key: "ethnicity", label: "Ethnic or racial origin", about: "your ethnic or racial origin" },
  { key: "religion", label: "Religion or belief", about: "your religion or belief" },
  { key: "health", label: "Health or disability", about: "your health or a disability" },
  { key: "other", label: "Another protected characteristic", about: "a protected characteristic" },
] as const;

export type SpecialKind = (typeof SPECIAL_KINDS)[number]["key"];

export type SpecialQuestion = {
  kind: SpecialKind;
  /** As the applicant reads it. */
  question: string;
  /** The occupational requirement: why this role may ask. The record of the decision. */
  justification: string;
};

/** Days an answer survives after casting closes: a shorter clock than the submission's. */
export const SPECIAL_RETENTION_DAYS = 30;

export type SpecialAnswer = {
  submissionId: string;
  kind: SpecialKind;
  answer: string;
  /** The consent sentence as it read when ticked, and its hash. */
  consentText: string;
  consentHash: string;
  consentedAt: string;
};

/** The inclusive casting statement a new casting call starts with. The director may edit or clear it. */
export const DEFAULT_INCLUSION_STATEMENT =
  "We welcome submissions from everyone. This casting is open to applicants of every background, ethnicity, faith, gender identity, sexuality and disability, and we encourage anyone who fits the brief to submit.";

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
  /** Whether the role is paid. Shown on the listing. */
  paid: boolean;
  ageMin: number;
  ageMax: number;
  /** yyyy-mm-dd. When it shoots, once known: null until the dates are fixed; the end is null for a single day. */
  shootStartsAt: string | null;
  shootEndsAt: string | null;
  /** The name of the account that posted it. */
  castingDirector: string;
  /** Terms the applicant must accept to submit. Empty when none are set. */
  disclaimer: string;
  /** Which of the applicant's fields have to be filled in for this role. */
  requiredFields: AskKey[];
  /** Which are not asked for at all. Never a field that is required. */
  hiddenFields: AskKey[];
  /** The videos asked for, each with its brief and cap. Empty means one general tape. */
  mediaSlots: MediaSlot[];
  /** A question about a protected characteristic, with the requirement that allows it, or null. */
  specialQuestion: SpecialQuestion | null;
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
  /** In centimetres, when the role asked and the applicant said. */
  heightCm: number | null;
  /** One of RESIDENCIES, or empty when not asked or not said. */
  residency: string;
  /** Whether they confirmed they are free for the shoot dates. Null when the role had none to confirm. */
  available: boolean | null;
  reelUrl: string;
  profileUrl: string;
  /** Uploaded with the submission, held privately, deleted with it. */
  photoUrl: string | null;
  /** The first video, kept for rows and code from before there were slots. */
  videoUrl: string | null;
  /** Every video sent, against the slot it answers. */
  videos: SubmissionVideo[];
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
  "ownerId" | "closedAt" | "createdAt" | "publishedAt" | "purgedAt" | "submissionCap"
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
/** How often a client is invoiced, as it reads on the page and on an invoice. */
export const BILLING_PERIODS = {
  monthly: { label: "Monthly", each: "a month" },
  quarterly: { label: "Quarterly", each: "a quarter" },
  annually: { label: "Annually", each: "a year" },
  per_call: { label: "Per casting call", each: "casting call" },
} as const;

export type BillingPeriod = keyof typeof BILLING_PERIODS;
export const BILLING_PERIOD_KEYS = Object.keys(BILLING_PERIODS) as BillingPeriod[];

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
  director: "Opens casting calls, posts roles into them and reviews what comes in.",
  producer: "Sees every casting call under the company, and everything posted into them.",
};

export type Database = {
  sessions: SeedSession[];
  /** Roles with their production's details filled in, ready to insert. */
  roles: Omit<Role, "ownerId">[];
  submissions: Submission[];
};
