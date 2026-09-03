import type { HeroKind } from "@/lib/types";

import { Logo } from "./logo";

/**
 * The top of an applicant's page: the casting call's own image when it has
 * one, or else the mark, small, so the page is still plainly somebody's. A
 * banner runs full width and never taller than a phone screen's third; a logo
 * sits centred on a white panel at a size that suits a logo, never stretched.
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
  if (heroUrl && heroKind === "logo") {
    return (
      <div className="mb-8 flex justify-center rounded-2xl border border-line bg-surface p-6 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- a public blob chosen by the casting director */}
        <img
          src={heroUrl}
          alt={`${name} logo`}
          decoding="async"
          className="h-auto max-h-32 w-auto max-w-full sm:max-h-40"
        />
      </div>
    );
  }
  if (heroUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a public blob chosen by the casting director
      <img
        src={heroUrl}
        alt={`${name} header image`}
        decoding="async"
        className="mb-8 max-h-72 w-full rounded-2xl border border-line object-cover shadow-card"
      />
    );
  }
  return (
    <div className="mb-8 flex items-center gap-2.5 text-sm font-medium text-text">
      <Logo tone="onLight" size="sm" />
      <span>Casting call</span>
    </div>
  );
}
