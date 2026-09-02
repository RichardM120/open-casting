/**
 * The mark: two brackets holding a door that stands a little open. On the
 * terracotta header it is drawn in white with no tile; on a light ground it
 * sits in a terracotta tile, which is how the brand shows it.
 */
export function Logo({
  tone = "onLight",
  size = "md",
  className,
}: {
  tone?: "onLight" | "onBrand";
  size?: "sm" | "md";
  /** Overrides the box, for the one place the mark is larger on a phone. */
  className?: string;
}) {
  const box = className ?? (size === "sm" ? "size-5" : "size-7");
  const tile = tone === "onLight";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`${box} shrink-0`}>
      {tile ? <rect width="32" height="32" rx="7" fill="var(--color-brand)" /> : null}
      <path
        d="M7 7h5v2.4H9.4v13.2H12V25H7zM25 7h-5v2.4h2.6v13.2H20V25h5z"
        fill={tile ? "#FFFFFF" : "currentColor"}
      />
      <path d="M13.2 10.2 19 8.6v14.8l-5.8-1.6z" fill={tile ? "#FFFFFF" : "currentColor"} />
      <circle cx="17.5" cy="16.2" r="0.9" fill={tile ? "var(--color-brand)" : "var(--color-brand)"} />
    </svg>
  );
}
