import "server-only";

import { noteMessage } from "./notifications";

/**
 * Outbound email, which today means one thing: the sign-in link for an account
 * that needs a second factor.
 *
 * Resend over its HTTP API, so there is no dependency and nothing to keep open
 * on a serverless invocation. With no API key configured it falls back to the
 * server log, which is useful in development and is why `sendEmail` reports
 * which of the two happened, so a caller must not tell someone to check their
 * inbox for a message that was only ever written to a log.
 */
export type Delivery = { delivered: boolean; reason?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function sender(): string {
  return process.env.EMAIL_FROM?.trim() || "Open Casting <onboarding@resend.dev>";
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  /** What prompted it, for the delivery log. */
  trigger?: string;
  /** Where a reply should go, when there is somewhere sensible to send it. */
  replyTo?: string;
  /** Files to attach, content base64-encoded, as the provider takes them. */
  attachments?: Array<{ filename: string; content: string }>;
}): Promise<Delivery> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const trigger = message.trigger ?? "other";

  if (!apiKey) {
    // Never in production: a link printed to a log is a link in the log.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[email] to ${message.to}: ${message.subject}\n${message.text}\n`);
    }
    const reason = "RESEND_API_KEY is not set";
    await noteMessage({ recipient: message.to, subject: message.subject, trigger, delivered: false, reason });
    return { delivered: false, reason };
  }

  try {
    // Overridable so the test harness can point the real send path at a local
    // sink and exercise it, rather than asserting against a log fallback that
    // casting call never takes.
    const endpoint = process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] send failed", response.status, detail);
      const reason = `the mail provider returned ${response.status}`;
      await noteMessage({ recipient: message.to, subject: message.subject, trigger, delivered: false, reason });
      return { delivered: false, reason };
    }
    await noteMessage({ recipient: message.to, subject: message.subject, trigger, delivered: true });
    return { delivered: true };
  } catch (error) {
    console.error("[email] send threw", error);
    const reason = "the mail provider could not be reached";
    await noteMessage({ recipient: message.to, subject: message.subject, trigger, delivered: false, reason });
    return { delivered: false, reason };
  }
}

/**
 * Where a reply to an automated message should go.
 *
 * The address is per role and carries the role's id, so a reply can be routed
 * to the team casting it without putting anybody's own mailbox on a message
 * that goes to strangers. It needs an inbound service listening on that
 * domain to be worth anything; with none configured there is no reply-to, and
 * the message says in words how to get in touch instead.
 */
export function replyToFor(roleId: string): string | undefined {
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim();
  return domain ? `role-${roleId}@${domain}` : undefined;
}
