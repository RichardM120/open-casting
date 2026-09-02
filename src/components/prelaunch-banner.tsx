import { cookies } from "next/headers";

import { GATE_COOKIE, gateEnabled } from "@/lib/gate";
import { verifyValue } from "@/lib/token";

/**
 * Unmissable while the site is closed, because the way this becomes a bad day
 * is somebody forgetting it is. Rendered in the root layout, so it is on every
 * page, including the casting share links, which are behind the wall too.
 *
 * Not on the interstitial itself: whoever is looking at that has not been let
 * in, and telling them the sign-in behind it accepts anything is a hint they
 * have no business having. So it renders only once the passcode is spent.
 */
export async function PrelaunchBanner() {
  if (!gateEnabled()) return null;

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  const through = (await verifyValue((await cookies()).get(GATE_COOKIE)?.value, secret)) === "open";
  if (!through) return null;

  return (
    <p
      role="status"
      className="border-b border-accent/40 bg-accent-soft px-5 py-2.5 text-center text-sm text-text"
    >
      <strong className="font-semibold">Not launched.</strong> The site is behind a passcode,
      and sign-in is not checking anything, so any email and any password will do. Unset{" "}
      <code className="font-mono">SITE_PASSCODE</code> to open it properly.
    </p>
  );
}
