/**
 * The pre-launch gate.
 *
 * Until `SITE_PASSCODE` is unset, nothing on this deployment is reachable
 * without entering it — not the sign-in page, not a casting share link. It is
 * one shared passcode rather than an account because its whole job is to keep
 * the site out of the hands of anyone who has not been shown it, including
 * search engines and anyone guessing at the domain.
 *
 * It is not the application's access control and does not pretend to be: the
 * sign-in behind it still decides who sees what. This only decides whether the
 * public sees anything at all.
 */
export const GATE_COOKIE = "oc_gate";

/** Thirty days: long enough not to nag, short enough to expire before launch. */
export const GATE_DAYS = 30;

export function gatePasscode(): string | null {
  return process.env.SITE_PASSCODE?.trim() || null;
}

/** Whether the deployment is currently closed to the public. */
export function gateEnabled(): boolean {
  return gatePasscode() !== null;
}

/**
 * Paths that must answer even while the gate is up: the gate itself, and the
 * health endpoint, which exists to be readable when nothing else is.
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
 * Pre-launch convenience: any email and any password signs in, and an account
 * is made on the spot for an address that has none.
 *
 * This removes the whole of the sign-in check, so it is only defensible while
 * the deployment is closed to the public — and it says so, loudly, on every
 * page while it is on. Turn it off before there is a real performer's name in
 * the database, let alone a child's.
 */
export function openAccess(): boolean {
  return process.env.OPEN_ACCESS?.trim() === "1";
}
