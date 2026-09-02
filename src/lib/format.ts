/**
 * Dates and times, and the words that go round them.
 *
 * Opening and closing times are stored as instants and shown in UK time, which
 * is where the productions cast and where the performers reading a share link
 * are. A casting director types "18:00" and that is what the performer sees,
 * whatever server or browser the two of them are on.
 */

export const ZONE = "Europe/London";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The UK wall clock at an instant, as a yyyy-mm-ddThh:mm:ss string. */
function wallClock(at: Date): string {
  const parts: Record<string, string> = {};
  for (const part of PARTS.formatToParts(at)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** The UK clock's offset from UTC at an instant, in minutes. */
function zoneOffset(at: Date): number {
  const wall = Date.parse(`${wallClock(at)}Z`);
  return Math.round((wall - at.getTime()) / 60000);
}

/**
 * Turns what was typed into a datetime-local field, read as UK time, into a
 * UTC ISO timestamp. Two passes, because the offset that applies depends on
 * the instant, and the instant is what is being worked out: the second pass
 * corrects a guess made across a clock change.
 */
export function fromLocalInput(value: string): string {
  const naive = new Date(`${value.slice(0, 16)}:00Z`);
  const first = new Date(naive.getTime() - zoneOffset(naive) * 60000);
  const second = new Date(naive.getTime() - zoneOffset(first) * 60000);
  return second.toISOString();
}

/** The reverse: an instant as the yyyy-mm-ddThh:mm a datetime-local field takes. */
export function toLocalInput(iso: string): string {
  return wallClock(new Date(iso)).slice(0, 16);
}

/** The UK calendar date of an instant, yyyy-mm-dd. */
export function londonDate(iso: string): string {
  return wallClock(new Date(iso)).slice(0, 10);
}

/** Midnight UTC of the current UTC date. */
function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Whole days from today to a yyyy-mm-dd date. Negative once it has passed. */
export function daysUntil(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - startOfToday()) / MS_PER_DAY);
}

/** Whole UK calendar days from today to an instant. Negative once it has passed. */
function calendarDaysUntil(iso: string): number {
  return Math.round(
    (Date.parse(`${londonDate(iso)}T00:00:00Z`) -
      Date.parse(`${londonDate(new Date().toISOString())}T00:00:00Z`)) /
      MS_PER_DAY,
  );
}

/**
 * When something accepts submissions. A role inherits its production's window;
 * closedAt is whichever of the two was shut early, if either was.
 */
export type Window = { opensAt: string; closesAt: string; closedAt: string | null };

export function notYetOpen(window: Window): boolean {
  return Date.parse(window.opensAt) > Date.now();
}

export function isOpen(window: Window): boolean {
  return (
    window.closedAt === null && !notYetOpen(window) && Date.parse(window.closesAt) >= Date.now()
  );
}

export function roleWindow(role: { closedAt: string | null; session: Window }): Window {
  return { ...role.session, closedAt: role.closedAt ?? role.session.closedAt };
}

/** Days until the window closes, for deciding how urgent to look. */
export function daysLeft(window: Window): number {
  return calendarDaysUntil(window.closesAt);
}

/** A short phrase for the state of a window: when it opens, or how long is left. */
export function deadlineLabel(window: Window): string {
  if (window.closedAt) return "Closed early";
  if (notYetOpen(window)) {
    const days = calendarDaysUntil(window.opensAt);
    if (days === 0) return `Opens today at ${formatTime(window.opensAt)}`;
    if (days === 1) return `Opens tomorrow at ${formatTime(window.opensAt)}`;
    return `Opens ${formatDateTime(window.opensAt)}`;
  }
  if (Date.parse(window.closesAt) < Date.now()) return "Closed";
  const days = calendarDaysUntil(window.closesAt);
  if (days === 0) return `Closes today at ${formatTime(window.closesAt)}`;
  if (days === 1) return `Closes tomorrow at ${formatTime(window.closesAt)}`;
  if (days <= 14) return `${days} days left`;
  return `Closes ${formatDateTime(window.closesAt)}`;
}

/** "18 Sep 2026". Takes a yyyy-mm-dd date or an ISO timestamp. */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: /T/.test(value) ? ZONE : "UTC",
  });
}

/** "18 Sep 2026, 18:00", in UK time. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "18:00", in UK time. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONE,
  });
}

/** "today", "yesterday", "3 days ago", or the date once it is a month old. */
export function formatRelative(isoTimestamp: string): string {
  const diff = Date.now() - Date.parse(isoTimestamp);
  const days = Math.floor(diff / MS_PER_DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(isoTimestamp);
}

export function ageRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min} to ${max}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
