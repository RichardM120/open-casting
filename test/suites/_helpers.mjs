import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

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

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "boss@example.com",
  password: process.env.ADMIN_PASSWORD ?? "bootstrap-admin-password",
};

/** A `yyyy-mm-dd` date relative to today, so the fixtures do not rot. */
export function day(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1500);
}

/** Everything the app has sent to the stand-in mail provider. */
function mailbox() {
  try {
    return JSON.parse(readFileSync(process.env.MAILBOX ?? "test/mailbox.json", "utf8"));
  } catch {
    return [];
  }
}

/**
 * The newest sign-in link the app has emailed. The harness runs a stand-in for
 * the mail provider, so this is the link a person would actually receive.
 */
export async function latestSignInLink({ after = 0 } = {}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const links = mailbox()
      .flatMap((message) => message.text.match(/http:\/\/\S+\/login\/verify\?token=\S+/g) ?? []);
    if (links.length > after) return links[links.length - 1];
    await sleep(250);
  }
  throw new Error("no sign-in link reached the mailbox");
}

export function countSignInLinks() {
  return mailbox().filter((message) => /\/login\/verify\?token=/.test(message.text)).length;
}

/**
 * Signs in as the administrator, which needs a second factor: password, then
 * the one-time link. Every suite goes through this because every suite needs
 * the admin to make its accounts.
 */
export async function signInAsAdmin(page) {
  const before = countSignInLinks();
  await signIn(page, ADMIN.email, ADMIN.password);
  const link = await latestSignInLink({ after: before });
  await page.goto(link, { waitUntil: "networkidle" });
}

/**
 * Creates an account the way the administrator does, and reads back the
 * generated password — there is no other way to get one, which is the point.
 */
export async function createAccount(adminPage, user) {
  await adminPage.goto(`${BASE}/dashboard/accounts`, { waitUntil: "networkidle" });
  await adminPage.fill("#name", user.name);
  await adminPage.fill("#email", user.email);
  await adminPage.fill("#company", user.company);
  await adminPage.selectOption("#role", user.role ?? "director");
  if (user.maxSessions !== undefined) {
    await adminPage.fill("#maxSessions", String(user.maxSessions));
  }
  if (user.maxRolesPerSession !== undefined) {
    await adminPage.fill("#maxRolesPerSession", String(user.maxRolesPerSession));
  }
  if (user.accessUntil !== undefined) await adminPage.fill("#accessUntil", user.accessUntil);
  await adminPage.getByRole("button", { name: "Create the account" }).click();

  const shown = adminPage.locator("dd.select-all");
  await shown.waitFor({ timeout: 20000 });
  return (await shown.textContent()).trim();
}

/**
 * The whole way in for a suite's fixture account: the admin makes it, then it
 * signs in in its own browser context. Stops on the wizard, where a new account
 * actually lands.
 */
export async function provisionOnly(browser, errors, admin, user) {
  const password = await createAccount(admin, user);
  const ctx = await session(browser, errors);
  await signIn(ctx.p, user.email, password);
  await ctx.p.waitForURL("**/welcome**", { timeout: 20000 });
  return { ...ctx, password };
}

/**
 * Accepts the Master Services Agreement, which is the first thing setup asks
 * and the gate on the dashboard. Every fixture account has to get past it.
 */
export async function acceptAgreement(page) {
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  const box = page.locator('input[name="accept"]');
  if ((await box.count()) === 0) return;
  await box.check();
  await page.getByRole("button", { name: "Accept and continue" }).click();
  await page.waitForURL(/welcome\?step=/, { timeout: 20000 });
}

/** As `provisionOnly`, then past the wizard, which most suites do not care about. */
export async function provision(browser, errors, admin, user) {
  const ctx = await provisionOnly(browser, errors, admin, user);
  await acceptAgreement(ctx.p);
  await ctx.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  return ctx;
}

/** An admin context of its own, for a suite that needs to make accounts. */
export async function adminSession(browser, errors) {
  const ctx = await session(browser, errors);
  await signInAsAdmin(ctx.p);
  return ctx;
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
  await page.fill("#productionEndsAt", fields.productionEndsAt ?? day(60));
  await page.getByRole("button", { name: "Open the session" }).click();
  await page.waitForURL(/\/dashboard\/sessions\/ses_/, { timeout: 20000 });
  return page.url().match(/sessions\/(ses_[^?]+)/)[1];
}

/** Publishes a session, which is what makes its share link work. */
export async function publish(page, sessionId) {
  await page.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Publish this casting call" }).click();
  await page.waitForURL(/published=1/, { timeout: 20000 });
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

  await page.goto(`${BASE}/dashboard/roles/new`, { waitUntil: "networkidle" });
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
  await page.waitForURL(/\/dashboard\/roles\/rol_/, { timeout: 20000 });
  const roleId = page.url().match(/roles\/(rol_[^?]+)/)[1];

  // A session this helper opened is a draft, and a draft's link opens for
  // nobody — so publish it, unless the caller is testing that very thing.
  if (!fields.sessionId && fields.publish !== false) await publish(page, sessionId);

  return roleId;
}

/** The share link for a casting session, read off its dashboard page. */
export async function shareToken(page, sessionId) {
  await page.goto(`${BASE}/dashboard/sessions/${sessionId}`, { waitUntil: "networkidle" });
  const url = (await page.locator("code.select-all").first().textContent()).trim();
  return url.split("/c/")[1];
}

/**
 * The share token for whichever production a role belongs to, read off the
 * "View as a performer" link on the role's own dashboard page.
 */
export async function shareTokenForRole(page, roleId) {
  await page.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
  const href = await page.getByRole("link", { name: "View as a performer" }).first().getAttribute("href");
  return href.split("/c/")[1].split("/")[0];
}

/** Fills and sends the submission form, reached the way a performer reaches it. */
export async function submit(page, token, roleId, performer, { acceptTerms = false } = {}) {
  await page.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
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
  await page.check("#acceptSubmissionTerms");
  await page.getByRole("button", { name: "Send submission" }).click();
}
