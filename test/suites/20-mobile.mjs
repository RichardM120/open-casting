/**
 * What a phone gets, measured rather than assumed.
 *
 * 320px is the narrowest screen still in use and the width everything has to
 * survive; a page that works there works on the rest. The checks are the four
 * things that go wrong on a small screen and cannot be seen from a desktop:
 * the page pushing sideways, a control too small to hit, type too small to
 * read, and a card drawn inside another card so the padding is paid twice.
 *
 * They are deliberately about the standards, not about any one screen, so a
 * new page is covered the day it is added to the list.
 */
import {
  BASE,
  SHOTS,
  adminSession,
  launch,
  openSession,
  postRole,
  provision,
  publish,
  reporter,
  shareToken,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();

/** The narrowest screen worth supporting, with a thumb rather than a pointer. */
const PHONE = { width: 320, height: 720 };

/**
 * 44px is the target size Apple, Material and WCAG's AAA rule all settle on.
 * WCAG 2.2 AA asks 24. The site holds to 44 for anything you tap on purpose,
 * so this is the number the checks use.
 */
const TARGET = 44;
/** Nothing in the interface goes below this. Half a pixel of rounding is fine. */
const TYPE = 11.9;

const admin = await adminSession(browser, errors);
const { p: page } = admin;

// A casting call of their own, published and open, so the applicant's pages
// have something real on them rather than the seeded demo. Set up at a normal
// width: what is being measured is the reading of these pages on a phone, not
// the filling in of the forms that made them.
const owner = await provision(browser, errors, admin.p, {
  name: "Pippa Phone",
  email: `phone${t}@example.com`,
  company: `Phone Co ${t}`,
});
const call = await openSession(owner.p, { name: `Phone Call ${t}` });
await postRole(owner.p, { sessionId: call, title: "Lead" });
await publish(owner.p, call);
const token = await shareToken(owner.p, call);

await page.setViewportSize(PHONE);

/**
 * Everything wrong with one page, in one pass of the DOM.
 *
 * The exemptions are the ones the standards themselves make. A link inside a
 * sentence is exempt from the target rule because padding it out would break
 * the line it sits in; a card whose title link is stretched over the whole
 * card by a pseudo-element is the size of the card, not of the words.
 */
async function measure(url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  return page.evaluate(
    ({ TARGET, TYPE }) => {
      const doc = document.documentElement;
      const name = (el) => {
        const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 3).join(".");
        const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
        return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
      };

      const spill = [];
      for (const el of document.querySelectorAll("body *")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) continue;
        // Inside something that scrolls sideways on purpose is not a spill.
        const scroller = el.closest(".overflow-x-auto");
        if (scroller && scroller !== el) continue;
        if (rect.right > doc.clientWidth + 1) spill.push(name(el));
      }

      const small = [];
      const tappable = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]";
      for (const el of document.querySelectorAll(tappable)) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.height >= TARGET - 0.5 && rect.width >= TARGET - 0.5) continue;
        if (el.classList.contains("sr-only")) continue;
        if (getComputedStyle(el, "::after").position === "absolute") continue;
        const parent = el.parentElement;
        const inASentence =
          parent &&
          ["P", "LI", "SPAN", "DD", "STRONG", "EM"].includes(parent.tagName) &&
          parent.textContent.trim().length > el.textContent.trim().length + 8;
        if (inASentence) continue;
        // WCAG 2.2's spacing exception: a small target with clear space around
        // it passes, because nothing else is close enough to hit by mistake.
        // A table cell is exactly that — the cell's own padding is the space.
        const cell = el.closest("td, th");
        if (cell && cell.getBoundingClientRect().height >= TARGET - 0.5) continue;
        // A control wrapped in its own label is tapped by the label, which is
        // the row: the box drawn for the tick is not the target.
        const label = el.closest("label");
        if (label && label !== el && label.getBoundingClientRect().height >= TARGET - 0.5) continue;
        small.push(`${name(el)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }

      const tiny = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
        if (!(el.textContent || "").trim()) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < TYPE) tiny.push(`${name(el)} ${size}px`);
      }

      // A row of a list, drawn as a card, inside a card. That is where the
      // cost compounds: every row in the list pays for the outer frame's
      // padding as well as its own. A tile in a grid of four is not this — it
      // is small on purpose and the grid is the thing being read.
      const nested = [];
      for (const el of document.querySelectorAll("main li.rounded-xl, main li.rounded-2xl")) {
        if (parseFloat(getComputedStyle(el).paddingLeft) === 0) continue;
        const outer = el.parentElement?.closest("main .rounded-2xl, main .rounded-xl");
        if (!outer || parseFloat(getComputedStyle(outer).paddingLeft) === 0) continue;
        nested.push(name(el));
      }

      // A row that wraps — a heading with buttons beside it, a name with its
      // counts and a Suspend button — puts the identity in a column that must
      // take the whole row on a phone. A column allowed to shrink instead
      // ends up a sliver: a name cut to three letters, a heading one word a
      // line, badges painted over the text beside them. `basis-full` is what
      // makes it wrap, so its absence is the bug, and its presence with less
      // than the full row means something on the row will not let it wrap.
      const squeezed = [];
      for (const el of document.querySelectorAll('main [class~="basis-full"]')) {
        const parent = el.parentElement;
        if (!parent || !getComputedStyle(parent).display.includes("flex")) continue;
        const style = getComputedStyle(parent);
        const room =
          parent.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        const got = el.getBoundingClientRect().width;
        if (got < room - 1) squeezed.push(`${name(el)} ${Math.round(got)} of ${Math.round(room)}`);
      }

      return { spill, small, tiny, nested, squeezed, width: doc.clientWidth, scroll: doc.scrollWidth };
    },
    { TARGET, TYPE },
  );
}

const PAGES = [
  ["the home page", "/"],
  ["the guides", "/faq"],
  ["the applicants' guide", "/faq/applicants"],
  ["a casting call", `/c/${token}`],
  ["the dashboard", "/dashboard"],
  ["the activity trail", "/dashboard/activity"],
  ["the casting call's own page", `/dashboard/sessions/${call}`],
  ["the admin overview", "/admin"],
  ["clients", "/admin/clients"],
  ["accounts", "/admin/accounts"],
  ["projects", "/admin/projects"],
  ["the submissions feed", "/admin/submissions"],
  ["storage", "/admin/storage"],
  ["privacy", "/admin/privacy"],
  ["notifications", "/admin/notifications"],
  ["the audit log", "/admin/audit-logs"],
];

section(`1 nothing pushes a ${PHONE.width}px screen sideways`);
const measured = new Map();
for (const [label, url] of PAGES) {
  const found = await measure(url);
  measured.set(label, found);
  check(`${label} fits`, found.spill.length === 0 && found.scroll <= found.width + 1,
    found.spill.slice(0, 3).join(" | "));
}

section(`2 everything you tap is at least ${TARGET}px under a thumb`);
for (const [label] of PAGES) {
  const found = measured.get(label);
  check(`${label}`, found.small.length === 0, found.small.slice(0, 3).join(" | "));
}

section("3 no text in the interface is under 12px");
for (const [label] of PAGES) {
  const found = measured.get(label);
  check(`${label}`, found.tiny.length === 0, found.tiny.slice(0, 3).join(" | "));
}

section("4 no card is drawn inside another card");
for (const [label] of PAGES) {
  const found = measured.get(label);
  check(`${label}`, found.nested.length === 0, found.nested.slice(0, 3).join(" | "));
}

section("4b no section heading is squeezed into a sliver beside its buttons");
for (const [label] of PAGES) {
  const found = measured.get(label);
  check(`${label}`, found.squeezed.length === 0, found.squeezed.slice(0, 3).join(" | "));
}

section("5 the gap between cards is the phone's, and widens with the screen");
{
  await page.goto(`${BASE}/admin/storage`, { waitUntil: "networkidle" });
  const gapAt = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll("main section[aria-labelledby]")];
      if (cards.length < 2) return null;
      const first = cards[0].getBoundingClientRect();
      const second = cards[1].getBoundingClientRect();
      return Math.round(second.top - first.bottom);
    });
  const phone = await gapAt();
  check(`24px on a phone: ${phone}`, phone === 24);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto(`${BASE}/admin/storage`, { waitUntil: "networkidle" });
  const desk = await gapAt();
  check(`32px with room for it: ${desk}`, desk === 32);
  await page.setViewportSize(PHONE);
}

section("6 the applicant's form is the widest thing on their screen");
{
  await page.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Lead" }).first().click();
  await page.waitForURL(/\/c\/.+\/.+/, { timeout: 20000 });
  const room = await page.evaluate(() => {
    const form = document.querySelector("form input#name")?.closest("form");
    if (!form) return null;
    const box = form.getBoundingClientRect();
    const style = getComputedStyle(form.parentElement);
    return {
      inner: Math.round(box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)),
      screen: document.documentElement.clientWidth,
    };
  });
  // 20px of padding each side inside a 288px card, not 28: the form is what
  // the applicant came for and the words in it need the room.
  check(`the form has ${room?.inner}px of a ${room?.screen}px screen`,
    room !== null && room.inner >= room.screen - 80);
}

await page.screenshot({ path: `${SHOTS}/20-mobile.png`, fullPage: true });
await browser.close();
finish();
