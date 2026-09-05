/**
 * A casting call at capacity. The director sets one up through the forms
 * with every option on: a production company and a banner, their own
 * inclusion statement, an agent route and their own tape guidance on the
 * call; then a lead role that asks for everything and makes all of it
 * mandatory, with three videos set out, terms to accept and a question
 * about a protected characteristic, and two plainer roles beside it. An
 * applicant goes through the whole form, photo and tapes included, and six
 * more go through it at once. The roles are then filled to over a thousand
 * submissions straight into the database, since a thousand trips through
 * the form would take an hour: photos that load, photos that cannot, three
 * tapes, guardians, every status, and names, emails, locations and cover
 * notes far longer than anyone plans for. Every page a director then reads
 * is timed and checked for a layout that broke, on a desktop and on a
 * phone, and the spreadsheet is downloaded and emailed with every row in it.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import ExcelJS from "exceljs";
import pg from "pg";

import {
  BASE,
  SHOTS,
  adminSession,
  at,
  day,
  launch,
  openAdvanced,
  postRole,
  provision,
  publish,
  reporter,
  session,
  shareToken,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const STANDIN = process.env.BLOB_STANDIN;
const PROXY = process.env.BLOB_PROXY;
if (!STANDIN || !PROXY) {
  console.log("  ✗ BLOB_STANDIN is not set: run this suite through test/run.mjs");
  process.exit(1);
}
// As in the uploads suite: the browser's uploads go to vercel.com, which the
// harness's proxy tunnels to the stand-in store.
const browser = await launch({
  proxy: { server: PROXY, bypass: "127.0.0.1,localhost" },
  args: ["--ignore-certificate-errors"],
});
const t = Date.now();
const CO = `Capacity Co ${t}`;
const CALL = `Capacity ${t}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** How many go straight into the database, per role. Over a thousand between them. */
const SEEDED = { lead: 600, ensemble: 400, extra: 200 };
/** How many go through the form at once, after the one that goes first. */
const RUSH = 6;
/** The most a page may take to load, twice over, on the harness's machine. */
const PAGE_BUDGET_MS = 4000;
const EXPORT_BUDGET_MS = 15000;

/* ------------------------------------------------------------- fixtures -- */

/** A 1×1 PNG: a photo that decodes. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
/** A tape that is not one: the browser cannot read a length off it, so no limit applies, and the store takes the bytes. */
const MP4 = Buffer.alloc(48 * 1024, 7);

