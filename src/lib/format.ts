/** Presentation helpers shared by server and client components. */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC today, so deadline maths does not drift with the clock. */
function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Whole days until a `yyyy-mm-dd` deadline. Negative once it has passed. */
export function daysUntil(deadline: string): number {
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - startOfToday()) / MS_PER_DAY);
}

export type Window = { opensAt: string; closesAt: string; closedAt: string | null };

/** Before the session opens, nothing about it accepts submissions. */
export function notYetOpen(window: Window): boolean {
  return daysUntil(window.opensAt) > 0;
}

/**
 * A session is live from the start of its opening day to the end of its closing
 * day, unless it was closed by hand.
 */
export function isOpen(window: Window): boolean {
  return (
    window.closedAt === null && !notYetOpen(window) && daysUntil(window.closesAt) >= 0
  );
}

/**
 * The window a role actually accepts submissions in: its session's, unless the
 * role itself was closed early. A role can be shut before the rest of the
 * production, never opened after the session has closed.
 */
export function roleWindow(role: { closedAt: string | null; session: Window }): Window {
  return { ...role.session, closedAt: role.closedAt ?? role.session.closedAt };
}

export function deadlineLabel(window: Window): string {
  if (window.closedAt) return "Closed early";
  if (notYetOpen(window)) {
    const days = daysUntil(window.opensAt);
    return days === 1 ? "Opens tomorrow" : `Opens ${formatDate(window.opensAt)}`;
  }
  const days = daysUntil(window.closesAt);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 14) return `${days} days left`;
  return `Closes ${formatDate(window.closesAt)}`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelative(isoTimestamp: string): string {
  const diff = Date.now() - Date.parse(isoTimestamp);
  const days = Math.floor(diff / MS_PER_DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(isoTimestamp);
}

export function ageRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
