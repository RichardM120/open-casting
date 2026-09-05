import Link from "next/link";
import type { ReactNode } from "react";

import type { Alert } from "@/lib/admin-alerts";

import { AlertDot } from "./alert-dot";
import { cx } from "./ui";

/**
 * What is waiting, across the top of an administrator's screen.
 *
 * It takes the place of the "what this screen is for" note. That note answered
 * a question somebody asks once; this answers the one they have every time
 * they sign in — is there anything for me to do — and answers it before they
 * have opened anything. On the summary it lists the section's whole queue; on
 * a department screen, only that screen's own.
 *
 * When nothing is waiting it still says so, in one quiet line. A bar that
 * disappears when there is nothing to report teaches nobody to trust it: the
 * administrator has to be able to tell "all clear" from "not loaded".
 *
 * `role="status"` rather than `alert`: this is the state of the place on
 * arrival, not something that just happened, and an assertive announcement on
 * every page load would be unbearable.
 */
export function AdminAlertBar({
  alerts,
  /** What the reader is looking at, so the empty line can name it. */
  scope = "the service",
  children,
}: {
  alerts: Alert[];
  scope?: string;
  children?: ReactNode;
}) {
  const now = alerts.filter((alert) => alert.urgency === "now");

  if (alerts.length === 0) {
    return (
      <p
        role="status"
        className="mt-6 flex items-center gap-2 rounded-xl border border-positive-line bg-positive-soft px-4 py-3 text-sm text-text"
      >
        <Tick />
        Nothing needs you on {scope} right now.
      </p>
    );
  }

  return (
    <section
      role="status"
      aria-label="What needs you"
      className={cx(
        "mt-6 overflow-hidden rounded-xl border",
        now.length > 0 ? "border-danger/40 bg-danger-soft" : "border-amber/40 bg-amber-soft",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm font-semibold text-text">
        {now.length > 0 ? (
          <AlertDot count={now.length} urgency="now" label="needing attention now" />
        ) : (
          <AlertDot count={alerts.length} urgency="soon" label="to look at" />
        )}
        {now.length > 0
          ? `${now.length === 1 ? "One thing needs" : `${now.length} things need`} doing`
          : "Nothing urgent, but worth a look"}
      </p>
      <ul className="flex flex-col divide-y divide-line border-t border-line bg-surface">
        {alerts.map((alert) => (
          <li key={`${alert.href}:${alert.say}`}>
            <Link
              href={alert.href}
              className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-text transition-colors hover:bg-raised"
            >
              <span
                aria-hidden="true"
                className={cx(
                  "size-2 shrink-0 rounded-full",
                  alert.urgency === "now" ? "bg-danger" : "bg-amber",
                )}
              />
              <span className="min-w-0 flex-1 wrap-anywhere">
                {alert.urgency === "now" ? "" : "Coming up: "}
                {alert.say}
              </span>
              <span aria-hidden="true" className="shrink-0 text-faint">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {children ? <div className="border-t border-line bg-surface px-4 py-3 text-sm">{children}</div> : null}
    </section>
  );
}

function Tick() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-positive"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4 10-11" />
    </svg>
  );
}
