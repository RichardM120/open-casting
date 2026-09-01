/**
 * The pre-launch walled garden.
 *
 * One variable. With `SITE_PASSCODE` set:
 *
 *  - every page shows an interstitial first, asking for that passcode. Nothing
 *    behind it is served — not the sign-in page, not a casting share link;
 *  - the application's own sign-in stops checking anything. Any email and any
 *    password gets a session, and an account is created on the spot for an
 *    address that has none.
 *
 * The two go together on purpose. Sign-in that authenticates nobody is only
 * defensible because the wall in front of it means nobody uncontrolled reaches
 * it — so they are the same switch, and it is not possible to leave the second
 * on while turning the first off.
 *
 * Unset it to launch: the wall goes, and real sign-in comes back with no code
 * change.
 */
export const GATE_COOKIE = "oc_gate";

/** Thirty days: long enough not to nag, short enough to expire before launch. */
export const GATE_DAYS = 30;

export function gatePasscode(): string | null {
  return process.env.SITE_PASSCODE?.trim() || null;
}

/** Whether the deployment is walled off, and therefore not authenticating. */
export function gateEnabled(): boolean {
  return gatePasscode() !== null;
}

/**
 * The only things served through the wall: the interstitial itself, and health,
 * which exists to be readable when nothing else is. robots.txt goes through so
 * a crawler is told to go away rather than being shown a password prompt.
 */
export function gateExempt(pathname: string): boolean {
  return (
    pathname === "/gate" ||
    pathname === "/api/health" ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico"
  );
}

/**
 * Whether the wall can be opened at all. "This browser has entered the
 * passcode" is a cookie signed with AUTH_SECRET, and the proxy turns away any
 * it cannot verify — so with no key there is no way through, right passcode or
 * not. The threshold is the one `authSecret()` enforces.
 */
export function gateOperable(): boolean {
  return (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32;
}
