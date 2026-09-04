import "server-only";

import { del, get, list, put } from "@vercel/blob";
import { getVercelOidcTokenSync } from "@vercel/oidc";

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
 * The image on a casting call's applicant page, a banner or a logo. Private
 * like everything else in the store, and read back through /api/hero, which
 * checks only that the file is one of ours: the page it sits on is open to
 * anyone holding the link. The browser shrinks a picture to 1600px and WebP
 * before it is sent, so the limit here is a backstop for a browser that could
 * not; SVG is small and scales itself.
 */
export const HERO = {
  label: "Header image or logo",
  maxBytes: 4 * 1024 * 1024,
  contentTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
} as const;

/** Where an account's header images live. The upload route checks the prefix. */
export function heroPrefix(userId: string): string {
  return `calls/${userId}/hero/`;
}

/** The pathname within the store, when the URL is a store's; otherwise null. */
function storePathname(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return null;
  return parsed.pathname.slice(1);
}

/** Whether a header image URL is one this store issued for this account. */
export function isHeroUrl(url: string, userId: string): boolean {
  return storePathname(url)?.startsWith(heroPrefix(userId)) ?? false;
}

/** Whether a URL is a header image this store issued for any account. */
export function isStoredHeroUrl(url: string): boolean {
  const path = storePathname(url);
  return path !== null && /^calls\/[^/]+\/hero\/.+$/.test(path);
}

/**
 * How this deployment reaches the store. Vercel connects a store to a project
 * in one of two ways, and either will do. The older puts a read-write token in
 * the environment, BLOB_READ_WRITE_TOKEN, or PREFIX_READ_WRITE_TOKEN when a
 * prefix was chosen on connecting. The current one puts only the store's id
 * there, BLOB_STORE_ID, and the deployment signs in as itself, with the
 * identity token Vercel gives every request once OIDC federation is on for
 * the project. The SDK is told which explicitly rather than left to look for
 * defaults a prefix would hide.
 */
export type StoreAccess =
  | { kind: "token"; variable: string; token: string }
  | { kind: "identity"; variable: string; storeId: string };

/** The first variable named exactly `name`, or ending in `suffix` with a value of the right shape. */
function variable(
  name: string,
  suffix: string,
  shaped: (value: string) => boolean,
): { name: string; value: string } | null {
  const direct = process.env[name]?.trim();
  if (direct) return { name, value: direct };
  for (const [key, raw] of Object.entries(process.env)) {
    const value = raw?.trim();
    if (key.endsWith(suffix) && value && shaped(value)) return { name: key, value };
  }
  return null;
}

/** Whether Vercel handed this request an identity token to sign in to the store with. */
function identityAvailable(): boolean {
  try {
    return getVercelOidcTokenSync().length > 0;
  } catch {
    return false;
  }
}

function storeIdVariable() {
  return variable("BLOB_STORE_ID", "_STORE_ID", (value) => value.startsWith("store_"));
}

export function storeAccess(): StoreAccess | null {
  const token = variable("BLOB_READ_WRITE_TOKEN", "_READ_WRITE_TOKEN", (value) =>
    value.startsWith("vercel_blob_rw_"),
  );
  if (token) return { kind: "token", variable: token.name, token: token.value };
  const id = storeIdVariable();
  if (id && identityAvailable()) return { kind: "identity", variable: id.name, storeId: id.value };
  return null;
}

/** The credentials to spread into every SDK call. */
export function storeAuth(): { token: string } | { storeId: string } | undefined {
  const access = storeAccess();
  if (!access) return undefined;
  return access.kind === "token" ? { token: access.token } : { storeId: access.storeId };
}

/** Whether a store is configured. Without one the form simply does not offer uploads. */
export function uploadsEnabled(): boolean {
  return storeAccess() !== null;
}

/**
 * The store's state in words, for /api/health and the Admin overview: which
 * way in was found, or, when a store id is set but no identity reached this
 * deployment, what to turn on.
 */
export function describeStore(): string {
  const access = storeAccess();
  if (access?.kind === "token") return `read-write token in ${access.variable}`;
  if (access?.kind === "identity") {
    return `store ${access.variable}, reached with the deployment's own identity`;
  }
  const id = storeIdVariable();
  if (id) {
    return `${id.name} is set, but no identity token reached this deployment, so it cannot sign in to the store: turn on OIDC federation under the project's security settings, or add a read-write token as BLOB_READ_WRITE_TOKEN, then redeploy`;
  }
  return "not connected";
}

/** A private file read back: its bytes and the headers that describe them. */
export type BlobRead = {
  stream: ReadableStream<Uint8Array>;
  headers: { get(name: string): string | null };
};

/**
 * Reads a private file back, or null when the store has nothing at that
 * address. A Range header is passed through so a video player can seek, and
 * `fresh` reads past any cache, for a file written a moment ago. On a
 * deployment this is the SDK's get, signed as storeAuth() says. The SDK will
 * only read from a real Vercel host, and the test harness has no store, so
 * with BLOB_READ_BASE set the same pathname is fetched from that base instead:
 * the harness's stand-in store. It is never set on a deployment.
 */
