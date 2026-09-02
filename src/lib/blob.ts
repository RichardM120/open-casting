import "server-only";

import { del, get, list, put } from "@vercel/blob";

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

/**
 * The image across the top of a casting call's applicant page. Public, since
 * the page it sits on is open to anyone holding the link; sized for a banner.
 */
export const HERO = {
  label: "Header image",
  maxBytes: 8 * 1024 * 1024,
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Where an account's header images live. The upload route checks the prefix. */
export function heroPrefix(userId: string): string {
  return `calls/${userId}/hero/`;
}

/** Whether a header image URL is one this store issued for this account. */
export function isHeroUrl(url: string, userId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return false;
  return parsed.pathname.slice(1).startsWith(heroPrefix(userId));
}

/**
 * The store's token. Vercel calls it BLOB_READ_WRITE_TOKEN unless a prefix was
 * chosen when the store was connected to the project, in which case it is
 * SOMETHING_READ_WRITE_TOKEN with the same shape of value. Either will do;
 * the SDK is told which explicitly rather than left to look for the default.
 */
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    const candidate = value?.trim();
    if (key.endsWith("_READ_WRITE_TOKEN") && candidate?.startsWith("vercel_blob_rw_")) {
      return candidate;
    }
  }
  return undefined;
}

/** Whether a store is configured. Without one the form simply does not offer uploads. */
export function uploadsEnabled(): boolean {
  return Boolean(blobToken());
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

/** What a store check found. */
export type StoreCheck = { ok: true; pathname: string; ms: number } | { ok: false; error: string };

/**
 * Proves the store works from this deployment, end to end: writes a small
 * private file, reads it back, and deletes it. The write is the snippet the
 * Vercel dashboard offers when a store is connected; the read and the delete
 * are what the app itself does with a submission. The file goes under checks/,
 * never under submissions/, so the media route and the orphan sweep never see
 * it, and it is deleted whether or not the read-back succeeds.
 */
export async function checkStore(): Promise<StoreCheck> {
  if (!uploadsEnabled()) {
    return { ok: false, error: "No store is connected: BLOB_READ_WRITE_TOKEN is not set." };
  }
  const started = Date.now();
  const token = blobToken();
  try {
    const blob = await put(`checks/${started}.txt`, "Hello World!", {
      access: "private",
      addRandomSuffix: true,
      contentType: "text/plain",
      token,
    });
    try {
      const read = await get(blob.url, { access: "private", token, useCache: false });
      const text = read?.stream ? await new Response(read.stream).text() : null;
      if (text !== "Hello World!") {
        return {
          ok: false,
          error: `Wrote the file but read back ${text === null ? "nothing" : "something else"}.`,
        };
      }
    } finally {
      await del(blob.url, { token });
    }
    return { ok: true, pathname: blob.pathname, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The store refused the request.",
    };
  }
}

/** How many URLs go to the store in one delete call. */
const DELETE_BATCH = 100;

/** Removes the files behind a set of submissions. Missing ones are not an error. */
export async function deleteMedia(urls: Array<string | null | undefined>): Promise<void> {
  const real = urls.filter((url): url is string => Boolean(url));
  if (real.length === 0 || !uploadsEnabled()) return;
  try {
    for (let start = 0; start < real.length; start += DELETE_BATCH) {
      await del(real.slice(start, start + DELETE_BATCH), { token: blobToken() });
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
      const page = await list({ prefix: MEDIA_ROOT, cursor, limit: 1000, token: blobToken() });
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
