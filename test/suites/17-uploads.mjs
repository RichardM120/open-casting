/**
 * Files, end to end, against the harness's stand-in store: a casting
 * director's header image goes up from the casting call form and comes back
 * on the applicant's page; an applicant's photo goes up with a submission and
 * comes back to the director, and to nobody else; removing the role removes
 * the file; and the Admin overview's store check passes. The browser's SDK
 * puts files through vercel.com; the browser is given the harness's proxy,
 * which tunnels that host to the stand-in, so the browser does exactly what
 * it does on a deployment, the page's Content Security Policy and the CORS
 * preflight included, and the request shape under test is the real one.
 */
import { deflateSync } from "node:zlib";

import {
  BASE,
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
// The stand-in's certificate is its own. A context can be told to accept
// it, but that acceptance is settled one connection late, and an upload with
// a body cannot be sent again on the second connection; the browser as a
// whole is told instead, and this browser reaches nothing but the app and
// the stand-in.
const browser = await launch({
  proxy: { server: PROXY, bypass: "127.0.0.1,localhost" },
  args: ["--ignore-certificate-errors"],
});
const t = Date.now();
const CO = `Files Co ${t}`;

/** A 1×1 PNG: enough for the browser to decode, and for a photo to be a photo. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A PNG drawn here, as wide as a banner off a camera, so the browser has
 * something to shrink: solid terracotta, which compresses to nothing but is a
 * real picture of the size the form is told to bring down.
 */
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
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
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
/** A tape that is not one: the browser reads no length off it, and the store takes the bytes. */
const TAPE = Buffer.alloc(16 * 1024, 7);

/** Whether an image in the page decoded to something with a width. */
const rendered = (image) =>
  image.evaluate((img) => img.decode().then(() => img.naturalWidth > 0, () => false));

/** A route fetched from inside the page, as the page's own images are, with its cookies. */
const fetched = (page, src) =>
  page.evaluate(async (url) => {
    const response = await fetch(url);
    return {
      status: response.status,
      type: response.headers.get("content-type") ?? "",
      cache: response.headers.get("cache-control") ?? "",
    };
  }, src);

/** What the stand-in holds under a prefix. */
async function stored(prefix) {
  const response = await fetch(`${STANDIN}/?prefix=${encodeURIComponent(prefix)}`);
  return (await response.json()).blobs;
}

section("0 the deployment reports the store");
{
  const health = await (await fetch(`${BASE}/api/health`)).json();
  check("uploads are ready", health.uploads === "ready", JSON.stringify(health));
  check("through the token the harness gave it", /BLOB_READ_WRITE_TOKEN/.test(health.store), health.store);
}

section("1 a header image goes up from the casting call form and comes back on the applicant's page");
const admin = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin.p, {
  name: "Ima Ges",
  company: CO,
  email: `img${t}@example.com`,
  role: "director",
});
await dir.p.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
await openAdvanced(dir.p);
check("with a store connected, the form offers a header image", (await dir.p.locator("#hero").count()) === 1);
await dir.p.setInputFiles("#hero", { name: "banner.png", mimeType: "image/png", buffer: BANNER });
await dir.p
  .waitForFunction(
    () => (document.querySelector('input[name="heroUrl"]')?.value ?? "").startsWith("https://"),
    null,
    { timeout: 20000 },
  )
  .catch(async () => {
    const said = await dir.p.locator("#hero-error").textContent().catch(() => null);
    check("the header image uploaded", false, `the form said: ${said ?? "nothing"}; browser: ${errors.join(" | ") || "no errors"}`);
    finish();
  });
const heroUrl = await dir.p.inputValue('input[name="heroUrl"]');
check(
  "the file went to the store, under this account's own folder, with a random suffix",
  /\.blob\.vercel-storage\.com\/calls\/[^/]+\/hero\/banner-[a-z0-9]+\.(webp|png|jpe?g)$/.test(heroUrl),
  heroUrl,
);
check("and was shrunk to WebP on the way", heroUrl.endsWith(".webp"), heroUrl);
check("the form says by how much", (await dir.p.getByText(/Resized to 1600 by 400 pixels/).count()) === 1);
const preview = dir.p.locator('img[src^="/api/hero?u="]').first();
await preview.waitFor({ timeout: 10000 });
check("and is shown back through the app's own route", await rendered(preview));
check("the fold summarises what is set", /with a banner/.test(await dir.p.locator('details[data-more="production"] summary').textContent()));
await dir.p.fill("#name", `Pictures ${t}`);
await dir.p.fill("#synopsis", "A casting call with a picture at the top, described at length for the form.");
await dir.p.fill("#opensAt", at(-1));
await dir.p.fill("#closesAt", at(20, "23:59"));
await dir.p.fill("#productionEndsAt", day(60));
await dir.p.getByRole("button", { name: "Save and continue" }).click();
await dir.p.waitForURL(/\/dashboard\/sessions\/(?!new)[^/?]+/, { timeout: 20000 });
const call = dir.p.url().match(/sessions\/([^/?]+)/)[1];
const roleId = await postRole(dir.p, { sessionId: call, title: `Pictured role ${t}`, company: CO });
await publish(dir.p, call);
const token = await shareToken(dir.p, call);

