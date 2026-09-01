/**
 * The magic link, treated as a credential rather than a convenience.
 *
 * Run against a real working address — richard@cwcasting.co.uk — because the
 * thing being checked is not only that a link arrives, but that it goes to that
 * address and nowhere else, works once, and cannot be forged, replayed,
 * stretched, or made to outlive the account it belongs to.
 */
import {
  BASE,
  SHOTS,
  adminSession,
  createAccount,
  latestSignInLink,
  countSignInLinks,
  launch,
  reporter,
  session,
  signIn,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);

const RICHARD = process.env.SECOND_ADMIN ?? "richard@cwcasting.co.uk";

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Everything the app sent to the stand-in mail provider, newest last. */
async function mailbox() {
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(process.env.MAILBOX ?? "test/mailbox.json", "utf8"));
}

const admin = await adminSession(browser, errors);

section("1 an address on the allowlist becomes an admin, and admins need two factors");
const password = await createAccount(admin.p, {
  name: "Richard Morland",
  company: "CW Casting Limited",
  email: RICHARD,
  role: "director",
});
const row = await pool.query("SELECT role, mfa_required FROM users WHERE lower(email) = lower($1)", [RICHARD]);
check("created as an admin despite being asked for a director", row.rows[0]?.role === "admin", JSON.stringify(row.rows[0]));

section("2 the password alone starts nothing");
const before = countSignInLinks();
const me = await ctx();
await signIn(me.p, RICHARD, password);
check("no session cookie", (await me.p.context().cookies()).every((c) => c.name !== "oc_session"));
check("told to check the inbox", (await me.p.getByText("Check your email").count()) > 0);
await me.p.screenshot({ path: `${SHOTS}/magic-link-sent.png`, fullPage: true });

section("3 the link goes to that address and nowhere else");
const link = await latestSignInLink({ after: before });
const sent = (await mailbox()).at(-1);
check("addressed to exactly that mailbox", JSON.stringify(sent.to) === JSON.stringify([RICHARD]), JSON.stringify(sent.to));
check("one recipient only", sent.to.length === 1);
check("the subject says what it is", /sign-in link/i.test(sent.subject), sent.subject);
check("the body warns if it was not them", /not you/i.test(sent.text));

section("4 the token is not stored where it could be read back");
const token = new URL(link).searchParams.get("token");
const stored = await pool.query("SELECT token_hash FROM login_challenges WHERE used_at IS NULL");
check("a challenge is on record", stored.rows.length >= 1);
check("but not the token itself", stored.rows.every((r) => r.token_hash !== token));
check("it is a sha-256 hash", stored.rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash)));

section("5 a tampered link is refused");
{
  const { c, p } = await ctx();
  const tampered = link.slice(0, -4) + (link.endsWith("aaaa") ? "bbbb" : "aaaa");
  await p.goto(tampered, { waitUntil: "networkidle" });
  check("does not sign anyone in", (await p.context().cookies()).every((x) => x.name !== "oc_session"));
  check("and says the link is not ours", (await p.getByText(/not one we issued/).count()) > 0);
  await c.close();
}

section("6 the real link works, once");
await me.p.goto(link, { waitUntil: "networkidle" });
check("now signed in", (await me.p.context().cookies()).some((c) => c.name === "oc_session"));
check("as an admin", (await me.p.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" })).status() === 200);
{
  const { c, p } = await ctx();
  await p.goto(link, { waitUntil: "networkidle" });
  check("a replay is refused", (await p.getByText(/already been used/).count()) > 0);
  check("and starts no session", (await p.context().cookies()).every((x) => x.name !== "oc_session"));
  await c.close();
}

section("7 an expired link is refused, and says so");
{
  const links = countSignInLinks();
  const { c, p } = await ctx();
  await signIn(p, RICHARD, password);
  const fresh = await latestSignInLink({ after: links });

  await pool.query("UPDATE login_challenges SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
  await p.goto(fresh, { waitUntil: "networkidle" });
  check("expired links do not work", (await p.context().cookies()).every((x) => x.name !== "oc_session"));
  check("and say which it was", (await p.getByText(/has expired/).count()) > 0);
  await c.close();
}

section("8 asking for a new link kills the old one");
{
  const links = countSignInLinks();
  const first = await ctx();
  await signIn(first.p, RICHARD, password);
  const firstLink = await latestSignInLink({ after: links });

  const second = await ctx();
  await signIn(second.p, RICHARD, password);
  await latestSignInLink({ after: links + 1 });

  await first.p.goto(firstLink, { waitUntil: "networkidle" });
  check("the superseded link is dead", (await first.p.context().cookies()).every((x) => x.name !== "oc_session"));
  await first.c.close();
  await second.c.close();
}

section("9 a link cannot outlive the account it belongs to");
{
  const links = countSignInLinks();
  const { c, p } = await ctx();
  await signIn(p, RICHARD, password);
  const pending = await latestSignInLink({ after: links });

  // Suspended between the password and the link being opened.
  await pool.query("UPDATE users SET suspended_at = now() WHERE lower(email) = lower($1)", [RICHARD]);
  await p.goto(pending, { waitUntil: "networkidle" });
  check("a suspended account cannot spend its link", (await p.context().cookies()).every((x) => x.name !== "oc_session"));
  check("and is told why", (await p.getByText(/no longer active/).count()) > 0);

  await pool.query("UPDATE users SET suspended_at = NULL WHERE lower(email) = lower($1)", [RICHARD]);
  await c.close();
}

section("10 signing out does not leave a way back in");
await me.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await me.p.getByRole("button", { name: "Sign out" }).click();
await me.p.waitForTimeout(1500);
check("session cookie cleared", (await me.p.context().cookies()).every((c) => c.name !== "oc_session"));
check("edge context cleared too", (await me.p.context().cookies()).every((c) => c.name !== "oc_ctx"));
await me.p.goto(link, { waitUntil: "networkidle" });
check("and the old link is still spent", (await me.p.context().cookies()).every((c) => c.name !== "oc_session"));

section("11 the deployment can report whether any of this will work");
{
  const response = await fetch(`${BASE}/api/health`);
  const body = await response.json();
  check("health reports the signing key", body.authSecret === "set", JSON.stringify(body));
  check("and whether email is configured", body.email === "configured", JSON.stringify(body));
  check("without leaking a connection string", !JSON.stringify(body).includes("postgresql://"));
}

await pool.end();
for (const s of [admin, me]) await s.c.close();
await browser.close();
finish();
