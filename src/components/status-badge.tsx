import type { SubmissionStatus } from "@/lib/types";

import { Badge } from "./ui";

const TONES = {
  New: "neutral",
  Shortlisted: "accent",
  Callback: "positive",
  Declined: "danger",
} as const;

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
