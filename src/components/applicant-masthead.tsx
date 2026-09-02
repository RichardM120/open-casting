import { Logo } from "./logo";

/**
 * The top of an applicant's page: the casting call's own image when it has
 * one, full width and never taller than a phone screen's third, or else the
 * mark, small, so the page is still plainly somebody's.
 */
export function ApplicantMasthead({ heroUrl, name }: { heroUrl: string | null; name: string }) {
  if (heroUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a public blob chosen by the casting director
      <img
        src={heroUrl}
        alt={`${name} header image`}
        className="mb-8 max-h-72 w-full rounded-2xl border border-line object-cover"
      />
    );
  }
  return (
    <div className="mb-8 flex items-center gap-2.5 text-sm font-medium text-muted">
      <Logo tone="onLight" size="sm" />
      <span>Casting call</span>
    </div>
  );
}
