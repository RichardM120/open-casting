/**
 * What the administrator is told before they open anything.
 *
 * Ten screens, and most days none of them wants a thing. The bar across the
 * top of every admin screen answers "is there anything for me" without one of
 * them being opened, the tiles on the summary carry the same answer per page,
 * and the navigation carries a dot for the group it is under. This suite
 * proves the three agree with each other and with the state of the database —
 * a bar that says all clear while a request runs out of time is worse than no
 * bar at all.
 *
 * The conditions are made through the interface rather than written into the
 * tables: a request logged on the privacy page, a sweep run from the same
 * page. What the app itself does is what the alert has to notice.
 */
import { BASE, SHOTS, adminSession, launch, reporter, session } from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();

const admin = await adminSession(browser, errors);
const { p } = admin;

/** The bar at the top of an admin screen, as text, and what colour it is. */
async function bar(path) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  return p.evaluate(() => {
    const clear = document.querySelector('main p[role="status"]');
    const box = document.querySelector('main [role="status"][aria-label="What needs you"]');
    const element = box ?? clear;
    if (!element) return null;
    return {
      allClear: element === clear,
      text: element.textContent.replace(/\s+/g, " ").trim(),
      lines: [...element.querySelectorAll("li a")].map((a) =>
        a.textContent.replace(/\s+/g, " ").trim(),
      ),
      hrefs: [...element.querySelectorAll("li a")].map((a) => new URL(a.href).pathname),
    };
  });
}

/** The dot on a navigation item or a tile, by the label beside it. */
const dots = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main a, header a")]
      .map((a) => {
        const dot = a.querySelector(".rounded-full.px-1\\.5, .absolute.-top-1");
        if (!dot) return null;
        return {
          to: new URL(a.href).pathname,
          says: dot.textContent.replace(/\s+/g, " ").trim(),
          red: getComputedStyle(dot).backgroundColor,
        };
      })
      .filter(Boolean),
  );

section("1 the summary opens with what is waiting, not with what the screen is for");
{
  const seen = await bar("/admin");
  check("there is a bar at the top", seen !== null);
  check("and it is not the old help note", (await p.getByText("What this screen is for").count()) === 0);
  // A fresh deployment has never run the nightly sweep and has no file store,
  // which is exactly the pair the bar exists to surface.
  check(
    `it names the sweep that has never run: ${JSON.stringify(seen.lines)}`,
    seen.lines.some((line) => /deletion sweep/.test(line)),
  );
  check(
    "and says how many need doing now",
    /needs? doing|need doing/.test(seen.text),
    seen.text.slice(0, 90),
  );
  check(
    "every line leads somewhere it can be dealt with",
    seen.hrefs.length > 0 && seen.hrefs.every((href) => href.startsWith("/admin/")),
    seen.hrefs.join(" "),
  );
  await p.screenshot({ path: `${SHOTS}/admin-summary.png`, fullPage: true });
}

section("2 the summary is a tile per page, led by its own mark");
{
  await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const tiles = await p.evaluate(() =>
    [...document.querySelectorAll("main a[data-tile]")].map((a) => ({
      to: new URL(a.href).pathname,
      icon: a.querySelector("svg") !== null,
      text: a.textContent.replace(/\s+/g, " ").trim(),
    })),
  );
  const expected = [
    "/admin/clients",
    "/admin/accounts",
    "/admin/projects",
    "/admin/submissions",
    "/admin/storage",
    "/admin/privacy",
    "/admin/notifications",
    "/admin/activity",
    "/admin/audit-logs",
  ];
  const to = tiles.map((tile) => tile.to);
  check(`all nine pages have a tile: ${to.length}`, expected.every((href) => to.includes(href)), to.join(" "));
  check("each is led by an icon", tiles.every((tile) => tile.icon), JSON.stringify(tiles.find((tile) => !tile.icon)));
  check(
    "and carries the one figure the page is worth opening for",
    tiles.find((tile) => tile.to === "/admin/accounts")?.text.match(/\d+ accounts?/) !== null,
    tiles.find((tile) => tile.to === "/admin/accounts")?.text,
  );
  check(
    "and says what the page is for",
    /Who signs in/.test(tiles.find((tile) => tile.to === "/admin/accounts")?.text ?? ""),
  );
}

