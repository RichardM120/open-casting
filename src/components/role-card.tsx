import Link from "next/link";

import {
  ageRange,
  daysUntil,
  deadlineLabel,
  isOpen,
  notYetOpen,
  roleWindow,
  type Window,
} from "@/lib/format";
import type { ListedRole } from "@/lib/roles";

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

export function RoleCard({ role }: { role: ListedRole }) {
  const window = roleWindow(role);
  const open = isOpen(window);

  return (
    <Link
      href={`/roles/${role.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{role.productionType}</Badge>
        {role.selfTape ? <Badge tone="outline">Self-tape</Badge> : null}
        <DeadlineBadge session={window} />
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-accent">
          {role.title}
        </h3>
        <p className="text-sm text-muted">
          {role.production} · {role.company}
        </p>
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-muted">{role.characterBrief}</p>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        <Meta label="Location" value={role.location} />
        <Meta label="Playing age" value={ageRange(role.ageMin, role.ageMax)} />
        <Meta label="Rate" value={role.rate} />
        <Meta label="Union" value={role.unionStatus} />
      </dl>

      {!open ? (
        <p className="text-xs text-faint">
          {notYetOpen(window)
            ? "Not open yet. Submissions start on the opening date."
            : window.closedAt
              ? "Closed early. Kept for reference."
              : "Submissions closed. Kept for reference."}
        </p>
      ) : null}
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="truncate text-text" title={value}>
        {value}
      </dd>
    </div>
  );
}
