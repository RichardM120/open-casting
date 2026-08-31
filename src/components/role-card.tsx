import Link from "next/link";

import { ageRange, daysUntil, deadlineLabel, isOpen } from "@/lib/format";
import type { Role } from "@/lib/types";

import { Badge } from "./ui";

export function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  const tone = days < 0 ? "outline" : days <= 7 ? "danger" : "neutral";
  return <Badge tone={tone}>{deadlineLabel(deadline)}</Badge>;
}

export function RoleCard({ role }: { role: Role }) {
  const open = isOpen(role.deadline);

  return (
    <Link
      href={`/roles/${role.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{role.productionType}</Badge>
        {role.selfTape ? <Badge tone="outline">Self-tape</Badge> : null}
        <DeadlineBadge deadline={role.deadline} />
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
        <p className="text-xs text-faint">Submissions closed. Kept for reference.</p>
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
