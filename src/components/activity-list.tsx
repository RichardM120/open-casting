import Link from "next/link";

import type { Action, ActivityEntry } from "@/lib/activity";
import { formatRelative } from "@/lib/format";

import { EmptyState } from "./ui";

/** Verb and tone per action, so the trail reads at a glance. */
const SHAPE: Record<Action, { verb: string; tone: string }> = {
  "session.created": { verb: "opened a casting call", tone: "bg-positive" },
  "session.published": { verb: "published", tone: "bg-positive" },
  "session.edited": { verb: "edited a casting call", tone: "bg-accent" },
  "session.closed": { verb: "closed a casting call", tone: "bg-muted" },
  "session.reopened": { verb: "reopened a casting call", tone: "bg-positive" },
  "session.removed": { verb: "removed a casting call", tone: "bg-danger" },
  "client.created": { verb: "added a client", tone: "bg-positive" },
  "client.edited": { verb: "edited a client", tone: "bg-accent" },
  "client.suspended": { verb: "suspended a client", tone: "bg-danger" },
  "client.restored": { verb: "restored a client", tone: "bg-positive" },
  "client.removed": { verb: "removed a client", tone: "bg-danger" },
  "role.posted": { verb: "posted", tone: "bg-positive" },
  "role.edited": { verb: "edited", tone: "bg-accent" },
  "role.closed": { verb: "closed", tone: "bg-muted" },
  "role.reopened": { verb: "reopened", tone: "bg-positive" },
  "role.removed": { verb: "removed", tone: "bg-danger" },
  "submission.received": { verb: "submitted for", tone: "bg-accent" },
  "submission.status": { verb: "updated a submission on", tone: "bg-muted" },
  "account.limits": { verb: "changed what an account may run", tone: "bg-accent" },
  "account.created": { verb: "created an account for", tone: "bg-positive" },
  "account.suspended": { verb: "suspended", tone: "bg-danger" },
  "account.restored": { verb: "restored", tone: "bg-positive" },
  "data.purged": { verb: "removed applicant details from", tone: "bg-muted" },
  "data.exported": { verb: "exported the submissions of", tone: "bg-accent" },
};

function Subject({ entry }: { entry: ActivityEntry }) {
  if (!entry.roleTitle) return null;

  // A removed role has no page left to link to.
  return entry.roleId ? (
    <Link
      href={`/dashboard/roles/${entry.roleId}`}
      className="text-text underline-offset-4 hover:text-accent hover:underline"
    >
      {entry.roleTitle}
    </Link>
  ) : (
    <span className="text-text line-through decoration-faint">{entry.roleTitle}</span>
  );
}

export function ActivityList({
  entries,
  emptyDescription,
}: {
  entries: ActivityEntry[];
  emptyDescription: string;
}) {
  if (entries.length === 0) {
    return <EmptyState title="Nothing yet" description={emptyDescription} />;
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const shape = SHAPE[entry.action];
        return (
          <li key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center pt-1.5">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${shape?.tone ?? "bg-muted"}`}
              />
              {index < entries.length - 1 ? (
                <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-6">
              <p className="text-sm leading-relaxed">
                <span className="font-medium">{entry.actorName}</span>{" "}
                <span className="text-muted">{shape?.verb ?? entry.action}</span>{" "}
                <Subject entry={entry} />
                {entry.detail ? <span className="text-muted">: {entry.detail}</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                <time dateTime={entry.createdAt}>{formatRelative(entry.createdAt)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
