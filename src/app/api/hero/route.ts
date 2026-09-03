import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { isStoredHeroUrl, storeAuth, uploadsEnabled } from "@/lib/blob";

export const dynamic = "force-dynamic";

/**
 * Serves a casting call's header image or logo. The store is private, so a
 * browser cannot load the file by its own address; this route fetches it and
 * streams it from this origin, which is also the only origin the page's
 * Content Security Policy lets an image come from.
 *
 * There is no viewer check, because there is nothing to check against: the
 * picture sits on a page open to anyone holding the casting call's link, and
 * its address, with the store's random suffix, appears nowhere but on that
 * page. What the route does insist on is that the file is one of ours, under
 * an account's hero folder; anything else is a 404, the same answer as for a
 * file that is not there. The response may be cached, since a replaced picture
 * has a new address, and it carries a policy of its own so that an SVG opened
 * directly runs nothing on this origin.
 */
export async function GET(request: Request) {
  if (!uploadsEnabled()) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url).searchParams.get("u");
  if (!url || !isStoredHeroUrl(url)) return new NextResponse(null, { status: 404 });

  let file: Awaited<ReturnType<typeof get>>;
  try {
    file = await get(url, { ...storeAuth(), access: "private" });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!file || !file.stream) return new NextResponse(null, { status: 404 });

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = file.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "public, max-age=3600, s-maxage=86400");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  return new NextResponse(file.stream, { status: 200, headers });
}
