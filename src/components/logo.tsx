/**
 * The mark: two brackets holding a door that stands a little open, hinged on
 * the left bracket, with one gold knob. Wherever the ground is light, the
 * header's cream plate included, it sits in a terracotta tile; on terracotta
 * itself it is drawn in white with no tile.
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
      <path d="M7 7h12v6.5h-5.5v37H19V57H7z" fill={glyph} />
      <path d="M57 7H45v6.5h5.5v37H45V57h12z" fill={glyph} />
      <path d="M23.5 15.5 L39.5 11.5 V52.5 L23.5 48.5 Z" fill={glyph} />
      <circle cx="36.8" cy="32" r="2" fill={knob} />
    </svg>
  );
}

/**
 * The master lockup: the mark in its terracotta tile beside the name in
 * charcoal, set in capitals with open tracking. The gap is three tenths of
 * the tile and the type just under half of it, the spacing the logo book
 * fixes. The header carries it on a cream plate, because charcoal type would
 * not read on terracotta.
 */
export function Lockup({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-ink px-2 py-1.5 font-semibold tracking-[0.08em] text-text uppercase sm:px-3 ${className ?? ""}`}
    >
      <Logo tone="onLight" className="size-10 sm:size-9" />
      <span className="text-[1rem] whitespace-nowrap sm:text-base">Open Casting</span>
    </span>
  );
}
