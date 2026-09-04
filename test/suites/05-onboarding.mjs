import {
  BASE,
  SHOTS,
  launch,
  reporter,
  session,
  adminSession,
  provisionOnly,
  signInAsAdmin,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

section("1 an account the admin made is taken into setup on first sign-in");
const admin = await adminSession(browser, errors);
const dir = await provisionOnly(browser, errors, admin.p, {
  name: "Ada Dir", company: `Wiz Co ${t}`, email: `wd${t}@example.com`, role: "director",
});
check("lands on /welcome", dir.p.url().includes("/welcome"), dir.p.url());
check("greets by first name", (await dir.p.getByText("Welcome, Ada").count()) > 0);
check("shows a 4-step indicator", (await dir.p.getByLabel(/Step 1 of 4/).count()) > 0);
check("step 1 is the agreement", (await dir.p.locator('input[name="accept"]').count()) === 1);
await dir.p.locator('input[name="accept"]').check();
await dir.p.getByRole("button", { name: "Accept and continue" }).click();
await dir.p.waitForURL(/welcome\?step=2/, { timeout: 20000 });
check("then the profile", (await dir.p.locator("#company").count()) === 1);
await dir.p.screenshot({ path: `${SHOTS}/wizard-1.png`, fullPage: true });

section("2 step 1 validates and saves");
await dir.p.fill("#company", "X");
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.locator("[data-error-summary]").waitFor({ timeout: 20000 });
check("rejects a too-short company", true);
await dir.p.fill("#company", `Wiz Co ${t}`);
await dir.p.fill("#name", "Ada Director");
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.waitForURL("**step=3**", { timeout: 20000 });
check("moves on", true);
check("name saved into the header", (await dir.p.locator("header").textContent()).includes(`Wiz Co ${t}`));

section("3 step 2 explains the director's own scope");
check("director wording", (await dir.p.getByText(/casting calls you open, and nothing else/).count()) > 0);
check("warns colleagues cannot see it", (await dir.p.getByText(/cannot see your casting calls/).count()) > 0);
check(
  "explains casting calls come first",
  (await dir.p.getByText(/Start by opening a casting call/).count()) > 0,
);
await dir.p.screenshot({ path: `${SHOTS}/wizard-2.png`, fullPage: true });
await dir.p.getByRole("link", { name: "Continue" }).click();
await dir.p.waitForURL("**step=4**", { timeout: 20000 });
check("the last step mentions the data duty", (await dir.p.getByText(/UK GDPR/).count()) > 0);
check("links the casting guide", (await dir.p.getByRole("link", { name: /casting director guide/ }).count()) > 0);

section("3b accounts cannot be self-registered");
{
  const { c, p } = await ctx();
  check("no signup page", (await p.goto(`${BASE}/signup`, { waitUntil: "networkidle" })).status() === 404);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check("sign-in says who makes accounts", (await p.getByText(/made by the administrator/).count()) > 0);
  check("no link offering to create one", (await p.getByRole("link", { name: /create one/i }).count()) === 0);
  await c.close();
}

section("4 finishing sends a director to open a casting call");
await dir.p.getByRole("button", { name: "Open your first casting call" }).click();
await dir.p.waitForURL("**/dashboard/sessions/new", { timeout: 20000 });
check("lands on the casting call form", true);
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("the nudge banner is gone", (await dir.p.getByText(/setup is not finished/).count()) === 0);

section("5 an unfinished setup is nudged from the dashboard");
const half = await provisionOnly(browser, errors, admin.p, {
  name: "Half Done", company: `Half ${t}`, email: `hf${t}@example.com`, role: "producer",
});
// Before the agreement, the dashboard is not reachable at all.
await half.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("no dashboard until the agreement is accepted", half.p.url().includes("/welcome"), half.p.url());

await half.p.locator('input[name="accept"]').check();
await half.p.getByRole("button", { name: "Accept and continue" }).click();
await half.p.waitForTimeout(1500);

// Accepted but setup unfinished: the dashboard opens, and nudges.
await half.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("banner shown once past the agreement", (await half.p.getByText(/setup is not finished/).count()) > 0);

await half.p.goto(`${BASE}/welcome?step=3`, { waitUntil: "networkidle" });
check("producer gets company-wide wording", (await half.p.getByText(/every casting call under your company/i).count()) > 0);

section("6 an admin is told what admin actually means");
await admin.p.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
check("says the role came from the admin list", (await admin.p.getByText(/admin list, not from anything you chose/).count()) > 0);
await admin.p.goto(`${BASE}/welcome?step=2`, { waitUntil: "networkidle" });
check("warns removal is permanent", (await admin.p.getByText(/permanently deletes/).count()) > 0);
check("warns their own actions are logged", (await admin.p.getByText(/including yours/).count()) > 0);
await admin.p.screenshot({ path: `${SHOTS}/wizard-admin.png`, fullPage: true });

section("6b the two sections each carry their own navigation");
{
  // The casting director's section, which an admin is in when doing their own
  // casting: no admin links, because that is a different section.
  const order = await admin.p.locator("header nav").first().locator("a").allTextContents();
  check(`casting nav in order: ${JSON.stringify(order)}`,
    JSON.stringify(order) === JSON.stringify(["Casting calls", "Activity", "FAQ", "New casting call"]));

  await admin.p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const adminOrder = await admin.p.locator("header nav").first().locator("a").allTextContents();
  check(`admin nav in order: ${JSON.stringify(adminOrder)}`,
    JSON.stringify(adminOrder) === JSON.stringify(["Overview", "Clients", "Accounts", "Storage", "Activity", "FAQ"]));
  await admin.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

  await half.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const theirs = await half.p.locator("header nav").first().locator("a").allTextContents();
  check(`a producer gets no Accounts: ${JSON.stringify(theirs)}`, !theirs.includes("Accounts"));
  check("and the page itself still refuses",
    (await half.p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" })).status() === 404);

  // The breadcrumb at the top of the screen names its steps as the nav does;
  // a trail that calls a destination something else is a bug.
  await admin.p.goto(`${BASE}/dashboard/activity`, { waitUntil: "networkidle" });
  const crumbs = () => admin.p.locator("nav[aria-label='Breadcrumb']").first();
  check("the breadcrumb is the first thing in the page", (await admin.p.locator("main > div > *").first().evaluate((el) => el.getAttribute("aria-label"))) === "Breadcrumb");
  check("breadcrumbs use the nav's names", (await crumbs().getByRole("link", { name: "Casting calls" }).count()) === 1);
  check("and end on the page itself", (await crumbs().locator("[aria-current='page']").innerText()) === "Activity");
  await admin.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
  check("and so does the new-casting call page", (await crumbs().getByRole("link", { name: "Casting calls" }).count()) === 1);
}

section("7 navigation fixes");
const m = await ctx({ width: 390, height: 844 });
await signInAsAdmin(m.p);
await m.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const visible = await m.p.locator("header nav a").evaluateAll((els) =>
  els.filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim()));
check(`nav visible on a phone: ${JSON.stringify(visible)}`, visible.includes("Activity"));
check("casting calls reachable on a phone", visible.includes("Casting calls"));
check("no horizontal overflow", (await m.p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
await m.p.keyboard.press("Tab");
const firstFocus = await m.p.evaluate(() => document.activeElement?.textContent?.trim());
check(`first tab stop is the skip link (got "${firstFocus}")`, firstFocus === "Skip to content");
await m.p.screenshot({ path: `${SHOTS}/mobile-nav.png`, fullPage: false });

for (const s of [dir, half, admin, m]) await s.c.close();
await browser.close();
finish();
