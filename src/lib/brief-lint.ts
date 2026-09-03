/**
 * Reads a brief the way a safeguarding reviewer would, for a casting that
 * involves children. Normal industry practice asks a ten-year-old to say on
 * camera where they live and who they are close to; spoken on video that
 * cannot be redacted, pseudonymised or partly disclosed, and it survives
 * every deletion but the file's. The form already collects the structured
 * facts, and they can be withheld or deleted one at a time, so the brief is
 * warned where it asks for them on tape. Advisory: the director decides,
 * and the decision is recorded with the role.
 */
export type BriefWarning = {
  key: "location" | "school" | "birth" | "relationships" | "contact";
  label: string;
  hint: string;
};

const RULES: { key: BriefWarning["key"]; pattern: RegExp; label: string; hint: string }[] = [
  {
    key: "location",
    pattern:
      /\b(where (you|they|he|she) (live|lives|are from|come from)|home ?town|your (town|village|area|street)|address|post ?code|which part of)\b/i,
    label: "where they live",
    hint: "The form takes where an applicant is based as a field, which can be withheld or deleted. Said on camera it cannot.",
  },
  {
    key: "school",
    pattern: /\b(school|college|class(room)?|teacher|year (group|[1-9]|1[0-3]))\b/i,
    label: "their school",
    hint: "A school names a place a child is every weekday. Leave it out of a tape.",
  },
  {
    key: "birth",
    pattern: /\b(date of birth|d\.?o\.?b\.?|birthday|born (on|in)|how old (you|they) (are|is))\b/i,
    label: "their date of birth or age",
    hint: "Age is a field on the form and drives the parental consent route. On a tape it is just a fact about a child.",
  },
  {
    key: "relationships",
    pattern:
      /\b(family|parents?|mum|mom|dad|mother|father|brother|sister|siblings?|best friends?|friends?|pets?|someone (you|they) (are )?close to|close to you)\b/i,
    label: "family, friends or pets",
    hint: "A child describing who they are close to, with their face, name and area, is a package that identifies them and their circle. It has no casting purpose the brief cannot meet another way.",
  },
  {
    key: "contact",
    pattern: /\b(phone number|mobile number|email address|instagram|tiktok|snapchat|social media|handle)\b/i,
    label: "contact details or social media",
    hint: "Contact goes through the form and the parent. A handle on a tape reaches a child directly.",
  },
];

export function lintBrief(text: string): BriefWarning[] {
  const found: BriefWarning[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text)) found.push({ key: rule.key, label: rule.label, hint: rule.hint });
  }
  return found;
}

/** Whether a role is cast to children: a playing age that starts under 18. */
export function involvesMinors(ageMin: number | string): boolean {
  const age = Number(ageMin);
  return Number.isFinite(age) && age > 0 && age < 18;
}
