import { daysUntil, formatDate, formatDateTime, isOpen, notYetOpen } from "./format";
import { purgeDate } from "./retention";
import type { CastingSession } from "./types";

/**
 * Where a casting call is in its life, as a traffic light. Green is taking
 * submissions or about to; amber is shut and being reviewed; red is finished
 * and counting down to the deletion of the applicants' details; an
 * unpublished call is in progress and has no colour of its own.
 */
export type CallState = {
  key: "live" | "upcoming" | "review" | "closing" | "purged" | "draft";
  label: string;
  tone: "positive" | "amber" | "danger" | "neutral" | "accent";
  /** The one line under the name that says what happens next, and when. */
  line: string;
  /** Sort order on the list: what needs the director first. */
  rank: number;
};

export function callState(session: CastingSession): CallState {
  if (session.publishedAt === null) {
    return {
      key: "draft",
      label: "In progress",
      tone: "accent",
      line: "Not published yet. Nobody can open its link until you publish it.",
      rank: 4,
    };
  }
  if (session.purgedAt) {
    return {
      key: "purged",
      label: "Finished",
      tone: "neutral",
      line: `Applicants' details were deleted on ${formatDate(session.purgedAt)}. The roles and the counts are kept.`,
      rank: 5,
    };
  }
  if (daysUntil(session.productionEndsAt) <= 0) {
    const deletion = purgeDate(session.productionEndsAt);
    const days = daysUntil(deletion);
    return {
      key: "closing",
      label: "Closing",
      tone: "danger",
      line: `Production finished ${formatDate(session.productionEndsAt)}. Applicants' details are deleted on ${formatDate(deletion)}${days > 0 ? `, in ${days} ${days === 1 ? "day" : "days"}` : ""}.`,
      rank: 3,
    };
  }
  if (isOpen(session)) {
    return {
      key: "live",
      label: "Live",
      tone: "positive",
      line: `Taking submissions until ${formatDateTime(session.closesAt)}.`,
      rank: 1,
    };
  }
  if (notYetOpen(session)) {
    return {
      key: "upcoming",
      label: "Opens soon",
      tone: "positive",
      line: `Published. Submissions open ${formatDateTime(session.opensAt)}.`,
      rank: 1,
    };
  }
  return {
    key: "review",
    label: "In review",
    tone: "amber",
    line: `Closed ${formatDateTime(session.closedAt ?? session.closesAt)}. Production finishes ${formatDate(session.productionEndsAt)}; details are deleted 30 days after that.`,
    rank: 2,
  };
}

/** The card's edge and ground for a state. In progress has no ground of its own. */
export function cardTone(state: CallState): string {
  switch (state.key) {
    case "live":
    case "upcoming":
      return "border-l-4 border-l-positive bg-positive-soft/60";
    case "review":
      return "border-l-4 border-l-amber bg-amber-soft/70";
    case "closing":
      return "border-l-4 border-l-danger bg-danger-soft/70";
    case "purged":
      return "border-l-4 border-l-line-strong bg-surface";
    default:
      return "border-l-4 border-l-transparent bg-transparent";
  }
}
