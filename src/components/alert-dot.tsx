import { cx } from "./ui";

/**
 * The dot that says a link has something waiting behind it.
 *
 * Red for what should already have happened, amber for what is coming. It is
 * never the only signal: it carries the number, and everything it marks also
 * says in words what is waiting, on the page it leads to and in the bar at the
 * top of the summary. Colour alone would fail anyone who cannot tell red from
 * amber, and a bare dot would tell nobody using a screen reader anything.
 *
 * `on` places it: `corner` hangs it off the top-right of whatever it sits in,
 * for an icon or a tab; `inline` sits it in a line of text.
 */
export function AlertDot({
  count,
  urgency,
  label,
  on = "inline",
  className,
}: {
  count: number;
  urgency: "now" | "soon";
  /** What is waiting, for anyone who cannot see the dot. */
  label: string;
  on?: "inline" | "corner";
  className?: string;
}) {
  if (count < 1) return null;

  return (
    <span
      className={cx(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-5 font-semibold",
        urgency === "now" ? "bg-danger text-white" : "bg-amber text-white",
        on === "corner" && "absolute -top-1 -right-1 shadow-card",
        className,
      )}
    >
      <span aria-hidden="true">{count > 9 ? "9+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
