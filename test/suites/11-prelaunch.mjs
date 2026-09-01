/**
 * The two pre-launch switches: one door for the whole site, and a sign-in
 * behind it that lets anything through.
 *
 * Both are dangerous if forgotten, so what is checked here is as much that they
 * announce themselves as that they work.
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

section("1 every page sends a signed-out visitor to the one door");
{
  const { c, p } = await ctx();
  for (const path of ["/", "/faq", "/faq/performers", "/dashboard", "/dashboard/sessions"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path} -> /login`, p.url().includes("/login"), p.url());
  }
  check("and it remembers where you were headed", p.url().includes("next="), p.url());
  await c.close();
}

section("2 a casting link still opens without one");
{
  const { c, p } = await ctx();
  const response = await p.goto(`${BASE}/c/saltmarsh-4f21c9ba7e`, { waitUntil: "networkidle" });
  check("the share link is not behind the door", response.status() === 200, String(response.status()));
  check("performers see the production", (await p.getByRole("heading", { name: "Saltmarsh" }).count()) > 0);
  await c.close();
}

section("3 health answers regardless, and reports both switches");
{
  const response = await fetch(`${BASE}/api/health`);
  const body = await response.json();
  check("readable", typeof body.ok === "boolean", JSON.stringify(body));
  check("says the site is closed", body.site.startsWith("closed until launch"), JSON.stringify(body.site));
  check("names the shared password arrangement", body.site.includes("shared password"), JSON.stringify(body.site));
}

section("4 search engines are told off at every layer");
{
  const { c, p } = await ctx();
  const robots = await p.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle" });
  check("robots.txt disallows everything", (await robots.text()).includes("Disallow: /"));
  const page = await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check(
    "every response carries X-Robots-Tag",
    (page.headers()["x-robots-tag"] ?? "").includes("noindex"),
    page.headers()["x-robots-tag"],
  );
  await c.close();
}

section("5 the shared password gets you through, and nothing else does");
const inside = await ctx();
await inside.p.goto(`${BASE}/dashboard/sessions`, { waitUntil: "networkidle" });
check("bounced to sign in", inside.p.url().includes("/login"), inside.p.url());
await inside.p.fill("#email", `whoever${t}@example.com`);
await inside.p.fill("#password", "not-the-shared-password");
await inside.p.getByRole("button", { name: "Sign in" }).click();
await inside.p.waitForTimeout(2000);
check("a wrong password is refused", (await inside.p.getByText(/do not match an account/).count()) > 0);

await inside.p.fill("#email", `whoever${t}@example.com`);
await inside.p.fill("#password", process.env.SITE_PASSWORD ?? "test-site-password");
await inside.p.getByRole("button", { name: "Sign in" }).click();
await inside.p.waitForURL("**/welcome**", { timeout: 20000 });
check("the shared password lets any address in", inside.p.url().includes("/welcome"), inside.p.url());
check("with a session", (await inside.p.context().cookies()).some((c) => c.name === "oc_session"));
await inside.p.screenshot({ path: `${SHOTS}/open-access.png`, fullPage: true });

section("6 being closed is impossible to miss");
check("banner on the page", (await inside.p.getByText(/Not launched/).count()) > 0);
await inside.p.goto(`${BASE}/c/saltmarsh-4f21c9ba7e`, { waitUntil: "networkidle" });
check("including on a casting link", (await inside.p.getByText(/Not launched/).count()) > 0);

section("7 and it does not hand out admin");
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
