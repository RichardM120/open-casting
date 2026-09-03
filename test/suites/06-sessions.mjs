/**
 * The casting call is what times a role and what an applicant submits into.
 * These checks are about that boundary: the window governs every role in the
 * casting call at once, and one person gets one submission per casting call.
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
  shareToken,
  day,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Session Co ${t}`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, { name: "Sam Dir", company: CO, email: `sd${t}@example.com`, role: "director" });

section("1 a role cannot be posted without a casting call");
await dir.p.goto(`${BASE}/dashboard/roles/new`, { waitUntil: "networkidle" });
check("the form is replaced by an explanation", (await dir.p.getByText("Open a casting call first").count()) > 0);
check("no role fields to fill in", (await dir.p.locator("#title").count()) === 0);
check("offers the way forward", (await dir.p.locator("main").getByRole("link", { name: "New casting call" }).count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/session-required.png`, fullPage: true });

section("2 opening a casting call, then posting two roles into it");
const live = await openSession(dir.p, { name: `Live ${t}`, company: CO, opensAt: at(-2), closesAt: at(20, "23:59") });
check("lands on the casting call page", dir.p.url().includes(live), dir.p.url());
check("confirms it is saved as a draft", (await dir.p.getByText(/saved as a draft/).count()) > 0);
check("says it is accepting submissions", (await dir.p.getByText(/Accepting submissions until/).count()) > 0);

const roleA = await postRole(dir.p, { title: `LEAD-${t}`, company: CO, sessionId: live });
const roleB = await postRole(dir.p, { title: `SUPPORT-${t}`, company: CO, sessionId: live });
await publish(dir.p, live);
const token = await shareTokenForRole(dir.p, roleA);
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("both roles listed under the casting call", (await dir.p.locator("main li").filter({ hasText: `-${t}` }).count()) === 2);
check("counts the roles", (await dir.p.getByText("2 roles").count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/session-detail.png`, fullPage: true });

section("2b the casting call hands over a link to circulate");
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("the link is shown in full", (await dir.p.locator("code.select-all").count()) === 1);
const shown = (await dir.p.locator("code.select-all").textContent()).trim();
check("it points at this casting call", shown.endsWith(`/c/${token}`), shown);
check("it is offered for copying", (await dir.p.getByRole("button", { name: "Copy link" }).count()) === 1);
check("and explained", (await dir.p.getByText(/whole of the casting call/).count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/share-link.png`, fullPage: true });

section("3 a role has no closing time of its own");
await dir.p.goto(`${BASE}/dashboard/roles/${roleA}/edit`, { waitUntil: "networkidle" });
check("no deadline field", (await dir.p.locator("#deadline").count()) === 0);
check("says where the times live", (await dir.p.getByText(/Change its times on the casting call, not here/).count()) > 0);

section("4 one submission per person per casting call, across roles");
{
  const { c, p } = await ctx();
  await submit(p, token, roleA, { name: "Perry One", email: `p1${t}@example.com` });
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("first submission goes through", true);
  check("says it covers the casting call", (await p.getByText(/any other role in it/).count()) > 0);

  await submit(p, token, roleB, { name: "Perry One", email: `p1${t}@example.com` });
  await p.waitForTimeout(2500);
  check("a second role in the same casting call is refused", (await p.getByText("Submission sent").count()) === 0);
  check("the error is on the email field", (await p.locator("#email-error").count()) === 1);
  check("and names the casting call", (await p.getByText(new RegExp(`already have a submission.*Live ${t}`)).count()) > 0);
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

section("6 a casting call that has not opened lists its roles but shows no form");
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
  check("still listed on its own casting call page", (await p.getByText(`LATER-${t}`).count()) > 0);
  check("with no way to submit yet", (await p.locator("#coverNote").count()) === 0);
  await c.close();
}

section("7 closing the casting call closes every role in it at once");
await dir.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Close early" }).click();
await dir.p.waitForTimeout(2500);
check("the casting call reads as closed", (await dir.p.getByText(/Closed early on/).count()) > 0);
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
  check("the other role in the casting call is unaffected", (await p.locator("#coverNote").count()) === 1);
  await c.close();
}
await dir.p.getByRole("button", { name: "Reopen" }).click();
await dir.p.waitForTimeout(2500);

section("9 casting calls are scoped like roles");
const other = await provision(browser, errors, admin.p, { name: "Other Dir", company: `Other ${t}`, email: `od${t}@example.com`, role: "director" });
await other.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("a stranger sees none of them", (await other.p.getByText(`Live ${t}`).count()) === 0);
check("a stranger's list is empty", (await other.p.getByText("No casting calls yet").count()) > 0);
const direct = await other.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("guessing the id is a 404", direct.status() === 404, String(direct.status()));

const prod = await provision(browser, errors, admin.p, { name: "Pat Prod", company: CO, email: `pp${t}@example.com`, role: "producer" });
await prod.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("a producer at the company sees them", (await prod.p.getByText(`Live ${t}`).count()) > 0);
check("including the upcoming one", (await prod.p.getByText(`Upcoming ${t}`).count()) > 0);

section("10 only an admin can remove a casting call");
check("no delete control for the director", (await dir.p.getByText("Remove this casting call").count()) === 0);

await admin.p.goto(`${BASE}/dashboard/sessions/${live}`, { waitUntil: "networkidle" });
check("the admin sees the casting call", (await admin.p.getByText(`Live ${t}`).count()) > 0);
await admin.p.getByText("Remove this casting call").click();
check("warns what goes with it", (await admin.p.getByText(/all 2 roles/).count()) > 0);
await admin.p.check('input[name="confirm"]');
await admin.p.getByRole("button", { name: "Remove casting call, roles and submissions" }).click();
await admin.p.waitForURL(/\/dashboard\?removed=1/, { timeout: 20000 });
check("says what happened", (await admin.p.getByText(/casting call was removed/).count()) > 0);
{
  const { c, p } = await ctx();
  const gone = await p.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
  check("its roles went with it", gone.status() === 404, String(gone.status()));
  await c.close();
}
check(
  "the removal is in the trail",
  (await admin.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" })) &&
    (await admin.p.getByText(/removed a casting call/).count()) > 0,
);

section("12 the date picker asks before it commits");
{
  await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
  const opener = dir.p.getByRole("button", { name: "Pick a date and time for Submissions open" });
  await opener.click();
  const dialog = dir.p.getByRole("dialog", { name: "Pick a date and time for Submissions open" });
  check("the picker opens", await dialog.isVisible());
  await dialog.getByRole("button", { name: /\b15 \w+ \d{4}$/ }).click();
  await dir.p.selectOption("#opensAt-hour", "10");
  await dir.p.selectOption("#opensAt-minute", "30");
  check("nothing reaches the field before Confirm", (await dir.p.inputValue("#opensAt")) === "");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  const picked = await dir.p.inputValue("#opensAt");
  check("Confirm commits the day and the time", /^\d{4}-\d{2}-15T10:30$/.test(picked), picked);
  check("and the field reads it back", (await dir.p.getByText(/^Set to /).count()) > 0);
  check("the picker closed", (await dir.p.getByRole("dialog").count()) === 0);

  await opener.click();
  await dir.p.getByRole("dialog").getByRole("button", { name: /\b20 \w+ \d{4}$/ }).click();
  await dir.p.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  check("Cancel leaves the field alone", (await dir.p.inputValue("#opensAt")) === picked);

  await opener.click();
  await dir.p.keyboard.press("Escape");
  check("Escape closes it", (await dir.p.getByRole("dialog").count()) === 0);
  check("with the field unchanged", (await dir.p.inputValue("#opensAt")) === picked);

  await dir.p.getByRole("button", { name: "Pick a date for Production finishes" }).click();
  await dir.p.getByRole("dialog").getByRole("button", { name: /\b20 \w+ \d{4}$/ }).click();
  await dir.p.screenshot({ path: `${SHOTS}/date-picker.png`, fullPage: true });
  await dir.p.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  const date = await dir.p.inputValue("#productionEndsAt");
  check("a date-only field takes a date", /^\d{4}-\d{2}-20$/.test(date), date);
  check("typing into the field still works", await dir.p.fill("#opensAt", at(3, "12:00")).then(async () => (await dir.p.inputValue("#opensAt")) === at(3, "12:00")));
}

section("13 a draft can be left and picked up again");
{
  const draft = await openSession(dir.p, { name: `Draft ${t}`, company: CO, opensAt: at(5), closesAt: at(40, "23:59") });
  check("the new call says it is saved as a draft", (await dir.p.getByText("saved as a draft").count()) > 0);
  await dir.p.getByRole("link", { name: "Save and finish later" }).click();
  await dir.p.waitForURL(/\/dashboard\?draft=1/, { timeout: 20000 });
  check("the list says it is saved", (await dir.p.getByText("Saved as a draft.").count()) > 0);
  const back = dir.p.locator(`li:has(a[href="/dashboard/sessions/${draft}"])`).getByRole("link", { name: "Continue setting up" });
  check("the draft offers a way back", (await back.count()) === 1);
  await back.click();
  await dir.p.waitForURL(new RegExp(`/dashboard/sessions/${draft}`), { timeout: 20000 });
  check("back on the draft, still unpublished", (await dir.p.locator("main").getByText("Not published yet").count()) > 0);
  check("with the wizard where it was left", (await dir.p.locator('[aria-current="step"]').innerText()).includes("Post the roles"));
  check("and the step numbered", (await dir.p.locator('[aria-current="step"]').innerText()).includes("2"));
  check("the steps link to their pages", (await dir.p.locator('nav[aria-label="Setting up the casting call"] ol a').count()) === 4);
  check("and the way on is a link", (await dir.p.locator('nav[aria-label="Setting up the casting call"] a', { hasText: "Next: Publish" }).count()) === 1);
  check("marked in progress", (await dir.p.locator("main").getByText("In progress").count()) > 0);

  // The list is a traffic light: a live call in green comes first, and a call
  // still being set up comes last with no ground of its own. The live call
  // from section 2 was removed in section 10, so a fresh one is opened here.
  const green = await openSession(dir.p, { name: `Green ${t}`, company: CO, opensAt: at(-1), closesAt: at(20, "23:59") });
  await postRole(dir.p, { title: `GREEN-${t}`, company: CO, sessionId: green });
  await publish(dir.p, green);
  await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const liveCard = dir.p.locator(`li[data-state]:has(a[href="/dashboard/sessions/${green}"])`).first();
  const draftCard = dir.p.locator(`li[data-state]:has(a[href="/dashboard/sessions/${draft}"])`).first();
  check("the live call is marked live", (await liveCard.getAttribute("data-state")) === "live" && (await liveCard.getByText("Live", { exact: true }).count()) > 0);
  check("the new call is in progress", (await draftCard.getAttribute("data-state")) === "draft" && (await draftCard.getByText("In progress", { exact: true }).count()) > 0);
  check("live sits above in progress", (await liveCard.boundingBox()).y < (await draftCard.boundingBox()).y);
  check("no header image field without a store", (await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" })) && (await dir.p.locator("#hero").count()) === 0);
}

section("14 the director chooses what applicants must send");
{
  const call = await openSession(dir.p, { name: `Asks ${t}`, company: CO, opensAt: at(-1), closesAt: at(20, "23:59") });
  await dir.p.goto(`${BASE}/dashboard/roles/new?session=${call}`, { waitUntil: "networkidle" });
  check("each ask offers required, optional or not asked", (await dir.p.locator('input[name="ask_phone"]').count()) === 3);
  check("height and residency start not asked", await dir.p.locator('input[name="ask_height"][value="off"]').isChecked() && await dir.p.locator('input[name="ask_residency"][value="off"]').isChecked());
  check("phone starts required", await dir.p.locator('input[name="ask_phone"][value="required"]').isChecked());
  check("the showreel starts optional", await dir.p.locator('input[name="ask_reelUrl"][value="optional"]').isChecked());
  check("no photo or video to ask for without a store", (await dir.p.locator('input[name="ask_photo"]').count()) === 0);
  check("the post button stays quiet until the form is complete", (await dir.p.getByRole("button", { name: "Post the role" }).getAttribute("data-ready")) === "false");
  await dir.p.selectOption("#sessionId", call);
  await dir.p.fill("#title", `Asks role ${t}`);
  await dir.p.fill("#characterBrief", "A character brief comfortably long enough to pass validation.");
  await dir.p.fill("#location", "Leeds, UK");
  await dir.p.fill("#shootStartsAt", day(120));
  check("and lights up once it is", await dir.p.locator('button[data-ready="true"]', { hasText: "Post the role" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await dir.p.locator('label:has(input[name="ask_phone"][value="off"])').click();
  await dir.p.locator('label:has(input[name="ask_coverNote"][value="optional"])').click();
  await dir.p.locator('label:has(input[name="ask_reelUrl"][value="required"])').click();
  await dir.p.locator('label:has(input[name="ask_height"][value="required"])').click();
  await dir.p.locator('label:has(input[name="ask_residency"][value="optional"])').click();
  await dir.p.getByRole("button", { name: "Post the role" }).click();
  await dir.p.waitForURL(/\/dashboard\/roles\/rol_/, { timeout: 20000 });
  const roleId = dir.p.url().match(/roles\/(rol_[^?]+)/)[1];
  await dir.p.goto(`${BASE}/dashboard/roles/${roleId}/edit`, { waitUntil: "networkidle" });
  check("the choice is kept on the role", await dir.p.locator('input[name="ask_phone"][value="off"]').isChecked() && await dir.p.locator('input[name="ask_reelUrl"][value="required"]').isChecked() && await dir.p.locator('input[name="ask_height"][value="required"]').isChecked());
  check("the role is paid unless said otherwise", await dir.p.locator('input[name="paid"]').isChecked());
  await publish(dir.p, call);
  const token = await shareToken(dir.p, call);

  const applicant = await session(browser, errors);
  const p = applicant.p;
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("no phone field: the role does not ask", (await p.locator("#phone").count()) === 0);
  check("the cover note is marked optional", (await p.locator('label[for="coverNote"]').innerText()).toLowerCase().includes("optional"));
  check("the showreel link is now marked required", (await p.locator('label[for="reelUrl"]').innerText()).includes("*"));
  check("height is asked for, and required", (await p.locator('label[for="height"]').innerText()).includes("*"));
  check("residency is asked for, optional", (await p.locator('label[for="residency"]').innerText()).toLowerCase().includes("optional"));
  check("the shoot dates ask for a yes", (await p.locator("#available").count()) === 1);
  await p.selectOption("#age", "30");
  await p.fill("#name", `Asks Applicant ${t}`);
  await p.fill("#email", `asks${t}@example.com`);
  await p.fill("#location", "Leeds");
  await p.fill("#height", "5ft 8");
  await p.selectOption("#residency", "United Kingdom");
  await p.check("#acceptSubmissionTerms");
  check("not ready without the showreel it requires", (await p.getByRole("button", { name: "Send submission" }).getAttribute("data-ready")) === "false");
  await p.fill("#reelUrl", "https://vimeo.com/123456");
  check("nor without the yes to the dates", (await p.getByRole("button", { name: "Send submission" }).getAttribute("data-ready")) === "false");
  await p.check("#available");
  check("ready once it has both", await p.locator('button[data-ready="true"]', { hasText: "Send submission" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("accepted without a phone number or a cover note", (await p.getByText("Submission sent").count()) > 0);
  await applicant.c.close();

  await dir.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
  const card = dir.p.locator('li:has(select[aria-label="Submission status"])').first();
  const text = await card.innerText();
  check("the card reads without them, with the height both ways", text.includes("Leeds · resident in United Kingdom · 173 cm (5ft 8) · 30 · submitted") && (await card.locator("a[href^='mailto:']").count()) === 1, text.split("\n").slice(0, 4).join(" | "));
  check("and says they are free for the dates", text.includes("Available for the shoot dates"));
}

section("15 a casting call can send represented actors elsewhere");
{
  const call = await openSession(dir.p, { name: `Agents ${t}`, company: CO, opensAt: at(-1), closesAt: at(20, "23:59") });
  const roleId = await postRole(dir.p, { sessionId: call, title: `Agents role ${t}`, company: CO });
  await dir.p.goto(`${BASE}/dashboard/sessions/${call}/edit`, { waitUntil: "networkidle" });
  check("the inclusive statement starts with the default wording", (await dir.p.inputValue("#inclusionStatement")).includes("open to applicants of every background"));
  await dir.p.fill("#inclusionStatement", "We are casting inclusively and welcome everyone who fits the brief.");
  await dir.p.fill("#agentRoute", "Represented UK actors: please apply through your agent rather than this form.");
  await dir.p.getByRole("button", { name: "Save changes" }).click();
  await dir.p.waitForURL(/saved=1/, { timeout: 20000 });
  await publish(dir.p, call);
  const token = await shareToken(dir.p, call);

  const applicant = await session(browser, errors);
  const p = applicant.p;
  await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("the edited statement is what applicants read", (await p.getByText("We are casting inclusively and welcome everyone who fits the brief.").count()) > 0);
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("the form is behind one question", (await p.getByText("Do you have an agent?").count()) > 0 && (await p.locator("#name").count()) === 0);
  await p.getByRole("button", { name: "Yes, I have an agent" }).click();
  check("a represented actor is sent to their agent, with nothing taken", (await p.getByText("apply through your agent").count()) > 0 && (await p.locator("#name").count()) === 0);
  await p.getByRole("button", { name: "I am not represented after all" }).click();
  check("and can come back to the form", (await p.locator("#name").count()) === 1);
  await applicant.c.close();
}

for (const s of [dir, other, prod, admin]) await s.c.close();
await browser.close();
finish();
