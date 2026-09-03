import type { Database, SeedRole, SeedSession, Submission } from "./types";
import { DEFAULT_REQUIRED_FIELDS } from "./types";

/**
 * Demo content. The database seeds itself from this when it is empty, so a
 * fresh clone has something to look at straight away.
 */

/**
 * One production per casting. The production owns the live window, so the
 * roles inside it open and close together and an applicant submits to it once.
 * Times are UTC instants: 08:00Z is 09:00 in London in the summer.
 */
const sessions: SeedSession[] = [
  {
    id: "ses_saltmarsh",
    productionCompany: "Wildseed Films",
    publicToken: "4f21c9ba7e",
    heroUrl: null,
    heroKind: "banner",
    slug: "saltmarsh",
    name: "Saltmarsh",
    productionType: "Feature Film",
    synopsis:
      "A low-budget feature about a marine biologist who returns to the Essex coast to close her late father's boatyard and finds the tide has taken more than the land.",
    company: "Raman Casting",
    opensAt: "2026-08-24T08:00:00.000Z",
    closesAt: "2026-09-18T17:00:00.000Z",
    productionEndsAt: "2026-11-06",
  },
  {
    id: "ses_northbank",
    productionCompany: "Two Rivers Television",
    publicToken: "7c03ae5d18",
    heroUrl: null,
    heroKind: "banner",
    slug: "northbank",
    name: "Northbank",
    productionType: "TV Series",
    synopsis:
      "Series two of the returning crime drama set across the Manchester canal network. Eight episodes.",
    company: "Whitcombe & Fry Casting",
    opensAt: "2026-08-19T08:00:00.000Z",
    closesAt: "2026-10-02T17:00:00.000Z",
    productionEndsAt: "2027-04-30",
  },
  {
    id: "ses_hearth",
    productionCompany: "Hearth Retail Group",
    publicToken: "2b96fd40ac",
    heroUrl: null,
    heroKind: "banner",
    slug: "hearth-winter-campaign",
    name: "Hearth: Winter Campaign",
    productionType: "Commercial",
    synopsis:
      "A national television and online campaign for a home energy brand. One 60 second hero film plus cutdowns.",
    company: "Ortiz Casting",
    opensAt: "2026-08-27T08:00:00.000Z",
    closesAt: "2026-09-08T17:00:00.000Z",
    productionEndsAt: "2026-10-02",
  },
  {
    id: "ses_glasshouse",
    productionCompany: "Marlowe Audio",
    publicToken: "e81a37f65d",
    heroUrl: null,
    heroKind: "banner",
    slug: "the-glasshouse",
    name: "The Glasshouse",
    productionType: "Voice Over",
    synopsis:
      "A six-part audio documentary series about the last commercial nursery in a Midlands town.",
    company: "Sixth Floor Audio",
    opensAt: "2026-08-29T08:00:00.000Z",
    closesAt: "2026-09-25T17:00:00.000Z",
    productionEndsAt: "2027-01-29",
  },
  {
    id: "ses_lantern",
    productionCompany: "Lantern Theatre Company",
    publicToken: "93cd6b02fa",
    heroUrl: null,
    heroKind: "banner",
    slug: "lantern",
    name: "Lantern",
    productionType: "Theatre",
    synopsis:
      "A new devised piece touring mid-scale venues across the north of England in spring 2027.",
    company: "Lantern Theatre Company",
    opensAt: "2026-08-12T08:00:00.000Z",
    closesAt: "2026-10-16T17:00:00.000Z",
    productionEndsAt: "2027-05-30",
  },
  {
    id: "ses_kestrel",
    productionCompany: "Wildseed Films",
    publicToken: "6d40ba18ce",
    heroUrl: null,
    heroKind: "banner",
    slug: "kestrel",
    name: "Kestrel",
    productionType: "Short Film",
    synopsis:
      "A fifteen-minute graduation short about a kid who finds an injured bird and decides not to tell anyone.",
    company: "Northern Film School",
    opensAt: "2026-08-22T08:00:00.000Z",
    closesAt: "2026-09-30T17:00:00.000Z",
    productionEndsAt: "2026-11-15",
  },
];

