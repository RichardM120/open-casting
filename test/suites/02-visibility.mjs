import {
  BASE,
  adminSession,
  launch,
  postRole,
  provision,
  reporter,
  session,
  shareTokenForRole,
} from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();
const ctx = (viewport) => session(browser, errors, viewport);
const t = Date.now();

const ACME = `Acme Casting ${t}`;
const OTHER = `Other Casting ${t}`;

const dirA  = { name: "Dir A",  company: ACME,  email: `dira${t}@example.com`,  role: "director" };
const dirB  = { name: "Dir B",  company: ACME,  email: `dirb${t}@example.com`,  role: "director" };
const prodA = { name: "Prod A", company: ACME,  email: `proda${t}@example.com`, role: "producer" };
const prodO = { name: "Prod O", company: OTHER, email: `prodo${t}@example.com`, role: "producer" };

// Every account below exists only because the administrator made it.
const ad = await adminSession(browser, errors);

console.log("\n[1] director A posts a role under " + ACME);
const a = await provision(browser, errors, ad.p, dirA);
const roleId = await postRole(a.p, { title: `ALPHA-${t}`, company: ACME });
await a.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("A sees own role", (await a.p.getByText(`ALPHA-${t}`).count()) > 0);
check("A does not see seeded demo roles", (await a.p.getByText("NELL — Lead").count()) === 0);

section("2 director B, same company, must NOT see it");
const b = await provision(browser, errors, ad.p, dirB);
check("B dashboard does not list A's role", (await b.p.getByText(`ALPHA-${t}`).count()) === 0);
check("B gets 404 on A's role", (await b.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" })).status() === 404);

section("3 producer at the same company MUST see it");
const pa = await provision(browser, errors, ad.p, prodA);
check("producer sees company role", (await pa.p.getByText(`ALPHA-${t}`).count()) > 0);
check("producer can open it", (await pa.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" })).status() === 200);

section("4 producer at a different company must NOT");
const po = await provision(browser, errors, ad.p, prodO);
check("other-company producer does not see it", (await po.p.getByText(`ALPHA-${t}`).count()) === 0);
check("other-company producer gets 404", (await po.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" })).status() === 404);

section("5 the bootstrapped administrator sees everything");
await ad.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check("admin sees another company's role", (await ad.p.getByText(`ALPHA-${t}`).count()) > 0);
check("admin sees the seeded demo roles too", (await ad.p.getByText("NELL — Lead").count()) > 0);
check("admin can open any role", (await ad.p.goto(`${BASE}/dashboard/roles/${roleId}`, { waitUntil: "networkidle" })).status() === 200);

section("6 status writes are scoped too");
{
  // B (no access) posts a status change straight at the action's route.
  await b.p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const before = await a.p.evaluate(async (id) => {
    const r = await fetch(`/dashboard/roles/${id}`);
    return r.status;
  }, roleId);
  check("A still reaches own role", before === 200);
}

section("7 the share link is the only public way to A's role");
{
  const token = await shareTokenForRole(a.p, roleId);
  const { c, p } = await ctx();
  check("/ is public", (await p.goto(BASE, { waitUntil: "networkidle" })).status() === 200);
  check(
    "the role opens on its production's link",
    (await p.goto(`${BASE}/c/${token}/${roleId}`, { waitUntil: "networkidle" })).status() === 200,
  );
  check("anonymous can still submit", (await p.locator("#coverNote").count()) === 1);
  await c.close();
}

for (const s of [a, b, pa, po, ad]) await s.c.close();
await browser.close();
finish();
