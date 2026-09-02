/**
 * The production is what times a role and what an applicant submits into.
 * These checks are about that boundary: the window governs every role in the
 * production at once, and one person gets one submission per production.
 */
import {
  BASE,
  SHOTS,
  at,
  launch,
  openSession,
  publish,
  postRole,
  reporter,
  session,
  adminSession,
  provision,
  shareTokenForRole,
  submit,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Session Co ${t}`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, { name: "Sam Dir", company: CO, email: `sd${t}@example.com`, role: "director" });

section("1 a role cannot be posted without a production");
await dir.p.goto(`${BASE}/dashboard/roles/new`, { waitUntil: "networkidle" });
check("the form is replaced by an explanation", (await dir.p.getByText("Open a production first").count()) > 0);
check("no role fields to fill in", (await dir.p.locator("#title").count()) === 0);
check("offers the way forward", (await dir.p.locator("main").getByRole("link", { name: "New production" }).count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/session-required.png`, fullPage: true });

section("2 opening a production, then posting two roles into it");
const live = await openSession(dir.p, { name: `Live ${t}`, company: CO, opensAt: at(-2), closesAt: at(20, "23:59") });
check("lands on the production page", dir.p.url().includes(live), dir.p.url());
check("confirms it opened", (await dir.p.getByText(/Production opened/).count()) > 0);
check("says it is accepting submissions", (await dir.p.getByText(/Accepting submissions until/).count()) > 0);

const roleA = await postRole(dir.p, { title: `LEAD-${t}`, company: CO, sessionId: live });
const roleB = await postRole(dir.p, { title: `SUPPORT-${t}`, company: CO, sessionId: live });
await publish(dir.p, live);
const token = await shareTokenForRole(dir.p, roleA);
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("both roles listed under the production", (await dir.p.locator("main li").filter({ hasText: `-${t}` }).count()) === 2);
check("counts the roles", (await dir.p.getByText("2 roles").count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/session-detail.png`, fullPage: true });

section("2b the production hands over a link to circulate");
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("the link is shown in full", (await dir.p.locator("code.select-all").count()) === 1);
const shown = (await dir.p.locator("code.select-all").textContent()).trim();
check("it points at this production", shown.endsWith(`/c/${token}`), shown);
check("it is offered for copying", (await dir.p.getByRole("button", { name: "Copy link" }).count()) === 1);
check("and explained", (await dir.p.getByText(/whole of the casting call/).count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/share-link.png`, fullPage: true });

section("3 a role has no closing time of its own");
await dir.p.goto(`${BASE}/dashboard/roles/${roleA}/edit`, { waitUntil: "networkidle" });
check("no deadline field", (await dir.p.locator("#deadline").count()) === 0);
check("says where the times live", (await dir.p.getByText(/Change its times on the production, not here/).count()) > 0);

section("4 one submission per person per production, across roles");
{
  const { c, p } = await ctx();
  await submit(p, token, roleA, { name: "Perry One", email: `p1${t}@example.com` });
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("first submission goes through", true);
  check("says it covers the production", (await p.getByText(/any other role in it/).count()) > 0);

  await submit(p, token, roleB, { name: "Perry One", email: `p1${t}@example.com` });
  await p.waitForTimeout(2500);
  check("a second role in the same production is refused", (await p.getByText("Submission sent").count()) === 0);
  check("the error is on the email field", (await p.locator("#email-error").count()) === 1);
  check("and names the production", (await p.getByText(new RegExp(`already have a submission.*Live ${t}`)).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/session-duplicate.png`, fullPage: true });
  await c.close();
}

section("5 a different person may still submit for the same role");
{
  const { c, p } = await ctx();
  await submit(p, token, roleB, { name: "Perry Two", email: `p2${t}@example.com` });
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("second applicant is fine", true);
  await c.close();
}

section("6 a production that has not opened lists its roles but shows no form");
const upcoming = await openSession(dir.p, {
  name: `Upcoming ${t}`,
  company: CO,
  opensAt: at(5),
  closesAt: at(40, "23:59"),
});
const laterRole = await postRole(dir.p, { title: `LATER-${t}`, company: CO, sessionId: upcoming });
await publish(dir.p, upcoming);
const laterToken = await shareTokenForRole(dir.p, laterRole);
{
  const { c, p } = await ctx();
  const response = await p.goto(`${BASE}/c/${laterToken}/${laterRole}`, { waitUntil: "networkidle" });
  check("the role page opens on its link", response.status() === 200);
  check("no submission form", (await p.locator("#coverNote").count()) === 0);
  check("says it has not opened", (await p.getByText("Submissions have not opened yet").count()) > 0);
  check("gives the opening time", (await p.getByText(/takes submissions from/).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/session-upcoming.png`, fullPage: true });

  await p.goto(`${BASE}/c/${laterToken}`, { waitUntil: "networkidle" });
  check("still listed on its own production page", (await p.getByText(`LATER-${t}`).count()) > 0);
  check("with no way to submit yet", (await p.locator("#coverNote").count()) === 0);
  await c.close();
}

