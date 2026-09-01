/**
 * The pre-launch door.
 *
 * One variable does all of it. With `SITE_PASSWORD` set:
 *
 *  - every page requires a sign-in, so a signed-out visitor sees the sign-in
 *    page and nothing else;
 *  - any email address plus that one shared password gets through, and an
 *    account is created on the spot for an address that has none.
 *
 * It is one shared password rather than real accounts because its whole job is
 * to keep the work in progress away from anyone who has not been shown it. It
 * is not the application's access control and does not pretend to be — what a
 * signed-in account can then see is decided as it always was.
 *
 * Unset it to launch. Everything reverts to real sign-in with no code change.
 */
export function sitePassword(): string | null {
  return process.env.SITE_PASSWORD?.trim() || null;
}

export function siteClosed(): boolean {
  return sitePassword() !== null;
}

/**
 * Reachable without signing in, even while closed: the sign-in page itself, the
 * casting share links — which are the product's outward face, carry an
 * unguessable token and are the whole reason a performer needs no account — the
 * agreements those links reference, and health, which exists to be readable
 * when nothing else is.
 */
export function alwaysOpen(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/legal/") ||
    pathname === "/api/health" ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico"
  );
}
