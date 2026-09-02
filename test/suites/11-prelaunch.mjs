/**
 * The pre-launch walled garden.
 *
 * One variable, `SITE_PASSCODE`, does two things: it puts an interstitial in
 * front of every page, and it stops the application's own sign-in checking
 * anything. The second is only defensible because of the first, so this suite
 * spends as much effort on the wall being total, casting links included, and
 * on it announcing itself, as on either switch working.
 */
import {
  BASE,
  SHOTS,
  launch,
  reporter,
  session,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

const PASSCODE = process.env.SITE_PASSCODE ?? "test-site-passcode";
const SHARE = "/c/saltmarsh-4f21c9ba7e";

section("1 every page is behind the interstitial");
{
  const { c, p } = await ctx();
  for (const path of ["/", "/faq", "/faq/applicants", "/login", "/legal/submission-terms", "/dashboard", "/dashboard/activity"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path} -> /gate`, new URL(p.url()).pathname === "/gate", p.url());
  }
  check("it asks for a passcode", (await p.locator("#passcode").count()) === 1);
  check("and remembers where you were headed", p.url().includes("next=%2Fdashboard"), p.url());
  await p.screenshot({ path: `${SHOTS}/gate.png`, fullPage: true });
  await c.close();
}

section("2 a casting link is behind it too");
{
  const { c, p } = await ctx();
  await p.goto(BASE + SHARE, { waitUntil: "networkidle" });
  check("the share link stops at the wall", new URL(p.url()).pathname === "/gate", p.url());
  check("the production is not shown", (await p.getByRole("heading", { name: "Saltmarsh" }).count()) === 0);
  check("and it says why", (await p.getByText(/not accepting\s+submissions yet/).count()) > 0);
  await c.close();
}

section("3 health answers through the wall, and reports it");
{
  const response = await fetch(`${BASE}/api/health`);
  const body = await response.json();
  check("readable", typeof body.ok === "boolean", JSON.stringify(body));
  check("says the site is walled off", body.site.startsWith("walled off"), JSON.stringify(body.site));
  check("and that sign-in checks nothing", body.site.includes("sign-in checks nothing"), JSON.stringify(body.site));
}

section("4 search engines are told off at every layer");
{
  const { c, p } = await ctx();
  const robots = await p.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle" });
  check("robots.txt is served through the wall", robots.status() === 200, String(robots.status()));
  check("and disallows everything", (await robots.text()).includes("Disallow: /"));
  const page = await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check(
    "every response carries X-Robots-Tag",
    (page.headers()["x-robots-tag"] ?? "").includes("noindex"),
    page.headers()["x-robots-tag"],
  );
  await c.close();
}

section("5 the passcode is the only way through");
const inside = await ctx();
{
  const { p } = inside;
  await p.goto(`${BASE}/gate?next=%2Fdashboard%2Fsessions`, { waitUntil: "networkidle" });
  await p.fill("#passcode", "not-the-passcode");
  await p.getByRole("button", { name: "Enter" }).click();
  await p.waitForTimeout(1500);
  check("a wrong passcode is refused", (await p.getByText(/passcode is not right/).count()) > 0);
  check("and does not let go of the door", new URL(p.url()).pathname === "/gate", p.url());
  check("with no cookie to show for it", !(await p.context().cookies()).some((c) => c.name === "oc_gate"));

  await p.fill("#passcode", PASSCODE);
  await p.getByRole("button", { name: "Enter" }).click();
  // Through the wall it hands over to the app's own guard, which for a
  // signed-out visitor means the sign-in page, reached in one hop, with the
  // destination still on it.
  await p.waitForURL(/\/login\?/, { timeout: 20000 });
  check("the right one goes through", (await p.locator("#passcode").count()) === 0, p.url());
  check("and hands over to the app's own sign-in", new URL(p.url()).pathname === "/login", p.url());
  check("in one hop, not two", (await p.locator("#email").count()) === 1, p.url());
  check("still carrying the destination", p.url().includes("next=%2Fdashboard%2Fsessions"), p.url());
  check("and it is remembered", (await p.context().cookies()).some((c) => c.name === "oc_gate"));

  await p.goto(`${BASE}${SHARE}`, { waitUntil: "networkidle" });
  check("the wall stays open for the rest of the site", (await p.getByRole("heading", { name: "Saltmarsh" }).count()) > 0);
}

section("6 OAuth is withdrawn while the wall is up");
{
  const { p } = inside;
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check("no Google button behind the wall", (await p.getByRole("link", { name: /Continue with Google/ }).count()) === 0);

  // The route itself, before any browser follows it: a refusal, and a relative
  // one. A redirect built from the server's own address moves the browser to
  // another host and drops every cookie it holds, the gate cookie included.
  const refusal = await fetch(`${BASE}/api/auth/google?next=%2Fdashboard`, { redirect: "manual" });
  check("google sign-in refuses", refusal.status === 303, String(refusal.status));
  check("and never leaves this origin", refusal.headers.get("location")?.startsWith("/login?error=google-unavailable") === true, refusal.headers.get("location"));

  // Checked signed out on purpose: the sign-in page sends anyone already signed
  // in straight on, notice and all, which is right but shows nothing.
  await p.goto(`${BASE}/api/auth/google?next=%2Fdashboard`, { waitUntil: "networkidle" });
  check("the browser lands back on sign-in", new URL(p.url()).pathname === "/login", p.url());
  check("told why", (await p.getByRole("alert").filter({ hasText: "google-unavailable" }).count()) === 1);
  check("with the wall still open", (await p.context().cookies()).some((c) => c.name === "oc_gate"));
}

section("7 sign-in is clickable and checks nothing");
{
  const { p } = inside;
  const email = `whoever${t}@example.com`;
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });

  await p.fill("#email", email);
  await p.fill("#password", "anything-at-all");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/welcome**", { timeout: 20000 });
  check("any address and any password goes in", p.url().includes("/welcome"), p.url());
  check("with a session", (await p.context().cookies()).some((c) => c.name === "oc_session"));

  await p.getByRole("button", { name: "Sign out" }).click();
  await p.waitForURL((url) => !url.pathname.startsWith("/welcome"), { timeout: 20000 });

  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("#password", "a-completely-different-password");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/welcome**", { timeout: 20000 });
  check("the same address again on a different password", p.url().includes("/welcome"), p.url());
  await p.screenshot({ path: `${SHOTS}/open-access.png`, fullPage: true });
}

section("8 being closed is impossible to miss");
{
  const { p } = inside;
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("banner on the page", (await p.getByText(/Not launched/).count()) > 0);
  check("it names the variable to unset", (await p.getByText(/SITE_PASSCODE/).count()) > 0);
  await p.goto(`${BASE}${SHARE}`, { waitUntil: "networkidle" });
  check("including on a casting link", (await p.getByText(/Not launched/).count()) > 0);
}

section("9 and it does not hand out admin");
{
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rows = await pool.query("SELECT role FROM users WHERE lower(email) = lower($1)", [
    `whoever${t}@example.com`,
  ]);
  check("a director, not an admin", rows.rows[0]?.role === "director", JSON.stringify(rows.rows[0]));
  await pool.end();
}

await inside.c.close();
await browser.close();
finish();
