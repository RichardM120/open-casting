/**
 * The paperwork, as part of the process rather than beside it: the customer
 * accepts the Master Services Agreement before the platform will let them do
 * anything, and an applicant accepts the Terms of Submission before their
 * details are taken, with a parent doing it for a child.
 */
import {
  BASE,
  SHOTS,
  adminSession,
  createAccount,
  at,
  day,
  launch,
  openSession,
  postRole,
  publish,
  reporter,
  session,
  shareTokenForRole,
  signIn,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();
const CO = `Legal Co ${t}`;

const admin = await adminSession(browser, errors);

section("1 a new account meets the agreement before anything else");
const password = await createAccount(admin.p, {
  name: "Dee Rector", company: CO, email: `lg${t}@example.com`, role: "director",
});
const dir = await ctx();
await signIn(dir.p, `lg${t}@example.com`, password);
await dir.p.waitForURL("**/welcome**", { timeout: 20000 });
check("setup opens on the agreement", (await dir.p.getByText("Your agreement with opencasting.app").count()) > 0);
check("the full text is there to read", (await dir.p.getByText(/Master Services Agreement and Data Processing Schedule/).count()) > 0);
check("including the retention clause", (await dir.p.getByText(/deleted at the end of the retention period following the designated Production End Date/).count()) > 0);
check("which says what the default is and that a call keeps its own", (await dir.p.getByText(/thirty \(30\) calendar days unless a different period is recorded/).count()) > 0);
check("and names the sub-processors as they are", (await dir.p.getByText(/Vercel Blob object storage/).count()) > 0 && (await dir.p.getByText(/Resend \(transactional email/).count()) > 0);
check("and the indemnity", (await dir.p.getByText(/defend, indemnify, and hold harmless/).count()) > 0);
check("nothing else is offered yet", (await dir.p.locator("#company").count()) === 0);
await dir.p.screenshot({ path: `${SHOTS}/agreement.png`, fullPage: true });

section("2 the dashboard is shut until it is accepted");
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("sent back to setup", dir.p.url().includes("/welcome"), dir.p.url());
await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
check("and so is opening a casting call", dir.p.url().includes("/welcome"), dir.p.url());

section("3 accepting is recorded, with the version");
await dir.p.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Accept and continue" }).click();
await dir.p.waitForTimeout(1500);
check("an unticked box is refused", (await dir.p.getByText(/Tick to confirm/).count()) > 0);

await dir.p.locator('input[name="accept"]').check();
await dir.p.getByRole("button", { name: "Accept and continue" }).click();
await dir.p.waitForURL(/welcome\?step=/, { timeout: 20000 });
check("accepting moves setup on", (await dir.p.locator("#company").count()) === 1);
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("and the dashboard opens", !dir.p.url().includes("/welcome"), dir.p.url());

await dir.p.goto(`${BASE}/legal/agreement`, { waitUntil: "networkidle" });
check("the acceptance is on record", (await dir.p.getByText(/You have accepted the current version/).count()) > 0);
// Whatever the current version is: pinning the string here means a wording
// change fails the build for the wrong reason.
check("with the version", (await dir.p.getByText(/Version \d{4}-\d{2}-\d{2}, accepted/).count()) > 0);

section("4 the administrator is the service provider, not a customer of it");
await admin.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("no agreement gate for the admin", !admin.p.url().includes("/welcome"), admin.p.url());

/** The version of the Terms the applicant was actually shown. */
let shown = "";

section("5 an applicant accepts the Terms of Submission");
const live = await openSession(dir.p, {
  name: `Legal ${t}`, company: CO, opensAt: at(0), closesAt: at(20, "23:59"), productionEndsAt: day(40),
});
const role = await postRole(dir.p, { title: `LEGAL-${t}`, company: CO, sessionId: live });
await publish(dir.p, live);
const token = await shareTokenForRole(dir.p, role);

{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${role}`, { waitUntil: "networkidle" });
  check("the terms are on the form", (await p.getByText("Terms of Submission").first().count()) > 0);
  check("summarised honestly", (await p.getByText(/never used to train AI|nothing is used to train AI/i).count()) > 0);
  check("with the full text a click away", (await p.getByRole("link", { name: /Read the full Terms of Submission/ }).count()) > 0);
  shown = (await p.getByText(/Version \d{4}-\d{2}-\d{2}/).first().textContent()).match(/\d{4}-\d{2}-\d{2}/)[0];
  check(`and a version stated: ${shown}`, Boolean(shown));

  await p.fill("#name", "Adult Applicant"); await p.fill("#email", `ad${t}@example.com`);
  await p.fill("#phone", "07700 900900"); await p.fill("#location", "Leeds"); await p.selectOption("#age", "34");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.waitForTimeout(2500);
  check("submitting without accepting them is refused", (await p.getByText("Submission sent").count()) === 0);
  check("and the error is on the checkbox", (await p.locator("#acceptSubmissionTerms-error").count()) === 1);
  await p.screenshot({ path: `${SHOTS}/submission-terms.png`, fullPage: true });

  await p.check("#acceptSubmissionTerms");

  if (await p.locator("#available").count()) await p.check("#available");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("accepting lets it through", true);
  await c.close();
}

section("6 a child's submission needs a parent or guardian");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${role}`, { waitUntil: "networkidle" });
  check("no guardian section for an adult", (await p.locator("#guardianName").count()) === 0);

  await p.selectOption("#age", "12");
  await p.waitForTimeout(400);
  check("typing an age under 18 asks for one", (await p.locator("#guardianName").count()) === 1);
  check("and says why", (await p.getByText(/legal parental responsibility/).count()) > 0);

  check("no applicant email asked of a child", (await p.locator("#email").count()) === 0);
  check("the consent block comes first", (await p.locator("form").evaluate((form) => {
    const consent = form.querySelector("#guardianName");
    const name = form.querySelector("#name");
    return Boolean(consent && name) && (consent.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  })));
  await p.fill("#name", "Child Applicant");
  await p.fill("#phone", "07700 900901"); await p.fill("#location", "Leeds");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  await p.check("#acceptSubmissionTerms");
  if (await p.locator("#available").count()) await p.check("#available");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.waitForTimeout(2500);
  check("without consent it is refused", (await p.getByText("Submission sent").count()) === 0);
  check("and it names the reason", (await p.getByText(/under 18, so the submission has to be made by a parent/).count()) > 0);
  check("guardian consent is flagged", (await p.locator("#guardianConsent-error").count()) === 1);
  await p.screenshot({ path: `${SHOTS}/guardian-consent.png`, fullPage: true });

  await p.fill("#guardianName", "Pat Guardian");
  await p.fill("#guardianEmail", `pg${t}@example.com`);
  await p.check("#guardianConsent");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  check("with consent it goes through", true);
  await c.close();
}

section("7 what was accepted is recorded against the submission");
{
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rows = await pool.query(
    `SELECT name, terms_version, guardian_name, guardian_email, guardian_consent_at
       FROM submissions WHERE session_id = $1 ORDER BY name`,
    [live],
  );
  const [adult, child] = [rows.rows.find((r) => r.name === "Adult Applicant"), rows.rows.find((r) => r.name === "Child Applicant")];
  // The version stored against the acceptance is the one they were shown.
  check("the adult's terms version is the one on the form", adult?.terms_version === shown, JSON.stringify(adult));
  check("with no guardian", adult?.guardian_name === null);
  check("the child's guardian is stored", child?.guardian_name === "Pat Guardian", JSON.stringify(child));
  check("with the guardian's email", child?.guardian_email === `pg${t}@example.com`);
  check("and when consent was given", child?.guardian_consent_at !== null);
  await pool.end();
}

section("8 the public terms page stands on its own");
{
  const { c, p } = await ctx();
  const response = await p.goto(`${BASE}/legal/submission-terms`, { waitUntil: "networkidle" });
  check("readable without signing in", response.status() === 200);
  check("covers parental consent", (await p.getByText(/parent or legal guardian with legal parental responsibility/).count()) > 0);
  check("covers prohibited content", (await p.getByText(/nudity, semi-nudity, sexually explicit/).count()) > 0);
  check("covers the purge", (await p.getByText(/destroyed at the end of the retention period after the formal conclusion/).count()) > 0);
  check("and rules out AI training", (await p.getByText(/never be sold, commercialised, or used for automated AI model training/).count()) > 0);
  await c.close();
}

for (const s of [dir, admin]) await s.c.close();
await browser.close();
finish();