/** A wide solid PNG, for the banner, as the uploads suite draws it. */
function png(width, height) {
  const table = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (bytes) => {
    let c = -1;
    for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = 0xa2;
    row[2 + x * 3] = 0x43;
    row[3 + x * 3] = 0x32;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const BANNER = png(2400, 600);

const INCLUSION = "This production is casting from the North East and welcomes submissions from everyone who fits the brief, whatever their background.";
const AGENT_ROUTE = "Represented UK actors: please apply through your agent rather than this form. Agents should send tapes to casting@example.com.";
const TAPE_GUIDANCE = ["Film in landscape.", "Say your name and the role first.", "Keep it under the length asked for."].join("\n");
const TERMS = "Usage is UK, all media, 12 months. The day rate does not include the buyout. Submitting confirms you are free for the shoot dates.";
const QUESTION = "Do you have South Asian heritage?";

/**
 * What the seeded rows look like, by their number. The SQL below says the
 * same thing, so the counts the pages are expected to show are worked out
 * here rather than typed in.
 */
const seeded = {
  status: (n) => (n % 25 === 0 ? "Callback" : n % 10 === 0 ? "Shortlisted" : n % 7 === 0 ? "Declined" : "New"),
  photo: (n) => (n % 4 === 0 ? "real" : n % 10 === 1 ? "missing" : "none"),
  videos: (n) => n % 5 === 0,
  minor: (n) => n % 25 === 0,
};
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ROWS = {
  lead: range(1, SEEDED.lead),
  ensemble: range(SEEDED.lead + 1, SEEDED.lead + SEEDED.ensemble),
  extra: range(SEEDED.lead + SEEDED.ensemble + 1, SEEDED.lead + SEEDED.ensemble + SEEDED.extra),
};
const ALL = [...ROWS.lead, ...ROWS.ensemble, ...ROWS.extra];
/** The seeded row whose neighbours carry the longest values: n % 50 picks them, so 100 to 104. */
const LONG = 100;

/* -------------------------------------------------------------- helpers -- */

const timings = [];
/** Loads a page and notes how long it took, images included. */
async function timed(page, url, label) {
  const started = Date.now();
  await page.goto(url, { waitUntil: "load" });
  const ms = Date.now() - started;
  timings.push({ label, ms });
  return ms;
}

/**
 * Whether anything on the page pokes out past the right edge of the
 * viewport, other than the wells that are meant to scroll sideways (a wide
 * table on a phone). A page that scrolls sideways is the layout breaking.
 */
async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const culprits = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.closest(".overflow-x-auto") && !element.classList.contains("overflow-x-auto")) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= doc.clientWidth + 1) continue;
      const name = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${[...element.classList].slice(0, 4).join(".")}`;
      culprits.push(`${name} right=${Math.round(rect.right)}`);
    }
    return { spill: doc.scrollWidth - doc.clientWidth, culprits: culprits.slice(0, 6) };
  });
}
async function fits(page, label) {
  const found = await overflow(page);
  check(
    `${label} fits the viewport`,
    found.spill <= 0 && found.culprits.length === 0,
    `spills ${found.spill}px; ${found.culprits.join(" | ") || "nothing named"}`,
  );
}

/** Waits until at least `n` elements match, then counts them: image errors land one at a time. */
async function settled(page, selector, n) {
  if (n > 0) await page.locator(selector).nth(n - 1).waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
  return page.locator(selector).count();
}

/** Whether every photo shown decoded to a real picture. */
const allRendered = (page) =>
  page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('img[src^="/api/media"]')].map((img) =>
        img.decode().then(() => img.naturalWidth > 0, () => false),
      ),
    ).then((results) => results.every(Boolean)),
  );

const count = async (sql, params) => Number((await pool.query(sql, params)).rows[0].n);

/* ------------------------------------------------------------------ 0 -- */

section("0 the deployment reports the store");
{
  const health = await (await fetch(`${BASE}/api/health`)).json();
  check("uploads are ready", health.uploads === "ready", JSON.stringify(health));
}

/* ------------------------------------------------------------------ 1 -- */

section("1 the director sets up the casting call with every option on");
const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, {
  name: "Cap Acity",
  company: CO,
  email: `cap${t}@example.com`,
  role: "director",
});

await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
await openAdvanced(dir.p);
await dir.p.fill("#name", CALL);
await dir.p.selectOption("#productionType", "TV Series");
await dir.p.fill("#synopsis", "A six-part drama set on the Tyne, casting every speaking part and a large ensemble from the region, described here at length for the form.");
await dir.p.fill("#opensAt", at(-1));
await dir.p.fill("#closesAt", at(30, "23:59"));
await dir.p.fill("#productionEndsAt", day(60));
await dir.p.fill("#productionCompany", "Wildseed Films");
await dir.p.setInputFiles("#hero", { name: "banner.png", mimeType: "image/png", buffer: BANNER });
await dir.p
  .waitForFunction(() => (document.querySelector('input[name="heroUrl"]')?.value ?? "").startsWith("https://"), null, { timeout: 30000 })
  .catch(async () => {
    const said = await dir.p.locator("#hero-error").textContent().catch(() => null);
    check("the banner uploaded", false, `the form said: ${said ?? "nothing"}; browser: ${errors.join(" | ") || "no errors"}`);
    finish();
  });
check("the banner uploaded", true);
await dir.p.fill("#inclusionStatement", INCLUSION);
await dir.p.fill("#agentRoute", AGENT_ROUTE);
await dir.p.fill("#tapeGuidance", TAPE_GUIDANCE);
// Close the folds to read their one-line summaries, which say what is set.
await dir.p.evaluate(() => {
  for (const fold of document.querySelectorAll("details[data-more]")) fold.open = false;
});
check(
  "the production fold says what it holds",
  (await dir.p.locator('details[data-more="production"] summary').textContent()).includes("Wildseed Films, with a banner."),
);
{
  const told = await dir.p.locator('details[data-more="told"] summary').textContent();
  check(
    "and so does the fold for what applicants are told",
    /Your own inclusive casting statement/.test(told) && /represented applicants are sent to their agent/.test(told),
    told,
  );
}
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.waitForURL(/\/dashboard\/sessions\/ses_/, { timeout: 20000 });
const sessionId = dir.p.url().match(/sessions\/(ses_[^?]+)/)[1];
{
  const { rows } = await pool.query(
    "SELECT production_type, production_company, hero_url, hero_kind, inclusion_statement, agent_route, tape_guidance FROM sessions_casting WHERE id = $1",
    [sessionId],
  );
  const saved = rows[0];
  check(
    "everything on the call was saved",
    saved.production_type === "TV Series" &&
      saved.production_company === "Wildseed Films" &&
      /\.blob\.vercel-storage\.com\/calls\//.test(saved.hero_url ?? "") &&
      saved.hero_kind === "banner" &&
      saved.inclusion_statement === INCLUSION &&
      saved.agent_route === AGENT_ROUTE &&
      saved.tape_guidance === TAPE_GUIDANCE,
    JSON.stringify(saved),
  );
}

/* ------------------------------------------------------------------ 2 -- */

section("2 the lead role asks for everything and makes all of it mandatory");
await dir.p.goto(`${BASE}/dashboard/roles/new`, { waitUntil: "networkidle" });
await dir.p.selectOption("#sessionId", sessionId);
await dir.p.fill("#title", "Nell (Lead)");
await dir.p.fill("#characterBrief", "Nell runs the boatyard her father left her and is losing it a plank at a time. Dry, quick, never asks for help. A character brief comfortably long enough to pass validation.");
await dir.p.fill("#requirements", ["Confident in open water", "Available for three weeks on location", "A Tyneside accent, or the ability to hold one"].join("\n"));
await dir.p.fill("#ageMin", "25");
await dir.p.fill("#ageMax", "40");
await dir.p.fill("#location", "Newcastle upon Tyne, UK");
await dir.p.fill("#shootStartsAt", day(120));
await dir.p.fill("#shootEndsAt", day(140));
await openAdvanced(dir.p);

const asks = dir.p.locator("[data-ask]");
const askCount = await asks.count();
for (let i = 0; i < askCount; i += 1) {
  const row = asks.nth(i);
  if ((await row.getAttribute("data-setting")) === "off") {
    await row.getByRole("button", { name: "Ask for it" }).click();
  }
  const toggle = row.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
}
check("nine things can be asked for", askCount === 9, String(askCount));
check(
  "every one of them is now mandatory",
  (await dir.p.locator('[data-ask][data-setting="required"]').count()) === askCount &&
    (await dir.p.locator('input[name^="ask_"]').evaluateAll((inputs) => inputs.every((input) => input.value === "required"))),
);

await dir.p.getByRole("button", { name: "Set out the videos" }).click();
await dir.p.fill('input[name="slot_1_label"]', "A monologue of your choosing");
await dir.p.fill('textarea[name="slot_1_brief"]', "Nothing from the production itself, in your own accent.");
await dir.p.selectOption('select[name="slot_1_max"]', "60");
await dir.p.getByRole("button", { name: "Add another video" }).click();
await dir.p.fill('input[name="slot_2_label"]', "A piece to camera");
await dir.p.fill('textarea[name="slot_2_brief"]', "Tell us about the last boat you were on.");
await dir.p.selectOption('select[name="slot_2_max"]', "30");
await dir.p.getByRole("button", { name: "Add another video" }).click();
await dir.p.fill('input[name="slot_3_label"]', "The sides, if you have had time");
await dir.p.locator('input[name="slot_3_required"]').uncheck();
check("three videos is the most a role can ask for", (await dir.p.getByRole("button", { name: "Add another video" }).count()) === 0);

await dir.p.fill("#disclaimer", TERMS);
await dir.p.selectOption("#specialKind", "ethnicity");
await dir.p.fill("#specialQuestion", QUESTION);
await dir.p.fill("#specialJustification", "Nell is written as British South Asian and the story turns on her family's arrival on the Tyne; the production requires the part to be played by an actor who shares that heritage.");
await dir.p.getByRole("button", { name: "Post the role" }).click();
await dir.p.waitForURL(/\/dashboard\/roles\/rol_/, { timeout: 20000 });
const roleA = dir.p.url().match(/roles\/(rol_[^?]+)/)[1];
{
  const { rows } = await pool.query(
    "SELECT required_fields, hidden_fields, media_slots, special_question, disclaimer, paid, self_tape, requirements, shoot_ends_at FROM roles WHERE id = $1",
    [roleA],
  );
  const saved = rows[0];
  check(
    "everything on the role was saved",
    saved.required_fields.length === 9 &&
      saved.hidden_fields.length === 0 &&
      saved.media_slots.length === 3 &&
      saved.media_slots[0].maxSeconds === 60 &&
      saved.media_slots[2].required === false &&
      saved.special_question?.kind === "ethnicity" &&
      saved.special_question?.question === QUESTION &&
      saved.disclaimer === TERMS &&
      saved.paid === true &&
      saved.self_tape === true &&
      saved.requirements.length === 3 &&
      saved.shoot_ends_at !== null,
    JSON.stringify(saved),
  );
}
const roleB = await postRole(dir.p, { sessionId, title: "Ensemble", company: CO, location: "Gateshead, UK" });
const roleC = await postRole(dir.p, { sessionId, title: "Featured extra", company: CO, location: "Sunderland, UK", disclaimer: "Unpaid, expenses and a credit." });
await publish(dir.p, sessionId);
const token = await shareToken(dir.p, sessionId);
const ROLE_ID = { lead: roleA, ensemble: roleB, extra: roleC };

/* ------------------------------------------------------------------ 3 -- */

section("3 an applicant sees every option and goes through the whole form");
const first = await session(browser, errors);
await first.p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
check("the call's page carries the banner", (await first.p.locator('img[src^="/api/hero?u="]').count()) === 1);
check("and lists the three roles", (await first.p.locator('a[href^="/c/"]:has-text("Read the brief and apply")').count()) === 3);
check("with one button to choose one", (await first.p.getByRole("link", { name: "Choose a role and apply" }).count()) === 1);
check("and the director's own inclusion statement", (await first.p.getByText(INCLUSION).count()) === 1);

await first.p.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
check("the role asks about an agent before anything else", (await first.p.getByRole("button", { name: "No, I am not represented" }).count()) === 1);
await first.p.getByRole("button", { name: "Yes, I have an agent" }).click();
check("a represented applicant is sent to their agent", (await first.p.getByText(AGENT_ROUTE).count()) === 1);
await first.p.getByRole("button", { name: "I am not represented after all" }).click();
check("the listing says what to send", (await first.p.locator("ol li", { hasText: "A monologue of your choosing" }).count()) === 1 && (await first.p.getByText(/· up to 30 seconds/).count()) === 1);
check("and what the role needs", (await first.p.getByText("A Tyneside accent, or the ability to hold one").count()) === 1);
const videoInputs = first.p.locator('input[type="file"][name^="video_"]');
check(
  "the form asks for everything the director set",
  (await first.p.locator("#residency").count()) === 1 &&
    (await first.p.locator("#height").count()) === 1 &&
    (await first.p.locator("#reelUrl[required]").count()) === 1 &&
    (await first.p.locator("#profileUrl[required]").count()) === 1 &&
    (await first.p.locator("#photo[required]").count()) === 1 &&
    (await videoInputs.count()) === 3 &&
    (await first.p.locator("#specialAnswer").count()) === 1 &&
    (await first.p.locator("#acceptTerms").count()) === 1 &&
    (await first.p.locator("#available").count()) === 1,
);
check("with the third video optional", (await videoInputs.nth(2).getAttribute("required")) === null && (await videoInputs.nth(0).getAttribute("required")) !== null);
check("a video's brief is on the listing and above its upload", (await first.p.getByText("Tell us about the last boat you were on.").count()) === 2);
check("and the director's own tape guidance is beside the uploads", (await first.p.getByText("Say your name and the role first.").count()) === 1);

/** Fills the whole form for the lead, photo and three tapes included, and sends it. */
async function apply(page, who) {
  await page.goto(`${BASE}/c/${token}/${roleA}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "No, I am not represented" }).click();
  await page.selectOption("#age", String(who.age ?? 30));
  await page.fill("#name", who.name);
  await page.fill("#email", who.email);
  await page.fill("#phone", "07700 900123");
  await page.fill("#location", who.location ?? "Newcastle upon Tyne");
  await page.selectOption("#residency", "United Kingdom");
  await page.fill("#height", "172 cm");
  await page.fill("#reelUrl", "https://vimeo.com/123456789");
  await page.fill("#profileUrl", "https://www.spotlight.com/1234-5678-9012");
  await page.fill("#coverNote", who.coverNote ?? "A cover note comfortably longer than the twenty character minimum.");
  await page.setInputFiles("#photo", { name: "face.png", mimeType: "image/png", buffer: PNG });
  const tapes = page.locator('input[type="file"][name^="video_"]');
  for (let i = 0; i < (await tapes.count()); i += 1) {
    await tapes.nth(i).setInputFiles({ name: `tape-${i + 1}.mp4`, mimeType: "video/mp4", buffer: MP4 });
  }
  await page.check("#available");
  await page.fill("#specialAnswer", "Yes, on my mother's side");
  await page.check("#specialConsent");
  await page.check("#acceptTerms");
  await page.check("#acceptSubmissionTerms");
  await page.getByRole("button", { name: "Send submission" }).click();
  await page.getByText("Submission sent").waitFor({ timeout: 120000 });
}

