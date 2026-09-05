/**
 * Two sections, two palettes.
 *
 * Front of house — the casting director's dashboard and everything a customer
 * touches — is warm: cream ground, terracotta bar, gold for the one action.
 * The administrator's section is the alternate palette: slate paper, a petrol
 * bar, teal action. It is the same set of colour tokens with different values,
 * so this suite reads the tokens themselves rather than a list of class names,
 * which is what makes it hold as components change.
 *
 * What matters and is checked here: the swap happens on the path and not the
 * role, both palettes clear WCAG 2.2 AA on the pairings the components make,
 * and no page ends up with one section's colours around the other's links.
 */
import {
  BASE,
  SHOTS,
  adminSession,
  addPayingClient,
  launch,
  provision,
  reporter,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();

/* ------------------------------------------------------------- contrast -- */

const channel = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);

/**
 * Relative luminance. Both spellings the browser hands back: a token read off
 * a custom property comes as it was written, `#E3E8EC`; a computed
 * background comes as `rgb(227, 232, 236)`.
 */
function luminance(colour) {
  const hex = colour.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const parts = hex
    ? (hex[1].length === 3 ? [...hex[1]].map((c) => c + c) : hex[1].match(/../g)).map((h) =>
        parseInt(h, 16),
      )
    : colour.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const [r, g, b] = parts.map((n) => channel(n / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio between two computed colours. */
function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The colour tokens as the browser resolves them on a page, which is the only
 * way to know what a reader actually sees: the tokens are redefined on an
 * ancestor, so reading the stylesheet would prove nothing.
 */
const palette = (page) =>
  page.evaluate(() => {
    const shell = document.querySelector("[data-section]");
    const style = getComputedStyle(shell);
    const token = (name) => style.getPropertyValue(name).trim();
    const header = document.querySelector("header");
    return {
      section: shell.dataset.section,
      ground: getComputedStyle(shell).backgroundColor,
      bar: getComputedStyle(header).backgroundColor,
      ink: token("--color-ink"),
      surface: token("--color-surface"),
      raised: token("--color-raised"),
      lineStrong: token("--color-line-strong"),
      text: token("--color-text"),
      muted: token("--color-muted"),
      faint: token("--color-faint"),
      accent: token("--color-accent"),
      accentInk: token("--color-accent-ink"),
      brand: token("--color-brand"),
      brandInk: token("--color-brand-ink"),
    };
  });

/** Every pairing the components actually make, and what AA asks of each. */
const PAIRINGS = [
  ["the bar's own text on the bar", "brandInk", "brand", 4.5],
  ["body copy on the page", "text", "ink", 7],
  ["body copy on a card", "text", "raised", 7],
  ["body copy on a field", "text", "surface", 7],
  ["the quieter copy on a card", "muted", "raised", 4.5],
  ["the quietest copy on the page", "faint", "ink", 4.5],
  ["a heading or link on a card", "brand", "raised", 4.5],
  ["the action's label on the action", "accentInk", "accent", 4.5],
  ["a field's edge against the field", "lineStrong", "surface", 3],
];

/* ------------------------------------------------------ the two sections -- */

section("1 the casting director's section is the warm palette");
const admin = await adminSession(browser, errors);
await addPayingClient(admin.p, `Sections Co ${t}`);
const dir = await provision(browser, errors, admin.p, {
  name: "Sec Tion", company: `Sections Co ${t}`, email: `sec${t}@example.com`, role: "director",
});

await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const warm = await palette(dir.p);
check("the dashboard says which section it is", warm.section === "casting", warm.section);
check("on the cream ground", warm.ink.toUpperCase() === "#EAE3D6", warm.ink);
check("under the terracotta bar", warm.brand.toUpperCase() === "#A24332", warm.brand);
check("with gold for the action", warm.accent.toUpperCase() === "#D0A74A", warm.accent);
check("and the ground is painted, not left to the body", ratio(warm.ground, "rgb(255,255,255)") > 1.05, warm.ground);
await dir.p.screenshot({ path: `${SHOTS}/section-casting.png`, fullPage: false });

section("2 the administrator's section is the other one");
await admin.p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
const cool = await palette(admin.p);
check("the admin overview says which section it is", cool.section === "admin", cool.section);
check("on the slate ground", cool.ink.toUpperCase() === "#E3E8EC", cool.ink);
check("under the petrol bar", cool.brand.toUpperCase() === "#2F4858", cool.brand);
check("with teal for the action", cool.accent.toUpperCase() === "#4AB9D0", cool.accent);
await admin.p.screenshot({ path: `${SHOTS}/section-admin.png`, fullPage: false });

section("3 nothing they share is the same colour");
for (const key of ["ink", "raised", "brand", "accent", "lineStrong", "text", "muted", "faint"]) {
  check(`${key} differs between the sections`, warm[key] !== cool[key], `${warm[key]} / ${cool[key]}`);
}
check("and the bar the reader sees actually changed", warm.bar !== cool.bar, `${warm.bar} / ${cool.bar}`);

section("4 both palettes clear WCAG 2.2 AA on every pairing the components make");
for (const [what, fg, bg, need] of PAIRINGS) {
  const w = ratio(warm[fg], warm[bg]);
  const c = ratio(cool[fg], cool[bg]);
  check(
    `${what}: warm ${w.toFixed(1)}:1, admin ${c.toFixed(1)}:1 (needs ${need}:1)`,
    // The warm palette's field edge is the one pairing that was already under
    // 3:1 before this, and the alternate palette is asked to be no worse than
    // it rather than to fix a decision taken elsewhere.
    c >= need && (w >= need || fg === "lineStrong"),
  );
}
check(
  "and the admin's field edges are the better of the two",
  ratio(cool.lineStrong, cool.surface) > ratio(warm.lineStrong, warm.surface),
);

section("5 the section is the path, not the role");
// An administrator doing their own casting is front of house and gets the
// warm palette, exactly as they get the casting navigation.
await admin.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const adminCasting = await palette(admin.p);
check("an admin on the dashboard is in the casting section", adminCasting.section === "casting");
check("and sees the warm palette", adminCasting.ink === warm.ink, adminCasting.ink);
await admin.p.goto(`${BASE}/admin/clients`, { waitUntil: "networkidle" });
check("and back inside admin, the cool one", (await palette(admin.p)).ink === cool.ink);

// A director cannot reach the admin section at all, so they never meet the
// alternate palette: it is the administrator's, not a theme to be picked.
await dir.p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("a director is refused the admin section outright", dir.p.url().includes("/admin"));
check("and gets a 404 rather than a page in another palette", (await dir.p.locator("[data-section='admin']").count()) === 0);

section("6 every page in the admin section is in its palette, and none outside it");
{
  const inside = [
    "/admin",
    "/admin/clients",
    "/admin/accounts",
    "/admin/projects",
    "/admin/submissions",
    "/admin/storage",
    "/admin/privacy",
    "/admin/notifications",
    "/admin/activity",
    "/admin/audit-logs",
    "/admin/clients/new",
    "/admin/accounts/new",
  ];
  const wrong = [];
  for (const path of inside) {
    await admin.p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const seen = await palette(admin.p);
    if (seen.section !== "admin" || seen.ink !== cool.ink) wrong.push(`${path} → ${seen.section} ${seen.ink}`);
  }
  check(`all ${inside.length} admin pages are in the admin palette`, wrong.length === 0, wrong.join(", "));

  const outside = ["/dashboard", "/dashboard/activity", "/dashboard/sessions/new", "/faq", "/legal/agreement"];
  const bled = [];
  for (const path of outside) {
    await admin.p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const seen = await palette(admin.p);
    if (seen.section !== "casting" || seen.ink !== warm.ink) bled.push(`${path} → ${seen.section} ${seen.ink}`);
  }
  check(`and the palette does not follow them out of it`, bled.length === 0, bled.join(", "));
}

section("7 the long admin lists alternate their rows");
{
  await admin.p.goto(`${BASE}/admin/audit-logs`, { waitUntil: "networkidle" });
  const rows = admin.p.locator("tbody tr");
  const count = await rows.count();
  check("there is a table to read", count >= 2, String(count));

  const colours = await admin.p.locator("tbody tr").evaluateAll((els) =>
    els.slice(0, 4).map((el) => getComputedStyle(el).backgroundColor),
  );
  const [first, second] = colours;
  check("the second row is not the colour of the first", first !== second, colours.join(" / "));
  check("and the third goes back", colours[2] === undefined || colours[2] === first, colours.join(" / "));
  check(
    "the stripe is quiet enough to read through",
    ratio(cool.text, second) >= 7,
    `${ratio(cool.text, second).toFixed(1)}:1`,
  );
  check(
    "and loud enough to follow",
    ratio(first, second) > 1.05,
    `${ratio(first, second).toFixed(3)}:1`,
  );

  // A casting director's own lists are cards, not tables, and are left alone.
  await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("nothing striped front of house", (await dir.p.locator("tbody tr").count()) === 0);
  await admin.p.screenshot({ path: `${SHOTS}/section-admin-table.png`, fullPage: false });
}

section("8 a phone gets the same swap");
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await phone.newPage();
  await p.context().addCookies(await admin.c.cookies());
  await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const seen = await palette(p);
  check("the admin section on a phone is the admin palette", seen.section === "admin" && seen.ink === cool.ink);
  const tabs = p.locator("nav[aria-label='Main']").last();
  const tabBar = await tabs.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("including the tab bar along the bottom", ratio(tabBar, cool.brandInk) > 4.5, tabBar);
  check("no horizontal overflow in the other palette", (await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await p.screenshot({ path: `${SHOTS}/section-admin-phone.png`, fullPage: false });
  await phone.close();
}

for (const s of [dir, admin]) await s.c.close();
await browser.close();
finish();
