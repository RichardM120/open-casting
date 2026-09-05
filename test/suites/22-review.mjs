/**
 * What reaches the casting team, and when.
 *
 * Two rules that decide it. A child's submission is not one until the named
 * guardian has said so from their own mailbox — until then it is invisible,
 * uncounted, unexportable and unplayable, and if nobody says so it is
 * destroyed. And a director with four hundred submissions narrows by what the
 * part needs rather than reading all of them, so the list filters on age,
 * where somebody is based and whether they are free for the shoot.
 */
import { readFileSync } from "node:fs";

import pg from "pg";

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
  shareToken,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Everything the app has emailed, as the stand-in provider received it. */
function mailbox() {
  try {
    return JSON.parse(readFileSync(process.env.MAILBOX ?? "test/mailbox.json", "utf8"));
  } catch {
    return [];
  }
}

/** The newest link in the mailbox matching a pattern, waiting for it to land. */
async function latestLink(pattern) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const links = mailbox().flatMap((message) => message.text.match(pattern) ?? []);
    if (links.length) return links[links.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no link matching ${pattern} reached the mailbox`);
}

const admin = await adminSession(browser, errors);
const owner = await provision(browser, errors, admin.p, {
  name: "Rea View",
  email: `review${t}@example.com`,
  company: `Review Co ${t}`,
});

const call = await openSession(owner.p, {
  name: `Review Call ${t}`,
  opensAt: at(0),
  closesAt: at(20, "23:59"),
  productionEndsAt: day(40),
});
const roleId = await postRole(owner.p, { sessionId: call, title: "Lead", location: "Leeds, UK" });
await publish(owner.p, call);
const token = await shareToken(owner.p, call);

/** Sends one submission through the real form. */
async function submit({ name, email, age, location }) {
  const { c, p } = await session(browser, errors);
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  await p.selectOption("#age", String(age));
  await p.waitForTimeout(300);
  await p.fill("#name", name);
  if (await p.locator("#email").count()) await p.fill("#email", email);
  await p.fill("#phone", "07700 900900");
  await p.fill("#location", location);
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  if (await p.locator("#available").count()) await p.check("#available");
  await p.check("#acceptSubmissionTerms");
  return { c, p };
}

/* ------------------------------------------------ a child's submission -- */

section("1 a child's submission asks for the guardian, and says what happens next");
const GUARDIAN = `guardian${t}@example.com`;
{
  const { c, p } = await submit({
    name: "Kit Younger",
    email: "",
    age: 12,
    location: "Leeds",
  });
  check("the guardian is asked for", (await p.locator("#guardianName").count()) === 1);
  check(
    "and the form says they will be emailed",
    (await p.getByText(/We will email the address below to confirm/).count()) > 0,
  );
  await p.fill("#guardianName", "Pat Guardian");
  await p.fill("#guardianEmail", GUARDIAN);
  await p.check("#guardianConsent");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check(
    "and afterwards it says nothing goes on without them",
    (await p.getByText(/Nothing goes to .* until they do/).count()) > 0,
  );
  await p.screenshot({ path: `${SHOTS}/guardian-awaiting.png`, fullPage: true });
  await c.close();
}

section("2 until they confirm, the casting team has nothing");
{
  const { p } = owner;
  await p.goto(`${BASE}/dashboard/sessions/${call}`, { waitUntil: "networkidle" });
  check("the child is not on the list", (await p.getByText("Kit Younger").count()) === 0);
  check("and the count does not include them", (await p.getByText(/Nothing has come in yet/).count()) > 0);

  const rows = await pool.query(
    "SELECT name, guardian_email, guardian_confirmed_at, guardian_token FROM submissions WHERE session_id = $1",
    [call],
  );
  check("but the row is there, waiting", rows.rows.length === 1, JSON.stringify(rows.rows[0]?.name));
  check("with no confirmation on it", rows.rows[0]?.guardian_confirmed_at === null);
  check("and a token to confirm with", typeof rows.rows[0]?.guardian_token === "string" && rows.rows[0].guardian_token.length > 20);
}

section("3 the guardian is emailed a link, and it explains rather than confirms");
const confirmUrl = await latestLink(/http:\/\/\S+\/c\/guardian\/[A-Za-z0-9_-]+/);
{
  const sent = mailbox().filter((message) => message.to?.includes?.(GUARDIAN) || String(message.to) === GUARDIAN);
  check(`the guardian was written to: ${sent.length}`, sent.length > 0);

  const { c, p } = await session(browser, errors);
  await p.goto(confirmUrl, { waitUntil: "networkidle" });
  check("the page names the child", (await p.getByText("Kit Younger").count()) > 0);
  check("and the part", (await p.getByText("Lead").first().count()) > 0);
  check("and who would read it", (await p.getByText(`Review Co ${t}`).first().count()) > 0);
  check("opening the link confirms nothing on its own", (await p.getByRole("button", { name: /Confirm this submission/ }).count()) === 1);

  const still = await pool.query(
    "SELECT guardian_confirmed_at FROM submissions WHERE session_id = $1",
    [call],
  );
  check("and the row is still waiting after the page loads", still.rows[0]?.guardian_confirmed_at === null);
  await p.screenshot({ path: `${SHOTS}/guardian-page.png`, fullPage: true });
  await c.close();
}

section("4 confirming lets it through, once");
{
  const { c, p } = await session(browser, errors);
  await p.goto(confirmUrl, { waitUntil: "networkidle" });
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: /Confirm this submission/ }).click();
  await p.waitForURL(/\/c\/guardian\/done/, { timeout: 20000 });
  check("the guardian is thanked", (await p.getByText(/Thank you/).count()) > 0);

  const rows = await pool.query(
    "SELECT guardian_confirmed_at, guardian_token FROM submissions WHERE session_id = $1",
    [call],
  );
  check("the confirmation is recorded", rows.rows[0]?.guardian_confirmed_at !== null);
  check("and the token is spent", rows.rows[0]?.guardian_token === null);

  // The same link again: a forwarded email, or a second click.
  await p.goto(confirmUrl, { waitUntil: "networkidle" });
  check("the spent link says nothing about what it was", (await p.getByText(/Kit Younger/).count()) === 0);
  await c.close();
}

section("5 and now the casting team can see it");
{
  const { p } = owner;
  await p.goto(`${BASE}/dashboard/sessions/${call}`, { waitUntil: "networkidle" });
  check("the child is on the list", (await p.getByText("Kit Younger").count()) > 0);
  check("and counted", (await p.getByText(/1 across 1 role/).count()) > 0);
}

section("6 the confirmation is in the trail");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/audit-logs?q=Pat+Guardian`, { waitUntil: "networkidle" });
  check("recorded against the guardian who gave it", (await p.getByText(/Pat Guardian/).first().count()) > 0);
}

