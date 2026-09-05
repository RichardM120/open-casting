/**
 * The agreements, as text, versioned.
 *
 * An acceptance is only worth having if you can say afterwards exactly what was
 * accepted. So each document carries a version, every acceptance records it, and
 * the text for a given version never changes — a wording change is a new
 * version, which people are asked to accept again.
 */

export type Clause = { heading: string; body: string[] };
export type LegalDocument = {
  id: "msa" | "submission";
  version: string;
  title: string;
  updated: string;
  intro: string[];
  clauses: Clause[];
};

const ENTITY = "CW Casting Limited, trading as SeaGlass Digital";

/* ------------------------------------------------------- for the customer -- */

export const MSA: LegalDocument = {
  id: "msa",
  version: "2026-09-05",
  title: "Master Services Agreement and Data Processing Schedule",
  updated: "5 September 2026",
  intro: [
    `This Master Services Agreement (“Agreement”) is entered into between ${ENTITY}, operating opencasting.app (“Service Provider”), and the customer named on the account (“Customer”).`,
    "By activating a project campaign, accessing, or using the opencasting.app platform (“Service”), Customer agrees to be bound by the terms of this Agreement and the attached Data Processing Schedule.",
    "Governed by the laws of England and Wales.",
  ],
  clauses: [
    {
      heading: "1. Provision of services and licence",
      body: [
        "1.1 Platform access. Subject to payment of applicable Fees, Service Provider grants Customer a non-exclusive, non-transferable, revocable licence to access and use opencasting.app during the agreed Campaign Term to create open casting landing pages, collect candidate submissions, review audition media, curate shortlists, and export project data.",
        "1.2 Technical conduit status. Customer expressly acknowledges that Service Provider acts purely as an automated technical conduit and intermediary infrastructure provider for hosting and managing casting submissions.",
      ],
    },
    {
      heading: "2. Content ownership and intellectual property",
      body: [
        "2.1 Customer and talent ownership. Service Provider asserts no intellectual property rights, copyright, or ownership in any candidate submissions, audition tapes, showreels, self-tapes, headshots, forms, or metadata uploaded through the Service (“User Content”). All rights, title, and interest in and to shortlisted User Content remain exclusively with Customer or the submitting talent or guardian.",
        "2.2 Strictly limited processing licence. Customer grants Service Provider a strictly limited, non-exclusive, royalty-free, revocable licence solely to host, transmit, store, and display User Content for the purpose of delivering platform functionality to Customer during the active project campaign.",
      ],
    },
    {
      heading: "3. Third-party and public upload liability",
      body: [
        "3.1 Intermediary safe harbour. Service Provider operates as an automated intermediary under applicable statutory intermediary liability protections, including the UK Electronic Commerce Regulations and the Online Safety Act framework. Service Provider does not pre-screen, monitor, or edit public submissions.",
        "3.2 Disclaimer of uploaded content. Service Provider accepts no liability or responsibility whatsoever for the nature, legality, accuracy, or content of any materials submitted by members of the public, candidates, or third parties.",
        "3.3 Prohibited and explicit content. In the event that explicit, illicit, infringing, or illegal material is uploaded through a public campaign form, Service Provider shall not be held liable. Service Provider reserves the right to immediately take down, block, or delete any content upon notice or detection of illegality.",
        "3.4 Customer triage and indemnity. Customer is solely responsible for triaging, reviewing, moderating, and vetting all inbound submissions. Customer agrees to defend, indemnify, and hold harmless Service Provider, its directors, and affiliates from and against any third-party claims, damages, liabilities, or regulatory fines arising out of User Content uploaded to Customer’s casting campaigns.",
      ],
    },
    {
      heading: "4. Fees, access and project duration",
      body: [
        "4.1 Authorised access. Access is restricted to Customer’s designated casting directors and production personnel. Credentials must not be shared outside authorised staff.",
        "4.2 Tiered project fees. Pricing is structured on a per-project campaign basis — Indie Tier up to 500 submissions, Commercial Tier up to 2,500 submissions, Series/Feature Tier up to 10,000 submissions — or agreed enterprise subscriptions.",
        "4.3 Overage and extensions. Submissions exceeding tier caps or active campaigns exceeding contracted durations are subject to standard modular add-on charges: £195 per 1,000 additional submissions, and £150 per 30-day active extension.",
      ],
    },
    {
      heading: "5. Data lifecycle and automated purge",
      body: [
        "5.1 Post-production deletion. In strict compliance with UK GDPR data minimisation obligations, Customer acknowledges that all applicant media and submission form records will be permanently and irreversibly deleted at the end of the retention period following the designated Production End Date. That period is thirty (30) calendar days unless a different period is recorded on Customer’s account, and the period in force when a casting call is opened governs that casting call for its whole life.",
        "5.2 Customer export responsibility. Customer is solely responsible for executing bulk data and media exports prior to the expiry of the retention period. Service Provider accepts no liability for un-exported data purged following the expiry of that period.",
        "5.3 Automated alerts. The platform will issue automated reminder notifications to Customer’s designated account administrator at fourteen (14) days and forty-eight (48) hours prior to final media purge.",
      ],
    },
    {
      heading: "6. Warranties and limitation of liability",
      body: [
        "6.1 Service standards. Service Provider provides the platform using commercially reasonable standards, hosted on secure UK/EU cloud infrastructure.",
        "6.2 Limitation of liability. Neither party excludes liability for death or personal injury caused by negligence, fraud, or gross misconduct. To the maximum extent permitted by law, Service Provider’s total aggregate liability arising under this Agreement shall be strictly limited to the total fees paid by Customer for the specific project campaign giving rise to the claim.",
      ],
    },
    {
      heading: "Data Processing Schedule (UK GDPR Article 28)",
      body: [
        "Roles. Customer is the Data Controller, determining the purpose and legal basis of casting candidate data. Service Provider is the Data Processor, acting solely on Customer’s documented instructions via platform operations.",
        "Scope. Temporary transmission, hosting, triage, shortlisting, and secure export of talent audition records for television, film, commercial, and stage productions. Categories of data: names, dates of birth, contact details, location, guardian details, photographic headshots, video audition tapes, and biographical notes. Data subjects: casting applicants, actors, performers, and children submitted by parents or legal guardians.",
        "Duration. The active casting window plus the retention period recorded on Customer’s account — thirty (30) calendar days following the production’s conclusion unless otherwise agreed in writing — after which data is permanently erased.",
        "Processor obligations. Process only on documented instructions; bind authorised personnel to confidentiality; implement industry-standard technical and organisational measures including encryption at rest and TLS in transit, strict access control, and direct-to-storage presigned uploads; provide tools to assist with data subject rights under UK GDPR; notify Customer of a confirmed personal data breach without undue delay and within 48 hours; and delete all candidate personal data on expiry of the grace period.",
        "Sub-processors. Customer provides general written authorisation for essential infrastructure sub-processors: Vercel Inc. (application hosting and Vercel Blob object storage), Neon Inc. (PostgreSQL), Resend (transactional email — submission receipts, status updates and sign-in links), and, where a user chooses to sign in with Google, Google LLC (authentication only; no applicant data). Primary storage and server nodes reside in UK/EU data centres. Service Provider will give Customer notice of any intended change to this list, and Customer may object.",
        "Controller obligations. Customer warrants that it maintains a lawful basis for processing, ensures public landing pages carry the parental consent mechanisms required under the ICO Children’s Code, and accurately maintains each project’s Production End Date in the dashboard, which governs the automated retention and deletion lifecycle.",
      ],
    },
  ],
};