let firstOk = true;
await apply(first.p, { name: "Ada Applicant", email: `ada${t}@example.com` }).catch(async (error) => {
  firstOk = false;
  const said = await first.p.locator('[role="alert"]').allTextContents().catch(() => []);
  check("the whole form went through", false, `${error.message.split("\n")[0]}; the form said: ${said.join(" | ") || "nothing"}`);
});
let realPhoto = "";
let realVideos = [];
if (firstOk) {
  const { rows } = await pool.query(
    "SELECT photo_url, videos, height_cm, residency, available, reel_url FROM submissions WHERE session_id = $1",
    [sessionId],
  );
  const row = rows[0];
  realPhoto = row?.photo_url ?? "";
  realVideos = row?.videos ?? [];
  check(
    "the whole form went through, photo, three tapes and all",
    rows.length === 1 && Boolean(realPhoto) && realVideos.length === 3 && row.height_cm === 172 && row.residency === "United Kingdom" && row.available === true,
    JSON.stringify(row),
  );
  check("and the answer to the question was recorded apart from it", (await count("SELECT count(*)::int AS n FROM special_answers WHERE role_id = $1", [roleA])) === 1);
}
await first.c.close();

/* ------------------------------------------------------------------ 4 -- */

section("4 the roles fill to over a thousand submissions");
const MISSING = realPhoto ? `${new URL(realPhoto).origin}/submissions/${sessionId}/${roleA}/photo/missing-` : "https://standin.private.blob.vercel-storage.com/nothing/";
const CONSENT = `I consent to ${CO} and Open Casting processing my answer about your ethnic or racial origin for this casting decision and nothing else. It is special category data under UK GDPR. I can withdraw this consent at any time by asking, and the answer is deleted 30 days after casting closes.`;
{
  const started = Date.now();
  for (const [key, numbers] of Object.entries(ROWS)) {
    const roleId = ROLE_ID[key];
    const terms = key === "lead" ? TERMS : key === "extra" ? "Unpaid, expenses and a credit." : null;
    // Newest first is by submitted_at, so number n went in n + 1 minutes ago:
    // after the first applicant, who sent theirs a moment ago, and before
    // the six who are about to.
    await pool.query(
      `INSERT INTO submissions
         (id, role_id, session_id, name, email, phone, location, age, reel_url, profile_url,
          cover_note, status, accepted_terms, accepted_at, terms_version, guardian_name,
          guardian_email, guardian_consent_at, guardian_confirmed_at, photo_url, videos,
          height_cm, residency, available, submitted_at)
       SELECT 'sub_cap' || $3 || '_' || n, $1, $2,
              CASE WHEN n % 50 = 0 THEN 'Anastasia-Wilhelmina Featherstonehaugh-Cholmondeley-Wolstenholme'
                   WHEN n % 50 = 4 THEN 'Wolfeschlegelsteinhausenbergerdorffvoralternwaren'
                   ELSE 'Applicant ' || n END,
              CASE WHEN n % 50 = 1
                   THEN 'a.very.long.email.address.for.applicant.number.' || n || '@subdomain.example-production-company.co.uk'
                   ELSE 'cap' || $3 || '-' || n || '@example.com' END,
              '07700 900' || lpad((n % 1000)::text, 3, '0'),
              CASE WHEN n % 50 = 2 THEN 'Newcastle-under-Lyme, Staffordshire, United Kingdom of Great Britain and Northern Ireland'
                   WHEN n % 3 = 0 THEN 'London' WHEN n % 3 = 1 THEN 'Manchester' ELSE 'Glasgow' END,
              CASE WHEN n % 25 = 0 THEN 16 ELSE 18 + (n % 40) END,
              CASE WHEN n % 2 = 0 THEN 'https://vimeo.com/' || (100000 + n) ELSE '' END,
              CASE WHEN n % 3 = 0 THEN 'https://www.spotlight.com/' || n ELSE '' END,
              CASE WHEN n % 50 = 3
                   THEN repeat('A long cover note that runs on and on, because some applicants write a great deal about themselves and the part. ', 25)
                   ELSE 'A cover note for applicant ' || n || ', comfortably past the minimum.' END,
              CASE WHEN n % 25 = 0 THEN 'Callback' WHEN n % 10 = 0 THEN 'Shortlisted' WHEN n % 7 = 0 THEN 'Declined' ELSE 'New' END,
              CASE WHEN n % 2 = 0 THEN $4::text END,
              now(), 'v1',
              CASE WHEN n % 25 = 0 THEN 'Guardian ' || n END,
              CASE WHEN n % 25 = 0 THEN 'guardian' || n || '@example.com' END,
              CASE WHEN n % 25 = 0 THEN now() END,
              -- These stand in for submissions already through the door, so
              -- their guardians confirmed. One that has not is suite 22's.
              CASE WHEN n % 25 = 0 THEN now() END,
              CASE WHEN n % 4 = 0 THEN $5::text WHEN n % 10 = 1 THEN $6::text || n || '.jpg' END,
              CASE WHEN n % 5 = 0 THEN $7::jsonb ELSE '[]'::jsonb END,
              CASE WHEN n % 3 = 0 THEN 150 + (n % 50) END,
              CASE WHEN n % 4 = 0 THEN 'United Kingdom' WHEN n % 4 = 1 THEN 'Ireland' ELSE '' END,
              n % 9 <> 0,
              now() - ((n + 1) || ' minutes')::interval
         FROM generate_series($8::int, $9::int) AS n`,
      [roleId, sessionId, String(t), terms, realPhoto || null, MISSING, JSON.stringify(realVideos), numbers[0], numbers[numbers.length - 1]],
    );
    if (key === "lead") {
      await pool.query(
        `INSERT INTO special_answers (submission_id, role_id, session_id, kind, answer, consent_text, consent_hash)
         SELECT 'sub_cap' || $3 || '_' || n, $1, $2, 'ethnicity', 'Yes, on my mother''s side', $4, $5
           FROM generate_series($6::int, $7::int) AS n WHERE n % 3 = 0`,
        [roleId, sessionId, String(t), CONSENT, createHash("sha256").update(CONSENT).digest("hex"), numbers[0], numbers[numbers.length - 1]],
      );
    }
  }
  timings.push({ label: `seeding ${ALL.length} rows`, ms: Date.now() - started });
}
check(`${ALL.length} more rows are in the database`, (await count("SELECT count(*)::int AS n FROM submissions WHERE session_id = $1", [sessionId])) === ALL.length + (firstOk ? 1 : 0));