export async function readBlob(
  url: string,
  { range, fresh = false }: { range?: string | null; fresh?: boolean } = {},
): Promise<BlobRead | null> {
  const path = storePathname(url);
  if (path === null) return null;
  const base = process.env.BLOB_READ_BASE?.trim();
  if (base) {
    const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
      headers: range ? { range } : undefined,
    });
    if (!response.ok || !response.body) return null;
    return { stream: response.body, headers: response.headers };
  }
  const file = await get(url, {
    ...storeAuth(),
    access: "private",
    useCache: fresh ? false : undefined,
    headers: range ? { range } : undefined,
  });
  if (!file || !file.stream) return null;
  return { stream: file.stream, headers: file.headers };
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
  return storePathname(url)?.startsWith(mediaPrefix(sessionId, roleId, kind)) ?? false;
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
    return { ok: false, error: `No store is connected: ${describeStore()}.` };
  }
  const started = Date.now();
  const auth = storeAuth();
  try {
    const blob = await put(`checks/${started}.txt`, "Hello World!", {
      ...auth,
      access: "private",
      addRandomSuffix: true,
      contentType: "text/plain",
    });
    try {
      const read = await readBlob(blob.url, { fresh: true });
      const text = read?.stream ? await new Response(read.stream).text() : null;
      if (text !== "Hello World!") {
        return {
          ok: false,
          error: `Wrote the file but read back ${text === null ? "nothing" : "something else"}.`,
        };
      }
    } finally {
      await del(blob.url, { ...auth });
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
      await del(real.slice(start, start + DELETE_BATCH), { ...storeAuth() });
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
      const page = await list({ ...storeAuth(), prefix: MEDIA_ROOT, cursor, limit: 1000 });
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

/** What the store holds under one prefix: how many files and how many bytes. */
export type StoreSlice = { files: number; bytes: number };

/** Everything the store holds, split by what it is. */
export type StoreUsage = {
  heroes: StoreSlice;
  photos: StoreSlice;
  videos: StoreSlice;
  /** Anything under neither prefix: nothing writes here, so it should stay empty. */
  other: StoreSlice;
  total: StoreSlice;
  /** The oldest and newest file, so a store that stopped being written to shows it. */
  oldest: string | null;
  newest: string | null;
};

const EMPTY_SLICE = (): StoreSlice => ({ files: 0, bytes: 0 });

/**
 * What the store is holding, counted by walking it. There is no size figure to
 * ask for, so the pages are listed and added up; the store is small by design
 * (a photo and up to three tapes per submission, deleted with them) and this
 * runs on an admin page nobody loads in a loop.
 */
export async function storeUsage(): Promise<StoreUsage | null> {
  if (!uploadsEnabled()) return null;

  const usage: StoreUsage = {
    heroes: EMPTY_SLICE(),
    photos: EMPTY_SLICE(),
    videos: EMPTY_SLICE(),
    other: EMPTY_SLICE(),
    total: EMPTY_SLICE(),
    oldest: null,
    newest: null,
  };

  try {
    let cursor: string | undefined;
    do {
      const page = await list({ ...storeAuth(), cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const slice = blob.pathname.startsWith("calls/")
          ? usage.heroes
          : /^submissions\/[^/]+\/[^/]+\/photo\//.test(blob.pathname)
            ? usage.photos
            : /^submissions\/[^/]+\/[^/]+\/video\//.test(blob.pathname)
              ? usage.videos
              : usage.other;
        slice.files += 1;
        slice.bytes += blob.size;
        usage.total.files += 1;
        usage.total.bytes += blob.size;

        const at = blob.uploadedAt.toISOString();
        if (usage.oldest === null || at < usage.oldest) usage.oldest = at;
        if (usage.newest === null || at > usage.newest) usage.newest = at;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[blob] could not measure the store", error);
    return null;
  }

  return usage;
}

/**
 * Files under submissions/ that no submission row points at. The nightly sweep
 * deletes these; counting them here says whether it is keeping up, without
 * deleting anything itself.
 */
export async function countOrphanedMedia(referencedUrls: Iterable<string>): Promise<number | null> {
  if (!uploadsEnabled()) return null;

  const referenced = new Set<string>();
  for (const url of referencedUrls) {
    try {
      referenced.add(new URL(url).pathname.slice(1));
    } catch {
      // Not a URL, so not a file in the store either.
    }
  }

  try {
    let cursor: string | undefined;
    let orphans = 0;
    do {
      const page = await list({ ...storeAuth(), prefix: MEDIA_ROOT, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (!referenced.has(blob.pathname)) orphans += 1;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return orphans;
  } catch (error) {
    console.error("[blob] could not count orphaned media", error);
    return null;
  }
}
