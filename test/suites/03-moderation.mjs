import {
  BASE,
  launch,
  postRole,
  reporter,
  session,
  adminSession,
  provision,
  shareTokenForRole,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

const CO = `Mod Co ${t}`;

const admin0 = await adminSession(browser, errors);
const dir = await provision(browser, errors, admin0.p, { name: "Mod Dir", company: CO, email: `md${t}@example.com`, role: "director" });
const roleId = await postRole(dir.p, { title: `MOD-${t}`, company: CO });
const token = await shareTokenForRole(dir.p, roleId);

section("1 owner can edit their own role");
await dir.p.goto(`${BASE}/dashboard/roles/${roleId}/edit`, { waitUntil: "networkidle" });
check("edit form prefilled", (await dir.p.inputValue("#title")) === `MOD-${t}`);
await dir.p.fill("#location", "Whitby, Yorkshire");
await dir.p.fill("#disclaimer", "Edited terms: usage UK only, 3 months.");
await dir.p.getByRole("button", { name: "Save changes" }).click();
await dir.p.waitForURL("**/dashboard/roles/**", { timeout: 20000 });
await dir.p.getByText("Changes saved").waitFor({ timeout: 20000 });
check("save confirmed", true);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("edit is live publicly", (await p.getByText("Whitby, Yorkshire").count()) > 0);
  check("new terms shown", (await p.getByText("Edited terms").count()) > 0);
  await c.close();
}

section("2 close early stops submissions without destroying anything");
await dir.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
await dir.p.getByRole("button", { name: "Close early" }).click();
await dir.p.waitForTimeout(2000);
check("marked closed early", (await dir.p.getByText(/Closed early on/).count()) > 0);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("public form gone", (await p.locator("#coverNote").count()) === 0);
  check("listing still readable", (await p.getByText(`MOD-${t}`).count()) > 0);
  await p.goto(`${BASE}/roles`, { waitUntil: "networkidle" });
  await p.goto(`${BASE}/c/${token}`, { waitUntil: "networkidle" });
  check("still listed on its casting call, for reference", (await p.getByText(`MOD-${t}`).count()) > 0);
  await c.close();
}
await dir.p.getByRole("button", { name: "Reopen" }).click();
await dir.p.waitForTimeout(2000);
check("reopen works", (await dir.p.getByText("Close early").count()) > 0);

section("3 a director elsewhere cannot edit it");
const other = await provision(browser, errors, admin0.p, { name: "Other", company: `Other ${t}`, email: `ot${t}@example.com`, role: "director" });
check("404 on the edit page", (await other.p.goto(`${BASE}/dashboard/roles/${roleId}/edit`, { waitUntil: "networkidle" })).status() === 404);

section("4 accounts page is admin only");
check("non-admin gets 404", (await other.p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" })).status() === 404);
// The bootstrapped administrator, not a made account: there is only one.
const admin = admin0;
check("admin reaches it", (await admin.p.goto(`${BASE}/admin/accounts`, { waitUntil: "networkidle" })).status() === 200);
check("lists other accounts", (await admin.p.getByText(`md${t}@example.com`).count()) > 0);
check("cannot suspend self", (await admin.p.getByText("Cannot suspend yourself").count()) > 0);

section("5 suspending signs someone out immediately");
const row = admin.p.locator("main ul > li").filter({ hasText: `md${t}@example.com` });
await row.getByRole("button", { name: "Suspend" }).click();
await admin.p.waitForTimeout(2000);
check("marked suspended", (await row.getByText("Suspended").count()) > 0);
await dir.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("existing session revoked", dir.p.url().includes("/login"), dir.p.url());
await dir.p.fill("#email", `md${t}@example.com`);
await dir.p.fill("#password", dir.password);
await dir.p.getByRole("button", { name: "Sign in" }).click();
await dir.p.waitForTimeout(2000);
check("cannot sign back in", (await dir.p.getByText(/suspended/i).count()) > 0);
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  check("their listing stays up", (await p.getByText(`MOD-${t}`).count()) > 0);
  await c.close();
}
await admin.p.reload({ waitUntil: "networkidle" });
await admin.p.locator("main ul > li").filter({ hasText: `md${t}@example.com` })
  .getByRole("button", { name: "Restore" }).click();
await admin.p.waitForTimeout(2000);
check("restore works", (await admin.p.getByText(`md${t}@example.com`).count()) > 0);

section("6 removal is admin only and destroys the submissions");
{
  const { c, p } = await ctx();
  await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" });
  await p.fill("#name", "Doomed Sub"); await p.fill("#email", `dm${t}@example.com`);
  await p.fill("#phone", "07700 900555"); await p.fill("#location", "York"); await p.selectOption("#age", "30");
  await p.fill("#coverNote", "A cover note comfortably longer than the twenty character minimum.");
  // The edit in step 1 gave this role terms, so acceptance is now required.
  await p.check("#acceptTerms");
  await p.check("#acceptSubmissionTerms");
  if (await p.locator("#available").count()) await p.check("#available");
  await p.getByRole("button", { name: "Send submission" }).click();
  await p.getByText("Submission sent").waitFor({ timeout: 20000 });
  await c.close();
}
await other.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("non-admin sees no remove control", (await other.p.getByText("Remove this role").count()) === 0);
await admin.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" });
check("admin sees the danger zone", (await admin.p.getByText("Remove this role").count()) > 0);
await admin.p.getByText("Remove this role").click();
check("warns how many submissions go", (await admin.p.getByText(/1 submission/).count()) > 0);
await admin.p.check('input[name="confirm"]');
await admin.p.getByRole("button", { name: "Remove role and submissions" }).click();
await admin.p.waitForTimeout(2500);
{
  const { c, p } = await ctx();
  check("role is gone", (await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" })).status() === 404);
  await c.close();
}

for (const s of [dir, other, admin0]) await s.c.close();
await browser.close();
finish();
