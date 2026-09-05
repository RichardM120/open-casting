/**
 * What the operator has told the deployment about itself.
 *
 * Five settings decide what the footer of every page is allowed to say: where
 * an applicant reports a fake casting call, and the four disclosures a limited
 * company owes its website — the company number, the registered office, the
 * VAT registration and the ICO registration. None of them break anything when
 * they are missing or wrong. That is the problem: a mistyped report address is
 * a valid address belonging to nobody, and nothing says so until somebody
 * tries to use it and gets nothing back.
 *
 * So `/api/health` reports them, and this suite holds it to two things: that
 * what the health check says matches what the footer prints, and that a gap
 * is named as the thing to do about it rather than left as a silent absence.
 *
 * This suite runs with all five set (see SUITE_ENV in `run.mjs`). Every other
 * suite runs with none of them set, and `10-magic-link.mjs` checks that shape,
 * so both are covered.
 */
import { BASE, launch, reporter, session } from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();

const health = await (await fetch(`${BASE}/api/health`)).json();
const { c, p } = await session(browser, errors);
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const footer = (await p.locator("footer").innerText()).replace(/\s+/g, " ");

section("1 health reports what the operator has set");
{
  const operator = health.operator;
  check("there is an operator block", operator !== undefined, JSON.stringify(Object.keys(health)));
  check("the report address is given in full, because every page links to it anyway",
    operator.reportTo === "report@example.co.uk", operator.reportTo);
  check("and says which variable it came from", operator.reportFrom === "REPORT_EMAIL", operator.reportFrom);
  check("the company name", operator.companyName === "Example Casting Limited", operator.companyName);
  check("the company number is set", operator.companyNumber === "set", operator.companyNumber);
  check("the registered office is set", operator.registeredOffice === "set", operator.registeredOffice);
  check("the VAT number is set", operator.vatNumber === "set", operator.vatNumber);
  check("the ICO registration is set", operator.icoRegistration === "set", operator.icoRegistration);
  check(`nothing is outstanding: ${JSON.stringify(operator.gaps)}`, operator.gaps.length === 0);
}

section("2 and never the values of anything that is not already public");
{
  const body = JSON.stringify(health);
  // The report address is on every page. The rest are numbers and an address
  // that identify the company, and this endpoint answers to anybody.
  check("no company number", !body.includes("01234567"), body);
  check("no registered office", !body.includes("Example Street"), body);
  check("no VAT number", !body.includes("GB123456789"), body);
  check("no ICO registration", !body.includes("ZA123456"), body);
  check("and still no connection string", !body.includes("postgresql://"));
}

section("3 what health says is what the footer prints");
{
  // The address is the link's target, not its words: an address set in the
  // footer of every page is an address that gets scraped.
  check("the footer offers a way to write rather than an address",
    footer.includes("Contact us"), footer.slice(0, 200));
  check("and does not print the address itself",
    !footer.includes("report@example.co.uk"), footer.slice(0, 300));
  check("the company owns the page", footer.includes("Example Casting Limited"));
  check("the number is disclosed", /Registered in England and Wales no\. 01234567/.test(footer), footer);
  check("with the registered office", footer.includes("1 Example Street, Leeds, LS1 1AA"));
  check("the VAT registration", footer.includes("VAT no. GB123456789"));
  check("and the ICO registration", /Information Commissioner.s Office, no\. ZA123456/.test(footer), footer);
}

section("4 a mailto a person can actually click");
{
  const link = p.locator('footer a[href^="mailto:"]');
  check("there is one, and one only", (await link.count()) === 1);
  check("reading as an invitation", (await link.innerText()).trim() === "Contact us",
    await link.innerText());
  check("and opening a mail to the address health reported",
    (await link.getAttribute("href")) === "mailto:report@example.co.uk",
    await link.getAttribute("href"));
}

section("5 it can be read from outside, which is the point of it");
{
  // The whole use of this is checking a deployment you are not signed in to,
  // from a machine that is not yours. If it needed a session it would only
  // answer for someone who could already see the admin screens.
  const bare = await fetch(`${BASE}/api/health`, { redirect: "manual" });
  check(`no sign-in needed: ${bare.status}`, bare.status === 200);
  check("and it is never cached", bare.headers.get("cache-control") === "no-store",
    bare.headers.get("cache-control"));
  const again = await bare.json();
  check("the same answer as the browser got", JSON.stringify(again.operator) === JSON.stringify(health.operator));
}

await c.close();
await browser.close();
finish();
