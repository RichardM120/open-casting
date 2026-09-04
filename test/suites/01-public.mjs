/**
 * The only surface an applicant ever sees: the way in, the help pages, and one
 * casting call reached by its share link. Everything else must be shut.
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

// The seeded demo casting calls have fixed tokens, so they can be written down.
const SALTMARSH = "saltmarsh-4f21c9ba7e";
const HEARTH = "hearth-winter-campaign-2b96fd40ac";
const NORTHBANK = "northbank-7c03ae5d18";

section("1 the home page is the way in, and nothing else");
{
  const { c, p } = await ctx();
  check("/ -> 200", (await p.goto(BASE, { waitUntil: "networkidle" })).status() === 200);
  // One way in, not one per kind of account: there is a single credential
  // check, and the role comes from the account rather than the door.
  // The way in may be repeated down the page, but it is always the same door.
  const signIns = p.locator("main").getByRole("link", { name: /sign (in|up)/i });
  const count = await signIns.count();
  const doors = new Set(await signIns.evaluateAll((els) => els.map((el) => el.getAttribute("href"))));
  check(`every way in on the page goes to /login (found ${count})`, count >= 1 && doors.size === 1 && doors.has("/login"));
  check("the page leads with the five steps, no hero above them", (await p.locator("main h1").first().innerText()).includes("Five steps"));
  check("and ends on the sign-up button", (await p.locator("main").getByRole("link", { name: "Sign up" }).count()) >= 1);
  check("no separate admin door", (await p.getByRole("link", { name: /sign in as admin/i }).count()) === 0);
  check("explains what you see follows from the account", (await p.getByText(/follows from your\s+account/).count()) > 0);
  check("explains applicants use a link", (await p.getByText(/Sent a casting link/).count()) > 0);
  check("no browse anywhere on it", (await p.getByRole("link", { name: /browse/i }).count()) === 0);
  await p.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });
  await c.close();
}

section("2 there is no public board left to find");
{
  const { c, p } = await ctx();
  for (const path of ["/roles", "/roles/nell-saltmarsh", "/signup"]) {
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

section("2b the sign-in page introduces the tool");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  check("says what it is", (await p.getByText(/One casting call, run from one place/).count()) > 0);
  check("says what it is not", (await p.getByText(/not a job board/).count()) > 0);
  check("explains the one link", (await p.getByText(/One link to circulate/).count()) > 0);
  check("and the retention promise", (await p.getByText(/thirty days after the production finishes/i).count()) > 0);
  check("the form is still there", (await p.locator("#email").count()) === 1);
  check("no separate admin variant", !p.url().includes("as="), p.url());
  await p.screenshot({ path: `${SHOTS}/login.png`, fullPage: true });

  // The form comes first on a phone; whoever is signing in came to sign in.
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload({ waitUntil: "networkidle" });
  const formTop = await p.locator("#email").boundingBox();
  const introTop = await p.getByText(/One casting call, run from one place/).boundingBox();
  check("form above the introduction on a phone", formTop.y < introTop.y, `${formTop.y} vs ${introTop.y}`);
  check("no horizontal overflow", (await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await c.close();
}

section("3 FAQ pages stay open");
{
  const { c, p } = await ctx();
  for (const path of ["/faq", "/faq/applicants", "/faq/casting-directors"]) {
    check(`${path} -> 200`, (await p.goto(BASE + path, { waitUntil: "networkidle" })).status() === 200);
  }
  await p.goto(`${BASE}/faq/applicants`, { waitUntil: "networkidle" });
  check("under-18 guidance present", (await p.getByText(/licence/i).count()) > 0);
  check("not-legal-advice notice", (await p.getByText(/not legal advice/i).count()) > 0);
  check("says why there is nothing to search", (await p.getByText(/not a job board/).count()) > 0);
  await p.goto(`${BASE}/faq/casting-directors`, { waitUntil: "networkidle" });
  check("explains who sees submissions", (await p.getByText(/Producer/).count()) > 0);
  check("covers UK GDPR duty", (await p.getByText(/UK GDPR/).count()) > 0);
  check("explains circulating the link", (await p.getByText(/How do applicants find my roles/).count()) > 0);
  await c.close();
}

section("4 a share link opens one casting call, and only that one");
{
  const { c, p } = await ctx();
  const response = await p.goto(`${BASE}/c/${SALTMARSH}`, { waitUntil: "networkidle" });
  check("the link works", response.status() === 200);
  check("names the casting call", (await p.getByRole("heading", { name: "Saltmarsh" }).count()) > 0);
  check("says it is free to apply and the only way in", (await p.getByText(/Free to apply/).count()) > 0 && (await p.getByText(/only place to apply/).count()) > 0);
  check("with somewhere to report an imitation", (await p.locator("footer a[href^='mailto:']").count()) > 0);
  check("carries the inclusive casting statement", (await p.getByText(/open to applicants of every background/).count()) > 0);
  const short = p.locator('section[aria-labelledby="your-data"] > p').first();
  check("and says in two sentences who holds the data, for how long, and what you can do", (await p.getByRole("heading", { name: "Your data" }).count()) === 1 && (await short.isVisible()) && /uses it only to consider you for this call/.test(await short.textContent()) && /30 days after the production finishes/.test(await short.textContent()));
  const more = p.locator('details[data-more="your-data"]');
  check("with the detail folded behind a more control", (await more.count()) === 1 && !(await more.evaluate((el) => el.open)) && (await more.locator("summary").isVisible()) && !(await p.getByText(/data controller/).isVisible()));
  await more.locator("summary").click();
  check("which opens to the controller, the rights and the ICO", (await more.evaluate((el) => el.open)) && (await p.getByText(/data controller/).isVisible()) && (await p.getByText(/Information Commissioner/).isVisible()));
  check("each role says whether it is paid", (await p.getByText("Paid", { exact: true }).count()) >= 1);
  check("lists its roles", (await p.getByText("Nell (Lead)").count()) > 0);
  check("does not leak another casting call", (await p.getByText("Northbank").count()) === 0);
  check("says it is not a job board", (await p.getByText(/not a job board/).count()) > 0);
  await p.screenshot({ path: `${SHOTS}/casting-call.png`, fullPage: true });

  check("a made-up token is a 404",
    (await p.goto(`${BASE}/c/not-a-real-token-at-all`, { waitUntil: "networkidle" })).status() === 404);

  // The token authorises one casting call; another's role must not open under it.
  const crossed = await p.goto(`${BASE}/c/${NORTHBANK}/nell-saltmarsh`, { waitUntil: "networkidle" });
  check("one casting call's link cannot open another's role", crossed.status() === 404, String(crossed.status()));
  await c.close();
}

section("5 role with terms: acceptance is required");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${HEARTH}/couple-hearth`, { waitUntil: "networkidle" });
  check("terms shown on the listing", (await p.getByText("Terms for this role").count()) > 0);
  check("acceptance checkbox present", (await p.locator("#acceptTerms").count()) === 1);
  check("phone is marked required", (await p.locator('label[for="phone"]').innerText()).includes("*"));
  check("the showreel link is marked optional", (await p.locator('label[for="reelUrl"]').innerText()).toLowerCase().includes("optional"));
  check("the submit stays quiet until the form is complete", (await p.getByRole("button", { name: "Send submission" }).getAttribute("data-ready")) === "false");

  await p.fill("#name", "Terms Tester");
  await p.fill("#email", `terms${t}@example.com`);
  await p.fill("#phone", "07700 900111");
  await p.fill("#location", "London"); await p.selectOption("#age", "65");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.check("#acceptSubmissionTerms");
  if (await p.locator("#available").count()) await p.check("#available");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.waitForTimeout(2000);
  check("submitting without accepting the role's terms is refused", (await p.getByText("Submission sent").count()) === 0);
  check("error names the terms", (await p.locator("#acceptTerms-error").count()) === 1);
  check("checkbox marked invalid", (await p.locator("#acceptTerms[aria-invalid='true']").count()) === 1);
  check("summary lists it", (await p.locator("[data-error-summary]").getByText(/Terms for this role/).count()) > 0);

{
  const got = await p.locator("#age").inputValue();
  const names = await p.locator("#name").inputValue();
  check(`the age survives a refusal (age=${JSON.stringify(got)}, name=${JSON.stringify(names)})`, got === "65");
}
  await p.check("#acceptTerms");
  check("and lights up once it is", await p.locator('button[data-ready="true"]', { hasText: "Send submission" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("accepting lets it through", true);
  check("offers the way back to the casting call", (await p.getByRole("link", { name: /Hearth/ }).count()) > 0);
  await c.close();
}

section("6 role without terms: no checkbox, submits cleanly");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${SALTMARSH}/nell-saltmarsh`, { waitUntil: "networkidle" });
  check("no terms block", (await p.getByText("Terms for this role").count()) === 0);
  // The harness has no file store, so the form offers no uploads. Everything
  // else on it is unchanged: the store is an addition, not a dependency.
  check("no upload fields without a store", (await p.locator("#photo").count()) === 0 && (await p.locator("#video").count()) === 0);
  // The applicant's page stands alone: no site navigation, no footer of links.
  check("no site navigation on the applicant page", (await p.locator("header nav").count()) === 0);
  check("and no footer links", (await p.getByRole("link", { name: "Admin", exact: true }).count()) === 0 && (await p.getByRole("link", { name: "Casting director" }).count()) === 0);
  check("but the footer line and the form", (await p.getByText(/covered by UK GDPR/).count()) > 0 && (await p.locator("#name").count()) === 1);
  check("it opens with the words Casting call", (await p.getByText("Casting call", { exact: true }).count()) > 0);
  check("and a picture, or the slate that stands in for one", (await p.locator("img[alt$='header image'], img[alt$='logo'], [role='img'][aria-label*='No picture']").count()) === 1);
  check("and no count of submissions for applicants", (await p.getByText(/so far/).count()) === 0 && (await p.getByText(/^Submissions$/).count()) === 0);
  check("no acceptance checkbox", (await p.locator("#acceptTerms").count()) === 0);
  await p.fill("#name", "No Terms"); await p.fill("#email", `not${t}@example.com`);
  await p.fill("#phone", "07700 900222"); await p.fill("#location", "Essex"); await p.selectOption("#age", "33");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.check("#acceptSubmissionTerms");
  if (await p.locator("#available").count()) await p.check("#available");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("submits without any acceptance", true);
  await c.close();
}

section("7 errors are in situ and accessible");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${SALTMARSH}/nell-saltmarsh`, { waitUntil: "networkidle" });
  await p.fill("#name", "A"); await p.fill("#email", `x${t}@example.com`);
  await p.fill("#phone", "07700 900333"); await p.fill("#location", "Leeds"); await p.selectOption("#age", "31");
  await p.fill("#coverNote", "too short");
  await p.check("#acceptSubmissionTerms");
  if (await p.locator("#available").count()) await p.check("#available");
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
