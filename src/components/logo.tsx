/**
 * The mark: two brackets holding a door that stands a little open, hinged on
 * the left bracket, with one gold knob. On the terracotta header it is drawn
 * in white with no tile; on a light ground it sits in a terracotta tile.
 */
export function Logo({
  tone = "onLight",
  size = "md",
  className,
}: {
  tone?: "onLight" | "onBrand";
  size?: "sm" | "md";
  /** Overrides the box, for the places the mark is larger on a phone. */
  className?: string;
}) {
  const box = className ?? (size === "sm" ? "size-6" : "size-8");
  const tile = tone === "onLight";
  const glyph = tile ? "#FFFFFF" : "currentColor";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`${box} shrink-0`}>
      {tile ? <rect width="64" height="64" rx="14" fill="var(--color-brand)" /> : null}
      <path d="M13 13h10v5.5h-4.5v27h4.5V51H13z" fill={glyph} />
      <path d="M51 13H41v5.5h4.5v27H41V51h10z" fill={glyph} />
      <path d="M27 20.5 L38 17.5 V46.5 L27 43.5 Z" fill={glyph} />
      <circle cx="35.4" cy="32" r="1.7" fill={tile ? "var(--color-accent)" : "var(--color-brand)"} />
    </svg>
  );
}
