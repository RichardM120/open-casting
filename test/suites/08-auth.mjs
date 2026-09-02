/**
 * One way in, and what guards it: the second factor on privileged accounts, the
 * edge check on the dashboard, and the server check behind it that is the one
 * actually deciding.
 */
import {
  ADMIN,
  BASE,
  SHOTS,
  countSignInLinks,
  latestSignInLink,
  launch,
  provision,
  reporter,
  session,
  signIn,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

section("1 there is one entry point and it is /login");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
  check("the dashboard sends you to it", p.url().includes("/login"), p.url());
  check("carrying where you were headed", p.url().includes("next=%2Fdashboard%2Factivity"), p.url());
  check("no signup", (await p.goto(`${BASE}/signup`, { waitUntil: "networkidle" })).status() === 404);
  await c.close();
}

section("2 an admin password alone does not start a session");
const before = countSignInLinks();
const admin = await ctx();
await signIn(admin.p, ADMIN.email, ADMIN.password);
check("says to check the inbox", (await admin.p.getByText("Check your email").count()) > 0);
check("explains why", (await admin.p.getByText(/password on its own is not enough/).count()) > 0);
check("and no session was started", (await admin.p.context().cookies()).every((c) => c.name !== "oc_session"));
await admin.p.screenshot({ path: `${SHOTS}/mfa-sent.png`, fullPage: true });

const link = await latestSignInLink({ after: before });
check("a one-time link was issued", link.includes("/login/verify?token="));

section("3 the link is what signs you in, once");
await admin.p.goto(link, { waitUntil: "networkidle" });
// The bootstrapped admin has never been through setup, so that is where it goes.
check("lands signed in, on setup", admin.p.url().includes("/welcome"), admin.p.url());
check("and now there is a session", (await admin.p.context().cookies()).some((c) => c.name === "oc_session"));
check("and a signed context for the edge", (await admin.p.context().cookies()).some((c) => c.name === "oc_ctx"));

{
  const { c, p } = await ctx();
  await p.goto(link, { waitUntil: "networkidle" });
  check("a second use is refused", p.url().includes("/login"), p.url());
  check("and says why", (await p.getByText(/already been used/).count()) > 0);
  await c.close();
}

section("4 a forged context cookie does not get past the edge");
{
  const { c, p } = await ctx();
  await c.addCookies([
    {
      name: "oc_ctx",
      // A well-formed payload claiming admin, signed with nothing that checks out.
      value: `${Buffer.from(JSON.stringify({ sub: "usr_forged", role: "admin", exp: 9999999999 })).toString("base64url")}.bm90LWEtc2lnbmF0dXJl`,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await p.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" });
  check("the signature is checked, not just the shape", p.url().includes("/login"), p.url());
  await c.close();
}

section("5 a director cannot reach the admin console");
const dir = await provision(browser, errors, admin.p, {
  name: "Auth Dir", company: `Auth Co ${t}`, email: `au${t}@example.com`, role: "director",
});
const accounts = await dir.p.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" });
check("the edge turns it into a 404", accounts.status() === 404, String(accounts.status()));
check("their own dashboard still works", (await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })).status() === 200);

section("6 a director signs in with a password alone");
{
  const { c, p } = await ctx();
  const links = countSignInLinks();
  await signIn(p, `au${t}@example.com`, dir.password);
  check("straight in, no second factor", !p.url().includes("/login"), p.url());
  check("and no link was sent", countSignInLinks() === links);
  await c.close();
}

section("6b the Google callback refuses anything it did not start");
{
  const { c, p } = await ctx();
  // No handshake cookies, so no state to consume.
  await p.goto(`${BASE}/api/auth/google/callback?code=made-up`, { waitUntil: "networkidle" });
  check("a callback with no handshake is refused", p.url().includes("/login?error="), p.url());
  check("and starts no session", (await p.context().cookies()).every((x) => x.name !== "oc_session"));

  await p.goto(`${BASE}/api/auth/google/callback?error=access_denied`, { waitUntil: "networkidle" });
  check("a refusal at Google is reported, not crashed on", (await p.getByText(/cancelled/i).count()) > 0);
  await c.close();
}

section("7 the server decides, not the cookie");
{
  // Suspend the director while they hold a valid, correctly signed context.
  await admin.p.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" });
  await admin.p
    .locator("main ul > li")
    .filter({ hasText: `au${t}@example.com` })
    .getByRole("button", { name: "Suspend" })
    .click();
  await admin.p.waitForTimeout(2500);

  const cookies = await dir.p.context().cookies();
  check("the context cookie is still there and still valid", cookies.some((c) => c.name === "oc_ctx"));
  await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("but the database has the last word", dir.p.url().includes("/login"), dir.p.url());
}

section("8 a stale link cannot outlive the account");
{
  const links = countSignInLinks();
  const { c, p } = await ctx();
  await signIn(p, ADMIN.email, ADMIN.password);
  const first = await latestSignInLink({ after: links });

  // Asking for another must void the first, or a forwarded email stays usable.
  const { c: c2, p: p2 } = await ctx();
  await signIn(p2, ADMIN.email, ADMIN.password);
  await latestSignInLink({ after: links + 1 });

  await p.goto(first, { waitUntil: "networkidle" });
  check("the superseded link is dead", p.url().includes("/login"), p.url());
  await c.close();
  await c2.close();
}

for (const s of [admin, dir]) await s.c.close();
await browser.close();
finish();
