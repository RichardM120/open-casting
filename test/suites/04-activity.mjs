import {
  BASE,
  SHOTS,
  launch,
  reporter,
  session,
  day,
  adminSession,
  provision,
  shareTokenForRole,
  openSession,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Act Co ${t}`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, { name: "Ada Dir", company: CO, email: `ad${t}@example.com`, role: "director" });
const sessionId = await openSession(dir.p, { name: `Act Session ${t}`, company: CO });
await dir.p.goto(`${BASE}/dashboard/roles/new`, { waitUntil: "networkidle" });
await dir.p.selectOption("#sessionId", sessionId);
await dir.p.fill("#production", "Act Prod"); await dir.p.fill("#synopsis", "Verifying the activity trail records what happens.");
await dir.p.fill("#castingDirector", "Ada Dir"); await dir.p.fill("#company", CO);
await dir.p.fill("#title", `ACT-${t}`);
await dir.p.fill("#characterBrief", "A character brief comfortably long enough to pass validation.");
await dir.p.fill("#location", "Leeds"); await dir.p.fill("#shootDates", "Apr 2027");
await dir.p.fill("#rate", "£300/day");
await dir.p.getByRole("button", { name: "Post the role" }).click();
await dir.p.waitForURL(/\/dashboard\/roles\/rol_/, { timeout: 20000 });
const id = dir.p.url().match(/roles\/(rol_[^?]+)/)[1];

section("1 posting is recorded");
check("role page shows it", (await dir.p.getByText(/Ada Dir.*posted/).count()) > 0);
await dir.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check(
  "opening the session is recorded too",
  (await dir.p.getByText(/Ada Dir opened a casting session/).count()) > 0,
);
await dir.p.goto(`${BASE}/dashboard/roles/${id}`, { waitUntil: "networkidle" });

section("2 an edit says what changed");
await dir.p.goto(`${BASE}/dashboard/roles/${id}/edit`, { waitUntil: "networkidle" });
await dir.p.fill("#rate", "£350/day"); await dir.p.fill("#shootDates", "May 2027");
await dir.p.getByRole("button", { name: "Save changes" }).click();
await dir.p.getByText("Changes saved").waitFor({ timeout: 20000 });
const trail = await dir.p.locator("main ol").last().textContent();
check("names the changed fields", trail.includes("rate") && trail.includes("shoot dates"), trail.slice(0, 160));

section("2b moving the session's dates is recorded against the session");
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}/edit`, { waitUntil: "networkidle" });
await dir.p.fill("#closesAt", day(45));
await dir.p.getByRole("button", { name: "Save changes" }).click();
await dir.p.waitForURL(/\/dashboard\/sessions\/ses_[^/]+\?saved=1/, { timeout: 20000 });
await dir.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check(
  "names the closing date",
  (await dir.p.getByText(/edited a casting session.*closing date/).count()) > 0,
);
await dir.p.goto(`${BASE}/dashboard/roles/${id}`, { waitUntil: "networkidle" });

section("3 a performer's submission is recorded");
const token = await shareTokenForRole(dir.p, id);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${id}`, { waitUntil: "networkidle" });
  await p.fill("#name", "Perry Former"); await p.fill("#email", `pf${t}@example.com`);
  await p.fill("#phone", "07700 900666"); await p.fill("#location", "Leeds"); await p.fill("#age", "29");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await c.close();
}
await dir.p.reload({ waitUntil: "networkidle" });
check("submission appears", (await dir.p.getByText(/Perry Former.*submitted for/).count()) > 0);

section("4 a status change is recorded with the name");
await dir.p.getByLabel("Submission status").first().selectOption("Shortlisted");
await dir.p.waitForTimeout(2500);
await dir.p.reload({ waitUntil: "networkidle" });
check("status change logged", (await dir.p.getByText(/Perry Former → Shortlisted/).count()) > 0);

section("5 closing and reopening");
await dir.p.getByRole("button", { name: "Close early" }).click();
await dir.p.waitForTimeout(2500);
check("close logged", (await dir.p.getByText(/Ada Dir.*closed/).count()) > 0);
await dir.p.getByRole("button", { name: "Reopen" }).click();
await dir.p.waitForTimeout(2500);
check("reopen logged", (await dir.p.getByText(/Ada Dir.*reopened/).count()) > 0);

section("6 the trail is scoped like everything else");
const other = await provision(browser, errors, admin.p, { name: "Other", company: `Other ${t}`, email: `ot${t}@example.com`, role: "director" });
await other.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("a stranger sees none of it", (await other.p.getByText(`ACT-${t}`).count()) === 0);
const prod = await provision(browser, errors, admin.p, { name: "Prod", company: CO, email: `pd${t}@example.com`, role: "producer" });
await prod.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("a producer at the company sees it", (await prod.p.getByText(`ACT-${t}`).count()) > 0);

section("7 account events are admin-only");
await admin.p.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" });
await admin.p.locator("main ul > li").filter({ hasText: `ot${t}@example.com` })
  .getByRole("button", { name: "Suspend" }).click();
await admin.p.waitForTimeout(2500);
await admin.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("admin sees the suspension", (await admin.p.getByText(/suspended/).count()) > 0);
await prod.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("a producer does not", (await prod.p.getByText(/suspended/).count()) === 0);

section("8 history survives the role being removed");
await admin.p.goto(`${BASE}/dashboard/roles/${id}`, { waitUntil: "networkidle" });
await admin.p.getByText("Remove this role").click();
await admin.p.check('input[name="confirm"]');
await admin.p.getByRole("button", { name: "Remove role and submissions" }).click();
await admin.p.waitForTimeout(3000);
await admin.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("removal is logged", (await admin.p.getByText(/removed/).count()) > 0);
check("the role's earlier history is still there", (await admin.p.getByText(`ACT-${t}`).count()) > 1);
check("the dead role is not a link", (await admin.p.locator(`a:has-text("ACT-${t}")`).count()) === 0);
await admin.p.screenshot({ path: `${SHOTS}/activity.png`, fullPage: true });

for (const s of [dir, other, prod, admin]) await s.c.close();
await browser.close();
finish();
