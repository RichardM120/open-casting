/**
 * The administrator's own screens, as the owner uses them.
 *
 * Setting an account up is its own page now, and it asks for the money as well
 * as the person: what the client is invoiced, what they pay and how often,
 * which belong to the client every account under it shares. The long lists,
 * which only ever grow, come in pages of fifty. And Storage says what the site
 * is holding, what is due to be destroyed and whether the nightly sweep that
 * does the destroying is still running.
 */
import pg from "pg";

import {
  ADMIN,
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
  signIn,
  submit,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();
const CO = `Ledger Co ${t}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const admin = await adminSession(browser, errors);

section("1 the accounts page sends you to a page of its own to set one up");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" });
  check("no form on the list", (await p.locator("#clientId").count()) === 0);
  const door = p.getByRole("link", { name: "New account", exact: true });
  check("a button to set one up", (await door.count()) === 1 && (await door.getAttribute("href")) === "/admin/accounts/new");
  await door.click();
  await p.waitForURL(/\/admin\/accounts\/new$/, { timeout: 20000 });
  check("which is the setup page", (await p.getByRole("heading", { name: "Set up an account", level: 1 }).count()) === 1);
}

section("2 setting an account up asks for the person and the money");
// A client to hang the account on, with nothing financial set yet.
await admin.p.goto(`${BASE}/admin/clients/new`, { waitUntil: "networkidle" });
await admin.p.fill("#name", CO);
await admin.p.fill("#contactName", "Fin Ance");
await admin.p.getByRole("button", { name: "Take on the client" }).click();
await admin.p.waitForURL(/\/admin\/clients\/cl_/, { timeout: 20000 });
const clientId = admin.p.url().match(/clients\/(cl_[^?]+)/)[1];

let password = "";
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/accounts/new`, { waitUntil: "networkidle" });
  check("the person and the money are asked for together", (await p.locator("#name").count()) === 1 && (await p.locator("#billingEmail").count()) === 1 && (await p.locator("#ratePence").count()) === 1);
  check("it names the client the money belongs to", (await p.getByText(new RegExp(`Invoiced to ${CO}`)).count()) === 1);

  await p.fill("#name", "Ledger Director");
  await p.fill("#email", `led${t}@example.com`);
  await p.selectOption("#clientId", clientId);
  await p.selectOption("#role", "director");
  await p.fill("#billingEmail", `accounts${t}@example.com`);
  await p.fill("#billingReference", "PO-4471");
  await p.fill("#vatNumber", "GB123456789");
  await p.fill("#paymentTermsDays", "30");
  await p.fill("#ratePence", "450.50");
  await p.selectOption("#billingPeriod", "monthly");
  await p.fill("#address", "1 Quayside, Newcastle upon Tyne");
  await p.selectOption("#tier", "commercial");
  await p.fill("#maxSessions", "4");
  await p.getByRole("button", { name: "Create the account" }).click();
  await p.getByText("Account created", { exact: true }).waitFor({ timeout: 20000 });
  password = (await p.locator("dd.select-all").textContent()).trim();
  check("the password is shown once, on the same page", password.length > 8);
  check("with a way back to the list", (await p.getByRole("link", { name: "Back to accounts" }).count()) === 1);
  await p.screenshot({ path: `${SHOTS}/account-setup.png`, fullPage: true });
}
{
  const { rows } = await pool.query(
    "SELECT billing_email, billing_reference, vat_number, payment_terms_days, rate_pence, billing_period, address, tier, max_sessions FROM clients WHERE id = $1",
    [clientId],
  );
  const saved = rows[0];
  check(
    "the money was saved onto the client, in whole pence",
    saved.billing_email === `accounts${t}@example.com` &&
      saved.billing_reference === "PO-4471" &&
      saved.vat_number === "GB123456789" &&
      saved.payment_terms_days === 30 &&
      saved.rate_pence === 45050 &&
      saved.billing_period === "monthly" &&
      saved.address === "1 Quayside, Newcastle upon Tyne" &&
      saved.tier === "commercial" &&
      saved.max_sessions === 4,
    JSON.stringify(saved),
  );
}
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/clients/${clientId}`, { waitUntil: "networkidle" });
  check("and it reads back on the client, as pounds", (await p.getByText("£450.50 monthly").count()) === 1);
  check("with the terms in days", (await p.getByText("30 days from the invoice").count()) === 1);
  check("and the VAT number", (await p.getByText("GB123456789").count()) === 1);
}
{
  // The account itself works, which is the point of setting one up.
  const dir = await session(browser, errors);
  await signIn(dir.p, `led${t}@example.com`, password);
  await dir.p.waitForURL("**/welcome**", { timeout: 20000 });
  check("the account can sign in with the password it was given", dir.p.url().includes("/welcome"));
  await dir.c.close();
}

section("3 a second account on the same client comes filled in with what they are on");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/accounts/new`, { waitUntil: "networkidle" });
  await p.selectOption("#clientId", clientId);
  check("the invoicing is already there", (await p.inputValue("#billingEmail")) === `accounts${t}@example.com` && (await p.inputValue("#billingReference")) === "PO-4471");
  check("and what they pay", (await p.inputValue("#ratePence")) === "450.50" && (await p.inputValue("#maxSessions")) === "4");
}

