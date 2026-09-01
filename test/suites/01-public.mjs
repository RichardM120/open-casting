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

section("1 FAQ pages");
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
  await p.goto(`${BASE}/faq/casting-directors`, { waitUntil: "networkidle" });
  check("explains who sees submissions", (await p.getByText(/Producer/).count()) > 0);
  check("covers UK GDPR duty", (await p.getByText(/UK GDPR/).count()) > 0);
  check("FAQ reachable from the header", (await p.locator("header").getByText("FAQ").count()) > 0);
  await p.screenshot({ path: `${SHOTS}/faq-cd.png`, fullPage: true });
  await c.close();
}

section("2 role with terms — acceptance is required");
{
  const { c, p } = await ctx();
  // rol_hearth_couple carries seeded terms.
  await p.goto(`${BASE}/roles/rol_hearth_couple`, { waitUntil: "networkidle" });
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
  await p.screenshot({ path: `${SHOTS}/terms-error.png`, fullPage: true });

  await p.check("#acceptTerms");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("accepting lets it through", true);
  await c.close();
}

section("3 role without terms — no checkbox, submits cleanly");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/roles/rol_saltmarsh_nell`, { waitUntil: "networkidle" });
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

section("4 errors are in situ and accessible");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/roles/rol_saltmarsh_nell`, { waitUntil: "networkidle" });
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
  await c.close();
}

await browser.close();
finish();
