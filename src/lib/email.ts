import "server-only";

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
}): Promise<Delivery> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    // Never in production: a link printed to a log is a link in the log.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[email] to ${message.to}: ${message.subject}\n${message.text}\n`);
    }
    return { delivered: false, reason: "RESEND_API_KEY is not set" };
  }

  try {
    // Overridable so the test harness can point the real send path at a local
    // sink and exercise it, rather than asserting against a log fallback that
    // production never takes.
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
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] send failed", response.status, detail);
      return { delivered: false, reason: `the mail provider returned ${response.status}` };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[email] send threw", error);
    return { delivered: false, reason: "the mail provider could not be reached" };
  }
}
