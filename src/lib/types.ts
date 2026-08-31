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
  /** ISO timestamp. */
  submittedAt: string;
};

export type Database = {
  roles: Role[];
  submissions: Submission[];
};
