/**
 * A casting call can run to hundreds of submissions. This one has two hundred
 * in a single role, fifty of them with a photo, put straight into the
 * database because two hundred trips through the form would take the suite
 * most of ten minutes. The pages, the photos, the placeholders and the export
 * are then read the way a director would read them.
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import pg from "pg";

import {
  BASE,
  SHOTS,
  at,
  launch,
  openSession,
  postRole,
  publish,
  reporter,
  adminSession,
  provision,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();
const CO = `Volume Co ${t}`;

const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, { name: "Val Dir", company: CO, email: `vd${t}@example.com`, role: "director" });

section("1 two hundred submissions in one casting call, fifty with a photo");
const sessionId = await openSession(dir.p, { name: `Volume ${t}`, company: CO, opensAt: at(-1), closesAt: at(30, "23:59") });
const roleId = await postRole(dir.p, { sessionId, title: "Ensemble", company: CO });
await publish(dir.p, sessionId);
{
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Every fourth applicant sent a photo. Newest first, so the first page is
  // applicants 1 to 25, six of them with a photo.
  await pool.query(
    `INSERT INTO submissions
       (id, role_id, session_id, name, email, phone, location, age, reel_url, profile_url,
        cover_note, status, accepted_at, terms_version, photo_url, submitted_at)
     SELECT 'sub_vol' || $3 || '_' || n, $1, $2,
            'Applicant ' || n,
            'vol' || $3 || '-' || n || '@example.com',
            '07700 900' || lpad(n::text, 3, '0'),
            'Leeds', 20 + (n % 40), '', '',
            'A cover note for applicant ' || n || ', comfortably past the minimum.',
            'New', now(), 'v1',
            CASE WHEN n % 4 = 0
                 THEN 'https://test.private.blob.vercel-storage.com/submissions/' || $2 || '/' || $1 || '/photo/p' || n || '.jpg'
            END,
            now() - (n || ' minutes')::interval
       FROM generate_series(1, 200) AS n`,
    [roleId, sessionId, String(t)],
  );
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM submissions WHERE session_id = $1", [sessionId]);
  check("two hundred rows in the database", rows[0].n === 200, String(rows[0].n));
  await pool.end();
}

section("2 the dashboard counts them");
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const card = dir.p.locator(`li:has(a[href="/dashboard/sessions/${sessionId}"])`).first();
check("two hundred submitted", (await card.locator('[data-figure="submitted"]').innerText()) === "200");
check("two hundred to review", (await card.locator('[data-figure="to-review"]').innerText()) === "200");

section("3 the casting call's page shows them in pages of twenty-five");
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
check("the summary counts everything", (await dir.p.getByText("200 across 1 role, 200 still to review.").count()) > 0);
check("twenty-five rows", (await dir.p.locator("table tbody tr").count()) === 25, String(await dir.p.locator("table tbody tr").count()));
check("says which are showing", (await dir.p.getByText("Showing 1 to 25 of 200").count()) > 0);
check("newest first", (await dir.p.locator("table tbody tr").first().innerText()).includes("Applicant 1\n") || (await dir.p.locator("table tbody tr").first().getByText("Applicant 1", { exact: true }).count()) > 0);
// The harness has no file store, so the six photos on this page cannot be
// fetched, and each shows as "not available" rather than as a broken image.
check("six photos attempted on the first page", (await dir.p.locator('table [data-photo="unavailable"]').count()) === 6, String(await dir.p.locator('table [data-photo="unavailable"]').count()));
check("nineteen placeholders", (await dir.p.locator('table [data-photo="none"]').count()) === 19, String(await dir.p.locator('table [data-photo="none"]').count()));
check("the placeholder says what it is", (await dir.p.locator('table [data-photo="none"]').first().getAttribute("aria-label")) === "No photo submitted");
check("and so does the other", (await dir.p.locator('table [data-photo="unavailable"]').first().getAttribute("aria-label")) === "Photo not available");
await dir.p.screenshot({ path: `${SHOTS}/pagination.png`, fullPage: true });

await dir.p.getByRole("link", { name: "Next", exact: true }).click();
await dir.p.waitForURL(/page=2/, { timeout: 20000 });
await dir.p.waitForLoadState("networkidle");
check("the second page follows", (await dir.p.getByText("Showing 26 to 50 of 200").count()) > 0);
check("and has its own twenty-five", (await dir.p.locator("table tbody tr").count()) === 25);
check("the current page is marked", (await dir.p.locator('nav[aria-label="Pages"] [aria-current="page"]').innerText()) === "2");

await dir.p.getByRole("link", { name: "8", exact: true }).click();
await dir.p.waitForURL(/page=8/, { timeout: 20000 });
await dir.p.waitForLoadState("networkidle");
check("the last page", (await dir.p.getByText("Showing 176 to 200 of 200").count()) > 0);
check("seven photos attempted on it", (await dir.p.locator('table [data-photo="unavailable"]').count()) === 7, String(await dir.p.locator('table [data-photo="unavailable"]').count()));
check("eighteen placeholders on it", (await dir.p.locator('table [data-photo="none"]').count()) === 18);
check("Next goes no further", (await dir.p.locator('nav[aria-label="Pages"]').getByRole("link", { name: "Next", exact: true }).count()) === 0);

await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}?page=99`, { waitUntil: "networkidle" });
check("a page past the end shows the last one", (await dir.p.getByText("Showing 176 to 200 of 200").count()) > 0);

await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}?status=New&page=3`, { waitUntil: "networkidle" });
check("a filter and a page together", (await dir.p.getByText("Showing 51 to 75 of 200").count()) > 0);
check("the page links keep the filter", ((await dir.p.locator('nav[aria-label="Pages"]').getByRole("link", { name: "Next", exact: true }).getAttribute("href")) ?? "").includes("status=New"));
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}?status=Declined`, { waitUntil: "networkidle" });
check("an empty status has no pages", (await dir.p.locator('nav[aria-label="Pages"]').count()) === 0 && (await dir.p.getByText("Nothing is marked Declined at the moment.").count()) > 0);

section("4 the role's page pages the cards the same way");
await dir.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
const cards = dir.p.locator('li:has(select[aria-label="Submission status"])');
check("twenty-five cards", (await cards.count()) === 25, String(await cards.count()));
check("says which are showing", (await dir.p.getByText("Showing 1 to 25 of 200").count()) > 0);
check("the total is still two hundred", (await dir.p.getByText("200 total").count()) > 0);
check("six photos attempted among the cards", (await dir.p.locator('li [data-photo="unavailable"]').count()) === 6);
check("and nineteen placeholders", (await dir.p.locator('li [data-photo="none"]').count()) === 19);
await dir.p.getByRole("link", { name: "Next", exact: true }).click();
await dir.p.waitForURL(/page=2/, { timeout: 20000 });
await dir.p.waitForLoadState("networkidle");
check("the second page of cards", (await dir.p.getByText("Showing 26 to 50 of 200").count()) > 0);

section("5 the export has every one of them");
await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
const [download] = await Promise.all([
  dir.p.waitForEvent("download", { timeout: 30000 }),
  dir.p.getByRole("link", { name: "Download spreadsheet" }).click(),
]);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(readFileSync(await download.path()));
const sheet = workbook.getWorksheet("Submissions");
let rows = 0;
let photos = 0;
sheet.eachRow((row, n) => {
  if (n === 1) return;
  rows += 1;
  if (String(row.getCell(11).value) === "Yes") photos += 1;
});
check("two hundred rows in the spreadsheet", rows === 200, String(rows));
check("fifty of them marked as having a photo", photos === 50, String(photos));

await dir.c.close();
await admin.c.close();
await browser.close();
finish();
