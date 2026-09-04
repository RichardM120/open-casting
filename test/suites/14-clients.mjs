/**
 * Clients are the companies paying for Open Casting, and only the owner
 * manages them. These checks are about the two things that follow: a director
 * cannot reach the admin side at all, and what a client bought is what its
 * accounts may do, including being stopped outright.
 */
import {
  BASE,
  SHOTS,
  addPayingClient,
  adminSession,
  launch,
  openSession,
  provision,
  reporter,
  session,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CLIENT = `Paying Co ${t}`;

const admin = await adminSession(browser, errors);

section("1 the owner takes on a client");
await admin.p.goto(`${BASE}/admin/clients/new`, { waitUntil: "networkidle" });
await admin.p.fill("#name", CLIENT);
await admin.p.fill("#contactName", "Dana Buyer");
await admin.p.fill("#contactEmail", "dana@example.com");
await admin.p.fill("#billingEmail", "accounts@example.com");
await admin.p.fill("#billingReference", `PO-${t}`);
await admin.p.selectOption("#tier", "commercial");
await admin.p.fill("#maxSessions", "1");
await admin.p.getByRole("button", { name: "Take on the client" }).click();
await admin.p.waitForURL(/\/admin\/clients\/cl_/, { timeout: 20000 });
const clientId = admin.p.url().match(/clients\/(cl_[^?]+)/)[1];
check("the client has a page", Boolean(clientId));
check("its details are shown", (await admin.p.getByText("Dana Buyer").count()) > 0);
check("and its billing reference", (await admin.p.getByText(`PO-${t}`).count()) > 0);
check("and the plan it is on", (await admin.p.getByText(/Commercial/).count()) > 0);
await admin.p.screenshot({ path: `${SHOTS}/client.png`, fullPage: true });

section("2 it appears in the list with what it is using");
await admin.p.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" });
check("listed", (await admin.p.locator("#main").getByText(CLIENT, { exact: true }).count()) > 0);
check("with no accounts yet", (await admin.p.getByText("0 accounts").count()) > 0);
await admin.p.screenshot({ path: `${SHOTS}/clients-admin.png`, fullPage: true });

section("3 a duplicate name is refused");
await admin.p.goto(`${BASE}/admin/clients/new`, { waitUntil: "networkidle" });
await admin.p.fill("#name", CLIENT);
await admin.p.getByRole("button", { name: "Take on the client" }).click();
await admin.p.waitForTimeout(1500);
check("says it already exists", (await admin.p.getByText(/already a client with that name/).count()) > 0);

section("4 an account is made under the client and inherits what it bought");
const dir = await provision(browser, errors, admin.p, {
  name: "Dee Rector", company: CLIENT, email: `dr${t}@example.com`, role: "director",
});
await admin.p.goto(`${BASE}/admin/clients/${clientId}`, { waitUntil: "networkidle" });
check("the account shows on the client", (await admin.p.getByText("Dee Rector").count()) > 0);
check("with their email", (await admin.p.getByText(`dr${t}@example.com`).count()) > 0);

// maxSessions was set to 1 on the client, never on the account.
await openSession(dir.p, { name: `First ${t}`, productionCompany: `Wildseed ${t}` });
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("the client's ceiling is enforced on its account",
  (await dir.p.getByText(/covers 1 casting call and you have used/).count()) > 0);
check("and the way to open another is withdrawn",
  (await dir.p.locator("main").getByRole("link", { name: "New casting call" }).count()) === 0);

section("5 a director cannot reach the admin side");
{
  const paths = ["/admin", "/admin/clients", `/admin/clients/${clientId}`, "/admin/clients/new", "/admin/accounts", "/admin/activity"];
  for (const path of paths) {
    const res = await dir.p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    check(`${path} refuses a director (${res.status()})`, res.status() === 404);
  }
  check("and the nav does not offer it",
    (await dir.p.locator("header nav").first().getByText("Clients", { exact: true }).count()) === 0);
}

section("5b the footer offers each reader their own section, and never a door that is shut");
{
  await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const footer = dir.p.locator("footer");
  check("a director's footer links to their casting calls",
    (await footer.getByRole("link", { name: "Casting calls", exact: true }).count()) > 0);
  check("and not to admin",
    (await footer.getByRole("link", { name: "Admin", exact: true }).count()) === 0);
  check("the footer is a landmark", (await footer.locator("nav[aria-label='Footer']").count()) === 1);
  check("and its mark goes home", (await footer.locator("a[href='/']").count()) === 1);

  // The section itself still refuses a director, footer or no footer.
  const landed = await dir.p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  check(`which still refuses a director (${landed.status()})`, landed.status() === 404);

  await admin.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("an admin's footer does link to admin",
    (await admin.p.locator("footer").getByRole("link", { name: "Admin", exact: true }).count()) > 0);
}

section("5c the admin section carries its own navigation");
{
  await admin.p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("the file store card says there is none", (await admin.p.getByText("Not connected.").count()) > 0);
  check("and offers no test without one", (await admin.p.getByRole("button", { name: "Test the store" }).count()) === 0);
  check("the overview opens", (await admin.p.getByText("Open Casting, as a service").count()) > 0);
  const nav = await admin.p.locator("header nav").first().locator("a").allTextContents();
  check(`admin nav: ${JSON.stringify(nav)}`, nav.includes("Clients") && nav.includes("Accounts"));
  check("and no Casting calls link, that being the other section", !nav.includes("Casting calls"));

  await admin.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const casting = await admin.p.locator("header nav").first().locator("a").allTextContents();
  check(`casting nav for the same admin: ${JSON.stringify(casting)}`,
    casting.includes("Casting calls") && !casting.includes("Clients"));
}

section("6 suspending the client stops everyone under it");
await admin.p.goto(`${BASE}/admin/clients/${clientId}`, { waitUntil: "networkidle" });
await admin.p.getByRole("button", { name: "Suspend this client" }).click();
await admin.p.waitForURL(/suspended=1/, { timeout: 20000 });
check("shown as suspended", (await admin.p.getByText("Suspended").count()) > 0);

await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("its director is locked out at once", !dir.p.url().includes("/dashboard"), dir.p.url());

section("7 restoring lets them back in");
await admin.p.goto(`${BASE}/admin/clients/${clientId}`, { waitUntil: "networkidle" });
await admin.p.getByRole("button", { name: "Restore this client" }).click();
await admin.p.waitForURL(/restored=1/, { timeout: 20000 });
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check("the client is active again",
    (await admin.p.getByText("Suspended").count()) === 0);
  await c.close();
}

section("8 a client with accounts cannot be removed");
await admin.p.goto(`${BASE}/admin/clients/${clientId}`, { waitUntil: "networkidle" });
check("no Remove offered while it is in use",
  (await admin.p.getByRole("button", { name: "Remove this client" }).count()) === 0);

section("9 an empty client can be removed");
const SPARE = `Spare Co ${t}`;
await addPayingClient(admin.p, SPARE);
const spareId = admin.p.url().match(/clients\/(cl_[^?]+)/)?.[1];
await admin.p.goto(`${BASE}/admin/clients/${spareId}`, { waitUntil: "networkidle" });
await admin.p.locator('input[name="confirm"]').check();
await admin.p.getByRole("button", { name: "Remove this client" }).click();
await admin.p.waitForURL(/\/admin\/clients\?removed=1/, { timeout: 20000 });
check("it is gone", (await admin.p.locator("#main").getByText(SPARE, { exact: true }).count()) === 0);
check("and the one in use remains",
  (await admin.p.locator("#main").getByText(CLIENT, { exact: true }).count()) > 0);

await browser.close();
finish();
