"use client";

import { useEffect, useRef, useState } from "react";

import { mediaSrc } from "@/lib/media";

/**
 * An applicant's photo, or their initials where there is none.
 *
 * Photos are private blobs read back through /api/media, which checks who is
 * asking. The fallback is the applicant's initials on a plain ground, in the
 * same shape as a photo so a list reads the same either way. Two kinds, told
 * apart by their label: a submission that came with no photo, and a photo
 * that could not be fetched, so a missing file or a store that is down shows
 * as that rather than as a broken image.
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
  const shape = size === "sm" ? "size-10 rounded-lg text-sm" : "size-16 rounded-xl text-xl";

  // A photo that failed before React took over the page has already fired
  // its error event, so the handler below never hears it. A complete image
  // with no width is that case.
  useEffect(() => {
    const element = image.current;
    if (element && element.complete && element.naturalWidth === 0) setFailed(true);
  }, []);

  if (!url) return <Initials shape={shape} name={name} kind="none" label="No photo submitted" />;
  if (failed) {
    return <Initials shape={shape} name={name} kind="unavailable" label="Photo not available" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our own authenticated route
    <img
      ref={image}
      src={mediaSrc(url)}
      alt={`${name}'s photo`}
      onError={() => setFailed(true)}
      className={`${shape} shrink-0 border border-line bg-surface object-cover`}
    />
  );
}

/** The first letters of the first two words of a name, or a dash for an empty one. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "–";
}

function Initials({
  shape,
  name,
  kind,
  label,
}: {
  shape: string;
  name: string;
  kind: "none" | "unavailable";
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-photo={kind}
      className={`${shape} inline-flex shrink-0 items-center justify-center border border-line bg-surface font-semibold tracking-wide text-brand select-none`}
    >
      {initials(name)}
    </span>
  );
}
