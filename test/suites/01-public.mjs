/**
 * The only surface a performer ever sees: the way in, the help pages, and one
 * production reached by its share link. Everything else must be shut.
 */
import {
  BASE,
  SHOTS,
  launch,
  reporter,
  session,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

// The seeded demo productions have fixed tokens, so they can be written down.
const SALTMARSH = "demo-saltmarsh-4f21c9ba7e";
const HEARTH = "demo-hearth-2b96fd40ac";
const NORTHBANK = "demo-northbank-7c03ae5d18";

section("1 the home page is the way in, and nothing else");
{
  const { c, p } = await ctx();
  check("/ -> 200", (await p.goto(BASE, { waitUntil: "networkidle" })).status() === 200);
  check("offers an admin sign-in", (await p.getByRole("link", { name: "Sign in as admin" }).count()) > 0);
  check("offers a production sign-in", (await p.getByRole("link", { name: /^Sign in$/ }).count()) > 0);
  check("explains performers use a link", (await p.getByText(/Sent a casting link/).count()) > 0);
  check("no browse anywhere on it", (await p.getByRole("link", { name: /browse/i }).count()) === 0);
  await p.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });
  await c.close();
}

section("2 there is no public board left to find");
{
  const { c, p } = await ctx();
  for (const path of ["/roles", "/roles/rol_saltmarsh_nell", "/signup"]) {
    check(`${path} -> 404`, (await p.goto(BASE + path, { waitUntil: "networkidle" })).status() === 404);
  }
  const robots = await p.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle" });
  check("robots.txt disallows everything", (await robots.text()).includes("Disallow: /"));
  check(
    "the dashboard sends a stranger to sign in",
    (await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })) && p.url().includes("/login"),
    p.url(),
  );
  await c.close();
}

section("3 FAQ pages stay open");
{
  const { c, p } = await ctx();
  for (const path of ["/faq", "/faq/performers", "/faq/casting-directors"]) {
    check(`${path} -> 200`, (await p.goto(BASE + path, { waitUntil: "networkidle" })).status() === 200);
  }
  await p.goto(`${BASE}/faq/performers`, { waitUntil: "networkidle" });
  check("glossary explains buyout and usage", (await p.getByText("Buyout and usage").count()) > 0);
  check("explains deferred pay honestly", (await p.getByText(/Treat it as unpaid/).count()) > 0);
  check("under-18 guidance present", (await p.getByText(/licence/i).count()) > 0);
  check("not-legal-advice notice", (await p.getByText(/not legal advice/i).count()) > 0);
  check("says why there is nothing to search", (await p.getByText(/not a job board/).count()) > 0);
  await p.goto(`${BASE}/faq/casting-directors`, { waitUntil: "networkidle" });
  check("explains who sees submissions", (await p.getByText(/Producer/).count()) > 0);
  check("covers UK GDPR duty", (await p.getByText(/UK GDPR/).count()) > 0);
  check("explains circulating the link", (await p.getByText(/How do performers find my roles/).count()) > 0);
  await c.close();
}

section("4 a share link opens one production, and only that one");
{
  const { c, p } = await ctx();
  const response = await p.goto(`${BASE}/c/${SALTMARSH}`, { waitUntil: "networkidle" });
  check("the link works", response.status() === 200);
  check("names the production", (await p.getByRole("heading", { name: "Saltmarsh" }).count()) > 0);
  check("lists its roles", (await p.getByText("NELL — Lead").count()) > 0);
  check("does not leak another production", (await p.getByText("Northbank").count()) === 0);
  check("says it is not a job board", (await p.getByText(/not a job board/).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/casting-call.png`, fullPage: true });

  check("a made-up token is a 404",
    (await p.goto(`${BASE}/c/not-a-real-token-at-all`, { waitUntil: "networkidle" })).status() === 404);

  // The token authorises one production; another's role must not open under it.
  const crossed = await p.goto(`${BASE}/c/${NORTHBANK}/rol_saltmarsh_nell`, { waitUntil: "networkidle" });
  check("one production's link cannot open another's role", crossed.status() === 404, String(crossed.status()));
  await c.close();
}

section("5 role with terms — acceptance is required");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${HEARTH}/rol_hearth_couple`, { waitUntil: "networkidle" });
  check("terms shown on the listing", (await p.getByText("Terms for this role").count()) > 0);
  check("acceptance checkbox present", (await p.locator("#acceptTerms").count()) === 1);

  await p.fill("#name", "Terms Tester");
  await p.fill("#email", `terms${t}@example.com`);
  await p.fill("#phone", "07700 900111");
  await p.fill("#location", "London"); await p.fill("#age", "65");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.waitForTimeout(2000);
  check("submitting without accepting is refused", (await p.getByText("Submission sent").count()) === 0);
  check("error names the terms", (await p.locator("#acceptTerms-error").count()) === 1);
  check("checkbox marked invalid", (await p.locator("#acceptTerms[aria-invalid='true']").count()) === 1);
  check("summary lists it", (await p.locator("[data-error-summary]").getByText(/Terms for this role/).count()) > 0);

  await p.check("#acceptTerms");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("accepting lets it through", true);
  check("offers the way back to the production", (await p.getByRole("link", { name: /Hearth/ }).count()) > 0);
  await c.close();
}

section("6 role without terms — no checkbox, submits cleanly");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${SALTMARSH}/rol_saltmarsh_nell`, { waitUntil: "networkidle" });
  check("no terms block", (await p.getByText("Terms for this role").count()) === 0);
  check("no acceptance checkbox", (await p.locator("#acceptTerms").count()) === 0);
  await p.fill("#name", "No Terms"); await p.fill("#email", `not${t}@example.com`);
  await p.fill("#phone", "07700 900222"); await p.fill("#location", "Essex"); await p.fill("#age", "33");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("submits without any acceptance", true);
  await c.close();
}

section("7 errors are in situ and accessible");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${SALTMARSH}/rol_saltmarsh_nell`, { waitUntil: "networkidle" });
  await p.fill("#name", "A"); await p.fill("#email", `x${t}@example.com`);
  await p.fill("#phone", "07700 900333"); await p.fill("#location", "Leeds"); await p.fill("#age", "31");
  await p.fill("#coverNote", "too short");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.locator("[data-error-summary]").waitFor({ timeout: 20000 });
  check("summary appears", true);
  check("summary counts the problems", (await p.locator("[data-error-summary]").textContent()).includes("2 things to fix"));
  check("name marked invalid", (await p.locator("#name[aria-invalid='true']").count()) === 1);
  check("name describedby its error", (await p.getAttribute("#name", "aria-describedby")) === "name-error");
  check("coverNote marked invalid", (await p.locator("#coverNote[aria-invalid='true']").count()) === 1);
  check("valid fields not marked", (await p.locator("#phone[aria-invalid='true']").count()) === 0);
  const focused = await p.evaluate(() => document.activeElement?.getAttribute("data-error-summary") !== null);
  check("focus moved to the summary", focused);
  await p.screenshot({ path: `${SHOTS}/submission-errors.png`, fullPage: true });
  await c.close();
}

await browser.close();
finish();