/* ------------------------------------------------------------------ 5 -- */

section(`5 ${RUSH} more applicants send the whole form at once`);
{
  const started = Date.now();
  const outcomes = await Promise.all(
    range(1, RUSH).map(async (n) => {
      const ctx = await session(browser, errors);
      try {
        await apply(ctx.p, { name: `Rush Applicant ${n}`, email: `rush${t}-${n}@example.com`, location: "Durham" });
        return null;
      } catch (error) {
        const said = await ctx.p.locator('[role="alert"]').allTextContents().catch(() => []);
        return `${n}: ${error.message.split("\n")[0]}; the form said: ${said.join(" | ") || "nothing"}`;
      } finally {
        await ctx.c.close();
      }
    }),
  );
  timings.push({ label: `${RUSH} applicants at once, four files each`, ms: Date.now() - started });
  check(`all ${RUSH} went through`, outcomes.every((outcome) => outcome === null), outcomes.filter(Boolean).join(" || "));
}
const TOTAL = await count("SELECT count(*)::int AS n FROM submissions WHERE session_id = $1", [sessionId]);
const byStatus = Object.fromEntries(
  (await pool.query("SELECT status, count(*)::int AS n FROM submissions WHERE session_id = $1 GROUP BY status", [sessionId])).rows.map((row) => [row.status, row.n]),
);
const leadTotal = await count("SELECT count(*)::int AS n FROM submissions WHERE role_id = $1", [roleA]);
check(`over a thousand submissions: ${TOTAL}`, TOTAL > 1000 && TOTAL === ALL.length + 1 + RUSH, String(TOTAL));
const PAGES = Math.ceil(TOTAL / 25);
const UI = TOTAL - ALL.length;

