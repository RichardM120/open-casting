/**
 * The journey end to end: the administrator sells an arrangement, the casting
 * director works inside it, publishes when ready, and the applicants' details
 * are destroyed on a schedule once the call is over.
 */
import {
  BASE,
  SHOTS,
  adminSession,
  at,
  day,
  launch,
  openSession,
  postRole,
  provision,
  publish,
  reporter,
  session,
  signIn,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Lifecycle Co ${t}`;

const admin = await adminSession(browser, errors);

section("1 the administrator sets what the arrangement covers");
const dir = await provision(browser, errors, admin.p, {
  name: "Cass Dir",
  company: CO,
  email: `lc${t}@example.com`,
  role: "director",
  maxSessions: 2,
  maxRolesPerSession: 2,
});
await admin.p.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" });
check("the allowance is shown against the client",
  (await admin.p.getByText(/0 of 2 productions/).count()) > 0);
await admin.p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" });
check("and the account points at its client",
  (await admin.p.getByText(/What they may run comes from their client/).count()) > 0);
await admin.p.screenshot({ path: `${SHOTS}/accounts.png`, fullPage: true });

section("2 a new production is a draft, and its link opens for nobody");
const first = await openSession(dir.p, { name: `Draft ${t}`, company: CO, opensAt: at(0), closesAt: at(30, "23:59") });
check("marked not published", (await dir.p.getByText("Not published yet").count()) > 0);
check("publishing is blocked with no roles", await dir.p.getByRole("button", { name: "Publish this casting call" }).isDisabled());
check("no share link yet", (await dir.p.locator("code.select-all").count()) === 0);

const token = await dir.p
  .getByRole("link", { name: "Preview as an applicant" })
  .getAttribute("href")
  .then((href) => href.split("/c/")[1]);

{
  const { c, p } = await ctx();
  check("a stranger gets a 404 on the draft", (await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" })).status() === 404);
  await c.close();
}
check("but the owner can preview it", (await dir.p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" })).status() === 200);
check("clearly marked a draft", (await dir.p.getByText("Draft preview").count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/draft-preview.png`, fullPage: true });

section("3 roles are capped by the arrangement");
await postRole(dir.p, { title: `ONE-${t}`, company: CO, sessionId: first });
await postRole(dir.p, { title: `TWO-${t}`, company: CO, sessionId: first });
await dir.p.goto(`${BASE}/dashboard/roles/new?session=${first}`, { waitUntil: "networkidle" });
await dir.p.selectOption("#sessionId", first);
await dir.p.fill("#title", `THREE-${t}`);
await dir.p.fill("#characterBrief", "A character brief comfortably long enough to pass validation.");
await dir.p.fill("#location", "Leeds"); await dir.p.fill("#shootDates", "Mar 2027");
await dir.p.fill("#rate", "£400/day");
await dir.p.getByRole("button", { name: "Post the role" }).click();
await dir.p.waitForTimeout(2500);
check("a third role is refused", (await dir.p.getByText(/2 roles per production/).count()) > 0);
check("and it says who can lift it", (await dir.p.getByText(/Ask the administrator/).count()) > 0);

section("4 publishing is what makes the link work");
await publish(dir.p, first);
check("says it is published", (await dir.p.getByText(/The link below is live/).count()) > 0);
check("the link is now shown", (await dir.p.locator("code.select-all").count()) === 1);
{
  const { c, p } = await ctx();
  const opened = await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("a stranger can open it now", opened.status() === 200);
  check("no draft banner", (await p.getByText("Draft preview").count()) === 0);
  check("both roles are there", (await p.getByText(`ONE-${t}`).count()) > 0 && (await p.getByText(`TWO-${t}`).count()) > 0);
  await c.close();
}

section("4b an applicant submits through the link");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  await p.getByText(`ONE-${t}`).click();
  await p.waitForURL(/\/c\/[^/]+\/[^/]+$/, { timeout: 20000 });
  await p.fill("#name", "Perry Former"); await p.fill("#email", `pf${t}@example.com`);
  await p.fill("#phone", "07700 900777"); await p.fill("#location", "Leeds"); await p.fill("#age", "30");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.check("#acceptSubmissionTerms");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("the submission goes through", true);
  await c.close();
}
await dir.p.goto(`${BASE}/dashboard/sessions/${first}`, { waitUntil: "networkidle" });
check("the casting director sees it", (await dir.p.getByText("1 submission").count()) > 0);

