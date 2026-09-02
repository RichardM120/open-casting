/**
 * The wall with no key.
 *
 * SITE_PASSCODE set and AUTH_SECRET missing is the easiest misconfiguration to
 * arrive at (the passcode is the first variable anyone sets) and the worst to
 * be stuck in: the wall is up, the passcode is right, and the door does not
 * open, because the cookie that would remember it cannot be signed. So the
 * interstitial says exactly that instead of offering a form, and health agrees.
 */
import { BASE, launch, reporter, session } from "./_helpers.mjs";

const { check, section, finish, errors } = reporter();
const browser = await launch();

section("1 the wall is up, and says why it will not open");
{
  const { c, p } = await session(browser, errors);
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("every page still stops at the wall", new URL(p.url()).pathname === "/gate", p.url());
  check("no passcode field, since it could only ever say no", (await p.locator("#passcode").count()) === 0);
  check("it names the missing key", (await p.getByRole("alert").filter({ hasText: "AUTH_SECRET" }).count()) === 1);
  check("and says what to do", (await p.getByText(/redeploy/).count()) > 0);
  await c.close();
}

section("2 health says the same");
{
  const body = await (await fetch(`${BASE}/api/health`)).json();
  check("the key is missing", body.authSecret === "missing", JSON.stringify(body.authSecret));
  check("and the site is walled off", body.site.startsWith("walled off"), JSON.stringify(body.site));
}

await browser.close();
finish();
