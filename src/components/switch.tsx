"use client";

import { cx } from "./ui";

/**
 * A two-state toggle the size of a thumb, with its two states named either
 * side of it, so it reads at a glance and asks for one click rather than a
 * choice from a row of options. It is a button with role="switch": a screen
 * reader hears the field it belongs to, then "switch, on" or "off", and Space
 * or a click flips it. The value travels in a hidden input the form keeps
 * alongside, so what is posted is what the switch says.
 */
export function Switch({
  checked,
  onChange,
  offLabel,
  onLabel,
  labelledBy,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the left-hand, off state means, e.g. "Optional". */
  offLabel: string;
  /** What the right-hand, on state means, e.g. "Mandatory". */
  onLabel: string;
  /** The id of the text that names the field this switch belongs to. */
  labelledBy: string;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2.5 text-sm select-none", className)}>
      <span className={cx("transition-colors", checked ? "text-muted" : "font-semibold text-text")}>
        {offLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelledBy}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          checked ? "border-accent bg-accent" : "border-line-strong bg-line",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute left-0.5 size-4.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      <span className={cx("transition-colors", checked ? "font-semibold text-text" : "text-muted")}>
        {onLabel}
      </span>
    </span>
  );
}