/* ------------------------------------------------------ for the performer -- */

export const SUBMISSION_TERMS: LegalDocument = {
  id: "submission",
  version: "2026-09-05",
  title: "Terms of Submission and Acceptable Use Policy",
  updated: "5 September 2026",
  intro: [
    "Please read these terms carefully before submitting any information, photographs, or video audition tapes (“Submissions”) through opencasting.app.",
    `The platform is an automated technical intermediary service operated by ${ENTITY}. Submissions are collected on behalf of the production company or casting director running this casting call (“the Production Team”).`,
  ],
  clauses: [
    {
      heading: "1. Parental consent and submissions for under-18s",
      body: [
        "If the candidate is under 18 years of age, this submission must be completed exclusively by a parent or legal guardian with legal parental responsibility.",
        "By completing this form you confirm that you are the parent or legal guardian of the applicant, and you explicitly consent to the processing of their name, age, contact details, headshots, and video tapes solely for casting consideration on this project.",
      ],
    },
    {
      heading: "2. Ownership and intellectual property",
      body: [
        "You retain ownership. Neither opencasting.app nor its operators claim any ownership, copyright, or proprietary right in the media or materials you submit.",
        "By uploading, you grant the Production Team and opencasting.app a strictly limited, non-exclusive licence to transmit, store, view, and review the materials solely for the purpose of casting and assessing suitability for this project.",
      ],
    },
    {
      heading: "3. Acceptable use and prohibited content",
      body: [
        "You agree not to upload, transmit, or link to any content that contains nudity, semi-nudity, sexually explicit, suggestive, or otherwise inappropriate visual material.",
        "You agree not to upload content that is defamatory, abusive, harassing, threatening, discriminatory, or that promotes hate speech.",
        "You agree not to upload content that infringes any third-party intellectual property right, trademark, or copyrighted music or video.",
        "You agree not to upload malicious code, viruses, or corrupted media files.",
        "Zero tolerance. Any submission containing explicit, harmful, or unlawful content will be immediately deleted without notice, the submitting IP address blocked, and, where appropriate or required by law, reported to the relevant law enforcement and safeguarding authorities. opencasting.app acts as a technical intermediary and assumes no liability for unsolicited public uploads.",
      ],
    },
    {
      heading: "4. Data retention and automated deletion",
      body: [
        "Your submission is held securely for the duration of the casting and production review process.",
        "In compliance with UK GDPR data minimisation principles, all photos, video audition tapes, and contact records are permanently and irreversibly destroyed at the end of the retention period after the formal conclusion of the production. That period is thirty (30) calendar days unless the casting team has agreed a longer one, and the casting call you applied to states the exact date your details go.",
        "Your materials will never be sold, commercialised, or used for automated AI model training.",
      ],
    },
    {
      heading: "5. Your rights under UK GDPR",
      body: [
        "You have the right to request access to, rectification of, or immediate erasure of your data — or your child’s — at any point prior to the automated purge date, under Article 17 of the UK GDPR.",
        "Requests should go to the Production Team named on this casting call, who is the data controller for your submission.",
      ],
    },
  ],
};

export const DOCUMENTS = { msa: MSA, submission: SUBMISSION_TERMS } as const;
