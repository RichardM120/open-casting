/**
 * Every page, put through axe-core against WCAG 2.2 AA.
 *
 * The rules a machine can decide — contrast, names on controls, labels on
 * fields, heading order, landmarks, the language of the document — are the
 * ones that get broken quietly by an ordinary change and never noticed. This
 * suite fails the build on any of them, so a regression costs a push rather
 * than a complaint.
 *
 * It is not the whole of accessibility. Whether the words make sense, whether
 * a keyboard can finish a task, whether an error tells you what to do — those
 * still need a person. What is automated here is what a person should never
 * have to check twice.
 */
import { createRequire } from "node:module";

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
  session,
  shareToken,
} from "./_helpers.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core");

const { check, section, finish, errors } = reporter();
const browser = await launch();
const t = Date.now();

/** WCAG 2.2 AA, which is what a public service in the UK is asked to meet. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const admin = await adminSession(browser, errors);
const owner = await provision(browser, errors, admin.p, {
  name: "Ada Access",
  email: `access${t}@example.com`,
  company: `Access Co ${t}`,
});
const call = await openSession(owner.p, { name: `Access Call ${t}` });
const roleId = await postRole(owner.p, { sessionId: call, title: "Lead" });
await publish(owner.p, call);
const token = await shareToken(owner.p, call);

/** Runs axe in the page and returns the violations, worst first. */
async function scan(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  // Folded-away detail is still content: open it so it is checked too.
  await page.evaluate(() => {
    for (const fold of document.querySelectorAll("details")) fold.open = true;
  });
  await page.addScriptTag({ path: AXE });
  return page.evaluate(
    async (tags) =>
      (await axe.run(document, { runOnly: { type: "tag", values: tags } })).violations.map(
        (violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.slice(0, 2).map((node) => node.html.slice(0, 90)),
        }),
      ),
    TAGS,
  );
}

const said = (violations) =>
  violations
    .map((v) => `${v.id} (${v.impact}) ${v.nodes.join(" | ")}`)
    .slice(0, 2)
    .join("  ///  ");

/** What a stranger sees: no account, no session. */
const OPEN = [
  ["the home page", "/"],
  ["the guides", "/faq"],
  ["the applicants' guide", "/faq/applicants"],
  ["the casting directors' guide", "/faq/casting-directors"],
  ["the terms of submission", "/legal/submission-terms"],
  ["sign in", "/login"],
  ["a casting call", `/c/${token}`],
  ["a role, with its form", `/c/${token}/${roleId}`],
];

/** What the two signed-in sections look like. */
const CASTING = [
  ["the dashboard", "/dashboard"],
  ["the activity trail", "/dashboard/activity"],
  ["a casting call's own page", `/dashboard/sessions/${call}`],
  ["the casting call form", "/dashboard/sessions/new"],
  ["the role form", "/dashboard/roles/new"],
  ["the agreement", "/legal/agreement"],
];

const ADMIN = [
  ["the admin overview", "/admin"],
  ["clients", "/admin/clients"],
  ["the client form", "/admin/clients/new"],
  ["accounts", "/admin/accounts"],
  ["setting an account up", "/admin/accounts/new"],
  ["projects", "/admin/projects"],
  ["the submissions feed", "/admin/submissions"],
  ["storage", "/admin/storage"],
  ["privacy", "/admin/privacy"],
  ["notifications", "/admin/notifications"],
  ["the audit log", "/admin/audit-logs"],
];

const stranger = await session(browser, errors);

section("1 the pages anyone can open");
for (const [label, url] of OPEN) {
  const found = await scan(stranger.p, url);
  check(label, found.length === 0, said(found));
}

section("2 the casting director's section");
for (const [label, url] of CASTING) {
  const found = await scan(owner.p, url);
  check(label, found.length === 0, said(found));
}

section("3 the administrator's section");
for (const [label, url] of ADMIN) {
  const found = await scan(admin.p, url);
  check(label, found.length === 0, said(found));
}

section("4 the same pages on a phone, where the layout changes");
await stranger.p.setViewportSize({ width: 320, height: 720 });
await admin.p.setViewportSize({ width: 320, height: 720 });
for (const [label, url] of [OPEN[0], OPEN[6], OPEN[7]]) {
  const found = await scan(stranger.p, url);
  check(`${label}, at 320px`, found.length === 0, said(found));
}
for (const [label, url] of [ADMIN[0], ADMIN[6], ADMIN[8]]) {
  const found = await scan(admin.p, url);
  check(`${label}, at 320px`, found.length === 0, said(found));
}

section("5 a form that has been submitted wrong still reads");
{
  const { p } = stranger;
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  // Empty, so every required field fails at once and the page fills with the
  // error state: the moment an applicant most needs it to be readable.
  await p.evaluate(() => {
    const form = document.querySelector("form input#name")?.closest("form");
    if (form) form.noValidate = true;
  });
  await p.getByRole("button", { name: /Send|Submit/ }).first().click();
  await p.waitForTimeout(1500);
  await p.addScriptTag({ path: AXE });
  const found = await p.evaluate(
    async (tags) =>
      (await axe.run(document, { runOnly: { type: "tag", values: tags } })).violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 90)),
      })),
    TAGS,
  );
  check("the form in its error state", found.length === 0, said(found));
}

await admin.p.screenshot({ path: `${SHOTS}/21-accessibility.png`, fullPage: true });
await browser.close();
finish();
