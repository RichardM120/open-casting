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

/**
 * A role is open until the end of its deadline day, unless it was closed early.
 */
export function isOpen(role: { deadline: string; closedAt: string | null }): boolean {
  return role.closedAt === null && daysUntil(role.deadline) >= 0;
}

export function deadlineLabel(role: { deadline: string; closedAt: string | null }): string {
  if (role.closedAt) return "Closed early";
  const days = daysUntil(role.deadline);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 14) return `${days} days left`;
  return `Closes ${formatDate(role.deadline)}`;
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