const applicant = await session(browser, errors);
await applicant.p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
const shown = applicant.p.locator('img[src^="/api/hero?u="]').first();
check("the applicant's page carries the picture", (await shown.count()) === 1);
check("and it renders", (await shown.count()) === 1 && (await rendered(shown)));
{
  const served = await fetched(applicant.p, await shown.getAttribute("src"));
  check("the route serves it as an image, cacheable", served.status === 200 && served.type.startsWith("image/") && /public/.test(served.cache), JSON.stringify(served));
}

section("2 an applicant's photo and tape go up with the submission and come back to the director alone");
await applicant.p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
check("the form offers a photo", (await applicant.p.locator("#photo").count()) === 1);
await applicant.p.fill("#name", "Ada Applicant");
await applicant.p.fill("#email", `ada${t}@example.com`);
await applicant.p.fill("#phone", "07700 900123");
await applicant.p.fill("#location", "Leeds");
await applicant.p.selectOption("#age", "30");
await applicant.p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
await applicant.p.setInputFiles("#photo", { name: "face.png", mimeType: "image/png", buffer: PNG });
check("and the one general tape", (await applicant.p.locator('input[type="file"][name^="video_"]').count()) === 1);
await applicant.p.setInputFiles('input[type="file"][name^="video_"]', { name: "tape.mp4", mimeType: "video/mp4", buffer: TAPE });
await applicant.p.check("#acceptSubmissionTerms");
if (await applicant.p.locator("#available").count()) await applicant.p.check("#available");
await applicant.p.getByRole("button", { name: "Send submission" }).click();
await applicant.p.getByText("Submission sent").waitFor({ timeout: 30000 });
check("the submission went through with the photo and the tape", true);
{
  const files = (await stored("submissions/")).map((file) => file.pathname).sort();
  check(
    "the store holds both under the submission's folder",
    files.length === 2 &&
      files[0].startsWith(`submissions/${call}/${roleId}/photo/face-`) &&
      files[1].startsWith(`submissions/${call}/${roleId}/video/tape/tape-`),
    JSON.stringify(files),
  );
}
await dir.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
const photo = dir.p.locator('img[src^="/api/media?u="]').first();
check("the director sees the photo on the submission", (await photo.count()) === 1);
check("and it renders", (await photo.count()) === 1 && (await rendered(photo)));
check("and the tape, to play through the same route", (await dir.p.locator('video[src^="/api/media?u="]').count()) === 1);
const photoSrc = await photo.getAttribute("src");
{
  const mine = await fetched(dir.p, photoSrc);
  check("the route serves it to the director, uncached", mine.status === 200 && mine.type.startsWith("image/") && /no-store/.test(mine.cache), JSON.stringify(mine));
  const stranger = await session(browser, errors);
  await stranger.p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const theirs = await fetched(stranger.p, photoSrc);
  check("and to nobody who is not signed in", theirs.status === 404, JSON.stringify(theirs));
  await stranger.c.close();
}

section("3 the Admin overview can prove the store works");
await admin.p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("the file store card says it is connected", (await admin.p.getByText(/Connected through/).count()) === 1);
await admin.p.getByRole("button", { name: "Test the store" }).click();
await admin.p.getByText(/Wrote a private test file, read it back and deleted it/).waitFor({ timeout: 20000 });
check("it wrote, read back and deleted a file", true);
check("and left nothing behind", (await stored("checks/")).length === 0);

section("4 removing the role removes the file");
await admin.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
await admin.p.getByText("Remove this role", { exact: true }).click();
await admin.p.check('input[name="confirm"]');
await admin.p.getByRole("button", { name: "Remove role and submissions" }).click();
await admin.p.waitForURL((url) => !url.pathname.includes(`/roles/${roleId}`), { timeout: 20000 });
check("the photo and the tape are gone from the store", (await stored("submissions/")).length === 0);
{
  const gone = await fetched(dir.p, photoSrc);
  check("and the route no longer serves it", gone.status === 404, JSON.stringify(gone));
}

await browser.close();
finish();
