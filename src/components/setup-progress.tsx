import Link from "next/link";

import { cx } from "./ui";

/**
 * The four moves that take a casting call from nothing to out in the world.
 * Order carries meaning here: each depends on the one before it, so a step
 * lights up only once the earlier ones are done.
 */
export const SETUP_STEPS = [
  { key: "open", label: "Set up the casting call" },
  { key: "roles", label: "Post the roles" },
  { key: "publish", label: "Publish" },
  { key: "share", label: "Share the link" },
] as const;

export type SetupStage = 1 | 2 | 3 | 4;

/**
 * Progress dots, shown under the navigation on every casting-call screen so a
 * director always knows where they are in setting one up, and what comes next.
 * `href` on a step makes the dot a link back to that step's page.
 */
export function SetupProgress({
  stage,
  hrefs = {},
}: {
  stage: SetupStage;
  hrefs?: Partial<Record<(typeof SETUP_STEPS)[number]["key"], string>>;
}) {
  return (
    <nav aria-label="Setting up the casting call" className="-mt-4 mb-6 border-b border-line">
      <ol className="flex items-center gap-2 overflow-x-auto py-3 text-xs sm:gap-4">
        {SETUP_STEPS.map((step, index) => {
          const n = (index + 1) as SetupStage;
          const done = n < stage;
          const current = n === stage;
          const dot = (
            <span
              aria-hidden
              className={cx(
                "inline-block size-2.5 shrink-0 rounded-full border transition-colors",
                done
                  ? "border-accent bg-accent"
                  : current
                    ? "border-accent bg-accent/30 ring-4 ring-accent/15"
                    : "border-line-strong bg-transparent",
              )}
            />
          );
          const label = (
            <span
              className={cx(
                "whitespace-nowrap",
                current ? "font-medium text-text" : done ? "text-muted" : "text-faint",
              )}
            >
              {step.label}
            </span>
          );
          const href = hrefs[step.key];
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-2 sm:gap-4"
            >
              {href ? (
                <Link href={href} className="flex items-center gap-2 transition-colors hover:text-text">
                  {dot}
                  {label}
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  {dot}
                  {label}
                </span>
              )}
              {index < SETUP_STEPS.length - 1 ? (
                <span aria-hidden className="h-px w-4 bg-line sm:w-8" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
