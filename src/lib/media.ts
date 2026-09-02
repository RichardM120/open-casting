/** The authenticated route that serves an applicant's file. Blobs are private. */
export function mediaSrc(url: string): string {
  return `/api/media?u=${encodeURIComponent(url)}`;
}
