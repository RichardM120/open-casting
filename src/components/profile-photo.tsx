"use client";

import { useEffect, useRef, useState } from "react";

import { mediaSrc } from "@/lib/media";

/**
 * An applicant's photo, or the placeholder that says why there is none.
 *
 * Photos are private blobs read back through /api/media, which checks who is
 * asking. Two placeholders, both a plain silhouette rather than initials so a
 * list reads the same either way: one for a submission that came with no
 * photo, and one for a photo that could not be fetched, so a missing file or
 * a store that is down shows as that rather than as a broken image.
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
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const shape = size === "sm" ? "size-10 rounded-lg" : "size-16 rounded-xl";

  // A photo that failed before React took over the page has already fired
  // its error event, so the handler below never hears it. A complete image
  // with no width is that case.
  useEffect(() => {
    const element = image.current;
    if (element && element.complete && element.naturalWidth === 0) setFailed(true);
  }, []);

  if (!url) return <Placeholder shape={shape} kind="none" label="No photo submitted" />;
  if (failed) return <Placeholder shape={shape} kind="unavailable" label="Photo not available" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our own authenticated route
    <img
      ref={image}
      src={mediaSrc(url)}
      alt={`${name}'s photo`}
      onError={() => setFailed(true)}
      className={`${shape} shrink-0 border border-line bg-raised object-cover`}
    />
  );
}

function Placeholder({
  shape,
  kind,
  label,
}: {
  shape: string;
  kind: "none" | "unavailable";
  label: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      data-photo={kind}
      viewBox="0 0 64 64"
      className={`${shape} shrink-0 border border-line bg-raised text-faint`}
    >
      <title>{label}</title>
      <circle cx="32" cy="24" r="11" fill="currentColor" />
      <path d="M12 58c1-13 9-20 20-20s19 7 20 20z" fill="currentColor" />
    </svg>
  );
}
