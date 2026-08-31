import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Hashing lives apart from the session code so the seed can create a user
 * without `db.ts` and `auth.ts` importing each other.
 *
 * Format: `scrypt$<salt>$<key>`, both base64. Node ships scrypt, so this needs
 * no dependency.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltPart, keyPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !keyPart) return false;

  const expected = Buffer.from(keyPart, "base64");
  const actual = await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltPart, "base64"),
    expected.length,
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * A hash of a password nobody holds. Comparing against this when an email is
 * unknown keeps the failed-login path the same cost as a real one, so response
 * time does not reveal which addresses have accounts.
 */
let decoy: Promise<string> | null = null;
export function decoyPasswordHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(32).toString("base64"));
  return decoy;
}

/** An unguessable password, for a seeded account nobody should sign in as. */
export function unusablePassword(): string {
  return randomBytes(32).toString("base64");
}
