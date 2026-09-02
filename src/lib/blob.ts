import "server-only";

import { del, list } from "@vercel/blob";

/**
 * Applicant media: a profile photo and a video, uploaded straight from the
 * browser to Vercel Blob rather than through a server action, because a video
 * is far larger than a function body may carry.
 *
 * Blobs are private. A casting tape is personal data, sometimes of a child,
 * and an unguessable public URL is still a URL anyone holding it can open.
 * The dashboard reads them through /api/media, which checks who is asking.
 */

export const MEDIA_KINDS = {
  photo: {
    label: "Profile photo",
    maxBytes: 5 * 1024 * 1024,
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  },
  video: {
    label: "Video",
    maxBytes: 200 * 1024 * 1024,
    contentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
  },
} as const;

export type MediaKind = keyof typeof MEDIA_KINDS;

/** Whether a store is configured. Without one the form simply does not offer uploads. */
export function uploadsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Everything applicants upload lives under here. */
export const MEDIA_ROOT = "submissions/";

/** Where a submission's files live. The prefix is what the upload route checks. */
export function mediaPrefix(sessionId: string, roleId: string, kind: MediaKind): string {
  return `${MEDIA_ROOT}${sessionId}/${roleId}/${kind}/`;
}

/**
 * Whether a URL the form posted back is one this deployment's store issued for
 * this role. A form can post any string, so the pathname is checked against
 * the prefix the token was minted for before it is stored against anybody.
 */
export function isSubmissionMediaUrl(
  url: string,
  sessionId: string,
  roleId: string,
  kind: MediaKind,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return false;
  return parsed.pathname.slice(1).startsWith(mediaPrefix(sessionId, roleId, kind));
}

/** How many URLs go to the store in one delete call. */
const DELETE_BATCH = 100;

/** Removes the files behind a set of submissions. Missing ones are not an error. */
export async function deleteMedia(urls: Array<string | null | undefined>): Promise<void> {
  const real = urls.filter((url): url is string => Boolean(url));
  if (real.length === 0 || !uploadsEnabled()) return;
  try {
    for (let start = 0; start < real.length; start += DELETE_BATCH) {
      await del(real.slice(start, start + DELETE_BATCH));
    }
  } catch (error) {
    // The rows are gone either way; a file left behind is a cost, not a leak,
    // and is worth a log line rather than a failed request.
    console.error("[blob] could not delete media", error);
  }
}

/** A file is an orphan once it has waited this long for a form that never came. */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Removes files no submission refers to. A file goes to the store before the
 * form is sent, so anyone who uploads and then closes the tab, or whose
 * submission is refused and who picks a different file, leaves one behind.
 * The retention cron runs this daily with every URL the database still holds.
 *
 * Files are matched by pathname rather than URL, so the comparison does not
 * depend on the store writing a URL the same way twice. Anything younger than
 * a day is left alone: its form may still be on the way.
 */
export async function sweepOrphanedMedia(referencedUrls: Iterable<string>): Promise<number> {
  if (!uploadsEnabled()) return 0;

  const referenced = new Set<string>();
  for (const url of referencedUrls) {
    try {
      referenced.add(new URL(url).pathname.slice(1));
    } catch {
      // Not a URL, so not a file in the store either.
    }
  }

  const cutoff = Date.now() - ORPHAN_AGE_MS;
  const orphans: string[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: MEDIA_ROOT, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (referenced.has(blob.pathname)) continue;
        if (blob.uploadedAt.getTime() > cutoff) continue;
        orphans.push(blob.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[blob] could not list media for the orphan sweep", error);
    return 0;
  }

  await deleteMedia(orphans);
  return orphans.length;
}
