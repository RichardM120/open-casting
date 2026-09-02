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
  /** onLight: terracotta tile, white glyphs. onBrand: white glyphs, no tile. mono: the glyphs in the current text colour, no tile. */
  tone?: "onLight" | "onBrand" | "mono";
  size?: "sm" | "md";
  /** Overrides the box, for the places the mark is larger on a phone. */
  className?: string;
}) {
  const box = className ?? (size === "sm" ? "size-6" : "size-8");
  const tile = tone === "onLight";
  const glyph = tile ? "#FFFFFF" : "currentColor";
  const knob = tile || tone === "mono" ? "var(--color-accent)" : "var(--color-brand)";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`${box} shrink-0`}>
      {tile ? <rect width="64" height="64" rx="14" fill="var(--color-brand)" /> : null}
      <path d="M13 13h10v5.5h-4.5v27h4.5V51H13z" fill={glyph} />
      <path d="M51 13H41v5.5h4.5v27H41V51h10z" fill={glyph} />
      <path d="M27 20.5 L38 17.5 V46.5 L27 43.5 Z" fill={glyph} />
      <circle cx="35.4" cy="32" r="1.7" fill={knob} />
    </svg>
  );
}

/**
 * The lockup: the mark beside the name, both terracotta, on a cream plate
 * with a two-pixel terracotta outline. The same on the terracotta header and
 * on a light ground.
 */
export function Lockup({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-3 rounded-xl border-2 border-brand bg-ink px-3 py-1.5 font-semibold tracking-[0.08em] text-brand uppercase ${className ?? ""}`}
    >
      <Logo tone="mono" className="size-9 sm:size-8" />
      <span className="text-base sm:text-[15px]">Open Casting</span>
    </span>
  );
}
