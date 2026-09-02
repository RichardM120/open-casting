/**
 * An applicant's photo, or the placeholder that says none was submitted.
 *
 * Photos are private blobs read back through /api/media, which checks who is
 * asking. The placeholder is a plain silhouette rather than initials, so a
 * list reads the same whether or not a photo came in, and it says so to a
 * screen reader rather than pretending to be a picture of the person.
 */
export function ProfilePhoto({
  url,
  name,
  size = "md",
}: {
  url: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const shape = size === "sm" ? "size-10 rounded-lg" : "size-16 rounded-xl";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- our own authenticated route
      <img
        src={mediaSrc(url)}
        alt={`${name}'s photo`}
        className={`${shape} shrink-0 border border-line bg-raised object-cover`}
      />
    );
  }
  return (
    <svg
      role="img"
      aria-label="No photo submitted"
      data-photo="none"
      viewBox="0 0 64 64"
      className={`${shape} shrink-0 border border-line bg-raised text-faint`}
    >
      <title>No photo submitted</title>
      <circle cx="32" cy="24" r="11" fill="currentColor" />
      <path d="M12 58c1-13 9-20 20-20s19 7 20 20z" fill="currentColor" />
    </svg>
  );
}

/** The authenticated route that serves an applicant's file. Blobs are private. */
export function mediaSrc(url: string): string {
  return `/api/media?u=${encodeURIComponent(url)}`;
}
