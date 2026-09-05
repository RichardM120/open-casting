import Link from "next/link";
import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------- buttons -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "signup";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-text hover:border-accent hover:text-brand",
  ghost: "text-muted hover:text-text",
  danger: "border border-line-strong text-danger hover:bg-danger-soft",
  /* The homepage's way in, as the design canvas has it: teal and bold. */
  signup: "bg-teal font-bold text-accent-ink hover:bg-teal-hover",
};

/**
 * Every size clears 44px under a thumb, which is the number Apple, Material
 * and WCAG's AAA target all settle on, and well past the 24px AA floor. The
 * small size drops to 40 from `sm` up, where there is a pointer to aim with
 * and a row of buttons should not read as a row of slabs.
 */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 py-2 text-sm sm:min-h-10",
  md: "min-h-11 px-6 py-2 text-sm",
  lg: "min-h-12 px-7 py-2 text-lg",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size]);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...props} className={cx(buttonStyles(variant, size), className)} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link {...props} className={cx(buttonStyles(variant, size), className)} />;
}

/* --------------------------------------------------------------- badges -- */

type BadgeTone = "neutral" | "accent" | "positive" | "amber" | "danger" | "outline";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-line/70 text-muted",
  accent: "bg-accent-soft text-brand",
  positive: "bg-positive-soft text-positive",
  amber: "bg-amber-soft text-amber",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line-strong text-muted",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- layout -- */

/** The shape of a section's container: cream, a line, soft corners. For a <section>, which Card's div cannot be. */
export const CARD = "rounded-2xl border border-line-strong bg-raised p-4 shadow-card sm:p-6";

/**
 * A section whose contents are cards in their own right: the list of casting
 * calls, the submissions feed, the groups on the admin overview.
 *
 * On a phone it is not a card at all. A frame inside a frame costs 32px of a
 * 320px screen — a tenth of the width, spent on a second border nobody needs
 * — so below `sm` this is a heading with its rows beneath it and the rows get
 * the screen's own gutter. From `sm` there is room for both and the frame
 * comes back. Every other card keeps CARD.
 */
export const CARD_GROUP =
  "sm:rounded-2xl sm:border sm:border-line-strong sm:bg-raised sm:p-6 sm:shadow-card";

/**
 * The gap from one card to the next. A phone shows one card at a time, so a
 * 32px trough between them is scrolling for nothing; 24px separates them just
 * as clearly. From `sm` two sit side by side or close together and the wider
 * gap does the work.
 */
export const STACK = "mt-6 sm:mt-8";

/**
 * The identity column of a row that wraps: a name, the badges that say what it
 * is, and a line under them, with counts or a button beside it.
 *
 * `min-w-0 flex-1` on its own is `flex-basis: 0`, which lets this column
 * shrink to nothing rather than push what sits beside it onto the next line.
 * On a phone that truncated names to three letters and painted badges over
 * the text next to them. So it takes the whole row below `sm`, and from there
 * asks for 256px before anything may share it — under that, the rest wraps.
 *
 * Only for a row that wraps. A row that is a photo beside its text is not
 * this: there, shrinking is the point.
 */
export const ROW_MAIN = "min-w-0 flex-1 basis-full sm:basis-64";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(CARD, className)}>{children}</div>;
}

/**
 * The one panel on a screen that is the next thing to do: white where the
 * copy containers are cream, with a gold edge. Used with a Nudge naming it.
 */
export const SPOTLIGHT = "rounded-2xl border-2 border-accent bg-surface shadow-card";

/** A small gold tag that points at a key interaction: "Next step", "Apply here". */
export function Nudge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold tracking-wide text-accent-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-xs font-semibold tracking-[0.18em] text-brand uppercase", className)}>
      {children}
    </p>
  );
}

/**
 * How a section opens: a short heading, one line under it saying what the
 * section holds, and to the right whatever acts on the section as a whole.
 * The line is what lets a page be skimmed heading by heading; a tag names
 * the one section that is the next thing to do.
 */
