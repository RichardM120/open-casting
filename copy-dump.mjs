// The words every page actually shows, for reading rather than grepping.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3301";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await c.newPage();

async function signIn() {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill("#email", "boss@example.com");
  await p.fill("#password", "bootstrap-admin-password");
  await p.getByRole("button", { name: "Sign in" }).click();
  for (let i = 0; i < 60; i += 1) {
    const links = (readFileSync("/tmp/audit-mail.log", "utf8").match(/http:\/\/\S+\/login\/verify\?token=\S+/g) ?? []);
    if (links.length) { await p.goto(links[links.length - 1], { waitUntil: "networkidle" }); return; }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no link");
}
await signIn();

const PAGES = ["/", "/faq", "/faq/applicants", "/faq/performers", "/faq/casting-directors",
  "/legal/agreement", "/legal/submission-terms", "/login", "/dashboard", "/dashboard/activity",
  "/dashboard/sessions/new", "/dashboard/roles/new", "/welcome",
  "/admin", "/admin/clients", "/admin/clients/new", "/admin/accounts", "/admin/accounts/new",
  "/admin/projects", "/admin/submissions", "/admin/storage", "/admin/privacy",
  "/admin/notifications", "/admin/audit-logs", "/admin/activity"];

let out = "";
for (const url of PAGES) {
  const res = await p.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await p.evaluate(() => { for (const d of document.querySelectorAll("details")) d.open = true; });
  const text = await p.locator("main").innerText().catch(() => "(no main)");
  out += `\n${"=".repeat(70)}\n${url}  [${res.status()}]\n${"=".repeat(70)}\n${text}\n`;
}
writeFileSync("/tmp/claude-0/-home-user/476ba44c-cca3-5fc0-b95f-a0428bb19d4c/scratchpad/copy.txt", out);
console.log("pages:", PAGES.length, "chars:", out.length);
await b.close();
