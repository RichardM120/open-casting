/** The authenticated route that serves an applicant's file. Blobs are private. */
export function mediaSrc(url: string): string {
  return `/api/media?u=${encodeURIComponent(url)}`;
}

/**
 * The route that serves a casting call's header image or logo. The store is
 * private and the page's policy allows images from this origin only, so the
 * picture is never shown by its own address.
 */
export function heroSrc(url: string): string {
  return `/api/hero?u=${encodeURIComponent(url)}`;
}
