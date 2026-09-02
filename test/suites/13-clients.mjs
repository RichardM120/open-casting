/**
 * Clients sit above productions. These checks are about the two promises that
 * makes: the dashboard sorts the work by who it is for, and the client itself
 * never reaches an applicant.
 */
import {
  BASE,
  SHOTS,
  addClient,
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

section("1 a production cannot be opened before a client exists");
await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
check("says to add a client first", (await dir.p.getByText("Add a client first").count()) > 0);
check("and offers the way to do it",
  (await dir.p.getByRole("link", { name: "New client" }).count()) > 0);
check("no production form yet", (await dir.p.locator("#name").count()) === 0);

section("2 adding a client opens the way through");
const CLIENT_A = `Wildseed ${t}`;
const CLIENT_B = `Two Rivers ${t}`;
await addClient(dir.p, CLIENT_A, "Feature work.");
await addClient(dir.p, CLIENT_B);
await dir.p.goto(`${BASE}/dashboard/clients`, { waitUntil: "networkidle" });
check("both clients listed", (await dir.p.locator("#main").getByText(CLIENT_A, { exact: true }).count()) > 0
  && (await dir.p.locator("#main").getByText(CLIENT_B, { exact: true }).count()) > 0);
check("notes are shown", (await dir.p.getByText("Feature work.").count()) > 0);
await dir.p.screenshot({ path: `${SHOTS}/clients.png`, fullPage: true });

section("3 a duplicate name is refused rather than silently made");
await dir.p.goto(`${BASE}/dashboard/clients/new`, { waitUntil: "networkidle" });
await dir.p.fill("#name", CLIENT_A);
await dir.p.getByRole("button", { name: "Add the client" }).click();
await dir.p.waitForTimeout(1500);
check("says it already exists", (await dir.p.getByText(/already have a client with that name/).count()) > 0);

section("4 productions are grouped under the client they are for");
const first = await openSession(dir.p, { name: `Saltmarsh ${t}`, client: CLIENT_A });
await openSession(dir.p, { name: `Kestrel ${t}`, client: CLIENT_A });
await openSession(dir.p, { name: `Northbank ${t}`, client: CLIENT_B });
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
{
  const headings = await dir.p.locator("main h2, h2").allTextContents();
  check(`both clients head a group: ${JSON.stringify(headings)}`,
    headings.includes(CLIENT_A) && headings.includes(CLIENT_B));
  check("the busier client counts two productions",
    (await dir.p.getByText("2 productions").count()) > 0);
}
await dir.p.screenshot({ path: `${SHOTS}/clients-grouped.png`, fullPage: true });

section("5 the production page names its client");
await dir.p.goto(`${BASE}/dashboard/sessions/${first}`, { waitUntil: "networkidle" });
check("client shown on the production", (await dir.p.getByText(CLIENT_A).count()) > 0);

section("6 a client holding productions cannot be removed");
await dir.p.goto(`${BASE}/dashboard/clients`, { waitUntil: "networkidle" });
check("no Remove offered while it is in use",
  (await dir.p.getByRole("button", { name: "Remove" }).count()) === 0);

section("7 an empty client can be removed");
const SPARE = `Spare ${t}`;
await addClient(dir.p, SPARE);
await dir.p.goto(`${BASE}/dashboard/clients`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Remove" }).first().click();
await dir.p.waitForURL(/\/dashboard\/clients\?removed=1/, { timeout: 20000 });
check("it is gone", (await dir.p.locator("#main").getByText(SPARE, { exact: true }).count()) === 0);
check("and the ones in use remain", (await dir.p.locator("#main").getByText(CLIENT_A, { exact: true }).count()) > 0);

section("8 the client never reaches an applicant");
const role = await postRole(dir.p, { title: `NELL-${t}`, sessionId: first });
await publish(dir.p, first);
{
  const token = await shareToken(dir.p, first);
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("the production page opens", (await p.getByText(`Saltmarsh ${t}`).count()) > 0);
  check("and says nothing about the client", (await p.getByText(CLIENT_A).count()) === 0);

  const roleToken = await shareTokenForRole(dir.p, role);
  await p.goto(`${BASE}/c/${roleToken}/${role}`, { waitUntil: "networkidle" });
  check("nor does the role page", (await p.getByText(CLIENT_A).count()) === 0);
  await c.close();
}

section("9 another director's clients are not visible");
const other = await provision(browser, errors, admin.p, {
  name: "Otto Dir", company: `Other ${t}`, email: `od${t}@example.com`, role: "director",
});
await other.p.goto(`${BASE}/dashboard/clients`, { waitUntil: "networkidle" });
check("a stranger sees none of them",
  (await other.p.locator("#main").getByText(CLIENT_A, { exact: true }).count()) === 0);
check("and is told there are none yet", (await other.p.getByText("No clients yet").count()) > 0);

section("10 a producer at the same agency sees them");
const prod = await provision(browser, errors, admin.p, {
  name: "Pia Prod", company: CO, email: `pp${t}@example.com`, role: "producer",
});
await prod.p.goto(`${BASE}/dashboard/clients`, { waitUntil: "networkidle" });
check("producer sees the agency's clients",
  (await prod.p.locator("#main").getByText(CLIENT_A, { exact: true }).count()) > 0);

await browser.close();
finish();