section("7 closing the production closes every role in it at once");
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Close early" }).click();
await dir.p.waitForTimeout(2500);
check("the production reads as closed", (await dir.p.getByText(/Closed early on/).count()) > 0);
{
  const { c, p } = await ctx();
  for (const [label, id] of [["first", roleA], ["second", roleB]]) {
    await p.goto(`${BASE}/c/${token}/${id}`, { waitUntil: "networkidle" });
    check(`${label} role stops taking submissions`, (await p.locator("#coverNote").count()) === 0);
    check(`${label} role says casting is closed`, (await p.getByText("Submissions have closed").count()) > 0);
  }
  await c.close();
}

section("8 reopening puts them both back");
await dir.p.getByRole("button", { name: "Reopen" }).click();
await dir.p.waitForTimeout(2500);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
  check("the form is back", (await p.locator("#coverNote").count()) === 1);
  await c.close();
}

section("8b closing one role early leaves its siblings open");
await dir.p.goto(`${BASE}/dashboard/roles/${roleA}`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Close early" }).click();
await dir.p.waitForTimeout(2500);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
  check("the closed role takes no submissions", (await p.locator("#coverNote").count()) === 0);
  await p.goto(`${BASE}/c/${token}/${roleB}`, { waitUntil: "networkidle" });
  check("the other role in the production is unaffected", (await p.locator("#coverNote").count()) === 1);
  await c.close();
}
await dir.p.getByRole("button", { name: "Reopen" }).click();
await dir.p.waitForTimeout(2500);

section("9 productions are scoped like roles");
const other = await provision(browser, errors, admin.p, { name: "Other Dir", company: `Other ${t}`, email: `od${t}@example.com`, role: "director" });
await other.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("a stranger sees none of them", (await other.p.getByText(`Live ${t}`).count()) === 0);
check("a stranger's list is empty", (await other.p.getByText("No productions yet").count()) > 0);
const direct = await other.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("guessing the id is a 404", direct.status() === 404, String(direct.status()));

const prod = await provision(browser, errors, admin.p, { name: "Pat Prod", company: CO, email: `pp${t}@example.com`, role: "producer" });
await prod.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("a producer at the company sees them", (await prod.p.getByText(`Live ${t}`).count()) > 0);
check("including the upcoming one", (await prod.p.getByText(`Upcoming ${t}`).count()) > 0);

section("10 only an admin can remove a production");
check("no delete control for the director", (await dir.p.getByText("Remove this production").count()) === 0);

await admin.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("the admin sees the production", (await admin.p.getByText(`Live ${t}`).count()) > 0);
await admin.p.getByText("Remove this production").click();
check("warns what goes with it", (await admin.p.getByText(/all 2 roles/).count()) > 0);
await admin.p.check('input[name="confirm"]');
await admin.p.getByRole("button", { name: "Remove production, roles and submissions" }).click();
await admin.p.waitForURL(/\/dashboard\?removed=1/, { timeout: 20000 });
check("says what happened", (await admin.p.getByText(/production was removed/).count()) > 0);
{
  const { c, p } = await ctx();
  const gone = await p.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
  check("its roles went with it", gone.status() === 404, String(gone.status()));
  await c.close();
}
check(
  "the removal is in the trail",
  (await admin.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" })) &&
    (await admin.p.getByText(/removed a production/).count()) > 0,
);

for (const s of [dir, other, prod, admin]) await s.c.close();
await browser.close();
finish();