/* ------------------------------------------------------------------ 6 -- */

section("6 the dashboard and the casting call's page carry them");
{
  const ms = await timed(dir.p, `${BASE}/dashboard`, "dashboard");
  const card = dir.p.locator(`li:has(a[href="/dashboard/sessions/${sessionId}"])`).first();
  check("the dashboard counts them all", (await card.locator('[data-figure="submitted"]').innerText()) === String(TOTAL));
  check("and knows how many are still new", (await card.locator('[data-figure="to-review"]').innerText()) === String(byStatus.New));
  check(`and loads in time (${ms} ms)`, ms < PAGE_BUDGET_MS);
  await fits(dir.p, "the dashboard");
}
{
  await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}`, "casting call page, cold");
  const ms = await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}`, "casting call page, first page");
  check(`the casting call's page loads in time (${ms} ms)`, ms < PAGE_BUDGET_MS);
  check("the summary counts everything", (await dir.p.getByText(`${TOTAL} across 3 roles, ${byStatus.New} still to review.`).count()) === 1);
  check("twenty-five rows", (await dir.p.locator("table tbody tr").count()) === 25);
  check("says which are showing", (await dir.p.getByText(`Showing 1 to 25 of ${TOTAL}`).count()) === 1);
  check("the applicants who went through the form come first", (await dir.p.locator("table tbody tr").nth(UI).getByText("Applicant 1", { exact: true }).count()) === 1);
  check("every status is there to narrow by", (await dir.p.locator('nav[aria-label="Narrow the list"] a').allTextContents()).join(" ") === `All · ${TOTAL} New · ${byStatus.New} Shortlisted · ${byStatus.Shortlisted} Callback · ${byStatus.Callback} Declined · ${byStatus.Declined}`);
  // The first page: the applicants who went through the form, each with a
  // photo, then seeded rows 1 to 25 - UI, with photos as the rules say.
  const firstSeeded = range(1, 25 - UI);
  const real = UI + firstSeeded.filter((n) => seeded.photo(n) === "real").length;
  const missing = firstSeeded.filter((n) => seeded.photo(n) === "missing").length;
  const none = firstSeeded.filter((n) => seeded.photo(n) === "none").length;
  check(`${real} photos load through the app's own route`, (await dir.p.locator('table img[src^="/api/media"]').count()) === real && (await allRendered(dir.p)), String(await dir.p.locator('table img[src^="/api/media"]').count()));
  check(`${missing} photos that the store no longer holds say so`, (await settled(dir.p, 'table [data-photo="unavailable"]', missing)) === missing);
  check(`${none} placeholders for the rest`, (await dir.p.locator('table [data-photo="none"]').count()) === none);
  await fits(dir.p, "the casting call's page on a desktop");
  await dir.p.screenshot({ path: `${SHOTS}/capacity-call-desktop.png`, fullPage: true });
}
{
  const ms = await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}?page=${PAGES}`, `casting call page, page ${PAGES}`);
  const from = (PAGES - 1) * 25 + 1;
  check(`the last page, ${PAGES}, shows the rest (${ms} ms)`, (await dir.p.getByText(`Showing ${from} to ${TOTAL} of ${TOTAL}`).count()) === 1 && ms < PAGE_BUDGET_MS);
  check("the current page is marked", (await dir.p.locator('nav[aria-label="Pages"] [aria-current="page"]').innerText()) === String(PAGES));
  check("Next goes no further", (await dir.p.locator('nav[aria-label="Pages"]').getByRole("link", { name: "Next", exact: true }).count()) === 0);
  await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}?page=9999`, { waitUntil: "load" });
  check("a page past the end shows the last one", (await dir.p.getByText(`Showing ${from} to ${TOTAL} of ${TOTAL}`).count()) === 1);
}
{
  const ms = await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}?status=Shortlisted&page=2`, "casting call page, one status, page 2");
  check(`a status and a page together (${ms} ms)`, (await dir.p.getByText(`Showing 26 to 50 of ${byStatus.Shortlisted}`).count()) === 1 && ms < PAGE_BUDGET_MS);
  check("the page links keep the status", ((await dir.p.locator('nav[aria-label="Pages"]').getByRole("link", { name: "Next", exact: true }).getAttribute("href")) ?? "").includes("status=Shortlisted"));
  check("the status chip is current", (await dir.p.locator('nav[aria-label="Narrow the list"] [aria-current="page"]').innerText()) === `Shortlisted · ${byStatus.Shortlisted}`);
}
{
  // A phone: the long names, emails and locations on the first page, and
  // the page with the longest of them, must not push the page sideways.
  await dir.p.setViewportSize({ width: 390, height: 844 });
  const ms = await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}`, "casting call page on a phone");
  check(`on a phone it loads in time (${ms} ms)`, ms < PAGE_BUDGET_MS);
  await fits(dir.p, "the casting call's page on a phone");
  const well = dir.p.locator("table").locator("xpath=..");
  check("the table scrolls inside its own well", await well.evaluate((element) => element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX === "auto"));
  await dir.p.screenshot({ path: `${SHOTS}/capacity-call-phone.png`, fullPage: true });
  // The page holding the longest values: seeded rows 100 to 104 carry them.
  const longPage = Math.ceil((UI + LONG + 4) / 25);
  await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}?page=${longPage}`, "casting call page with the longest values, phone");
  check("the longest name is on this page", (await dir.p.getByText("Wolfeschlegelsteinhausenbergerdorffvoralternwaren").count()) === 1);
  await fits(dir.p, "the page with the longest values on a phone");
  await dir.p.setViewportSize({ width: 1280, height: 900 });
  await timed(dir.p, `${BASE}/dashboard/sessions/${sessionId}?page=${longPage}`, "casting call page with the longest values, desktop");
  await fits(dir.p, "the page with the longest values on a desktop");
}

/* ------------------------------------------------------------------ 7 -- */

section("7 the lead role's page shows every submission with everything in it");
{
  const leadPages = Math.ceil(leadTotal / 25);
  const ms = await timed(dir.p, `${BASE}/dashboard/roles/${roleA}`, "role page, first page");
  const cards = dir.p.locator('li:has(select[aria-label="Submission status"])');
  check(`the role's page loads in time (${ms} ms)`, ms < PAGE_BUDGET_MS);
  check("twenty-five cards", (await cards.count()) === 25);
  check(`the total is ${leadTotal}`, (await dir.p.getByText(`${leadTotal} total`).count()) === 1);
  check("says which are showing", (await dir.p.getByText(`Showing 1 to 25 of ${leadTotal}`).count()) === 1);
  const rush = cards.first();
  check("a card from the form carries the photo, three tapes, the links and the answer", (await rush.locator('img[src^="/api/media"]').count()) === 1 && (await rush.locator("video").count()) === 3 && (await rush.getByText("A monologue of your choosing").count()) >= 1 && (await rush.getByRole("link", { name: /Showreel/ }).count()) === 1 && (await rush.getByText("Yes, on my mother's side").count()) === 1 && (await rush.getByText("Available for the shoot dates").count()) === 1 && (await rush.getByText("Accepted your terms on").count()) === 1);
  check("and the height and residency the role asked for", (await rush.getByText(/resident in United Kingdom/).count()) === 1 && (await rush.getByText(/172 cm/).count()) === 1);
  await fits(dir.p, "the role's page on a desktop");

  await timed(dir.p, `${BASE}/dashboard/roles/${roleA}?page=${leadPages}`, `role page, page ${leadPages}`);
  check(`the last page, ${leadPages}`, (await dir.p.getByText(`Showing ${(leadPages - 1) * 25 + 1} to ${leadTotal} of ${leadTotal}`).count()) === 1);

  // The seeded page with the longest values, the three tapes and a child.
  const longPage = Math.ceil((UI + LONG + 4) / 25);
  await dir.p.setViewportSize({ width: 390, height: 844 });
  const phoneMs = await timed(dir.p, `${BASE}/dashboard/roles/${roleA}?page=${longPage}`, "role page with the longest values, phone");
  check(`on a phone it loads in time (${phoneMs} ms)`, phoneMs < PAGE_BUDGET_MS);
  check("the longest email is on this page", (await dir.p.getByText(/a\.very\.long\.email\.address\.for\.applicant\.number\.101@/).count()) >= 1);
  check("a seeded card carries three tapes against their slots", (await dir.p.locator('li:has(select[aria-label="Submission status"])', { hasText: "Applicant 95" }).locator("video").count()) === 3);
  check("and a child's card says the age", (await dir.p.locator('li:has(select[aria-label="Submission status"])', { hasText: "Anastasia-Wilhelmina" }).getByText(/· 16 ·/).count()) === 1);
  await fits(dir.p, "the role's page with the longest values on a phone");
  await dir.p.screenshot({ path: `${SHOTS}/capacity-role-phone.png`, fullPage: true });
  await dir.p.setViewportSize({ width: 1280, height: 900 });
  await timed(dir.p, `${BASE}/dashboard/roles/${roleA}?page=${longPage}`, "role page with the longest values, desktop");
  await fits(dir.p, "the role's page with the longest values on a desktop");
}