section("4 the long lists come in pages of fifty");
{
  // Enough accounts to need a second page, put straight in: the point under
  // test is the paging, not the form, which section 2 covers.
  await pool.query(
    `INSERT INTO users (id, email, name, company, client_id, password_hash, role, onboarded_at)
     SELECT 'usr_pg' || $2 || '_' || n, 'page' || $2 || '-' || n || '@example.com',
            'Paged Person ' || n, $3, $1, 'x', 'director', now()
       FROM generate_series(1, 60) AS n`,
    [clientId, String(t), CO],
  );
  const { p } = admin;
  await p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" });
  const rows = p.locator("main section[aria-labelledby='accounts-heading'] > ul > li");
  check("fifty on the first page", (await rows.count()) === 50, String(await rows.count()));
  check("and it says how many there are in all", (await p.getByText(/Showing 1 to 50 of \d+/).count()) === 1);
  await p.getByRole("link", { name: "Next", exact: true }).click();
  await p.waitForURL(/page=2/, { timeout: 20000 });
  await p.waitForLoadState("networkidle");
  check("the rest are on the second", (await p.getByText(/Showing 51 to \d+ of \d+/).count()) === 1);
  check("the current page is marked", (await p.locator('nav[aria-label="Pages"] [aria-current="page"]').innerText()) === "2");
}
{
  // The trail pages the same way. Sixty entries is more than one page of it.
  await pool.query(
    `INSERT INTO activity (action, actor_name, detail)
     SELECT 'account.created', 'Someone', 'Paged entry ' || n FROM generate_series(1, 60) AS n`,
  );
  const { p } = admin;
  await p.goto(`${BASE}/admin/activity`, { waitUntil: "networkidle" });
  check("fifty entries to a page", (await p.getByText(/Showing 1 to 50 of \d+/).count()) === 1);
  check("and the heading counts the whole trail", (await p.getByText(/\d+ entries, newest first/).count()) === 1);
  await p.goto(`${BASE}/admin/activity?page=2`, { waitUntil: "networkidle" });
  check("page two follows", (await p.getByText(/Showing 51 to \d+ of \d+/).count()) === 1);
}

