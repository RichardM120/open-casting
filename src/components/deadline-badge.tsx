import { daysUntil, deadlineLabel, isOpen, notYetOpen, type Window } from "@/lib/format";

import { Badge } from "./ui";

/**
 * The window belongs to the casting session, so that is what this reads —
 * pass `roleWindow(role)` for a role, which folds in an early close of its own.
 */
export function DeadlineBadge({ session }: { session: Window }) {
  const days = daysUntil(session.closesAt);
  const tone = !isOpen(session)
    ? "outline"
    : notYetOpen(session)
      ? "accent"
      : days <= 7
        ? "danger"
        : "neutral";
  return <Badge tone={tone}>{deadlineLabel(session)}</Badge>;
}