/* ------------------------------------------------------------------ 8 -- */

section("8 the applicant's pages at both sizes");
{
  const visitor = await session(browser, errors);
  const ms = await timed(visitor.p, `${BASE}/c/${token}`, "applicant's call page");
  check(`the call's page loads in time (${ms} ms)`, ms < PAGE_BUDGET_MS);
  await fits(visitor.p, "the call's page on a desktop");
  await timed(visitor.p, `${BASE}/c/${token}/${roleA}`, "applicant's role page");
  await visitor.p.getByRole("button", { name: "No, I am not represented" }).click();
  await fits(visitor.p, "the role's page with the form on a desktop");
  await visitor.p.setViewportSize({ width: 390, height: 844 });
  await timed(visitor.p, `${BASE}/c/${token}`, "applicant's call page, phone");
  await fits(visitor.p, "the call's page on a phone");
  await timed(visitor.p, `${BASE}/c/${token}/${roleA}`, "applicant's role page, phone");
  await visitor.p.getByRole("button", { name: "No, I am not represented" }).click();
  await fits(visitor.p, "the role's page with the form on a phone");
  await visitor.p.screenshot({ path: `${SHOTS}/capacity-applicant-phone.png`, fullPage: true });
  await visitor.c.close();
}

/* ------------------------------------------------------------------ 9 -- */