section("5 productions are capped too");
const second = await openSession(dir.p, { name: `Second ${t}`, company: CO, opensAt: at(0), closesAt: at(20, "23:59") });
check("the second is allowed", second.startsWith("ses_"));
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("the allowance is stated", (await dir.p.getByText(/covers 2 productions/).count()) > 0);
check("and the way to open another is withdrawn", (await dir.p.locator("main").getByRole("link", { name: "New production" }).count()) === 0);
check("with a reason given", (await dir.p.getByText(/used them all/).count()) > 0);

section("6 the retention promise is stated where it matters");
await dir.p.goto(`${BASE}/dashboard/sessions/${first}`, { waitUntil: "networkidle" });
check("names the date the details go", (await dir.p.getByText(/destroyed 30 days later/).count()) > 0);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/faq/applicants`, { waitUntil: "networkidle" });
  check("and applicants are told the same", (await p.getByText(/Thirty days after the production finishes/).count()) > 0);
  await c.close();
}

section("7 the administrator can change the arrangement afterwards");
await admin.p.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" });
await admin.p.locator("#main").getByText(CO, { exact: true }).click();
await admin.p.waitForURL(/\/admin\/clients\/cl_/, { timeout: 20000 });
const clientUrl = admin.p.url().split("?")[0];
await admin.p.fill("#maxSessions", "5");
await admin.p.getByRole("button", { name: "Save the client" }).click();
await admin.p.waitForURL(/saved=1/, { timeout: 20000 });
check("the change is confirmed", (await admin.p.getByText(/The client was saved/).count()) > 0);
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("the director can open one again", (await dir.p.locator("main").getByRole("link", { name: "New production" }).count()) > 0);

section("8 a client can be given an end date");
await admin.p.goto(clientUrl, { waitUntil: "networkidle" });
await admin.p.fill("#accessUntil", day(-1));
await admin.p.getByRole("button", { name: "Save the client" }).click();
await admin.p.waitForURL(/saved=1/, { timeout: 20000 });
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("an expired account is signed out", dir.p.url().includes("/login"), dir.p.url());
{
  const { c, p } = await ctx();
  await signIn(p, `lc${t}@example.com`, dir.password);
  check("and cannot sign back in", (await p.getByText(/Access to this account ended/).count()) > 0);
  await c.close();
}

section("9 the roles it published stay up for the people holding the link");
{
  const { c, p } = await ctx();
  check("the call still opens", (await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" })).status() === 200);
  await c.close();
}

section("10 six months on, the applicants' details are destroyed");
{
  // Back-date the closing time rather than waiting six months for it.
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE sessions_casting
        SET production_ends_at = (now() AT TIME ZONE 'utc')::date - interval '45 days',
            closes_at = (now() AT TIME ZONE 'utc')::date - interval '60 days'
      WHERE id = $1`,
    [first],
  );

  const before = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE session_id = $1", [first]);
  check("the submission is there to begin with", before.rows[0].n === 1, JSON.stringify(before.rows[0]));

  const refused = await fetch(`${BASE}/api/retention`, { method: "POST" });
  check("the sweep refuses an unauthorised call", refused.status === 401, String(refused.status));

  const response = await fetch(`${BASE}/api/retention`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await response.json();
  check("the sweep runs", response.status === 200 && body.ok, JSON.stringify(body));
  check("and reports what it destroyed", body.submissions >= 1, JSON.stringify(body));

  const after = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE session_id = $1", [first]);
  check("the personal data is gone", after.rows[0].n === 0, JSON.stringify(after.rows[0]));

  const kept = await pool.query("SELECT count(*)::int AS n FROM roles WHERE session_id = $1", [first]);
  check("the production and its roles are kept", kept.rows[0].n === 2, JSON.stringify(kept.rows[0]));

  const marked = await pool.query("SELECT purged_at FROM sessions_casting WHERE id = $1", [first]);
  check("the production records that it happened", marked.rows[0].purged_at !== null);
  await pool.end();
}

await admin.p.goto(`${BASE}/dashboard/sessions/${first}`, { waitUntil: "networkidle" });
check(
  "and the dashboard says so rather than showing an empty list",
  (await admin.p.getByText(/details were removed on/).count()) > 0,
);

for (const s of [dir, admin]) await s.c.close();
await browser.close();
finish();