/** The roles, each naming the production it is posted into. */
const roles: SeedRole[] = [
  {
    id: "rol_saltmarsh_nell",
    slug: "nell-saltmarsh",
    title: "Nell (Lead)",
    sessionId: "ses_saltmarsh",
    characterBrief:
      "Nell is guarded, funny in a way that keeps people at arm's length, and quietly furious about a childhood nobody else remembers the same way. She carries most of the film. We are open on ethnicity and looking for someone who can hold long silences without filling them.",
    requirements: [
      "Confident in and around open water",
      "Comfortable with three weeks on location in Essex",
      "Native or fluent English; regional accents welcome",
    ],
    location: "Essex, UK",
    selfTape: true,
    ageMin: 28,
    ageMax: 40,
    shootStartsAt: "2026-10-12",
    shootEndsAt: "2026-11-06",
    castingDirector: "Priya Raman",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-24T09:15:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_saltmarsh_gethin",
    slug: "gethin-saltmarsh",
    title: "Gethin (Supporting)",
    sessionId: "ses_saltmarsh",
    characterBrief:
      "Gethin ran the boatyard alongside Nell's father for twenty years and has decided, without telling anyone, that he is going to keep it running. Warm, stubborn, physically at ease. Welsh accent preferred but not essential.",
    requirements: [
      "Comfortable working on and around boats",
      "Available for a two-week block",
    ],
    location: "Essex, UK",
    selfTape: true,
    ageMin: 55,
    ageMax: 70,
    shootStartsAt: "2026-10-19",
    shootEndsAt: "2026-11-01",
    castingDirector: "Priya Raman",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-24T09:22:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_northbank_dcelliot",
    slug: "dc-elliot-northbank",
    title: "DC Amara Elliot (Series Regular)",
    sessionId: "ses_northbank",
    characterBrief:
      "Amara transferred in from Merseyside and is the only person in the room who thinks the case is already solved. Precise, dry, allergic to small talk. This is a full series arc across all eight episodes.",
    requirements: [
      "Available for the full block, January to April 2027",
      "Northern English accent",
      "Previous broadcast credit preferred",
    ],
    location: "Manchester, UK",
    selfTape: true,
    ageMin: 30,
    ageMax: 42,
    shootStartsAt: "2027-01-11",
    shootEndsAt: "2027-04-30",
    castingDirector: "Tom Whitcombe",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-19T14:40:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_northbank_supporting",
    slug: "kez-northbank",
    title: "Kez (Recurring)",
    sessionId: "ses_northbank",
    characterBrief:
      "Kez works the lock gates and sees everything. Appears in four of eight episodes. Non-professionals with the right instincts are genuinely welcome to submit for this one.",
    requirements: ["Manchester-based or able to work as a local"],
    location: "Manchester, UK",
    selfTape: true,
    ageMin: 18,
    ageMax: 25,
    shootStartsAt: "2027-02-01",
    shootEndsAt: "2027-03-26",
    castingDirector: "Tom Whitcombe",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-19T14:52:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_hearth_couple",
    slug: "couple-hearth",
    title: "Couple, two roles (Principal)",
    sessionId: "ses_hearth",
    characterBrief:
      "Two people who have clearly lived in the same house for a long time. We want real warmth and real ease rather than polish. Submitting as an established pair is welcome; note it in your cover message.",
    requirements: [
      "Usage: UK, all media, 12 months",
      "Buyout negotiated separately from the day rate",
      "One-day shoot plus a half-day fitting",
    ],
    location: "London, UK",
    selfTape: true,
    ageMin: 60,
    ageMax: 78,
    shootStartsAt: "2026-09-22",
    shootEndsAt: null,
    castingDirector: "Lena Ortiz",
    disclaimer:
      "Usage is UK, all media, 12 months from first air date. The day rate does not include the buyout, which is negotiated separately once you are cast. Submitting does not create any engagement, and we cannot pay for self-tapes. We keep your details for the duration of this casting and delete them within 6 months of it closing.",
    closedAt: null,
    postedAt: "2026-08-27T11:05:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_glasshouse_vo",
    slug: "narrator-glasshouse",
    title: "Narrator (Voice)",
    sessionId: "ses_glasshouse",
    characterBrief:
      "The narrator is not a presenter. We want somebody who sounds like they are telling you something across a kitchen table, not reading it. All accents and backgrounds encouraged.",
    requirements: [
      "Broadcast-quality home booth, or able to record in Birmingham",
      "Roughly six half-day sessions across the run",
    ],
    location: "Remote or Birmingham, UK",
    selfTape: true,
    ageMin: 25,
    ageMax: 75,
    shootStartsAt: "2026-11-02",
    shootEndsAt: "2027-01-29",
    castingDirector: "Ruth Adeyemi",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-29T08:30:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_lantern_ensemble",
    slug: "ensemble-lantern",
    title: "Ensemble, six roles (Company)",
    sessionId: "ses_lantern",
    characterBrief:
      "A company of six who will build the piece together over a five-week rehearsal period. Movement-led. We are casting for range and generosity in the room rather than for fixed characters.",
    requirements: [
      "Strong movement background",
      "Available for the full rehearsal period and tour",
      "Deaf and disabled applicants particularly encouraged; access costs are budgeted",
    ],
    location: "Leeds, UK, then a UK tour",
    selfTape: false,
    ageMin: 21,
    ageMax: 55,
    shootStartsAt: "2027-02-08",
    shootEndsAt: "2027-05-30",
    castingDirector: "Marcus Bell",
    disclaimer: "",
    closedAt: null,
    postedAt: "2026-08-12T16:20:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
  {
    id: "rol_kestrel_youth",
    slug: "sam-kestrel",
    title: "Sam (Lead)",
    sessionId: "ses_kestrel",
    characterBrief:
      "Sam is eleven or twelve and does almost all of the film without dialogue. No previous experience needed. A chaperone is required on set and their travel is covered.",
    requirements: [
      "Chaperone required on set at all times",
      "Two consecutive weekends",
      "Comfortable outdoors in cold weather",
    ],
    location: "Peak District, UK",
    selfTape: true,
    ageMin: 11,
    ageMax: 13,
    shootStartsAt: "2026-11-07",
    shootEndsAt: "2026-11-15",
    castingDirector: "Jo Fenwick",
    disclaimer:
      "This role is for an applicant under 16. A parent or guardian must submit on their behalf and must be present for every day of the shoot. A licence from the local authority is required before filming and we will apply for it once the role is cast.",
    closedAt: null,
    postedAt: "2026-08-22T13:00:00.000Z",
    requiredFields: DEFAULT_REQUIRED_FIELDS,
  },
];

const submissions: Omit<
  Submission,
  "sessionId" | "termsVersion" | "guardianName" | "guardianEmail" | "guardianConsentAt"
>[] = [
  {
    id: "sub_0001",
    roleId: "rol_saltmarsh_nell",
    name: "Aoife Brennan",
    email: "aoife.brennan@example.com",
    phone: "07700 900142",
    location: "London, UK",
    age: 33,
    reelUrl: "https://vimeo.com/example/aoife-brennan-reel",
    profileUrl: "https://spotlight.com/example/aoife-brennan",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "I grew up on the Blackwater estuary and have spent more of my life in a boat than out of one. The long silences in the brief are what made me want to submit.",
    status: "Shortlisted",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-25T10:12:00.000Z",
  },
  {
    id: "sub_0002",
    roleId: "rol_saltmarsh_nell",
    name: "Deborah Okonkwo",
    email: "d.okonkwo@example.com",
    phone: "07700 900318",
    location: "Bristol, UK",
    age: 36,
    reelUrl: "https://vimeo.com/example/d-okonkwo",
    profileUrl: "https://spotlight.com/example/d-okonkwo",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "Most recently on stage at the Old Vic. I can send an additional self-tape on water at short notice if useful.",
    status: "Callback",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-25T18:44:00.000Z",
  },
  {
    id: "sub_0003",
    roleId: "rol_saltmarsh_nell",
    name: "Marta Kowalczyk",
    email: "marta.k@example.com",
    phone: "07700 900771",
    location: "Manchester, UK",
    age: 29,
    reelUrl: "https://vimeo.com/example/marta-kowalczyk",
    profileUrl: "",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "First feature submission. I have three shorts on my reel, the last of which played Encounters.",
    status: "New",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-28T07:59:00.000Z",
  },
  {
    id: "sub_0004",
    roleId: "rol_saltmarsh_gethin",
    name: "Dai Llewellyn",
    email: "dai.llewellyn@example.com",
    phone: "07700 900255",
    location: "Cardiff, UK",
    age: 63,
    reelUrl: "https://vimeo.com/example/dai-llewellyn",
    profileUrl: "https://spotlight.com/example/dai-llewellyn",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "Welsh, and I have restored two wooden boats badly enough to know how it is done properly.",
    status: "Shortlisted",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-26T09:03:00.000Z",
  },
  {
    id: "sub_0005",
    roleId: "rol_northbank_dcelliot",
    name: "Simone Achebe",
    email: "simone.achebe@example.com",
    phone: "07700 900604",
    location: "Liverpool, UK",
    age: 38,
    reelUrl: "https://vimeo.com/example/simone-achebe",
    profileUrl: "https://spotlight.com/example/simone-achebe",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "Two series regular credits, both northern. Free for the whole block from January.",
    status: "New",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-21T12:30:00.000Z",
  },
  {
    id: "sub_0006",
    roleId: "rol_northbank_dcelliot",
    name: "Hannah Pryce",
    email: "hannah.pryce@example.com",
    phone: "07700 900019",
    location: "Sheffield, UK",
    age: 41,
    reelUrl: "https://vimeo.com/example/hannah-pryce",
    profileUrl: "https://spotlight.com/example/hannah-pryce",
    photoUrl: null,
    videoUrl: null,
    coverNote: "Sheffield born. Tape attached, second take is the one.",
    status: "Declined",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-20T16:15:00.000Z",
  },
  {
    id: "sub_0007",
    roleId: "rol_hearth_couple",
    name: "Ken & Barbara Whitfield",
    email: "whitfields@example.com",
    phone: "07700 900488",
    location: "Croydon, UK",
    age: 71,
    reelUrl: "",
    profileUrl: "",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "Submitting as a pair, married 46 years. We have done two commercials together, both as a couple.",
    status: "Shortlisted",
    acceptedTerms:
      "Usage is UK, all media, 12 months from first air date. The day rate does not include the buyout, which is negotiated separately once you are cast. Submitting does not create any engagement, and we cannot pay for self-tapes. We keep your details for the duration of this casting and delete them within 6 months of it closing.",
    acceptedAt: "2026-08-28T14:22:00.000Z",
    submittedAt: "2026-08-28T14:22:00.000Z",
  },
  {
    id: "sub_0008",
    roleId: "rol_glasshouse_vo",
    name: "Errol Vance",
    email: "errol.vance@example.com",
    phone: "07700 900930",
    location: "Birmingham, UK",
    age: 58,
    reelUrl: "https://soundcloud.com/example/errol-vance-reel",
    profileUrl: "",
    photoUrl: null,
    videoUrl: null,
    coverNote:
      "Home booth, Source Connect if you need it. Brummie, and unapologetic about it.",
    status: "New",
    acceptedTerms: null,
    acceptedAt: null,
    submittedAt: "2026-08-30T09:48:00.000Z",
  },
];

/**
 * Assembles the demo data. Each role takes its production's name, type,
 * synopsis and company from the production it names, so the seed cannot
 * contradict itself the way a copy per role could.
 */
export function seedDatabase(): Database {
  const byId = new Map(sessions.map((session) => [session.id, session]));

  const seedRoles = structuredClone(roles).map((role) => {
    const session = byId.get(role.sessionId);
    if (!session) throw new Error(`No production for role ${role.id}`);
    return {
      ...role,
      production: session.name,
      productionType: session.productionType,
      synopsis: session.synopsis,
      company: session.company,
    };
  });

  const sessionByRole = new Map(seedRoles.map((role) => [role.id, role.sessionId]));

  const seedSubmissions = structuredClone(submissions).map((submission) => {
    const sessionId = sessionByRole.get(submission.roleId);
    if (!sessionId) throw new Error(`No role for submission ${submission.id}`);
    return {
      ...submission,
      sessionId,
      // Demo submissions predate the platform terms, and none is a minor.
      termsVersion: null,
      guardianName: null,
      guardianEmail: null,
      guardianConsentAt: null,
    };
  });

  return {
    sessions: structuredClone(sessions),
    roles: seedRoles,
    submissions: seedSubmissions,
  };
}
