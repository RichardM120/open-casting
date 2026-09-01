/**
 * Signed, self-contained tokens — the only thing the proxy can check.
 *
 * The proxy runs on the Edge runtime, which has no database. So a request
 * carries two cookies: the opaque session token, which means nothing without a
 * database lookup, and this, which carries the account id and role and is
 * signed so the edge can trust it without asking anybody.
 *
 * This is a cache, never the authority. It cannot know that an account was
 * suspended, that its access ended, or that its role changed a minute ago —
 * only the database knows that, and `currentUser()` asks it on every request.
 * What this buys is refusing an obviously-wrong request before rendering it.
 *
 * No dependency: Web Crypto is present on both runtimes, so one implementation
 * serves the edge and the server.
 */

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type Context = {
  /** Account id. */
  sub: string;
  role: "director" | "producer" | "admin";
  /** Seconds since the epoch. */
  exp: number;
};

export async function signContext(context: Context, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(context)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

/**
 * Returns the context when the signature and expiry both check out, and null
 * otherwise. `crypto.subtle.verify` does the comparison in constant time.
 */
export async function verifyContext(
  token: string | undefined,
  secret: string,
): Promise<Context | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      fromBase64url(signature),
      encoder.encode(payload),
    );
  } catch {
    // Malformed base64 in a hand-edited cookie lands here.
    return null;
  }
  if (!valid) return null;

  try {
    const context = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Context;
    if (typeof context.exp !== "number" || context.exp * 1000 < Date.now()) return null;
    return context;
  } catch {
    return null;
  }
}
