import { heroSrc } from "@/lib/media";
import type { HeroKind } from "@/lib/types";

/**
 * The top of an applicant's page. It opens with the words "Casting call",
 * large, so the page says what it is before anything else, and under them
 * the casting call's own picture: a banner across the width, or a logo
 * centred on a white panel at a logo's size, never stretched. Until the
 * casting director has added one, a drawn slate stands in the picture's
 * place, so the page keeps its shape.
 */
export function ApplicantMasthead({
  heroUrl,
  heroKind = "banner",
  name,
}: {
  heroUrl: string | null;
  heroKind?: HeroKind;
  name: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-4xl font-semibold tracking-tight sm:text-5xl">Casting call</p>
      <div className="mt-6">
        {heroUrl && heroKind === "logo" ? (
          <div className="flex justify-center rounded-2xl border border-line bg-surface p-6 shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private blob, served by /api/hero */}
            <img
              src={heroSrc(heroUrl)}
              alt={`${name} logo`}
              decoding="async"
              className="h-auto max-h-32 w-auto max-w-full sm:max-h-40"
            />
          </div>
        ) : heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private blob, served by /api/hero
          <img
            src={heroSrc(heroUrl)}
            alt={`${name} header image`}
            decoding="async"
            className="max-h-72 w-full rounded-2xl border border-line object-cover shadow-card"
          />
        ) : (
          <Placeholder />
        )}
      </div>
    </div>
  );
}

/** A slate, drawn in the site's line, where the casting call's picture will go. */
function Placeholder() {
  return (
    <div
      role="img"
      aria-label="No picture for this casting call yet"
      className="flex h-44 items-center justify-center rounded-2xl border border-line-strong bg-raised shadow-card sm:h-56"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 96 96"
        className="size-28 stroke-text sm:size-36"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 40h68v38a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" className="fill-raised" />
        <path d="M16 22l64-8 2 12-64 8z" className="fill-surface" />
        <path d="M27 21l6 10M41 19l6 10M55 17l6 10M69 15l6 10" className="stroke-brand" />
        <path d="M26 56h28M26 66h20" />
        <circle cx="70" cy="62" r="5" className="fill-accent" stroke="none" />
      </svg>
    </div>
  );
}