/* ------------------------------------------------------- the narrowing -- */

section("7 a director narrows the list by what the part needs");
// Three more, so the filters have something to choose between.
for (const person of [
  { name: "Ada Older", email: `ada${t}@example.com`, age: 41, location: "Leeds, UK" },
  { name: "Ben Middle", email: `ben${t}@example.com`, age: 29, location: "Manchester" },
  { name: "Cy Younger", email: `cy${t}@example.com`, age: 19, location: "Leeds, UK" },
]) {
  const { c, p } = await submit(person);
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await c.close();
}

{
  const { p } = owner;
  const list = `${BASE}/dashboard/sessions/${call}`;
  await p.goto(list, { waitUntil: "networkidle" });
  check("all four are in", (await p.getByText(/4 across 1 role/).count()) > 0);
  check("the filters are on the page", (await p.locator("#ageMin").count()) === 1
    && (await p.locator("#ageMax").count()) === 1
    && (await p.locator("#where").count()) === 1
    && (await p.locator("#free").count()) === 1);

  // 12, 19, 29 and 41 are in. Ends included: 19 and 29 both count.
  await p.goto(`${list}?ageMin=19&ageMax=29`, { waitUntil: "networkidle" });
  check("an age range narrows it", (await p.getByText(/2 of 4 match/).count()) > 0);
  check("with both ends counted", (await p.getByText("Cy Younger").count()) > 0 && (await p.getByText("Ben Middle").count()) > 0);
  check("and nobody out of it", (await p.getByText("Ada Older").count()) === 0 && (await p.getByText("Kit Younger").count()) === 0);

  await p.goto(`${list}?ageMin=20&ageMax=29`, { waitUntil: "networkidle" });
  check("moving the end by one drops the one on it", (await p.getByText(/1 of 4 match/).count()) > 0);
  check("and it is the right one", (await p.getByText("Cy Younger").count()) === 0 && (await p.getByText("Ben Middle").count()) > 0);

  await p.goto(`${list}?where=leeds`, { waitUntil: "networkidle" });
  check("a town narrows it, whatever the case", (await p.getByText(/3 of 4 match/).count()) > 0);
  check("and finds a longer address", (await p.getByText("Ada Older").count()) > 0);
  check("but not another town", (await p.getByText("Ben Middle").count()) === 0);

  await p.goto(`${list}?ageMin=30&where=leeds`, { waitUntil: "networkidle" });
  check("two filters narrow together", (await p.getByText(/1 of 4 match/).count()) > 0);
  check("to the one who is both", (await p.getByText("Ada Older").count()) > 0);

  await p.goto(`${list}?ageMin=99`, { waitUntil: "networkidle" });
  check("a filter that matches nobody says so", (await p.getByText(/0 of 4 match/).count()) > 0);

  await p.goto(`${list}?ageMin=30&where=leeds`, { waitUntil: "networkidle" });
  await p.getByRole("link", { name: "Clear", exact: true }).click();
  await p.waitForURL((url) => !url.search.includes("ageMin"), { timeout: 20000 });
  check("clearing puts everyone back", (await p.getByText(/4 across 1 role/).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/submission-filters.png`, fullPage: true });
}

section("8 narrowing keeps the status it was on");
{
  const { p } = owner;
  await p.goto(`${BASE}/dashboard/sessions/${call}?status=New&where=leeds`, { waitUntil: "networkidle" });
  check("both hold at once", (await p.getByText(/3 of 4 match/).count()) > 0);
  const chip = p.getByRole("link", { name: /^Shortlisted/ });
  check("and a status chip carries the narrowing with it",
    (await chip.getAttribute("href")).includes("where=leeds"));
}

await pool.end();
await browser.close();
finish();