section("5 Storage says what is held and what is due to go");
const dir = await provision(browser, errors, admin.p, { name: "Store Dir", company: `Store Co ${t}`, email: `st${t}@example.com`, role: "director" });
// It closes before the production finishes, which is the only order the form
// takes, and the details go 30 days after that: 33 days from today.
const sessionId = await openSession(dir.p, { name: `Stored ${t}`, company: `Store Co ${t}`, opensAt: at(-1), closesAt: at(2, "23:59"), productionEndsAt: day(3) });
const roleId = await postRole(dir.p, { sessionId, title: "Kept role", company: `Store Co ${t}` });
await publish(dir.p, sessionId);
{
  const token = await shareToken(dir.p, sessionId);
  const applicant = await session(browser, errors);
  await submit(applicant.p, token, roleId, { name: "Sam Stored", email: `sam${t}@example.com` });
  await applicant.p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await applicant.c.close();
}
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/storage`, { waitUntil: "networkidle" });
  check("the page is the administrator's", (await p.getByRole("heading", { name: "Storage", level: 1 }).count()) === 1);
  check("the database is measured by table", (await p.getByRole("cell", { name: "Submissions", exact: true }).count()) === 1);
  check("and the casting call is listed with the day its applicants' details go", (await p.getByRole("cell", { name: new RegExp(`Stored ${t}`) }).count()) === 1);
  check("with how long that is away", (await p.getByText(/in 33 days/).count()) >= 1);
  // Exact: the sentence under Needs attention says "has never run" too.
  check("the nightly sweep says it has never run", (await p.getByText("Never run", { exact: true }).count()) === 1);
  check("and that is called out as needing attention", (await p.getByRole("heading", { name: "Needs attention" }).count()) === 1 && (await p.getByText(/retention sweep has never run/).count()) === 1);
  check("with no store connected, that is called out too", (await p.getByText(/No file store is connected/).count()) === 1);
  check("what a client is using against what they bought", (await p.getByRole("heading", { name: "Against what they bought" }).count()) === 1 && (await p.getByText(/0 of 4 casting calls/).count()) === 1);
  await p.screenshot({ path: `${SHOTS}/storage.png`, fullPage: true });
}

section("6 the sweep records itself, and Storage says when it last ran");
{
  const response = await fetch(`${BASE}/api/retention`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  check("the sweep runs", response.status === 200, String(response.status));
  const { p } = admin;
  await p.goto(`${BASE}/admin/storage`, { waitUntil: "networkidle" });
  check("and it now says it ran today", (await p.getByText("Ran today").count()) === 1);
  check("with what it did", (await p.getByText(/casting calls destroyed, .* stray files cleared/).count()) === 1);
  check("so the sweep is off the attention list", (await p.getByText(/retention sweep has never run/).count()) === 0);
}

section("7 a director cannot reach any of it");
{
  const paths = ["/admin/storage", "/admin/accounts/new"];
  for (const path of paths) {
    const response = await dir.p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path} is a 404 for a director`, response.status() === 404, String(response.status()));
  }
}

section("8 Projects lists every casting call, and the administrator can pause one");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/projects`, { waitUntil: "networkidle" });
  check("the page lists calls across clients", (await p.getByRole("heading", { name: "Projects", level: 1 }).count()) === 1);
  const row = p.locator("tbody tr").filter({ hasText: `Stored ${t}` });
  check("the call that was opened above is on it", (await row.count()) === 1);
  check("with its client", (await row.getByText(`Store Co ${t}`).count()) >= 1);
  check("and its state", (await row.getByText("Open", { exact: true }).count()) === 1);
  check("one submission against no cap", (await row.getByText("1", { exact: true }).count()) >= 1);

  await row.getByRole("button", { name: "Pause" }).click();
  await p.waitForURL(/changed=1/, { timeout: 20000 });
  check("pausing says so", (await p.getByText(/on its new footing/).count()) === 1);
  const paused = p.locator("tbody tr").filter({ hasText: `Stored ${t}` });
  check("and the call reads as closed", (await paused.getByText("Closed", { exact: true }).count()) === 1);
  check("with a way to put it back", (await paused.getByRole("button", { name: "Reopen" }).count()) === 1);
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    paused.getByRole("button", { name: "Reopen" }).click(),
  ]);
  const reopened = p.locator("tbody tr").filter({ hasText: `Stored ${t}` });
  await reopened.getByText("Open", { exact: true }).waitFor({ timeout: 20000 }).catch(() => {});
  check("reopening puts it back", (await reopened.getByText("Open", { exact: true }).count()) === 1);
  await p.screenshot({ path: `${SHOTS}/projects.png`, fullPage: true });
}

section("9 a cap closes a casting call once it is met");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/projects`, { waitUntil: "networkidle" });
  const row = p.locator("tbody tr").filter({ hasText: `Stored ${t}` });
  await row.locator("details summary").click();
  await row.locator('input[name="submissionCap"]').fill("1");
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    row.getByRole("button", { name: "Save" }).click(),
  ]);
  const capped = p.locator("tbody tr").filter({ hasText: `Stored ${t}` });
  await capped.getByText("Full", { exact: true }).waitFor({ timeout: 20000 }).catch(() => {});
  check("the cap shows against what has come in", (await capped.getByText("1 / 1").count()) === 1);
  check("and the call reads as full", (await capped.getByText("Full", { exact: true }).count()) === 1);
  check("filtering by full finds it", (await p.getByRole("link", { name: /^Full · 1$/ }).count()) === 1);
}
{
  // The applicant's side: a full call offers no form and says why.
  const token = await shareToken(dir.p, sessionId);
  const applicant = await session(browser, errors);
  await applicant.p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("the call's page says it is full", (await applicant.p.getByText(/taken all the submissions it can/).count()) === 1);
  await applicant.p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("the role offers no form", (await applicant.p.locator("#coverNote").count()) === 0);
  check("and says why", (await applicant.p.getByRole("heading", { name: "This casting call is full" }).count()) === 1);
  await applicant.c.close();
}
{
  // And the casting team sees the cap on their own page.
  await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
  check("the casting call's own page carries the cap", (await dir.p.getByText("1 of 1, so it is closed to new ones").count()) === 1);
}

