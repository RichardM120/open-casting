/**
 * Production companies sit between the paying client and the productions. These checks are about the two promises that
 * makes: the dashboard sorts the work by who it is for, and the company itself
 * never reaches an applicant.
 */
import {
  BASE,
  SHOTS,
  addProductionCompany,
  adminSession,
  launch,
  openSession,
  postRole,
  provision,
  publish,
  reporter,
  session,
  shareToken,
  shareTokenForRole,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Client Co ${t}`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, {
  name: "Cass Dir", company: CO, email: `cd${t}@example.com`, role: "director",
});

section("1 a production cannot be opened before a production company exists");
await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
check("says to add a production company first", (await dir.p.getByText("Add a production company first").count()) > 0);
check("and offers the way to do it",
  (await dir.p.getByRole("link", { name: "New production company" }).count()) > 0);
check("no production form yet", (await dir.p.locator("#name").count()) === 0);

section("2 adding a production company opens the way through");
const COMPANY_A = `Wildseed ${t}`;
const COMPANY_B = `Two Rivers ${t}`;
await addProductionCompany(dir.p, COMPANY_A, "Feature work.");
await addProductionCompany(dir.p, COMPANY_B);
await dir.p.goto(`${BASE}/dashboard/production-companies`, { waitUntil: "networkidle" });
check("both production companies listed", (await dir.p.locator("#main").getByText(COMPANY_A, { exact: true }).count()) > 0
  && (await dir.p.locator("#main").getByText(COMPANY_B, { exact: true }).count()) > 0);
check("notes are shown", (await dir.p.getByText("Feature work.").count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/production-companies.png`, fullPage: true });

section("3 a duplicate name is refused rather than silently made");
await dir.p.goto(`${BASE}/dashboard/production-companies/new`, { waitUntil: "networkidle" });
await dir.p.fill("#name", COMPANY_A);
await dir.p.getByRole("button", { name: "Add the production company" }).click();
await dir.p.waitForTimeout(1500);
check("says it already exists", (await dir.p.getByText(/already have a production company with that name/).count()) > 0);

section("4 productions are grouped under the company they are for");
const first = await openSession(dir.p, { name: `Saltmarsh ${t}`, productionCompany: COMPANY_A });
await openSession(dir.p, { name: `Kestrel ${t}`, productionCompany: COMPANY_A });
await openSession(dir.p, { name: `Northbank ${t}`, productionCompany: COMPANY_B });
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
{
  const headings = await dir.p.locator("main h2, h2").allTextContents();
  check(`both companies head a group: ${JSON.stringify(headings)}`,
    headings.includes(COMPANY_A) && headings.includes(COMPANY_B));
  check("the busier company counts two productions",
    (await dir.p.getByText("2 productions").count()) > 0);
}
await dir.p.screenshot({ path: `${SHOTS}/production-companies-grouped.png`, fullPage: true });

section("4b they stay reachable without a nav item");
{
  await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("not offered in the nav",
    (await dir.p.locator("header nav").first()
      .getByText("Production companies", { exact: true }).count()) === 0);

  // The group heading is the way in now, so it has to be a real link.
  const heading = dir.p.locator("#main").getByRole("link", { name: COMPANY_A, exact: true });
  check("the group heading links to it", (await heading.count()) > 0);
  await heading.first().click();
  await dir.p.waitForURL(/\/dashboard\/production-companies\/.*\/edit/, { timeout: 20000 });
  check("and lands on the company", (await dir.p.getByText(`Edit ${COMPANY_A}`).count()) > 0);

  // And a director casting for someone new can still add one.
  await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
  const add = dir.p.getByRole("link", { name: "Add a production company" });
  check("the production form offers adding one", (await add.count()) > 0);
  await add.first().click();
  await dir.p.waitForURL(/\/dashboard\/production-companies\/new/, { timeout: 20000 });
  check("which opens the form", (await dir.p.locator("#name").count()) === 1);
}

section("5 the production page names its company");
await dir.p.goto(`${BASE}/dashboard/sessions/${first}`, { waitUntil: "networkidle" });
check("production company shown on the production", (await dir.p.getByText(COMPANY_A).count()) > 0);

section("6 a company holding productions cannot be removed");
await dir.p.goto(`${BASE}/dashboard/production-companies`, { waitUntil: "networkidle" });
check("no Remove offered while it is in use",
  (await dir.p.getByRole("button", { name: "Remove" }).count()) === 0);

section("7 an empty company can be removed");
const SPARE = `Spare ${t}`;
await addProductionCompany(dir.p, SPARE);
await dir.p.goto(`${BASE}/dashboard/production-companies`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Remove" }).first().click();
await dir.p.waitForURL(/\/dashboard\/production-companies\?removed=1/, { timeout: 20000 });
check("it is gone", (await dir.p.locator("#main").getByText(SPARE, { exact: true }).count()) === 0);
check("and the ones in use remain", (await dir.p.locator("#main").getByText(COMPANY_A, { exact: true }).count()) > 0);

section("8 the production company never reaches an applicant");
const role = await postRole(dir.p, { title: `NELL-${t}`, sessionId: first });
await publish(dir.p, first);
{
  const token = await shareToken(dir.p, first);
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("the production page opens", (await p.getByText(`Saltmarsh ${t}`).count()) > 0);
  check("and says nothing about the production company", (await p.getByText(COMPANY_A).count()) === 0);

  const roleToken = await shareTokenForRole(dir.p, role);
  await p.goto(`${BASE}/c/${roleToken}/${role}`, { waitUntil: "networkidle" });
  check("nor does the role page", (await p.getByText(COMPANY_A).count()) === 0);
  await c.close();
}

section("9 another director's companies are not visible");
const other = await provision(browser, errors, admin.p, {
  name: "Otto Dir", company: `Other ${t}`, email: `od${t}@example.com`, role: "director",
});
await other.p.goto(`${BASE}/dashboard/production-companies`, { waitUntil: "networkidle" });
check("a stranger sees none of them",
  (await other.p.locator("#main").getByText(COMPANY_A, { exact: true }).count()) === 0);
check("and is told there are none yet", (await other.p.getByText("No production companies yet").count()) > 0);

section("10 a producer at the same client sees them");
const prod = await provision(browser, errors, admin.p, {
  name: "Pia Prod", company: CO, email: `pp${t}@example.com`, role: "producer",
});
await prod.p.goto(`${BASE}/dashboard/production-companies`, { waitUntil: "networkidle" });
check("producer sees the client's companies",
  (await prod.p.locator("#main").getByText(COMPANY_A, { exact: true }).count()) > 0);

await browser.close();
finish();
