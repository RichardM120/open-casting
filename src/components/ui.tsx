import Link from "next/link";
import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------- buttons -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-raised text-text hover:border-accent hover:text-accent",
  ghost: "text-muted hover:text-text",
  danger: "border border-line-strong text-danger hover:bg-danger-soft",
};

// Both sizes clear a comfortable touch target; the app gets used on phones.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
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

type BadgeTone = "neutral" | "accent" | "positive" | "danger" | "outline";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-line/70 text-muted",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
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

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-surface p-6 md:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-xs font-semibold tracking-[0.18em] text-accent uppercase", className)}>
      {children}
    </p>
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
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- forms -- */

const CONTROL =
  "w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-text " +
  "placeholder:text-faint transition-colors hover:border-line-strong " +
  "focus:border-accent focus:outline-none " +
  // A red border alone would not reach anyone who cannot see it; it sits
  // alongside the message the field is wired to through aria-describedby.
  "aria-invalid:border-danger aria-invalid:hover:border-danger";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

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
      </label>
      {control}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-xs text-danger">
          <span aria-hidden="true" className="mt-px">⚠</span>
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

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(CONTROL, "resize-y", className)} />;
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
        className="size-4 accent-accent"
      />
      {label}
    </label>
  );
}
