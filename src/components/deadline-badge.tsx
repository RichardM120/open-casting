import { daysLeft, deadlineLabel, isOpen, notYetOpen, type Window } from "@/lib/format";

import { Badge } from "./ui";

/**
 * The window belongs to the casting call, so that is what this reads. Pass
 * `roleWindow(role)` for a role, which folds in an early close of its own.
 */
export function DeadlineBadge({ session }: { session: Window }) {
  const tone = !isOpen(session)
    ? "outline"
    : notYetOpen(session)
      ? "accent"
      : daysLeft(session) <= 7
        ? "danger"
        : "neutral";
  return <Badge tone={tone}>{deadlineLabel(session)}</Badge>;
}