section("9 the spreadsheet holds every one of them, downloaded and emailed");
const expectPhotos = UI + ALL.filter((n) => seeded.photo(n) !== "none").length;
const expectVideos = UI + ALL.filter((n) => seeded.videos(n)).length;
const expectGuardians = ALL.filter((n) => seeded.minor(n)).length;

/** Reads a workbook and counts what the export puts in each row. */
async function tallied(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Submissions");
  const tally = { rows: 0, photos: 0, videos: 0, guardians: 0, roles: new Set() };
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    tally.rows += 1;
    tally.roles.add(String(row.getCell(1).value));
    if (String(row.getCell(14).value) === "Yes") tally.photos += 1;
    if (String(row.getCell(15).value) === "3") tally.videos += 1;
    if (String(row.getCell(16).value ?? "").startsWith("Guardian")) tally.guardians += 1;
  });
  const about = workbook.getWorksheet("Casting call");
  tally.said = about.getCell("B8").value;
  return tally;
}
{
  await dir.p.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "load" });
  const started = Date.now();
  const [download] = await Promise.all([
    dir.p.waitForEvent("download", { timeout: 60000 }),
    dir.p.getByRole("link", { name: "Download spreadsheet" }).click(),
  ]);
  const file = readFileSync(await download.path());
  const ms = Date.now() - started;
  timings.push({ label: "spreadsheet download", ms });
  const tally = await tallied(file);
  check(`${TOTAL} rows in the spreadsheet (${ms} ms, ${Math.round(file.length / 1024)} KB)`, tally.rows === TOTAL && ms < EXPORT_BUDGET_MS, `${tally.rows} rows`);
  check("across the three roles", tally.roles.size === 3);
  check(`${expectPhotos} marked as having a photo`, tally.photos === expectPhotos, String(tally.photos));
  check(`${expectVideos} with three videos`, tally.videos === expectVideos, String(tally.videos));
  check(`${expectGuardians} with a guardian`, tally.guardians === expectGuardians, String(tally.guardians));
  check("the second sheet says how many", tally.said === TOTAL, String(tally.said));
}
{
  const before = JSON.parse(readFileSync(process.env.MAILBOX, "utf8")).length;
  const started = Date.now();
  await dir.p.getByRole("button", { name: "Email it to me" }).click();
  await dir.p.waitForURL(/emailed=1/, { timeout: 60000 });
  const ms = Date.now() - started;
  timings.push({ label: "spreadsheet emailed", ms });
  const sent = JSON.parse(readFileSync(process.env.MAILBOX, "utf8"));
  const message = sent.slice(before).find((entry) => entry.subject === `Submissions for ${CALL}`);
  check(`the email went (${ms} ms)`, Boolean(message) && ms < EXPORT_BUDGET_MS);
  if (message) {
    const tally = await tallied(Buffer.from(message.attachments[0].content, "base64"));
    check(`with all ${TOTAL} rows attached`, tally.rows === TOTAL, String(tally.rows));
    check("and the count in the body", message.text.includes(`${TOTAL} submissions across 3 roles`));
  }
  check("the page says it was sent", (await dir.p.getByText(/Sent to .* as a spreadsheet attached to the email/).count()) === 1);
}

/* ---------------------------------------------------------------------- */

console.log("\n[timings]");
for (const { label, ms } of timings) console.log(`  ${String(ms).padStart(6)} ms  ${label}`);

await pool.end();
await dir.c.close();
await admin.c.close();
await browser.close();
finish();