section("10 a director cannot reach Projects");
{
  const response = await dir.p.goto(`${BASE}/admin/projects`, { waitUntil: "networkidle" });
  check("/admin/projects is a 404 for a director", response.status() === 404, String(response.status()));
}

section("11 the submissions feed carries everything, and holds media back");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/submissions`, { waitUntil: "networkidle" });
  check("the feed lists submissions across every call", (await p.getByRole("heading", { name: "Submissions", level: 1 }).count()) === 1);
  const row = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  check("the submission made above is on it", (await row.count()) === 1);
  check("with its role and its casting call", (await row.getByText(`Stored ${t}`).count()) >= 1 && (await row.getByText("Kept role").count()) >= 1);
  check("and its status", (await row.getByText("New", { exact: true }).count()) === 1);

  await row.getByRole("link", { name: "Open", exact: true }).click();
  await p.waitForURL(/open=/, { timeout: 20000 });
  const opened = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  check("opening it shows the applicant's details", (await opened.getByText(`sam${t}@example.com`).count()) === 1);
  check("and their cover note", (await opened.getByText(/comfortably longer than the twenty character minimum/).count()) === 1);

  await opened.locator('input[name="reason"]').fill("Checking the tape");
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    opened.getByRole("button", { name: "Hold the media back" }).click(),
  ]);
  check("holding it back says so", (await p.getByText(/cannot fetch that photo or those tapes/).count()) === 1);
  const held = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  check("and the row is marked", (await held.getByText("Media held back").count()) === 1);
  check("filtering by held back finds it", (await p.getByRole("link", { name: /^Held back · 1$/ }).count()) === 1);
}
{
  // The casting team cannot fetch a held file; the administrator still can.
  const { rows } = await pool.query("SELECT id, media_flagged_at, media_flag_reason FROM submissions WHERE email = $1", [`sam${t}@example.com`]);
  check("the flag is on the submission, with the reason", rows[0]?.media_flagged_at !== null && rows[0].media_flag_reason === "Checking the tape", JSON.stringify(rows[0]));
}
{
  const { p } = admin;
  // The redirect kept the submission open, so the release button is here.
  const row = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  await row.getByRole("button", { name: "Release the media" }).waitFor({ timeout: 20000 });
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    row.getByRole("button", { name: "Release the media" }).click(),
  ]);
  check("releasing it says so", (await p.getByText(/can see it again/).count()) === 1);
  check("and the mark is gone", (await p.locator("main ul > li").filter({ hasText: "Sam Stored" }).getByText("Media held back").count()) === 0);
  await p.screenshot({ path: `${SHOTS}/submissions-feed.png`, fullPage: true });
}
{
  // Both are in the trail, against the administrator who did them.
  const { p } = admin;
  await p.goto(`${BASE}/admin/activity`, { waitUntil: "networkidle" });
  check("holding back is recorded", (await p.getByText(/held back a photo or tape on/).count()) >= 1);
  check("and so is releasing", (await p.getByText(/released a photo or tape on/).count()) >= 1);
}

section("12 a submission can be removed from the feed, with its files");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/submissions?open=`, { waitUntil: "networkidle" });
  const row = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  await row.getByRole("link", { name: "Open", exact: true }).click();
  await p.waitForURL(/open=/, { timeout: 20000 });
  const opened = p.locator("main ul > li").filter({ hasText: "Sam Stored" });
  await opened.getByText("Remove this submission").click();
  await opened.locator('input[name="confirm"]').check();
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    opened.getByRole("button", { name: "Remove submission and files" }).click(),
  ]);
  check("it says the submission is gone", (await p.getByText(/files are gone/).count()) === 1);
  check("and it is off the feed", (await p.locator("main ul > li").filter({ hasText: "Sam Stored" }).count()) === 0);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE email = $1", [`sam${t}@example.com`]);
  check("the row is gone from the database", rows[0].n === 0);
  await p.goto(`${BASE}/admin/activity`, { waitUntil: "networkidle" });
  check("the removal is in the trail", (await p.getByText(/removed a submission from/).count()) >= 1);
}

