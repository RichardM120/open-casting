/**
 * The casting call is where a director reads what came in. The dashboard
 * shows only the call and its numbers; the call's own page lists every
 * submission across its roles; and that list leaves as a spreadsheet,
 * downloaded or emailed to the director's own address.
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

import {
  BASE,
  SHOTS,
  at,
  launch,
  openSession,
  postRole,
  publish,
  reporter,
  session,
  adminSession,
  provision,
  shareToken,
  submit,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Export Co ${t}`;
const email = `xd${t}@example.com`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, { name: "Xan Dir", company: CO, email, role: "director" });

section("1 a casting call with two roles and three submissions");
const sessionId = await openSession(dir.p, { name: `Export ${t}`, company: CO, opensAt: at(-1), closesAt: at(30, "23:59") });
const roleA = await postRole(dir.p, { sessionId, title: "Lead", company: CO });
const roleB = await postRole(dir.p, { sessionId, title: "Support", company: CO });
await publish(dir.p, sessionId);
const token = await shareToken(dir.p, sessionId);
for (const [role, who] of [[roleA, "Ada"], [roleA, "Ben"], [roleB, "Cal"]]) {
  const { c, p } = await ctx();
  await submit(p, token, role, { name: `${who} ${t}`, email: `${who.toLowerCase()}${t}@example.com` });
  await p.waitForTimeout(1500);
  await c.close();
}

section("2 the dashboard shows the call and its numbers, not the submissions");
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const card = dir.p.locator(`li:has(a[href="/dashboard/sessions/${sessionId}"])`).first();
check("the call is listed", (await card.count()) === 1);
check("three submitted", (await card.locator('[data-figure="submitted"]').innerText()) === "3");
check("three to review", (await card.locator('[data-figure="to-review"]').innerText()) === "3");
check("two roles", (await card.locator('[data-figure="roles"]').innerText()) === "2");
check("no applicant names on the card", (await card.getByText(`Ada ${t}`).count()) === 0);
check("no role links on the list", (await card.getByRole("link", { name: "Lead", exact: true }).count()) === 0);
await dir.p.screenshot({ path: `${SHOTS}/dashboard-figures.png`, fullPage: true });
// The status sits beside the name, and the whole card is the way in: a click on
// its figures, nowhere near the name, opens the call.
const nameBox = await card.getByRole("link", { name: `Export ${t}` }).boundingBox();
const badgeBox = await card.getByText(/^Live$/).boundingBox();
check("the status sits beside the name", nameBox !== null && badgeBox !== null && Math.abs(nameBox.y + nameBox.height / 2 - (badgeBox.y + badgeBox.height / 2)) < 8 && badgeBox.x > nameBox.x + nameBox.width, JSON.stringify({ nameBox, badgeBox }));
check("no Open button; the card itself opens", (await card.getByRole("link", { name: "Open", exact: true }).count()) === 0);
// A pointer click where the figures are, as a person would: the name's link
// stretches over the card, so the browser hands the click to it.
const figure = card.locator('[data-figure="roles"]');
await figure.scrollIntoViewIfNeeded();
const figureBox = await figure.boundingBox();
await dir.p.mouse.click(figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2);
await dir.p.waitForURL(new RegExp(`/dashboard/sessions/${sessionId}`), { timeout: 20000 });

section("3 the call's page lists every submission across its roles");
await dir.p.waitForLoadState("networkidle");
check("all three listed", (await dir.p.getByText(`Ada ${t}`).count()) > 0 && (await dir.p.getByText(`Ben ${t}`).count()) > 0 && (await dir.p.getByText(`Cal ${t}`).count()) > 0);
check("with their roles", (await dir.p.locator("table").getByRole("link", { name: "Support", exact: true }).count()) === 1);
check("and the count", (await dir.p.getByText("3 across 2 roles, 3 still to review.").count()) > 0);
await dir.p.locator("tr", { hasText: `Ada ${t}` }).getByLabel("Submission status").selectOption("Shortlisted");
await dir.p.waitForTimeout(2500);
check("a status change keeps you on the call's page", dir.p.url().includes(`/dashboard/sessions/${sessionId}`), dir.p.url());
await dir.p.reload({ waitUntil: "networkidle" });
check("and takes", (await dir.p.locator("tr", { hasText: `Ada ${t}` }).getByLabel("Submission status").inputValue()) === "Shortlisted");
await dir.p.getByRole("link", { name: /^Shortlisted · 1$/ }).click();
await dir.p.waitForURL(/status=Shortlisted/, { timeout: 20000 });
await dir.p.waitForLoadState("networkidle");
check("the filter narrows the list", (await dir.p.getByText(`Ada ${t}`).count()) > 0 && (await dir.p.getByText(`Ben ${t}`).count()) === 0);
await dir.p.screenshot({ path: `${SHOTS}/casting-call-submissions.png`, fullPage: true });
// The same page on a phone: the status control is the first thing in a row,
// and the mark and copy are a size up.
await dir.p.setViewportSize({ width: 390, height: 844 });
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
check("on a phone the status is the first cell of a row", (await dir.p.locator("table tbody tr").first().locator("td").first().getByLabel("Submission status").count()) === 1);
check("and the root type is larger", (await dir.p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))) >= 17);
await dir.p.screenshot({ path: `${SHOTS}/mobile-submissions.png`, fullPage: true });
// The dashboard on a phone: the four totals are two rows of two squares.
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const tiles = dir.p.locator("dl").first().locator(":scope > div");
const boxes = await Promise.all([0, 1, 2, 3].map((i) => tiles.nth(i).boundingBox()));
check("four totals", (await tiles.count()) === 4);
check("in two rows of two", boxes[0].y === boxes[1].y && boxes[2].y === boxes[3].y && boxes[2].y > boxes[0].y + boxes[0].height - 1, JSON.stringify(boxes));
check("and compact: the four take under 200px", boxes[3].y + boxes[3].height - boxes[0].y < 200, JSON.stringify(boxes));
await dir.p.screenshot({ path: `${SHOTS}/mobile-dashboard.png`, fullPage: true });
await dir.p.setViewportSize({ width: 1280, height: 800 });

section("4 the list downloads as a spreadsheet");
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
const [download] = await Promise.all([
  dir.p.waitForEvent("download", { timeout: 20000 }),
  dir.p.getByRole("link", { name: "Download spreadsheet" }).click(),
]);
const filename = download.suggestedFilename();
check("named after the call", filename.startsWith(`export-${t}-submissions-`) && filename.endsWith(".xlsx"), filename);
const body = readFileSync(await download.path());
check("served as a file", body.length > 1000 && body.subarray(0, 2).toString() === "PK", String(body.length));
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(body);
const sheet = workbook.getWorksheet("Submissions");
const rows = [];
sheet.eachRow((row, n) => { if (n > 1) rows.push({ role: String(row.getCell(1).value), name: String(row.getCell(2).value), status: String(row.getCell(3).value) }); });
check("every submission is a row", ["Ada", "Ben", "Cal"].every((who) => rows.some((row) => row.name === `${who} ${t}`)), JSON.stringify(rows));
check("with the role", rows.some((row) => row.name === `Cal ${t}` && row.role === "Support"));
check("and the status", rows.some((row) => row.name === `Ada ${t}` && row.status === "Shortlisted"));
check("the headings are in place", String(sheet.getRow(1).getCell(3).value) === "Status" && String(sheet.getRow(1).getCell(16).value) === "Cover note");
check("and the call is described on its own sheet", workbook.getWorksheet("Casting call") !== undefined);
{
  const other = await provision(browser, errors, admin.p, { name: "Ned Nosy", company: `Nosy ${t}`, email: `nn${t}@example.com`, role: "director" });
  const denied = await other.p.goto(`${BASE}/dashboard/sessions/${sessionId}/export`, { waitUntil: "domcontentloaded" });
  check("another company's director gets a 404", denied.status() === 404, String(denied.status()));
  await other.c.close();
}

section("5 and is emailed to the director's own address");
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Email it to me" }).click();
await dir.p.waitForURL(/emailed=1/, { timeout: 20000 });
check("says it was sent", (await dir.p.getByText(`Sent to ${email}`).count()) > 0);
const sent = JSON.parse(readFileSync(process.env.MAILBOX ?? "test/mailbox.json", "utf8"));
const mail = sent.filter((m) => (m.to ?? []).includes(email) && /^Submissions for /.test(m.subject ?? "")).pop();
check("the message went to the director, and only them", Boolean(mail) && mail.to.length === 1);
check("with the spreadsheet attached", Boolean(mail?.attachments?.[0]?.filename?.endsWith(".xlsx")), JSON.stringify(mail?.attachments?.map((a) => a.filename)));
check("and the attachment is the file", (mail?.attachments?.[0]?.content?.length ?? 0) > 1000);
check("the text says what it holds", /personal details/.test(mail?.text ?? ""));

section("6 both exports are in the trail");
await dir.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
check("recorded twice, download and email", (await dir.p.getByText(/exported the submissions of/).count()) >= 2);
check("saying which and how many", (await dir.p.getByText(/3 submissions emailed to/).count()) > 0);

await dir.c.close();
await admin.c.close();
await browser.close();
finish();
