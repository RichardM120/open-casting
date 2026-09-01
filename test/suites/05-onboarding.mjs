import {
  BASE,
  SHOTS,
  launch,
  reporter,
  session,
  signUpOnly,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

section("1 a new director is taken into setup, not a bare dashboard");
const dir = await ctx();
await signUpOnly(dir.p, { name: "Ada Dir", company: `Wiz Co ${t}`, email: `wd${t}@example.com`, role: "director" });
await dir.p.waitForURL("**/welcome**", { timeout: 20000 });
check("lands on /welcome", dir.p.url().includes("/welcome"), dir.p.url());
check("greets by first name", (await dir.p.getByText("Welcome, Ada").count()) > 0);
check("shows a 3-step indicator", (await dir.p.getByLabel(/Step 1 of 3/).count()) > 0);
check("step 1 is the profile", (await dir.p.locator("#company").count()) === 1);
await dir.p.screenshot({ path: `${SHOTS}/wizard-1.png`, fullPage: true });

section("2 step 1 validates and saves");
await dir.p.fill("#company", "X");
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.locator("[data-error-summary]").waitFor({ timeout: 20000 });
check("rejects a too-short company", true);
await dir.p.fill("#company", `Wiz Co ${t}`);
await dir.p.fill("#name", "Ada Director");
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.waitForURL("**step=2**", { timeout: 20000 });
check("moves to step 2", true);
check("name saved into the header", (await dir.p.locator("header").textContent()).includes(`Wiz Co ${t}`));

section("3 step 2 explains the director's own scope");
check("director wording", (await dir.p.getByText(/roles you post, and nothing else/).count()) > 0);
check("warns colleagues cannot see it", (await dir.p.getByText(/cannot see your roles/).count()) > 0);
check(
  "explains casting sessions come first",
  (await dir.p.getByText(/opening a casting session for the production/).count()) > 0,
);
await dir.p.screenshot({ path: `${SHOTS}/wizard-2.png`, fullPage: true });
await dir.p.getByRole("link", { name: "Continue" }).click();
await dir.p.waitForURL("**step=3**", { timeout: 20000 });
check("step 3 mentions the data duty", (await dir.p.getByText(/UK GDPR/).count()) > 0);
check("links the casting guide", (await dir.p.getByRole("link", { name: /casting director guide/ }).count()) > 0);

section("4 finishing sends a director to open a casting session");
await dir.p.getByRole("button", { name: "Open your first casting session" }).click();
await dir.p.waitForURL("**/dashboard/sessions/new", { timeout: 20000 });
check("lands on the session form", true);
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("the nudge banner is gone", (await dir.p.getByText(/setup is not finished/).count()) === 0);

section("5 an unfinished setup is nudged from the dashboard");
const half = await ctx();
await signUpOnly(half.p, { name: "Half Done", company: `Half ${t}`, email: `hf${t}@example.com`, role: "producer" });
await half.p.waitForURL("**/welcome**", { timeout: 20000 });
await half.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("banner shown", (await half.p.getByText(/setup is not finished/).count()) > 0);
await half.p.goto(`${BASE}/welcome?step=2`, { waitUntil: "networkidle" });
check("producer gets company-wide wording", (await half.p.getByText(/every role posted under your company/i).count()) > 0);

section("6 an admin is told what admin actually means");
const admin = await ctx();
await signUpOnly(admin.p, { name: "Boss", company: `Admin ${t}`, email: "boss@example.com", role: "director" });
await admin.p.waitForURL("**/welcome**", { timeout: 20000 });
check("says the role came from the admin list", (await admin.p.getByText(/admin list, not from anything you chose/).count()) > 0);
await admin.p.goto(`${BASE}/welcome?step=2`, { waitUntil: "networkidle" });
check("warns removal is permanent", (await admin.p.getByText(/permanently deletes/).count()) > 0);
check("warns their own actions are logged", (await admin.p.getByText(/including yours/).count()) > 0);
await admin.p.screenshot({ path: `${SHOTS}/wizard-admin.png`, fullPage: true });

section("7 navigation fixes");
const m = await ctx({ width: 390, height: 844 });
await m.p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await m.p.fill("#email", "boss@example.com"); await m.p.fill("#password", "correct horse battery");
await m.p.getByRole("button", { name: "Sign in" }).click();
await m.p.waitForTimeout(2500);
await m.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const visible = await m.p.locator("header nav a").evaluateAll((els) =>
  els.filter((el) => el.offsetParent !== null).map((el) => el.textContent.trim()));
check(`nav visible on a phone: ${JSON.stringify(visible)}`, visible.includes("Casting dashboard"));
check("sessions reachable on a phone", visible.includes("Sessions"));
check("no horizontal overflow", (await m.p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
await m.p.keyboard.press("Tab");
const firstFocus = await m.p.evaluate(() => document.activeElement?.textContent?.trim());
check(`first tab stop is the skip link (got "${firstFocus}")`, firstFocus === "Skip to content");
await m.p.screenshot({ path: `${SHOTS}/mobile-nav.png`, fullPage: false });

for (const s of [dir, half, admin, m]) await s.c.close();
await browser.close();
finish();
