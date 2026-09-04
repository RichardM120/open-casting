import "server-only";

import { query } from "./db";

/**
 * The messages the app sends on its own, and the record of what it sent.
 *
 * Three of them, each with wording that can be changed without a deployment.
 * The defaults live here rather than in the database, so a fresh deployment
 * sends sensible words with nothing to set up, and a row exists only for a
 * template somebody has edited.
 */

/** What a template may put into its wording, and what each one means. */
export const PLACEHOLDERS = {
  applicant: "The applicant's name",
  role: "The role they went for",
  call: "The casting call",
  company: "The company casting it",
  status: "New, Shortlisted, Callback or Declined",
  submission: "The submission's own id",
  count: "How many submissions have come in",
  cap: "The cap on the casting call",
  closes: "When the casting call closes",
} as const;

export type Placeholder = keyof typeof PLACEHOLDERS;

export const TEMPLATES = {
  submission_received: {
    label: "A submission arrives",
    who: "To the applicant, as soon as their submission goes through.",
    placeholders: ["applicant", "role", "call", "company", "submission", "closes"] as Placeholder[],
    subject: "Your submission for {{role}}",
    body: [
      "Hello {{applicant}},",
      "",
      "Your submission for {{role}} on {{call}} has been received. Its reference is {{submission}}.",
      "",
      "{{company}} reads every submission after the call closes on {{closes}}. You will hear back through this address. There is nothing else to send, and one submission per person is all the call takes.",
      "",
      "If you did not make this submission, reply to this message and it will be removed.",
    ].join("\n"),
  },
  status_update: {
    label: "A submission's status changes",
    who: "To the applicant, when the casting team moves them along.",
    placeholders: ["applicant", "role", "call", "company", "status"] as Placeholder[],
    subject: "An update on your submission for {{role}}",
    body: [
      "Hello {{applicant}},",
      "",
      "{{company}} has moved your submission for {{role}} on {{call}} to {{status}}.",
      "",
      "They will be in touch through this address if there is anything else to do.",
    ].join("\n"),
  },
  cap_warning: {
    label: "A casting call is nearly full",
    who: "To the casting team, once nine in ten of the submissions they set are in.",
    placeholders: ["call", "count", "cap", "closes"] as Placeholder[],
    subject: "{{call}} is nearly full",
    body: [
      "{{call}} has taken {{count}} of the {{cap}} submissions it is set to take.",
      "",
      "Once the cap is met the call stops accepting them, whatever its closing time says. It closes on {{closes}}.",
      "",
      "Raise the cap or close the call early from its page on Open Casting.",
    ].join("\n"),
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export type Template = {
  key: TemplateKey;
  subject: string;
  body: string;
  /** Null when it is the wording that ships with the app. */
  updatedAt: string | null;
};

/** The wording in force for one template: the edited one, or the default. */
export async function templateFor(key: TemplateKey): Promise<Template> {
  const rows = await query<{ subject: string; body: string; updated_at: Date }>(
    "SELECT subject, body, updated_at FROM email_templates WHERE key = $1",
    [key],
  );
  const row = rows[0];
  return row
    ? { key, subject: row.subject, body: row.body, updatedAt: row.updated_at.toISOString() }
    : { key, subject: TEMPLATES[key].subject, body: TEMPLATES[key].body, updatedAt: null };
}

export async function allTemplates(): Promise<Template[]> {
  return Promise.all(TEMPLATE_KEYS.map(templateFor));
}

export async function saveTemplate(
  key: TemplateKey,
  wording: { subject: string; body: string },
  by: string,
): Promise<void> {
  await query(
    `INSERT INTO email_templates (key, subject, body, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE
       SET subject = $2, body = $3, updated_at = now(), updated_by = $4`,
    [key, wording.subject, wording.body, by],
  );
}

/** Puts a template back to the wording that ships with the app. */
export async function resetTemplate(key: TemplateKey): Promise<void> {
  await query("DELETE FROM email_templates WHERE key = $1", [key]);
}

/**
 * Fills the placeholders. Anything the caller did not give is left as the
 * placeholder itself rather than becoming "undefined": a gap that reads as a
 * gap is easier to notice than a gap that reads as a word.
 */
export function fill(text: string, values: Partial<Record<Placeholder, string>>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = values[name as Placeholder];
    return value === undefined || value === "" ? whole : value;
  });
}

/* ------------------------------------------------------- the delivery log -- */

export type Message = {
  id: string;
  sentAt: string;
  recipient: string;
  subject: string;
  trigger: string;
  delivered: boolean;
  reason: string;
};

export async function noteMessage(message: {
  recipient: string;
  subject: string;
  trigger: string;
  delivered: boolean;
  reason?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO messages (recipient, subject, trigger, delivered, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [message.recipient, message.subject, message.trigger, message.delivered, message.reason ?? ""],
    );
  } catch (error) {
    // A log that cannot be written must not stop the message being sent.
    console.error("[email] could not record the message", error);
  }
}

export async function listMessages(
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Message[]> {
  const rows = await query<{
    id: string;
    sent_at: Date;
    recipient: string;
    subject: string;
    trigger: string;
    delivered: boolean;
    reason: string;
  }>(
    `SELECT id::text, sent_at, recipient, subject, trigger, delivered, reason
       FROM messages ORDER BY sent_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows.map((row) => ({
    id: row.id,
    sentAt: row.sent_at.toISOString(),
    recipient: row.recipient,
    subject: row.subject,
    trigger: row.trigger,
    delivered: row.delivered,
    reason: row.reason,
  }));
}

export async function countMessages(): Promise<{ total: number; failed: number }> {
  const [row] = await query<{ total: string; failed: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE NOT delivered)::text AS failed
       FROM messages`,
  );
  return { total: Number(row?.total ?? 0), failed: Number(row?.failed ?? 0) };
}