section("3 a red dot on the icon, and on the group in the bar");
{
  await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const marks = await dots(p);
  const storage = marks.find((mark) => mark.to === "/admin/storage");
  check("the page with something waiting has a dot", storage !== undefined, JSON.stringify(marks));
  check("with a number on it", /^\d/.test(storage?.says ?? ""), storage?.says);
  check(
    "and it is red, because the sweep should already have run",
    storage?.red === "rgb(168, 35, 28)",
    storage?.red,
  );
  const group = marks.find((mark) => mark.to === "/admin/storage" && mark.says);
  check("the System group in the bar carries one too", group !== undefined);

  const quiet = marks.find((mark) => mark.to === "/admin/audit-logs");
  check("a page with nothing waiting has none", quiet === undefined, JSON.stringify(quiet));
}

section("4 a department screen shows its own queue and nobody else's");
{
  const storage = await bar("/admin/storage");
  check("storage has a bar of its own", storage !== null && !storage.allClear);
  check(
    "carrying only storage's lines",
    storage.hrefs.every((href) => href === "/admin/storage"),
    storage.hrefs.join(" "),
  );

  const audit = await bar("/admin/audit-logs");
  check("a screen with nothing waiting says so rather than showing nothing", audit?.allClear === true);
  check("in plain words", /Nothing needs you/.test(audit?.text ?? ""), audit?.text);
}

section("5 a request logged on the privacy page reaches the summary");
{
  await p.goto(`${BASE}/admin/privacy`, { waitUntil: "networkidle" });
  await p.fill("#email", `subject${t}@example.com`);
  await p.selectOption("#kind", "access");
  await p.fill("#note", "Asked by email what is held about them.");
  await p.getByRole("button", { name: "Log the request" }).click();
  await p.waitForTimeout(1500);

  const privacy = await bar("/admin/privacy");
  check(
    `privacy now says a request is waiting: ${JSON.stringify(privacy?.lines)}`,
    (privacy?.lines ?? []).some((line) => /request about somebody's own data/.test(line)),
  );
  check("and marks it as coming up rather than late", (privacy?.lines ?? []).some((line) => /^Coming up/.test(line)));

  const summary = await bar("/admin");
  check(
    "the summary carries it too",
    (summary?.lines ?? []).some((line) => /request about somebody's own data/.test(line)),
    JSON.stringify(summary?.lines),
  );
  const marks = await dots(p);
  check(
    "and the privacy tile has picked up an amber dot",
    marks.some((mark) => mark.to === "/admin/privacy" && mark.red === "rgb(122, 81, 0)"),
    JSON.stringify(marks.filter((mark) => mark.to === "/admin/privacy")),
  );
}

section("6 dealing with something takes it off the bar");
{
  await p.goto(`${BASE}/admin/privacy`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Run the sweep now" }).click();
  await p.waitForTimeout(2000);

  const after = await bar("/admin");
  check(
    "the sweep is no longer named",
    !(after?.lines ?? []).some((line) => /deletion sweep/.test(line)),
    JSON.stringify(after?.lines),
  );
  check(
    "and the request that is still open still is",
    (after?.lines ?? []).some((line) => /request about somebody's own data/.test(line)),
  );
}

section("7 the casting director never sees any of it");
{
  const { c, p: theirs } = await session(browser, errors);
  await theirs.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("signed out, no admin bar", (await theirs.locator('[aria-label="What needs you"]').count()) === 0);
  await c.close();

  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check(
    "and an admin doing their own casting is not shown it either",
    (await p.locator('[aria-label="What needs you"]').count()) === 0,
  );
  check(
    "their nav carries no dots",
    (await dots(p)).length === 0,
    JSON.stringify(await dots(p)),
  );
}

section("8 the summary holds together on a phone");
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const m = await phone.newPage();
  await m.context().addCookies(await admin.c.cookies());
  await m.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("the bar is there", (await m.locator('[aria-label="What needs you"]').count()) === 1);
  check("nothing spills sideways", (await m.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  const tile = await m.locator("main a[data-tile='/admin/storage']").boundingBox();
  check(`a tile is a whole row on a phone (${Math.round(tile?.width ?? 0)}px)`, (tile?.width ?? 0) > 300);
  check("the tab bar's System icon carries the dot", (await m.locator("header a[href='/admin/storage'] .absolute").count()) >= 1);
  await m.screenshot({ path: `${SHOTS}/admin-summary-phone.png`, fullPage: true });
  await phone.close();
}

await admin.c.close();
await browser.close();
finish();
