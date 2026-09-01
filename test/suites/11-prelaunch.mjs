/**
 * The two pre-launch switches: the gate that keeps the public out entirely, and
 * open access, which removes the sign-in check behind it.
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

const PASSCODE = process.env.SITE_PASSCODE ?? "test-passcode";

section("1 nothing is reachable without the passcode");
{
  const { c, p } = await ctx();
  for (const path of ["/", "/login", "/faq", "/c/demo-saltmarsh-4f21c9ba7e", "/dashboard"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path} is gated`, p.url().includes("/gate"), p.url());
  }
  check("says it is not open yet", (await p.getByText("Not open yet").count()) > 0);
  check("and tells a performer to keep their link", (await p.getByText(/Keep the link/).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/gate.png`, fullPage: true });
  await c.close();
}

section("2 the health endpoint still answers, because that is its job");
{
  const response = await fetch(`${BASE}/api/health`);
  const body = await response.json();
  check("readable through the gate", typeof body.ok === "boolean", JSON.stringify(body));
  check("and reports the gate is closed", body.gate === "closed", JSON.stringify(body.gate));
  check("and that open access is on", body.openAccess.startsWith("ON"), JSON.stringify(body.openAccess));
}

section("3 search engines are told off at every layer");
{
  const { c, p } = await ctx();
  const robots = await p.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle" });
  check("robots.txt disallows everything", (await robots.text()).includes("Disallow: /"));

  const gated = await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check(
    "and every response carries X-Robots-Tag",
    (gated.headers()["x-robots-tag"] ?? "").includes("noindex"),
    gated.headers()["x-robots-tag"],
  );
  await c.close();
}

section("4 a wrong passcode does not open it");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/gate`, { waitUntil: "networkidle" });
  await p.fill("#passcode", "not-the-passcode");
  await p.getByRole("button", { name: "Enter" }).click();
  await p.waitForTimeout(1500);
  check("refused", (await p.getByText(/not right/).count()) > 0);
  check("and still gated", (await p.goto(`${BASE}/`, { waitUntil: "networkidle" })) && p.url().includes("/gate"));
  await c.close();
}

section("5 the right passcode opens it, and it stays open");
const inside = await ctx();
await inside.p.goto(`${BASE}/gate?next=%2Flogin`, { waitUntil: "networkidle" });
await inside.p.fill("#passcode", PASSCODE);
await inside.p.getByRole("button", { name: "Enter" }).click();
await inside.p.waitForURL("**/login**", { timeout: 20000 });
check("lands where it was headed", inside.p.url().includes("/login"), inside.p.url());
check("the site works from then on", (await inside.p.goto(`${BASE}/faq`, { waitUntil: "networkidle" })).status() === 200);

section("6 open access is impossible to miss");
check("the banner is on the page", (await inside.p.getByText(/Open access is on/).count()) > 0);
await inside.p.goto(`${BASE}/c/demo-saltmarsh-4f21c9ba7e`, { waitUntil: "networkidle" });
check("including on a casting link", (await inside.p.getByText(/Open access is on/).count()) > 0);

section("7 any email and any password signs in");
await inside.p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await inside.p.fill("#email", `whoever${t}@example.com`);
await inside.p.fill("#password", "not-a-real-password");
await inside.p.getByRole("button", { name: "Sign in" }).click();
await inside.p.waitForURL("**/welcome**", { timeout: 20000 });
check("straight in, on an account that did not exist", inside.p.url().includes("/welcome"), inside.p.url());
check("with a session", (await inside.p.context().cookies()).some((c) => c.name === "oc_session"));
await inside.p.screenshot({ path: `${SHOTS}/open-access.png`, fullPage: true });

section("8 and it does not hand out admin");
{
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rows = await pool.query("SELECT role FROM users WHERE lower(email) = lower($1)", [
    `whoever${t}@example.com`,
  ]);
  check("the account is a director, not an admin", rows.rows[0]?.role === "director", JSON.stringify(rows.rows[0]));
  await pool.end();
}

await inside.c.close();
await browser.close();
finish();
