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

type StepKey = (typeof SETUP_STEPS)[number]["key"];

/**
 * One bar in four segments, under the navigation on every casting-call screen,
 * coloured by where the director is: terracotta for what is done, gold for
 * the step they are on, the line colour for what is still to come. Under it
 * the step's name and what it is for, and the way on to the next one. A
 * segment with a page to go to is a link back to that step; on a wide screen
 * the four names stand under their segments, on a phone the caption carries
 * the current one. `hrefs` overrides where a segment leads.
 */
export function SetupProgress({
  stage,
  sessionId,
  hrefs: given = {},
}: {
  stage: SetupStage;
  /** The casting call being set up, once it exists: every step then links to its page. */
  sessionId?: string;
  hrefs?: Partial<Record<StepKey, string>>;
}) {
  const hrefs: Partial<Record<StepKey, string>> = sessionId
    ? {
        open: `/dashboard/sessions/${sessionId}/edit`,
        roles: `/dashboard/roles/new?session=${sessionId}`,
        publish: `/dashboard/sessions/${sessionId}`,
        share: `/dashboard/sessions/${sessionId}`,
        ...given,
      }
    : given;
  const current = SETUP_STEPS[stage - 1];
  const next = SETUP_STEPS.at(stage);
  const nextHref = next ? hrefs[next.key] : undefined;

  return (
    <nav aria-label="Setting up the casting call" className="-mt-2 mb-8 border-b border-line pb-4">
      <ol className="grid grid-cols-4 gap-1">
        {SETUP_STEPS.map((step, index) => {
          const n = (index + 1) as SetupStage;
          const done = n < stage;
          const here = n === stage;
          const href = hrefs[step.key];
          const body = (
            <>
              {/* The segment sits in a row of fixed height, so its lift on hover moves nothing else. */}
              <span aria-hidden="true" className="flex h-2 items-center">
                <span
                  className={cx(
                    "block h-1.5 w-full rounded-full transition-all",
                    done ? "bg-brand" : here ? "bg-accent" : "bg-line",
                    href ? "group-hover:h-2" : null,
                  )}
                />
              </span>
              <span
                className={cx(
                  "mt-2 block truncate text-xs max-sm:sr-only",
                  here ? "font-semibold text-text" : done ? "text-text" : "text-muted",
                )}
              >
                <span className="sr-only">Step {n}: </span>
                {step.label}
              </span>
            </>
          );
          return (
            <li key={step.key} aria-current={here ? "step" : undefined} className="relative min-w-0">
              {href ? (
                <Link
                  href={href}
                  title={`${step.label}: ${step.point}`}
                  className="group block rounded-sm max-sm:flex max-sm:min-h-11 max-sm:flex-col max-sm:justify-center"
                >
                  {body}
                </Link>
              ) : (
                <span className="block">{body}</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* The bar above already names the step and marks where you are, so
            this says the one thing it cannot: what this step is for. On a
            phone the bar's names are read out rather than shown, so the
            step's own name comes back there. */}
        <p className="min-w-0 text-sm text-muted">
          <strong className="font-semibold text-text sm:hidden">{current.label}: </strong>
          {current.point}
        </p>
        {next ? (
          nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
            >
              Next: {next.label}
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 3 5 5-5 5" />
              </svg>
            </Link>
          ) : (
            <span className="shrink-0 text-sm text-muted">Next: {next.label}</span>
          )
        ) : null}
      </div>
    </nav>
  );
}