export function SectionHead({
  id,
  title,
  line,
  tag,
  aside,
  className,
}: {
  id?: string;
  title: string;
  line?: string;
  tag?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    // On a phone the aside wraps onto its own line, and a row of buttons
    // hanging off the bottom of a wrapped heading reads as an accident:
    // below `sm` everything is aligned to the left edge instead.
    <div
      data-head=""
      className={cx(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3 sm:items-end",
        className,
      )}
    >
      {/* `flex-1` alone lets this column shrink to nothing rather than push
          the aside onto the next line, which on a phone squeezed a heading
          into one word per line beside a row of tabs. It takes the whole row
          below `sm`, and from there asks for 256px before the aside may
          share it — under that the aside wraps, as the comment above says. */}
      <div data-head-main="" className="min-w-0 flex-1 basis-full sm:basis-64">
        <div className="flex flex-wrap items-center gap-3">
          {/* 24px is a lot of a 288px card. It steps down to 20 on a phone,
              which still reads as the heading of the section it opens. */}
          <h2 id={id} className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {tag ? <Nudge>{tag}</Nudge> : null}
        </div>
        {line ? <p className="mt-1 text-sm text-muted">{line}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    // Inside a card already, so the phone padding is the card's; this adds
    // only what the dashed edge needs to sit off the words.
    <div className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center sm:px-6 sm:py-12">
      <p className="text-lg font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- forms -- */

/**
 * The shape of every field. Its colours, which say whether it is still to be
 * filled in or is done, are the `.control` rules in globals.css. A red border
 * alone would not reach anyone who cannot see it; it sits alongside the
 * message the field is wired to through aria-describedby.
 */
const CONTROL =
  "control min-h-11 w-full rounded-xl px-3.5 py-2.5 text-sm text-text " +
  "placeholder:text-faint transition-colors focus:outline-none";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  /** Marks the label. Read from the control's own `required` unless given. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  // Every label says which it is: a star for a field that has to be filled
  // in, "(optional)" for one that can be left. The control's own `required`
  // is the source, so the mark and the browser's check cannot disagree.
  const mandatory =
    required ??
    Children.toArray(children).some(
      (child) =>
        isValidElement<{ required?: boolean }>(child) && Boolean(child.props.required),
    );

  // The control is wired up here rather than at every call site, so no field can
  // show an error a screen reader never announces or a red border it cannot
  // explain. `aria-invalid` is also what the focus helper looks for.
  const control = Children.map(children, (child) =>
    isValidElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>(child)
      ? cloneElement(child, {
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
        })
      : child,
  );

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
        {mandatory ? <RequiredMark /> : <OptionalMark />}
      </label>
      {control}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-xs text-danger">
          {/* The colour and the icon carry the same meaning as the words. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-0.5 size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M8 11h.01" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The star after a label: this has to be filled in. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 font-semibold text-brand">
      *
    </span>
  );
}

/** The word after a label that can be left blank. */
export function OptionalMark() {
  return <span className="ml-1.5 text-xs font-normal text-faint">(optional)</span>;
}

/** The key to the marks, once, at the top of a form. */
export function RequiredKey({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs text-muted", className)}>
      <span aria-hidden="true" className="font-semibold text-brand">
        *
      </span>{" "}
      Required. Anything marked optional can be left blank.
    </p>
  );
}

/**
 * Lists what needs fixing and jumps to it. Inline messages alone are easy to
 * miss on a long form, especially when the failure is below the fold.
 */
export function ErrorSummary({
  errors,
  labels,
}: {
  errors: Record<string, string>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(errors).filter(([field]) => field in labels);
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      tabIndex={-1}
      data-error-summary
      className="rounded-xl border border-danger/40 bg-danger-soft p-4"
    >
      <p className="text-sm font-medium text-danger">
        {entries.length === 1
          ? "There is one thing to fix"
          : `There are ${entries.length} things to fix`}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {entries.map(([field, message]) => (
          <li key={field} className="text-sm">
            <a href={`#${field}`} className="text-danger underline underline-offset-4">
              {labels[field]}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Every field has a placeholder, if only a space: :placeholder-shown is how
// the stylesheet tells an empty field from a filled one.
export function Input({ className, placeholder, ...props }: ComponentProps<"input">) {
  return <input {...props} placeholder={placeholder ?? " "} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, placeholder, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      placeholder={placeholder ?? " "}
      className={cx(CONTROL, "resize-y", className)}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cx(CONTROL, "select-chevron appearance-none pr-10", className)} />
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-2.5 text-sm text-muted select-none",
        className,
      )}
    >
      <input
        type="checkbox"
        {...props}
        className="size-5 accent-accent sm:size-4"
      />
      <span>
        {label}
        {props.required ? <RequiredMark /> : null}
      </span>
    </label>
  );
}