section("13 a director cannot reach the feed");
{
  const response = await dir.p.goto(`${BASE}/admin/submissions`, { waitUntil: "networkidle" });
  check("/admin/submissions is a 404 for a director", response.status() === 404, String(response.status()));
}

section("14 Privacy: a request is logged, answered, and what is held is found and erased");
// Its own applicant: the one above was removed in section 12, and an erasure
// test needs somebody who is actually held.
const PRIV = `priv${t}@example.com`;
{
  const held = await openSession(dir.p, { name: `Held ${t}`, company: `Store Co ${t}`, opensAt: at(-1), closesAt: at(10, "23:59"), productionEndsAt: day(20) });
  const heldRole = await postRole(dir.p, { sessionId: held, title: "Held role", company: `Store Co ${t}` });
  await publish(dir.p, held);
  const token = await shareToken(dir.p, held);
  const applicant = await session(browser, errors);
  await submit(applicant.p, token, heldRole, { name: "Pria Vacy", email: PRIV });
  await applicant.p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await applicant.c.close();
}
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/privacy`, { waitUntil: "networkidle" });
  check("the page is the administrator's", (await p.getByRole("heading", { name: "Privacy", level: 1 }).count()) === 1);
  check("it states the retention rules", (await p.getByText(/Destroyed 30 days after the production finishes/).count()) === 1 && (await p.getByText(/Deleted 30 days after casting closes/).count()) === 1);
  check("and says what the next sweep would take", (await p.getByText(/If the sweep ran now/).count()) === 1);

  await p.fill("#email", PRIV);
  await p.selectOption("#kind", "access");
  await p.fill("#note", "Asked by email");
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.getByRole("button", { name: "Log the request" }).click()]);
  check("logging a request says how long there is", (await p.getByText(/30 days to answer it/).count()) === 1);
  const request = p.locator('[data-requests="open"] > li').filter({ hasText: PRIV });
  check("it is on the list with the days left", (await request.count()) === 1 && (await request.getByText(/days left/).count()) === 1);
}
{
  // Looking one up finds every submission they made, across calls.
  const { p } = admin;
  await p.goto(`${BASE}/admin/privacy?who=${encodeURIComponent(PRIV)}`, { waitUntil: "networkidle" });
  check("what is held is listed", (await p.getByRole("cell", { name: "Held role" }).count()) >= 1);
  check("with what it carries", (await p.getByText("no files").count()) >= 1);
  check("and a bundle to hand over", (await p.getByRole("link", { name: "Bundle what is held" }).count()) === 1);
}
{
  // The bundle itself.
  // Fetched from inside the page, as the browser fetches it when the link is
  // followed: that is the path with the session cookie on it.
  const got = await admin.p.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, type: response.headers.get("content-type") ?? "", body: await response.text() };
  }, `${BASE}/admin/privacy/export?email=${encodeURIComponent(PRIV)}`);
  check("the bundle downloads as JSON", got.status === 200 && got.type.includes("application/json"), `${got.status} ${got.type}`);
  const bundle = JSON.parse(got.body);
  check("and holds their submissions", bundle.about === PRIV && bundle.submissions.length === 1, JSON.stringify(bundle).slice(0, 200));
  check("with a place for anything held apart from them", Array.isArray(bundle.answersAboutProtectedCharacteristics));
}
{
  // Erasure: the address has to be typed again.
  const { p } = admin;
  await p.goto(`${BASE}/admin/privacy?who=${encodeURIComponent(PRIV)}`, { waitUntil: "networkidle" });
  await p.locator('details[data-more="erase"] summary').click();
  await p.fill("#confirmEmail", "someone-else@example.com");
  await p.locator('input[name="confirm"]').check();
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.getByRole("button", { name: "Erase everything held about them" }).click()]);
  check("a mistyped address deletes nothing", (await p.getByText(/did not match. Nothing was deleted/).count()) === 1);
  const still = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE lower(email) = lower($1)", [PRIV]);
  check("and the submission is still there", still.rows[0].n === 1);

  await p.goto(`${BASE}/admin/privacy?who=${encodeURIComponent(PRIV)}`, { waitUntil: "networkidle" });
  await p.locator('details[data-more="erase"] summary').click();
  await p.fill("#confirmEmail", PRIV);
  await p.locator('input[name="confirm"]').check();
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.getByRole("button", { name: "Erase everything held about them" }).click()]);
  check("the right address erases them", (await p.getByText(/every file with them are gone/).count()) === 1);
  const gone = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE lower(email) = lower($1)", [PRIV]);
  check("the submission is gone", gone.rows[0].n === 0);
  const answers = await pool.query(
    "SELECT count(*)::int AS n FROM special_answers a JOIN submissions s ON s.id = a.submission_id WHERE lower(s.email) = lower($1)",
    [PRIV],
  );
  check("and nothing of theirs is left in the answers held apart", answers.rows[0].n === 0);
  await p.screenshot({ path: `${SHOTS}/privacy.png`, fullPage: true });
}
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/privacy`, { waitUntil: "networkidle" });
  const request = p.locator('[data-requests="open"] > li').filter({ hasText: PRIV });
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), request.getByRole("button", { name: "Mark answered" }).click()]);
  check("a request can be marked answered", (await p.getByText("Marked answered.").count()) === 1);
  check("and drops off the list of those to answer", (await p.locator('[data-requests="open"] > li').filter({ hasText: PRIV }).count()) === 0);
  check("but is kept as answered", (await p.locator('[data-requests="answered"] > li').filter({ hasText: PRIV }).count()) === 1);
  await p.goto(`${BASE}/admin/activity`, { waitUntil: "networkidle" });
  check("both are in the trail", (await p.getByText(/logged a request about somebody's own data/).count()) >= 1 && (await p.getByText(/removed applicant details/).count()) >= 1);
}

section("15 the sweep can be run by hand from Privacy");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/privacy`, { waitUntil: "networkidle" });
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.getByRole("button", { name: "Run the sweep now" }).click()]);
  check("it runs and says what it took", (await p.getByText(/The sweep ran\./).count()) === 1);
  check("and the badge says it swept today", (await p.getByText("Swept today").count()) === 1);
}

section("16 a director cannot reach Privacy");
{
  for (const path of ["/admin/privacy", "/admin/privacy/export?email=someone@example.com"]) {
    const response = await dir.p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`${path} is a 404 for a director`, response.status() === 404, String(response.status()));
  }
}

section("17 the audit log is the record, searchable and unscoped");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/audit-logs`, { waitUntil: "networkidle" });
  check("the page is the administrator's", (await p.getByRole("heading", { name: "Audit log", level: 1 }).count()) === 1);
  check("it carries the columns the record needs", (await p.getByRole("columnheader", { name: "Who" }).count()) === 1 && (await p.getByRole("columnheader", { name: "To what" }).count()) === 1 && (await p.getByRole("columnheader", { name: "From" }).count()) === 1);
  check("and shows what has happened", (await p.locator("tbody tr").count()) > 0);

  await p.fill("#q", ADMIN.email);
  await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.getByRole("button", { name: "Search" }).click()]);
  check("searching by an email finds that account's actions", (await p.locator("tbody tr").count()) > 0 && (await p.getByText(ADMIN.email).first().count()) === 1);
  check("and says how many match", (await p.getByText(/entries match|entry matches/).count()) === 1);

  await p.goto(`${BASE}/admin/audit-logs?action=media.flagged`, { waitUntil: "networkidle" });
  check("filtering by action narrows it", (await p.locator("tbody tr").count()) >= 1 && (await p.getByText("media.flagged").first().count()) === 1);

  await p.goto(`${BASE}/admin/audit-logs?q=nothing-matches-this-at-all`, { waitUntil: "networkidle" });
  check("a search that matches nothing says so", (await p.getByText(/Nothing matches/).count()) === 1);
  await p.goto(`${BASE}/admin/audit-logs`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `${SHOTS}/audit-log.png`, fullPage: true });
}
{
  // The address is on every entry the app recorded.
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM activity WHERE actor_ip IS NOT NULL");
  check("entries carry the address they came from", rows[0].n > 0, String(rows[0].n));
}

