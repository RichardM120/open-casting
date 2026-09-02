import Link from "next/link";

import { cx } from "./ui";

/**
 * The four moves that take a casting call from nothing to out in the world.
 * Order carries meaning here: each depends on the one before it, so a step
 * lights up only once the earlier ones are done. Each carries the one thing
 * it is for, so the strip reads as a plan and not only as a position.
 */
export const SETUP_STEPS = [
  { key: "open", label: "Set up the casting call", point: "Name, dates and a synopsis" },
  { key: "roles", label: "Post the roles", point: "One for each part you are casting" },
  { key: "publish", label: "Publish", point: "The moment the link goes live" },
  { key: "share", label: "Share the link", point: "Post it wherever applicants are" },
] as const;

export type SetupStage = 1 | 2 | 3 | 4;

/**
 * Numbered steps, shown under the navigation on every casting-call screen so a
 * director always knows where they are in setting one up, and what comes next.
 * `href` on a step makes it a link back to that step's page.
 */
export function SetupProgress({
  stage,
  sessionId,
  hrefs: given = {},
}: {
  stage: SetupStage;
  /** The casting call being set up, once it exists: every step then links to its page. */
  sessionId?: string;
  hrefs?: Partial<Record<(typeof SETUP_STEPS)[number]["key"], string>>;
}) {
  const hrefs: Partial<Record<(typeof SETUP_STEPS)[number]["key"], string>> = sessionId
    ? {
        open: `/dashboard/sessions/${sessionId}/edit`,
        roles: `/dashboard/roles/new?session=${sessionId}`,
        publish: `/dashboard/sessions/${sessionId}`,
        share: `/dashboard/sessions/${sessionId}`,
        ...given,
      }
    : given;

  return (
    <nav aria-label="Setting up the casting call" className="-mt-4 mb-8 border-b border-line">
      <ol className="flex flex-wrap items-start gap-x-3 gap-y-3 py-4 sm:gap-x-5">
        {SETUP_STEPS.map((step, index) => {
          const n = (index + 1) as SetupStage;
          const done = n < stage;
          const current = n === stage;
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cx(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                  done
                    ? "border-brand bg-brand text-brand-ink"
                    : current
                      ? "border-brand bg-brand-soft text-brand ring-4 ring-brand/15"
                      : "border-line-strong bg-surface text-muted",
                )}
              >
                {n}
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span
                  className={cx(
                    "text-sm whitespace-nowrap",
                    current ? "font-semibold text-text" : done ? "font-medium text-text" : "text-muted",
                  )}
                >
                  {step.label}
                </span>
                <span className="hidden text-xs whitespace-nowrap text-muted lg:block">{step.point}</span>
              </span>
            </>
          );
          const href = hrefs[step.key];
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className="flex items-start gap-3 sm:gap-5"
            >
              {href ? (
                <Link
                  href={href}
                  aria-label={`Step ${n}: ${step.label}`}
                  title={`${step.label}: ${step.point}`}
                  className="flex items-center gap-3 rounded-full transition-colors hover:text-text"
                >
                  {body}
                </Link>
              ) : (
                <span aria-label={`Step ${n}: ${step.label}`} className="flex items-center gap-3">
                  {body}
                </span>
              )}
              {index < SETUP_STEPS.length - 1 ? (
                <span aria-hidden="true" className="mt-4 h-px w-4 shrink-0 bg-line sm:w-6" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
