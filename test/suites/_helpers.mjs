import { chromium } from "playwright";

export const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
export const SHOTS = process.env.SHOTS ?? "test/screenshots";

/** Collects results so a suite reports everything rather than dying on the first miss. */
export function reporter() {
  const errors = [];
  let pass = 0;
  let fail = 0;

  return {
    errors,
    check(label, ok, detail = "") {
      if (ok) {
        pass += 1;
        console.log(`  ✓ ${label}`);
      } else {
        fail += 1;
        console.log(`  ✗ ${label}  ${detail}`);
      }
    },
    section(title) {
      console.log(`\n[${title}]`);
    },
    finish() {
      console.log(`\n${pass} passed, ${fail} failed`);
      if (errors.length) console.log(`BROWSER ERRORS:\n${errors.join("\n")}`);
      process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
    },
  };
}

export async function launch() {
  const browser = await chromium.launch();
  return browser;
}

/**
 * A fresh, isolated browser context — cookies included, so roles do not bleed
 * between accounts. Returned as `{ c, p }`: context and page.
 */
export async function session(browser, errors, viewport) {
  const c = await browser.newContext(viewport ? { viewport } : {});
  const p = await c.newPage();
  p.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  p.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Several suites visit a 404 on purpose — checking that a stranger cannot
    // tell a role exists. Those are assertions, not faults. A CSP violation or
    // a script error still comes through.
    if (/Failed to load resource.*\b40[034]\b/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return { c, p };
}

export const PASSWORD = "correct horse battery";

/** A `yyyy-mm-dd` date relative to today, so the fixtures do not rot. */
export function day(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Signs up and stops on the wizard, for the suite that tests the wizard. */
export async function signUpOnly(page, user) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill("#name", user.name);
  await page.fill("#company", user.company);
  await page.fill("#email", user.email);
  await page.fill("#password", PASSWORD);
  await page.check(`input[name="role"][value="${user.role}"]`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome**", { timeout: 20000 });
}

/** Signs up and steps past the wizard, which most suites do not care about. */
export async function signUp(page, user) {
  await signUpOnly(page, user);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
}

export async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1500);
}

/** Opens a casting session and returns its id. */
export async function openSession(page, fields) {
  await page.goto(`${BASE}/dashboard/sessions/new`, { waitUntil: "networkidle" });
  await page.fill("#name", fields.name);
  await page.fill(
    "#synopsis",
    fields.synopsis ?? "A production used by the test suite, described at length.",
  );
  await page.fill("#company", fields.company);
  await page.fill("#opensAt", fields.opensAt ?? day(0));
  await page.fill("#closesAt", fields.closesAt ?? day(30));
  await page.getByRole("button", { name: "Open the session" }).click();
  await page.waitForURL(/\/dashboard\/sessions\/ses_/, { timeout: 20000 });
  return page.url().match(/sessions\/(ses_[^?]+)/)[1];
}

/**
 * Posts a role and returns its id. A role must belong to a casting session, so
 * one is opened first unless the caller passes `sessionId`.
 */
export async function postRole(page, fields) {
  const sessionId =
    fields.sessionId ??
    (await openSession(page, {
      name: fields.production ?? `${fields.title} Production`,
      company: fields.company,
      opensAt: fields.opensAt,
      closesAt: fields.closesAt,
    }));

  await page.goto(`${BASE}/roles/new`, { waitUntil: "networkidle" });
  await page.selectOption("#sessionId", sessionId);
  await page.fill("#production", fields.production ?? `${fields.title} Production`);
  await page.fill("#synopsis", fields.synopsis ?? "A production used by the test suite.");
  await page.fill("#castingDirector", fields.castingDirector ?? "Test Director");
  await page.fill("#company", fields.company);
  await page.fill("#title", fields.title);
  await page.fill(
    "#characterBrief",
    fields.characterBrief ?? "A character brief comfortably long enough to pass validation.",
  );
  await page.fill("#location", fields.location ?? "Leeds, UK");
  await page.fill("#shootDates", fields.shootDates ?? "Mar 2027");
  await page.fill("#rate", fields.rate ?? "£400/day");
  if (fields.disclaimer) await page.fill("#disclaimer", fields.disclaimer);
  await page.getByRole("button", { name: "Post the role" }).click();
  await page.waitForURL("**/dashboard/roles/**", { timeout: 20000 });
  return page.url().match(/roles\/(rol_[^?]+)/)[1];
}

/** Fills and sends the public submission form. */
export async function submit(page, roleId, performer, { acceptTerms = false } = {}) {
  await page.goto(`${BASE}/roles/${roleId}`, { waitUntil: "networkidle" });
  await page.fill("#name", performer.name);
  await page.fill("#email", performer.email);
  await page.fill("#phone", performer.phone ?? "07700 900000");
  await page.fill("#location", performer.location ?? "Leeds");
  await page.fill("#age", String(performer.age ?? 30));
  await page.fill(
    "#coverNote",
    performer.coverNote ?? "A cover note comfortably longer than the twenty character minimum.",
  );
  if (acceptTerms) await page.check("#acceptTerms");
  await page.getByRole("button", { name: "Send submission" }).click();
}