section("18 a director cannot reach the audit log");
{
  const response = await dir.p.goto(`${BASE}/admin/audit-logs`, { waitUntil: "networkidle" });
  check("/admin/audit-logs is a 404 for a director", response.status() === 404, String(response.status()));
}

section("19 the automated emails: wording, sending, and the delivery log");
{
  const { p } = admin;
  await p.goto(`${BASE}/admin/notifications`, { waitUntil: "networkidle" });
  check("the page is the administrator's", (await p.getByRole("heading", { name: "Notifications", level: 1 }).count()) === 1);
  check("all three are listed", (await p.getByRole("heading", { name: "A submission arrives" }).count()) === 1 && (await p.getByRole("heading", { name: "A submission's status changes" }).count()) === 1 && (await p.getByRole("heading", { name: "A casting call is nearly full" }).count()) === 1);
  check("each starts as the wording that ships", (await p.getByText("As it ships").count()) === 3);

  await p.fill("#subject-submission_received", "We have your submission for {{role}}");
  await Promise.all([
    p.waitForNavigation({ timeout: 20000 }),
    p.locator('form:has(#subject-submission_received)').getByRole("button", { name: "Save the wording" }).click(),
  ]);
  check("the wording can be changed", (await p.getByText(/The next message uses it/).count()) === 1);
  check("and it says it was changed", (await p.getByText(/^Changed /).count()) === 1);
  check("with a way to put it back", (await p.getByRole("button", { name: "Put it back" }).count()) === 1);
}
{
  // A submission now sends a receipt, in the wording set above.
  const call = await openSession(dir.p, { name: `Told ${t}`, company: `Store Co ${t}`, opensAt: at(-1), closesAt: at(5, "23:59"), productionEndsAt: day(10) });
  const role = await postRole(dir.p, { sessionId: call, title: "Told role", company: `Store Co ${t}` });
  await publish(dir.p, call);
  const token = await shareToken(dir.p, call);
  const applicant = await session(browser, errors);
  await submit(applicant.p, token, role, { name: "Tilly Told", email: `told${t}@example.com` });
  await applicant.p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await applicant.c.close();

  const { p } = admin;
  await p.goto(`${BASE}/admin/notifications?tab=log`, { waitUntil: "networkidle" });
  const row = p.locator("tbody tr").filter({ hasText: `told${t}@example.com` });
  check("the receipt is in the delivery log", (await row.count()) === 1);
  check("in the wording that was set", (await row.getByText("We have your submission for Told role").count()) === 1);
  check("against the trigger that sent it", (await row.getByText("submission_received").count()) === 1);
  check("and it says whether it got there", (await row.getByText("Sent").count()) === 1);
  await p.screenshot({ path: `${SHOTS}/notifications.png`, fullPage: true });

  // And a status change tells them too. The status control saves by itself, so
  // the log is polled rather than waited on for a fixed time: a loaded machine
  // takes longer than a quiet one and neither is a fault.
  await dir.p.goto(`${BASE}/dashboard/roles/${role}`, { waitUntil: "networkidle" });
  await dir.p.locator('select[aria-label="Submission status"]').first().selectOption("Shortlisted");
  let told = 0;
  for (let attempt = 0; attempt < 20 && told === 0; attempt += 1) {
    await p.goto(`${BASE}/admin/notifications?tab=log`, { waitUntil: "networkidle" });
    told = await p.locator("tbody tr").filter({ hasText: "status_update" }).count();
    if (told === 0) await p.waitForTimeout(500);
  }
  check("a status change tells the applicant", told >= 1, String(told));
}

section("20 a director cannot reach the notifications");
{
  const response = await dir.p.goto(`${BASE}/admin/notifications`, { waitUntil: "networkidle" });
  check("/admin/notifications is a 404 for a director", response.status() === 404, String(response.status()));
}

await pool.end();
await dir.c.close();
await admin.c.close();
await browser.close();
finish();
